import type { SmfDocument } from './parser';
import { writeVarLen } from './parser';

/**
 * Serialisasi SMF kembali ke byte MIDI (tanpa running status — sintetis
 * menerima keduanya, hasil lebih mudah diverifikasi). Dipakai agar seluruh
 * transformasi (tempo/transpose/instrument) bisa diuji murni tanpa WASM.
 */
export function encodeSmf(doc: SmfDocument): Uint8Array {
  const chunks: number[] = [];

  const header = [
    0x4d,
    0x54,
    0x68,
    0x64, // MThd
    0,
    0,
    0,
    6,
    0,
    doc.format,
    (doc.tracks.length >> 8) & 0xff,
    doc.tracks.length & 0xff,
    (doc.ticksPerQuarter >> 8) & 0xff,
    doc.ticksPerQuarter & 0xff,
  ];
  chunks.push(...header);

  for (const track of doc.tracks) {
    const body: number[] = [0x4d, 0x54, 0x72, 0x6b]; // MTrk
    const payload: number[] = [];
    for (const event of track) {
      payload.push(...writeVarLen(event.delta));
      switch (event.type) {
        case 'noteOff':
          payload.push(0x80 | event.channel, event.key, event.velocity);
          break;
        case 'noteOn':
          payload.push(0x90 | event.channel, event.key, event.velocity);
          break;
        case 'polyPressure':
          payload.push(0xa0 | event.channel, event.key, event.value);
          break;
        case 'controlChange':
          payload.push(0xb0 | event.channel, event.controller, event.value);
          break;
        case 'programChange':
          payload.push(0xc0 | event.channel, event.program);
          break;
        case 'channelPressure':
          payload.push(0xd0 | event.channel, event.value);
          break;
        case 'pitchBend':
          payload.push(0xe0 | event.channel, event.value & 0x7f, (event.value >> 7) & 0x7f);
          break;
        case 'sysEx':
          payload.push(0xf0, ...writeVarLen(event.data.length), ...event.data);
          break;
        case 'meta':
          payload.push(0xff, event.metaType, ...writeVarLen(event.data.length), ...event.data);
          break;
      }
    }
    body.push(
      (payload.length >> 24) & 0xff,
      (payload.length >> 16) & 0xff,
      (payload.length >> 8) & 0xff,
      payload.length & 0xff,
    );
    chunks.push(...body, ...payload);
  }

  return new Uint8Array(chunks);
}
