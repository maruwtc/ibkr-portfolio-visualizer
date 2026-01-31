import { NextResponse } from 'next/server';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const LMSTUDIO_URL = process.env.LMSTUDIO_URL || 'http://localhost:1234';

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const model = body?.model;
    const messages = body?.messages;
    const provider = body?.provider || 'ollama';

    if (!model || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Missing model or messages' }, { status: 400 });
    }

    const res =
      provider === 'lmstudio'
        ? await fetch(`${LMSTUDIO_URL}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              messages,
              stream: false,
              max_tokens: 512,
            }),
          })
        : await fetch(`${OLLAMA_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              messages,
              stream: false,
              options: { num_predict: 512 },
            }),
          });

    if (!res.ok) {
      return NextResponse.json({ error: `LLM error ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    if (provider === 'lmstudio') {
      const content = data?.choices?.[0]?.message?.content || '';
      return NextResponse.json({ message: { content } });
    }
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to chat with Ollama' }, { status: 502 });
  }
}
