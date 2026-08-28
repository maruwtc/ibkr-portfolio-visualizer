import { NextResponse } from 'next/server';

import { auth0 } from '@/lib/auth0';
import { getSnapTradeConfig, isCredentialStorageConfigured } from '@/lib/cloud/credentials';

import {
  accountActivityPages,
  accountBalances,
  accountPositions,
  listAccounts,
  listAuthorizations,
} from '@/lib/snaptrade/client';
import { mapAccounts, type SnapTradeAccountBundle } from '@/lib/snaptrade/map';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type SnapTradeJson = SnapTradeAccountBundle['account'];

/**
 * Shortest gap between the statement snapshots pushed while activity is still
 * arriving. Every snapshot carries the whole statement, so emitting one per page
 * would grow quadratically on a long history; the client stays responsive on far
 * fewer than that.
 */
const SNAPSHOT_INTERVAL_MS = 1_500;

/**
 * How many of those interim snapshots are worth sending. Their value decays quickly —
 * once the ledger is visibly filling, further redraws are churn — while their cost
 * does not, since each one restates the whole history fetched so far.
 */
const MAX_INTERIM_SNAPSHOTS = 8;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'failed';
}

/**
 * Streams a sync as newline-delimited JSON.
 *
 * A full sync is several round trips deep — accounts, then balances and positions,
 * then however many pages of activity the history runs to — and holding the response
 * until the last page lands leaves the workspace blank for all of it. Holdings alone
 * are enough to draw the portfolio, so they go out as soon as they exist and the
 * ledger fills in behind them.
 *
 * Each `statement` event is a complete, self-consistent snapshot of everything
 * fetched so far, so the client can simply apply the most recent one and never has to
 * merge deltas itself.
 */
export async function POST(req: Request) {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return NextResponse.json({ error: 'Sign in to use cloud sync.' }, { status: 401 });
  }
  if (!isCredentialStorageConfigured()) {
    return NextResponse.json({ error: 'Credential storage is not configured on this server.' }, { status: 503 });
  }

  const cfg = await getSnapTradeConfig(String(session.user.sub));
  if (!cfg) {
    return NextResponse.json({ error: 'Add your SnapTrade credentials before syncing.' }, { status: 412 });
  }

  const body: Record<string, unknown> = await req.json().catch(() => ({}));
  // No default window: SnapTrade returns its full holdings, first transaction to last,
  // when neither bound is given. A caller may still ask for a slice.
  const startDate = typeof body?.startDate === 'string' ? body.startDate : undefined;
  const endDate = typeof body?.endDate === 'string' ? body.endDate : undefined;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      const failures: string[] = [];
      const bundles: SnapTradeAccountBundle[] = [];

      /** Builds the statement from whatever has arrived, with the notes it has earned. */
      const snapshot = (isIbkr: boolean) => {
        const statement = mapAccounts(bundles);

        const dates = statement.transactions.map((t) => t.date).filter(Boolean).sort();
        const requested = startDate || endDate ? `${startDate ?? 'first'} → ${endDate ?? 'last'}` : 'all available history';
        statement.notes.unshift(
          dates.length
            ? `Activity requested: ${requested}; broker returned ${dates[0]} → ${dates[dates.length - 1]}.`
            : `Activity requested: ${requested}; broker returned no activity.`
        );

        /**
         * Stated as a standing fact rather than inferred from the span.
         *
         * SnapTrade reaches IBKR through Flex, and a Flex export covers at most 365
         * days, so its history begins one year before the connection date and grows
         * forward from there — the span passes a year as the connection ages while
         * everything before that start stays permanently out of reach. A span
         * threshold would go quiet at exactly the wrong moment.
         */
        if (isIbkr && dates.length) {
          statement.notes.push(
            'Interactive Brokers limits a Flex export to 365 days, so SnapTrade holds IBKR history from one year before the connection date onward, growing forward from there. Anything earlier is only available by uploading a statement in Local mode.'
          );
        }

        for (const f of failures) statement.notes.push(`Partial sync: ${f}`);
        return statement;
      };

      try {
        const [connections, accounts] = await Promise.all([
          listAuthorizations(cfg).catch(() => [] as SnapTradeJson[]),
          listAccounts(cfg),
        ]);

        const accountList = Array.isArray(accounts) ? accounts : [];

        send({
          kind: 'meta',
          accounts: accountList.map((a: SnapTradeJson) => ({
            id: String(a?.id ?? ''),
            name: a?.name ?? a?.number ?? 'Account',
            institution: a?.institution_name ?? '',
            currency: a?.balance?.total?.currency ?? null,
            total: a?.balance?.total?.amount ?? null,
          })),
          connections: (Array.isArray(connections) ? connections : []).map((c: SnapTradeJson) => ({
            id: String(c?.id ?? ''),
            brokerage: c?.brokerage?.display_name || c?.brokerage?.name || c?.name || 'Brokerage',
            disabled: !!c?.disabled,
            updatedAt: c?.updated_date ?? null,
          })),
        });

        if (!accountList.length) {
          send({ kind: 'error', message: 'No brokerage account is connected yet.' });
          return;
        }

        const isIbkr = accountList.some((a: SnapTradeJson) => /interactive/i.test(String(a?.institution_name ?? '')));

        // Holdings first: they are what the portfolio view needs, and they cost one
        // round trip per account rather than one per page of history.
        for (const account of accountList) {
          const id = String(account?.id ?? '');
          if (!id) continue;

          const [balances, positions] = await Promise.all([
            accountBalances(cfg, id).catch((error: unknown) => {
              failures.push(`balances (${errorMessage(error)})`);
              return [] as SnapTradeJson[];
            }),
            accountPositions(cfg, id).catch((error: unknown) => {
              failures.push(`positions (${errorMessage(error)})`);
              return [] as SnapTradeJson[];
            }),
          ]);

          bundles.push({
            account,
            balances: Array.isArray(balances) ? balances : [],
            positions: Array.isArray(positions) ? positions : [],
            activities: [],
          });
        }

        send({ kind: 'stage', stage: 'holdings' });
        send({ kind: 'statement', statement: snapshot(isIbkr) });

        let activityCount = 0;
        let lastSnapshot = Date.now();
        let interimSnapshots = 0;

        for (const bundle of bundles) {
          const id = String(bundle.account?.id ?? '');
          if (!id) continue;

          try {
            for await (const page of accountActivityPages(cfg, id, { startDate, endDate })) {
              bundle.activities.push(...page);
              activityCount += page.length;
              send({ kind: 'stage', stage: 'activities', count: activityCount });

              if (interimSnapshots < MAX_INTERIM_SNAPSHOTS && Date.now() - lastSnapshot >= SNAPSHOT_INTERVAL_MS) {
                lastSnapshot = Date.now();
                interimSnapshots++;
                send({ kind: 'statement', statement: snapshot(isIbkr) });
              }
            }
          } catch (error: unknown) {
            failures.push(`activities (${errorMessage(error)})`);
          }
        }

        send({ kind: 'statement', statement: snapshot(isIbkr) });
        send({ kind: 'done', syncedAt: Date.now() });
      } catch (error: unknown) {
        // The status code is already spent by the time the stream opens, so a failure
        // mid-flight has to travel as an event.
        send({ kind: 'error', message: error instanceof Error ? error.message : 'Cloud sync failed' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      // Tells nginx-style proxies not to buffer the whole body before forwarding.
      'X-Accel-Buffering': 'no',
    },
  });
}
