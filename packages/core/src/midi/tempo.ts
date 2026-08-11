import type { SmfDocument } from './parser';

export const TEMPO_RATE_MIN = 0.25;
export const TEMPO_RATE_MAX = 4;

export function clampTempoRate(rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) return 1;
  return Math.min(TEMPO_RATE_MAX, Math.max(TEMPO_RATE_MIN, rate));
}

/**
 * Port dari gyschordweb `_scaleMidiTempo` (midi-render-worker.js): tulis ulang
 * meta event Set Tempo (0x51, MPQN) dengan rate. File tanpa event tempo
 * TIDAK berubah (return null) — kontrak upstream yang sama.
 */
export function scaleTempo(doc: SmfDocument, rate: number): SmfDocument | null {
  const clamped = clampTempoRate(rate);
  if (Math.abs(clamped - 1) < 1e-6) return doc;
  let tempoEvents = 0;
  const tracks = doc.tracks.map((track) =>
    track.map((event) => {
      if (event.type !== 'meta' || event.metaType !== 0x51 || event.data.length < 3) return event;
      tempoEvents += 1;
      const mpqn = (event.data[0]! << 16) | (event.data[1]! << 8) | event.data[2]!;
      const scaled = Math.max(1, Math.round(mpqn / clamped));
      return {
        ...event,
        data: [(scaled >> 16) & 0xff, (scaled >> 8) & 0xff, scaled & 0xff],
      };
    }),
  );
  if (tempoEvents === 0) return null;
  return { ...doc, tracks };
}
