import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { firstTempoMpqn, parseSmf, writeVarLen, type SmfDocument } from '../../src/midi/parser';
import { encodeSmf } from '../../src/midi/writer';
import { applyInstrumentOverride, transposeNotes } from '../../src/midi/transform';
import { clampTempoRate, scaleTempo } from '../../src/midi/tempo';

const MIDI = fileURLToPath(new URL('../../../../tests/fixtures/midi/KR001.mid', import.meta.url));

function synthDoc(): SmfDocument {
  return {
    format: 0,
    ticksPerQuarter: 480,
    tracks: [
      [
        { type: 'meta', delta: 0, metaType: 0x51, data: [0x07, 0xa1, 0x20] }, // 500000 MPQN
        { type: 'programChange', delta: 0, channel: 0, program: 0 },
        { type: 'noteOn', delta: 0, channel: 0, key: 60, velocity: 100 },
        { type: 'noteOff', delta: 480, channel: 0, key: 60, velocity: 0 },
        { type: 'meta', delta: 0, metaType: 0x2f, data: [] },
      ],
    ],
  };
}

describe('SMF parser', () => {
  it('parses the real KR 001 MIDI fixture', async () => {
    const bytes = new Uint8Array(await readFile(MIDI));
    const doc = parseSmf(bytes);
    expect(doc.format).toBeGreaterThanOrEqual(0);
    expect(doc.ticksPerQuarter).toBeGreaterThan(0);
    expect(doc.tracks.length).toBeGreaterThan(0);
    const total = doc.tracks.reduce((n, t) => n + t.length, 0);
    expect(total).toBeGreaterThan(100);
    expect(firstTempoMpqn(doc)).toBeGreaterThan(0);
  });

  it('parses synthetic document with note events', () => {
    const bytes = encodeSmf(synthDoc());
    const doc = parseSmf(bytes);
    expect(doc.tracks[0]).toHaveLength(5);
    expect(doc.tracks[0]?.[2]).toMatchObject({ type: 'noteOn', key: 60, channel: 0 });
    expect(firstTempoMpqn(doc)).toBe(500_000);
  });

  it('writeVarLen matches spec examples', () => {
    expect(writeVarLen(0)).toEqual([0]);
    expect(writeVarLen(127)).toEqual([0x7f]);
    expect(writeVarLen(128)).toEqual([0x81, 0x00]);
    expect(writeVarLen(8192)).toEqual([0xc0, 0x00]);
    expect(writeVarLen(16383)).toEqual([0xff, 0x7f]);
  });

  it('rejects non-SMF input', () => {
    expect(() => parseSmf(new Uint8Array([1, 2, 3]))).toThrow();
    expect(() =>
      parseSmf(new Uint8Array([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0, 0x78, 0xff])),
    ).toThrow();
  });
});

describe('encodeSmf round-trip', () => {
  it('parse(encode(doc)) preserves events', async () => {
    const bytes = new Uint8Array(await readFile(MIDI));
    const doc = parseSmf(bytes);
    const round = parseSmf(encodeSmf(doc));
    expect(round.ticksPerQuarter).toBe(doc.ticksPerQuarter);
    expect(round.tracks).toHaveLength(doc.tracks.length);
    const flat = (d: SmfDocument) => d.tracks.flat();
    expect(flat(round)).toEqual(flat(doc));
  });
});

describe('scaleTempo', () => {
  it('halves MPQN at rate 2 (tempo doubled)', () => {
    const scaled = scaleTempo(synthDoc(), 2);
    expect(scaled).not.toBeNull();
    expect(firstTempoMpqn(scaled as SmfDocument)).toBe(250_000);
  });

  it('doubles MPQN at rate 0.5', () => {
    const scaled = scaleTempo(synthDoc(), 0.5);
    expect(firstTempoMpqn(scaled as SmfDocument)).toBe(1_000_000);
  });

  it('returns null for files without tempo events (upstream contract)', () => {
    const noTempo: SmfDocument = {
      ...synthDoc(),
      tracks: [[{ type: 'meta', delta: 0, metaType: 0x2f, data: [] }]],
    };
    expect(scaleTempo(noTempo, 2)).toBeNull();
  });

  it('clamps rate to 0.25..4', () => {
    expect(clampTempoRate(0.1)).toBe(0.25);
    expect(clampTempoRate(10)).toBe(4);
    expect(clampTempoRate(NaN)).toBe(1);
    expect(clampTempoRate(1)).toBe(1);
  });
});

describe('transposeNotes', () => {
  it('transposes note on/off keys and skips channel 9', () => {
    const doc: SmfDocument = {
      ...synthDoc(),
      tracks: [
        [
          { type: 'noteOn', delta: 0, channel: 0, key: 60, velocity: 100 },
          { type: 'noteOff', delta: 480, channel: 0, key: 60, velocity: 0 },
          { type: 'noteOn', delta: 0, channel: 9, key: 42, velocity: 100 },
        ],
      ],
    };
    const out = transposeNotes(doc, 2);
    const notes = out.tracks[0]!.filter((e) => e.type === 'noteOn') as Array<{
      key: number;
      channel: number;
    }>;
    expect(notes.find((n) => n.channel === 0)?.key).toBe(62);
    expect(notes.find((n) => n.channel === 9)?.key).toBe(42);
  });

  it('clamps keys to 0..127', () => {
    const doc: SmfDocument = {
      ...synthDoc(),
      tracks: [[{ type: 'noteOn', delta: 0, channel: 0, key: 126, velocity: 100 }]],
    };
    expect((transposeNotes(doc, 5).tracks[0]?.[0] as { key: number }).key).toBe(127);
  });

  it('is a no-op at 0 semitones', () => {
    const doc = synthDoc();
    expect(transposeNotes(doc, 0)).toBe(doc);
  });
});

describe('applyInstrumentOverride', () => {
  it('injects program change before first note per channel', () => {
    const out = applyInstrumentOverride(synthDoc(), 25);
    const events = out.tracks[0]!;
    const progIdx = events.findIndex((e) => e.type === 'programChange' && e.program === 25);
    const noteIdx = events.findIndex((e) => e.type === 'noteOn');
    expect(progIdx).toBeGreaterThanOrEqual(0);
    expect(progIdx).toBeLessThan(noteIdx);
  });

  it('does nothing when program is null', () => {
    const doc = synthDoc();
    expect(applyInstrumentOverride(doc, null)).toBe(doc);
  });
});
