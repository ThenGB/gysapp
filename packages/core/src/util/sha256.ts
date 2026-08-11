export async function sha256Hex(data: Uint8Array): Promise<string> {
  // Salin ke buffer baru agar compatible dengan BufferSource (ArrayBuffer-backed).
  const copy = new Uint8Array(data);
  const digest = await crypto.subtle.digest('SHA-256', copy);
  const bytes = new Uint8Array(digest);
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}
