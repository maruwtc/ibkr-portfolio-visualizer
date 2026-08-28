/**
 * Reads a newline-delimited JSON stream, handing each value to `onValue` as it lands.
 *
 * Chunks arrive on network boundaries, not line boundaries: a single JSON object is
 * routinely split across two reads, and a multi-byte character across three. The
 * trailing partial line is therefore held back until more bytes arrive, and the
 * decoder is kept in streaming mode so it can reassemble split code points.
 */
export async function readNdjson(
  body: ReadableStream<Uint8Array>,
  onValue: (value: any) => void
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    // Whatever follows the last newline may be half a line; it waits for more bytes.
    buffer = lines.pop() ?? '';

    for (const line of lines) if (line.trim()) onValue(JSON.parse(line));
  }

  // Flush any bytes the decoder was still holding, then the final unterminated line.
  buffer += decoder.decode();
  if (buffer.trim()) onValue(JSON.parse(buffer));
}
