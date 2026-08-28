import { NextResponse } from 'next/server';

import { auth0 } from '@/lib/auth0';
import { getSnapTradeConfig, isCredentialStorageConfigured } from '@/lib/cloud/credentials';

import {
  accountActivities,
  accountBalances,
  accountPositions,
  listAccounts,
  listAuthorizations,
  SnapTradeError,
} from '@/lib/snaptrade/client';
import { mapAccounts, type SnapTradeAccountBundle } from '@/lib/snaptrade/map';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Activity history pulled on a sync when the caller names no window. */
const DEFAULT_LOOKBACK_DAYS = 730;
type SnapTradeJson = SnapTradeAccountBundle['account'];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'failed';
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Pulls accounts, balances, positions and activity from every connected brokerage
 * and returns them already normalized into a `ParsedStatement`.
 *
 * The mapping runs here rather than in the browser so the client keeps one ingestion
 * path: it receives the same shape a parsed CSV produces.
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

  try {
    const body: Record<string, unknown> = await req.json().catch(() => ({}));
    const startDate = typeof body?.startDate === 'string' ? body.startDate : isoDaysAgo(DEFAULT_LOOKBACK_DAYS);
    const endDate = typeof body?.endDate === 'string' ? body.endDate : new Date().toISOString().slice(0, 10);

    const [connections, accounts] = await Promise.all([
      listAuthorizations(cfg).catch(() => [] as SnapTradeJson[]),
      listAccounts(cfg),
    ]);

    const accountList = Array.isArray(accounts) ? accounts : [];
    if (!accountList.length) {
      return NextResponse.json({
        statement: null,
        accounts: [],
        connections: [],
        error: 'No brokerage account is connected yet.',
      });
    }

    const bundles: SnapTradeAccountBundle[] = [];
    const failures: string[] = [];

    // Sequential per account: SnapTrade rate-limits per user, and a partial sync is
    // worth more than a burst that trips the limiter.
    for (const account of accountList) {
      const id = String(account?.id ?? '');
      if (!id) continue;

      const [balances, positions, activities] = await Promise.all([
        accountBalances(cfg, id).catch((error: unknown) => {
          failures.push(`balances (${errorMessage(error)})`);
          return [] as SnapTradeJson[];
        }),
        accountPositions(cfg, id).catch((error: unknown) => {
          failures.push(`positions (${errorMessage(error)})`);
          return [] as SnapTradeJson[];
        }),
        accountActivities(cfg, id, { startDate, endDate }).catch((error: unknown) => {
          failures.push(`activities (${errorMessage(error)})`);
          return [] as SnapTradeJson[];
        }),
      ]);

      bundles.push({
        account,
        balances: Array.isArray(balances) ? balances : [],
        positions: Array.isArray(positions) ? positions : [],
        activities: Array.isArray(activities) ? activities : [],
      });
    }

    const statement = mapAccounts(bundles);
    statement.notes.unshift(`Activity window ${startDate} → ${endDate}.`);
    for (const f of failures) statement.notes.push(`Partial sync: ${f}`);

    return NextResponse.json({
      statement,
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
      syncedAt: Date.now(),
    });
  } catch (error: unknown) {
    const status = error instanceof SnapTradeError ? (error.status >= 400 && error.status < 600 ? error.status : 502) : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Cloud sync failed' }, { status });
  }
}
