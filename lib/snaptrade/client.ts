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

export function accountPositions(cfg: SnapTradeConfig, accountId: string) {
  return request<any[]>(cfg, 'GET', `/accounts/${encodeURIComponent(accountId)}/positions`);
}

/**
 * Activities moved from a per-account route to a top-level one that takes an account
 * filter. Both are still served, so the newer form is tried first and the older one
 * covers accounts SnapTrade has not migrated.
 */
export async function accountActivities(
  cfg: SnapTradeConfig,
  accountId: string,
  range: { startDate?: string; endDate?: string } = {}
): Promise<any[]> {
  const query = {
    accounts: accountId,
    startDate: range.startDate,
    endDate: range.endDate,
  };

  try {
    const data = await request<any>(cfg, 'GET', '/activities', { query });
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    return [];
  } catch (e) {
    if (!(e instanceof SnapTradeError) || (e.status !== 404 && e.status !== 400)) throw e;
  }

  const legacy = await request<any>(cfg, 'GET', `/accounts/${encodeURIComponent(accountId)}/activities`, {
    query: { startDate: range.startDate, endDate: range.endDate },
  });

  return Array.isArray(legacy) ? legacy : Array.isArray(legacy?.data) ? legacy.data : [];
}
