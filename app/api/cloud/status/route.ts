import { NextResponse } from 'next/server';

import { auth0, isAuth0Configured } from '@/lib/auth0';
import { getSnapTradeCredentialStatus, isCredentialStorageConfigured } from '@/lib/cloud/credentials';

// Credentials are read per request: a build-time snapshot would report the cloud
// path as unavailable on any host that injects env at runtime.
export const dynamic = 'force-dynamic';

export async function GET() {
  const authEnabled = isAuth0Configured();
  const databaseEnabled = isCredentialStorageConfigured();
  if (!authEnabled) {
    return NextResponse.json({
      provider: 'snaptrade',
      available: false,
      authenticated: false,
      configured: false,
      authEnabled,
      databaseEnabled,
      reason: 'Auth0 is not configured on this deployment.',
    });
  }

  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return NextResponse.json({
      provider: 'snaptrade',
      available: false,
      authenticated: false,
      configured: false,
      authEnabled,
      databaseEnabled,
      reason: 'Sign in to use cloud sync.',
    });
  }

  if (!databaseEnabled) {
    return NextResponse.json({
      provider: 'snaptrade',
      available: false,
      authenticated: true,
      configured: false,
      authEnabled,
      databaseEnabled,
      user: { name: session.user.name ?? null, email: session.user.email ?? null },
      reason: 'DATABASE_URL or CREDENTIAL_ENCRYPTION_KEY is not configured.',
    });
  }

  try {
    const credential = await getSnapTradeCredentialStatus(String(session.user.sub));

    return NextResponse.json({
      provider: 'snaptrade',
      available: credential.configured,
      authenticated: true,
      configured: credential.configured,
      authEnabled,
      databaseEnabled,
      maskedClientId: credential.maskedClientId,
      credentialUpdatedAt: credential.updatedAt,
      user: { name: session.user.name ?? null, email: session.user.email ?? null },
      reason: credential.configured ? null : 'Add your SnapTrade Personal API credentials below.',
    });
  } catch (error) {
    return NextResponse.json({
      provider: 'snaptrade',
      available: false,
      authenticated: true,
      configured: false,
      authEnabled,
      databaseEnabled,
      reason: error instanceof Error ? error.message : 'Could not read credential storage.',
    });
  }
}
