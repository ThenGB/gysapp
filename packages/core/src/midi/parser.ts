/** Format standar MIDI (SMF) — parser murni tanpa dependensi. */

export type MidiEvent =
  | { type: 'noteOff'; delta: number; channel: number; key: number; velocity: number }
  | { type: 'noteOn'; delta: number; channel: number; key: number; velocity: number }
  | { type: 'polyPressure'; delta: number; channel: number; key: number; value: number }
  | { type: 'controlChange'; delta: number; channel: number; controller: number; value: number }
  | { type: 'programChange'; delta: number; channel: number; program: number }
  | { type: 'channelPressure'; delta: number; channel: number; value: number }
  | { type: 'pitchBend'; delta: number; channel: number; value: number }
  | { type: 'sysEx'; delta: number; data: number[] }
  | { type: 'meta'; delta: number; metaType: number; data: number[] };

export interface SmfDocument {
  format: number;
  tracks: MidiEvent[][];
  ticksPerQuarter: number;
}

export class MidiParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MidiParseError';
  }
}

function readU16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]! << 8) | bytes[offset + 1]!;
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset]! << 24) |
      (bytes[offset + 1]! << 16) |
      (bytes[offset + 2]! << 8) |
      bytes[offset + 3]!) >>>
    0
  );
}

export function readVarLen(bytes: Uint8Array, offset: number): { value: number; next: number } {
  let value = 0;
  let next = offset;
  for (let i = 0; i < 4; i++) {
    const b = bytes[next]!;
    next += 1;
    value = (value << 7) | (b & 0x7f);
    if ((b & 0x80) === 0) break;
  }
  return { value, next };
}

/** Enkode delta sebagai VLQ (untuk writer). */
export function writeVarLen(value: number): number[] {
  const bytes: number[] = [];
  let v = value;
  bytes.unshift(v & 0x7f);
  v >>= 7;
  while (v > 0) {
    bytes.unshift((v & 0x7f) | 0x80);
    v >>= 7;
  }
  return bytes;
}

export function parseSmf(bytes: Uint8Array): SmfDocument {
  if (bytes.length < 14) throw new MidiParseError('file too short');
  const header = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!);
  if (header !== 'MThd') throw new MidiParseError('missing MThd header');
  const headerLen = readU32(bytes, 4);
  if (headerLen < 6) throw new MidiParseError('invalid header length');
  const format = readU16(bytes, 8);
  const trackCount = readU16(bytes, 10);
  const ticksPerQuarter = readU16(bytes, 12);

  const tracks: MidiEvent[][] = [];
  let offset = 14;
  for (let t = 0; t < trackCount; t++) {
    if (offset + 8 > bytes.length) throw new MidiParseError('truncated chunk header');
    const chunkType = String.fromCharCode(
      bytes[offset]!,
      bytes[offset + 1]!,
      bytes[offset + 2]!,
      bytes[offset + 3]!,
    );
    const chunkLen = readU32(bytes, offset + 4);
    offset += 8;
    if (chunkType !== 'MTrk') {
      offset += chunkLen;
      continue;
    }
    const trackEnd = offset + chunkLen;
    if (trackEnd > bytes.length) throw new MidiParseError('truncated track');
    const events: MidiEvent[] = [];
    let pos = offset;
    let runningStatus = 0;
    while (pos < trackEnd) {
      const { value: delta, next } = readVarLen(bytes, pos);
      pos = next;
      let status = bytes[pos]!;
      if ((status & 0x80) === 0) {
        status = runningStatus;
      } else {
        pos += 1;
      }
      const kind = status & 0xf0;
      const channel = status & 0x0f;

      if (status === 0xff) {
        const metaType = bytes[pos]!;
        pos += 1;
        const { value: len, next: afterLen } = readVarLen(bytes, pos);
        pos = afterLen;
        if (pos + len > trackEnd) throw new MidiParseError('truncated meta event');
        events.push({ type: 'meta', delta, metaType, data: [...bytes.slice(pos, pos + len)] });
        pos += len;
      } else if (status === 0xf0 || status === 0xf7) {
        const { value: len, next: afterLen } = readVarLen(bytes, pos);
        pos = afterLen;
        if (pos + len > trackEnd) throw new MidiParseError('truncated sysex');
        events.push({ type: 'sysEx', delta, data: [...bytes.slice(pos, pos + len)] });
        pos += len;
      } else {
        runningStatus = status;
        switch (kind) {
          case 0x80: {
            const key = bytes[pos]!;
            const velocity = bytes[pos + 1]!;
            pos += 2;
            events.push({ type: 'noteOff', delta, channel, key, velocity });
            break;
          }
          case 0x90: {
            const key = bytes[pos]!;
            const velocity = bytes[pos + 1]!;
            pos += 2;
            if (velocity === 0) events.push({ type: 'noteOff', delta, channel, key, velocity });
            else events.push({ type: 'noteOn', delta, channel, key, velocity });
            break;
          }
          case 0xa0: {
            events.push({
              type: 'polyPressure',
              delta,
              channel,
              key: bytes[pos]!,
              value: bytes[pos + 1]!,
            });
            pos += 2;
            break;
          }
          case 0xb0: {
            events.push({
              type: 'controlChange',
              delta,
              channel,
              controller: bytes[pos]!,
              value: bytes[pos + 1]!,
            });
            pos += 2;
            break;
          }
          case 0xc0: {
            events.push({ type: 'programChange', delta, channel, program: bytes[pos]! });
            pos += 1;
            break;
          }
          case 0xd0: {
            events.push({ type: 'channelPressure', delta, channel, value: bytes[pos]! });
            pos += 1;
            break;
          }
          case 0xe0: {
            const lsb = bytes[pos]!;
            const msb = bytes[pos + 1]!;
            pos += 2;
            events.push({ type: 'pitchBend', delta, channel, value: (msb << 7) | lsb });
            break;
          }
          default:
            throw new MidiParseError(`unsupported status 0x${status.toString(16)}`);
        }
      }
    }
    tracks.push(events);
    offset = trackEnd;
  }
  return { format, tracks, ticksPerQuarter };
}

/** Tempo MPQN dari meta event 0x51 (default 500000 = 120 BPM). */
export const DEFAULT_TEMPO_MPQN = 500_000;

export function firstTempoMpqn(doc: SmfDocument): number {
  for (const track of doc.tracks) {
    for (const event of track) {
      if (event.type === 'meta' && event.metaType === 0x51 && event.data.length >= 3) {
        return (event.data[0]! << 16) | (event.data[1]! << 8) | event.data[2]!;
      }
    }
  }
  return DEFAULT_TEMPO_MPQN;
}
