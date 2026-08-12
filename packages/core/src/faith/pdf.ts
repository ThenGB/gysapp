import { parseFaithPdfManifest, type FaithPdfManifest } from '@gysapp/contracts';
import { sha256Hex } from '../util/sha256';

const MANIFEST_URL =
  'https://raw.githubusercontent.com/ThenGB/GYSApp-Data/main/latest/faith-pdfs-manifest.json';

export async function fetchFaithPdfManifest(
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<FaithPdfManifest> {
  const res = await fetchImpl(MANIFEST_URL);
  if (!res.ok) throw new Error(`manifest fetch failed: ${res.status}`);
  return parseFaithPdfManifest(await res.json());
}

/** Download PDF topik dan verifikasi size + sha256 (kontrak GYSApp-Data). */
export async function downloadFaithPdf(
  item: FaithPdfManifest['items'][number],
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
  onProgress?: (pct: number) => void,
): Promise<Uint8Array> {
  const res = await fetchImpl(item.downloadUrl);
  if (!res.ok) throw new Error(`pdf fetch failed: ${res.status}`);
  if (res.body) {
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      onProgress?.(Math.round((received / item.size) * 100));
    }
    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return verifyFaithPdf(bytes, item);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  return verifyFaithPdf(bytes, item);
}

async function verifyFaithPdf(
  bytes: Uint8Array,
  item: FaithPdfManifest['items'][number],
): Promise<Uint8Array> {
  if (bytes.byteLength !== item.size) throw new Error('pdf size mismatch');
  const sha = await sha256Hex(bytes);
  if (sha !== item.sha256) throw new Error('pdf sha256 mismatch');
  return bytes;
}
