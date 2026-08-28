'use client';

import { useState } from 'react';
import { Building2, Cloud, CloudOff, KeyRound, LogIn, RefreshCw, Save } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWorkspace } from './WorkspaceContext';
import { fmtMoney } from './utils';

function fmtWhen(ts: number | null): string {
  if (!ts) return 'never';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return 'unknown';
  }
}

/**
 * Cloud mode reads brokerage connections managed in the SnapTrade dashboard.
 */
export default function CloudPanel({ compact = false }: { compact?: boolean }) {
  const {
    cloudStatus,
    cloudAccounts,
    cloudConnections,
    cloudBusy,
    cloudError,
    cloudSyncedAt,
    checkCloudStatus,
    syncCloud,
  } = useWorkspace();
  const [clientId, setClientId] = useState('');
  const [consumerKey, setConsumerKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [configError, setConfigError] = useState('');

  const saveCredentials = async () => {
    setSaving(true);
    setConfigError('');
    try {
      const res = await fetch('/api/cloud/snaptrade/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, consumerKey }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Save failed (${res.status})`);
      setClientId('');
      setConsumerKey('');
      await checkCloudStatus();
    } catch (error) {
      setConfigError(error instanceof Error ? error.message : 'Could not save SnapTrade credentials.');
    } finally {
      setSaving(false);
    }
  };

  if (!cloudStatus) {
    return <div className="text-sm text-muted-foreground">Checking cloud availability…</div>;
  }

  if (!cloudStatus.authEnabled || !cloudStatus.databaseEnabled) {
    return (
      <div className="space-y-3">
        <Alert>
          <CloudOff className="size-4" />
          <AlertTitle>Cloud sync unavailable</AlertTitle>
          <AlertDescription>
            {cloudStatus.reason || 'Auth0 or database-backed credential storage is not configured.'}
          </AlertDescription>
        </Alert>
        <p className="text-xs text-muted-foreground">
          Local mode still works everywhere: upload an IBKR CSV or a Firstrade PDF and nothing leaves this device.
        </p>
      </div>
    );
  }

  if (!cloudStatus.authenticated) {
    return (
      <div className="space-y-3">
        <Alert>
          <KeyRound className="size-4" />
          <AlertTitle>Sign in for cloud sync</AlertTitle>
          <AlertDescription>
            Your login keeps each SnapTrade configuration private and separate from other users.
          </AlertDescription>
        </Alert>
        <Button asChild size="sm" className="w-full">
          <a href="/auth/login?returnTo=/portfolio">
            <LogIn className="size-3.5" />
            Sign in with Auth0
          </a>
        </Button>
      </div>
    );
  }

  const connected = cloudConnections.length > 0 || cloudAccounts.length > 0;
  const busy = cloudBusy !== '';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="gap-1">
          <Cloud className="size-3" />
          SnapTrade
        </Badge>
        <Badge variant={connected ? 'default' : 'outline'}>{connected ? 'Connected' : 'Not connected'}</Badge>
      </div>

      {!compact && (
        <p className="text-xs text-muted-foreground">
          Read-only. Manage brokerage connections in SnapTrade; this app only syncs positions, balances and activity.
        </p>
      )}

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="min-w-0 truncate">{cloudStatus.user?.email || cloudStatus.user?.name || 'Signed in'}</span>
        <a href="/auth/logout" className="shrink-0 underline underline-offset-2 hover:text-foreground">
          Sign out
        </a>
      </div>

      {!cloudStatus.configured && (
        <Alert>
          <KeyRound className="size-4" />
          <AlertTitle>Configure SnapTrade</AlertTitle>
          <AlertDescription>
            Enter your Personal API key. The consumer key is encrypted before it is stored and is never returned to the browser.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2 rounded-md border p-3">
        {cloudStatus.configured && (
          <div className="text-xs text-muted-foreground">
            Saved client: <span className="font-mono text-foreground">{cloudStatus.maskedClientId}</span>
          </div>
        )}
        <label className="block space-y-1 text-xs">
          <span className="text-muted-foreground">SnapTrade client ID</span>
          <Input
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            autoComplete="off"
            placeholder={cloudStatus.configured ? 'Enter to replace saved credentials' : 'Client ID'}
          />
        </label>
        <label className="block space-y-1 text-xs">
          <span className="text-muted-foreground">SnapTrade consumer key</span>
          <Input
            type="password"
            value={consumerKey}
            onChange={(event) => setConsumerKey(event.target.value)}
            autoComplete="new-password"
            placeholder="Consumer key"
          />
        </label>
        {configError && <p className="text-xs text-destructive">{configError}</p>}
        <Button
          size="sm"
          variant="secondary"
          className="w-full"
          onClick={saveCredentials}
          disabled={saving || !clientId.trim() || !consumerKey.trim()}
        >
          <Save className="size-3.5" />
          {saving ? 'Saving…' : cloudStatus.configured ? 'Replace credentials' : 'Save credentials'}
        </Button>
      </div>

      {cloudError && (
        <Alert variant="destructive">
          <AlertTitle>Cloud error</AlertTitle>
          <AlertDescription className="break-words">{cloudError}</AlertDescription>
        </Alert>
      )}

      {cloudConnections.length > 0 && (
        <div className="space-y-1">
          {cloudConnections.map((c) => (
            <div key={c.id} className="flex items-center gap-2 text-xs">
              <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 truncate">{c.brokerage}</span>
              {c.disabled && (
                <Badge variant="destructive" className="ml-auto shrink-0 text-[10px]">
                  needs re-auth
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}

      {cloudAccounts.length > 0 && (
        <div className="space-y-1">
          {cloudAccounts.map((a) => (
            <div key={a.id} className="flex items-baseline justify-between gap-2 text-xs">
              <span className="min-w-0 truncate text-muted-foreground">{a.name}</span>
              <span className="shrink-0 tabular-nums">
                {a.total !== null ? `${fmtMoney(a.total)} ${a.currency ?? ''}`.trim() : '—'}
              </span>
            </div>
          ))}
        </div>
      )}

      <Button size="sm" variant="outline" onClick={syncCloud} disabled={busy || !cloudStatus.configured} className="w-full">
        <RefreshCw className={cloudBusy === 'sync' ? 'size-3.5 animate-spin' : 'size-3.5'} />
        {cloudBusy === 'sync' ? 'Syncing…' : 'Sync now'}
      </Button>

      <div className="text-xs text-muted-foreground">
        <span>Last sync: {fmtWhen(cloudSyncedAt)}</span>
      </div>
    </div>
  );
}
