import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';

import type { SnapTradeConfig } from '@/lib/snaptrade/client';

type CredentialRow = {
  client_id: string;
  encrypted_consumer_key: string;
  updated_at: string | Date;
};

let schemaPromise: Promise<unknown> | null = null;

function databaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error('DATABASE_URL is not configured. Add a Postgres integration to the Vercel project.');
  return value;
}

function sqlClient() {
  return neon(databaseUrl());
}

async function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    const sql = sqlClient();
    schemaPromise = sql`
      CREATE TABLE IF NOT EXISTS snaptrade_credentials (
        auth0_user_id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        encrypted_consumer_key TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `.catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  await schemaPromise;
}

function encryptionKey(): Buffer {
  const encoded = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!encoded) throw new Error('CREDENTIAL_ENCRYPTION_KEY is not configured.');

  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  }
  return key;
}

function encrypt(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join('.');
}

function decrypt(value: string): string {
  const [version, iv, tag, ciphertext] = value.split('.');
  if (version !== 'v1' || !iv || !tag || !ciphertext) throw new Error('Stored credential has an invalid format.');

  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8');
}

async function credentialRow(userId: string): Promise<CredentialRow | null> {
  await ensureSchema();
  const sql = sqlClient();
  const rows = await sql`
    SELECT client_id, encrypted_consumer_key, updated_at
    FROM snaptrade_credentials
    WHERE auth0_user_id = ${userId}
    LIMIT 1
  `;
  return (rows[0] as CredentialRow | undefined) ?? null;
}

export function isCredentialStorageConfigured(): boolean {
  if (!process.env.DATABASE_URL || !process.env.CREDENTIAL_ENCRYPTION_KEY) return false;
  try {
    encryptionKey();
    return true;
  } catch {
    return false;
  }
}

export async function getSnapTradeCredentialStatus(userId: string) {
  const row = await credentialRow(userId);
  return row
    ? {
        configured: true as const,
        maskedClientId: row.client_id.length <= 4 ? '•'.repeat(row.client_id.length) : `${row.client_id.slice(0, 4)}…`,
        updatedAt: new Date(row.updated_at).toISOString(),
      }
    : { configured: false as const, maskedClientId: null, updatedAt: null };
}

export async function getSnapTradeConfig(userId: string): Promise<SnapTradeConfig | null> {
  const row = await credentialRow(userId);
  if (!row) return null;
  return { clientId: row.client_id, consumerKey: decrypt(row.encrypted_consumer_key) };
}

export async function saveSnapTradeConfig(userId: string, config: SnapTradeConfig): Promise<void> {
  await ensureSchema();
  const sql = sqlClient();
  const encrypted = encrypt(config.consumerKey);
  await sql`
    INSERT INTO snaptrade_credentials (auth0_user_id, client_id, encrypted_consumer_key)
    VALUES (${userId}, ${config.clientId}, ${encrypted})
    ON CONFLICT (auth0_user_id) DO UPDATE SET
      client_id = EXCLUDED.client_id,
      encrypted_consumer_key = EXCLUDED.encrypted_consumer_key,
      updated_at = NOW()
  `;
}

export async function deleteSnapTradeConfig(userId: string): Promise<void> {
  await ensureSchema();
  const sql = sqlClient();
  await sql`DELETE FROM snaptrade_credentials WHERE auth0_user_id = ${userId}`;
}
