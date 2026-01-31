import { NextResponse } from 'next/server';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const LMSTUDIO_URL = process.env.LMSTUDIO_URL || 'http://localhost:1234';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const finalProvider = url.searchParams.get('provider') || 'ollama';

    if (finalProvider === 'lmstudio') {
      const res = await fetch(`${LMSTUDIO_URL}/v1/models`, { cache: 'no-store' });
      if (!res.ok) {
        return NextResponse.json({ models: [], error: `LM Studio error ${res.status}` }, { status: 502 });
      }
      const data = await res.json();
      const models = Array.isArray(data?.data) ? data.data.map((m: any) => m.id).filter(Boolean) : [];
      return NextResponse.json({ models });
    }

    const res = await fetch(`${OLLAMA_URL}/api/tags`, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({ models: [], error: `Ollama error ${res.status}` }, { status: 502 });
    }
    const data = await res.json();
    const models = Array.isArray(data?.models) ? data.models.map((m: any) => m.name).filter(Boolean) : [];
    return NextResponse.json({ models });
  } catch (e: any) {
    return NextResponse.json({ models: [], error: e?.message || 'Failed to reach model host' }, { status: 502 });
  }
}
