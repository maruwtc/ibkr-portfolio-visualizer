import { NextResponse } from 'next/server';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const LMSTUDIO_URL = process.env.LMSTUDIO_URL || 'http://localhost:1234';

async function probe(url: string) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 1200);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

export async function GET() {
  const [ollama, lmstudio] = await Promise.all([
    probe(`${OLLAMA_URL}/api/tags`),
    probe(`${LMSTUDIO_URL}/v1/models`),
  ]);

  return NextResponse.json({ ollama, lmstudio });
}
