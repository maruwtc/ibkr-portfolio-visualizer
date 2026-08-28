import { NextResponse } from 'next/server';

import { auth0 } from '@/lib/auth0';
import {
  deleteSnapTradeConfig,
  getSnapTradeCredentialStatus,
  isCredentialStorageConfigured,
  saveSnapTradeConfig,
} from '@/lib/cloud/credentials';

export const dynamic = 'force-dynamic';

async function signedInUser() {
  const session = await auth0.getSession();
  return session?.user?.sub ? String(session.user.sub) : null;
}

export async function GET() {
  const userId = await signedInUser();
  if (!userId) return NextResponse.json({ error: 'Sign in to configure SnapTrade.' }, { status: 401 });
  if (!isCredentialStorageConfigured()) {
    return NextResponse.json({ error: 'Credential storage is not configured on this server.' }, { status: 503 });
  }

  return NextResponse.json(await getSnapTradeCredentialStatus(userId));
}

export async function PUT(req: Request) {
  const userId = await signedInUser();
  if (!userId) return NextResponse.json({ error: 'Sign in to configure SnapTrade.' }, { status: 401 });
  if (!isCredentialStorageConfigured()) {
    return NextResponse.json({ error: 'Credential storage is not configured on this server.' }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const clientId = typeof body?.clientId === 'string' ? body.clientId.trim() : '';
  const consumerKey = typeof body?.consumerKey === 'string' ? body.consumerKey.trim() : '';
  if (!clientId || !consumerKey) {
    return NextResponse.json({ error: 'Client ID and consumer key are required.' }, { status: 400 });
  }
  if (clientId.length > 256 || consumerKey.length > 2048) {
    return NextResponse.json({ error: 'Credential value is too long.' }, { status: 400 });
  }

  await saveSnapTradeConfig(userId, { clientId, consumerKey });
  return NextResponse.json(await getSnapTradeCredentialStatus(userId));
}

export async function DELETE() {
  const userId = await signedInUser();
  if (!userId) return NextResponse.json({ error: 'Sign in to configure SnapTrade.' }, { status: 401 });
  if (!isCredentialStorageConfigured()) {
    return NextResponse.json({ error: 'Credential storage is not configured on this server.' }, { status: 503 });
  }

  await deleteSnapTradeConfig(userId);
  return NextResponse.json({ configured: false });
}
