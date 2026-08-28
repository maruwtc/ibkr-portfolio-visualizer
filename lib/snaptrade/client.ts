import crypto from 'node:crypto';

/**
 * Minimal server-side SnapTrade REST client.
 *
 * SnapTrade signs every request rather than using a bearer token: the consumer key
 * never leaves the server, and the signature covers the path, the query string and
 * the body, so this file is the only place that may run outside the browser. The
 * official SDK does the same thing; it is not used here to keep the cloud path from
 * pulling a dependency into an app that is otherwise offline-only.
 */

const BASE_URL = process.env.SNAPTRADE_BASE_URL || 'https://api.snaptrade.com/api/v1';

export type SnapTradeConfig = {
  clientId: string;
  consumerKey: string;
};

export class SnapTradeError extends Error {
  status: number;
  detail?: unknown;

  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.name = 'SnapTradeError';
    this.status = status;
    this.detail = detail;
  }
}

/** Returns null when the deployment has no SnapTrade credentials, which is the default. */
type Query = Record<string, string | number | undefined | null>;

/**
 * The signed string has to match the request byte for byte, so the query is built
 * once, in sorted order, and reused for both the signature and the URL.
 */
function buildQueryString(query: Query): string {
  const entries = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => [k, String(v)] as const)
    .sort((a, b) => a[0].localeCompare(b[0]));

  return entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

/** SnapTrade requires object keys to be sorted alphabetically at every nesting level. */
function canonicalJson(value: unknown): string {
  const keys = new Set<string>();
  JSON.stringify(value, (key, nested) => {
    keys.add(key);
    return nested;
  });

  return JSON.stringify(value, [...keys].sort());
}

function sign(consumerKey: string, path: string, queryString: string, body: unknown): string {
  const sigObject = { content: body ?? null, path, query: queryString };
  return crypto
    .createHmac('sha256', Buffer.from(consumerKey, 'utf-8'))
    .update(canonicalJson(sigObject))
    .digest('base64');
}

async function request<T>(
  cfg: SnapTradeConfig,
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  opts: { query?: Query; body?: unknown } = {}
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  const queryString = buildQueryString({
    ...(opts.query || {}),
    clientId: cfg.clientId,
    timestamp: Math.floor(Date.now() / 1000),
  });

  url.search = queryString;

  const signature = sign(cfg.consumerKey, url.pathname, queryString, opts.body);

  const res = await fetch(url.toString(), {
    method,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Signature: signature,
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const detail = data?.detail || data?.message || data?.code || res.statusText;

    // The credentials come from SnapTrade, but IBKR's Third-Party Reports screen shows
    // a token and Query ID of its own right next to the SnapTrade row — an easy pair to
    // reach for, and the resulting 401 says nothing about where the real keys live.
    const hint =
      res.status === 401
        ? ' — check that the SnapTrade Client ID and Consumer Key saved in Cloud settings are the Personal API credentials SnapTrade issued you, not the token / Query ID from IBKR\'s Third-Party Reports screen.'
        : '';

    throw new SnapTradeError(`SnapTrade ${method} ${path} failed (${res.status}): ${detail}${hint}`, res.status, data);
  }

  return data as T;
}

export function listAuthorizations(cfg: SnapTradeConfig) {
  return request<any[]>(cfg, 'GET', '/authorizations');
}

export function listAccounts(cfg: SnapTradeConfig) {
  return request<any[]>(cfg, 'GET', '/accounts');
}

export function accountBalances(cfg: SnapTradeConfig, accountId: string) {
  return request<any[]>(cfg, 'GET', `/accounts/${encodeURIComponent(accountId)}/balances`);
}

/**
 * `/positions` and `/holdings` both answer 410 Gone for client ids issued after
 * SnapTrade's 2026 cutovers; `/positions/all` is the surviving granular endpoint.
 * It returns `{ results, data_freshness }` rather than a bare array.
 */
export async function accountPositions(cfg: SnapTradeConfig, accountId: string): Promise<any[]> {
  const data = await request<any>(cfg, 'GET', `/accounts/${encodeURIComponent(accountId)}/positions/all`);

  if (Array.isArray(data)) return data;
  return Array.isArray(data?.results) ? data.results : [];
}

/** SnapTrade's per-request maximum. */
const ACTIVITIES_PAGE_SIZE = 1000;

/** Keeps a malformed `total` from paging forever. */
const ACTIVITIES_MAX = 50_000;

/**
 * Account activity, one page at a time.
 *
 * The user-level `/activities` route is the one SnapTrade retired (410 Gone for client
 * ids registered after April 2026). Its per-account replacement answers with
 * `{ data, pagination: { offset, limit, total } }`, newest trade date first.
 *
 * Yielding per page rather than returning the whole history lets a caller stream
 * results out while the rest is still being fetched. Omitting the date range asks
 * SnapTrade for everything it holds, from first known transaction to last.
 */
export async function* accountActivityPages(
  cfg: SnapTradeConfig,
  accountId: string,
  range: { startDate?: string; endDate?: string } = {}
): AsyncGenerator<any[], void, unknown> {
  let offset = 0;
  let fetched = 0;

  for (;;) {
    const data = await request<any>(cfg, 'GET', `/accounts/${encodeURIComponent(accountId)}/activities`, {
      query: {
        startDate: range.startDate,
        endDate: range.endDate,
        offset,
        limit: ACTIVITIES_PAGE_SIZE,
      },
    });

    const batch = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
    if (batch.length) yield batch;

    const total = Number(data?.pagination?.total);
    offset += batch.length;
    fetched += batch.length;

    if (!batch.length || !Number.isFinite(total) || offset >= total || fetched >= ACTIVITIES_MAX) break;
  }
}

/** Every page collected, for callers that have nothing useful to do with a partial set. */
export async function accountActivities(
  cfg: SnapTradeConfig,
  accountId: string,
  range: { startDate?: string; endDate?: string } = {}
): Promise<any[]> {
  const out: any[] = [];
  for await (const page of accountActivityPages(cfg, accountId, range)) out.push(...page);
  return out;
}
