'use client';

/**
 * Text extraction for uploaded PDF statements.
 *
 * pdf.js normally loads its worker from a separate asset URL, which is awkward to
 * resolve out of node_modules across dev/build. Importing the worker module and
 * exposing it as `globalThis.pdfjsWorker` makes pdf.js run the worker code on the
 * main thread instead (see PDFWorker#initialize), so nothing has to be copied or
 * fetched at runtime. Statements are a handful of pages, so the cost is fine.
 */

type PdfJs = typeof import('pdfjs-dist');

const Y_TOLERANCE = 2.2; // same-line threshold in PDF user-space units
const X_GAP = 0.8; // horizontal gap that counts as a word break

let pdfjsPromise: Promise<PdfJs> | null = null;

async function loadPdfjs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const [pdfjs, worker] = await Promise.all([
        import('pdfjs-dist'),
        import('pdfjs-dist/build/pdf.worker.min.mjs'),
      ]);
      (globalThis as unknown as { pdfjsWorker?: unknown }).pdfjsWorker = worker;
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

type Fragment = { x: number; y: number; width: number; text: string };

function joinFragments(fragments: Fragment[]): string {
  const sorted = [...fragments].sort((a, b) => a.x - b.x);
  let out = '';
  let cursor = -Infinity;

  for (const f of sorted) {
    if (out && f.x - cursor > X_GAP) out += ' ';
    out += f.text;
    cursor = f.x + f.width;
  }

  return out.replace(/\s+/g, ' ').trim();
}

function fragmentsToLines(items: unknown[]): string[] {
  const fragments: Fragment[] = [];

  for (const item of items) {
    const it = item as { str?: string; width?: number; transform?: number[] };
    if (typeof it?.str !== 'string' || !it.str.trim()) continue;
    const t = it.transform || [];
    fragments.push({
      x: Number(t[4]) || 0,
      y: Number(t[5]) || 0,
      width: Number(it.width) || 0,
      text: it.str,
    });
  }

  fragments.sort((a, b) => b.y - a.y);

  const lines: string[] = [];
  let current: Fragment[] = [];
  let currentY: number | null = null;

  for (const f of fragments) {
    if (currentY === null || Math.abs(f.y - currentY) <= Y_TOLERANCE) {
      if (currentY === null) currentY = f.y;
      current.push(f);
      continue;
    }
    lines.push(joinFragments(current));
    current = [f];
    currentY = f.y;
  }
  if (current.length) lines.push(joinFragments(current));

  return lines.filter(Boolean);
}

/** Extracts a PDF into visually-ordered text lines, one entry per rendered row. */
export async function extractPdfLines(file: File): Promise<string[]> {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());

  const doc = await pdfjs.getDocument({ data }).promise;
  const lines: string[] = [];

  try {
    for (let pageNo = 1; pageNo <= doc.numPages; pageNo++) {
      const page = await doc.getPage(pageNo);
      try {
        const content = await page.getTextContent();
        lines.push(...fragmentsToLines(content.items));
      } finally {
        page.cleanup();
      }
    }
  } finally {
    await doc.destroy();
  }

  return lines;
}
