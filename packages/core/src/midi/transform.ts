import type { SmfDocument } from './parser';

/**
 * Port dari gyschordweb `hookPlayerMIDIEvents` (worker): transposisi note
 * on/off (skip channel 9 = drum, clamp 0..127). Instrument override:
 * sisipkan program change pada channel saat noteOn pertama bila file tidak
 * memiliki program change sendiri.
 */
export function transposeNotes(doc: SmfDocument, semitones: number): SmfDocument {
  if (semitones === 0) return doc;
  const tracks = doc.tracks.map((track) =>
    track.map((event) => {
      if (event.type === 'noteOn' || event.type === 'noteOff') {
        if (event.channel === 9) return event;
        const key = Math.max(0, Math.min(127, event.key + semitones));
        return { ...event, key };
      }
      return event;
    }),
  );
  return { ...doc, tracks };
}

/** Pastikan channel memakai program `program` (0-127) sebelum note pertama. */
export function applyInstrumentOverride(doc: SmfDocument, program: number | null): SmfDocument {
  if (program === null) return doc;
  const tracks = doc.tracks.map((track) => {
    const channels = new Set<number>();
    const out: Array<(typeof track)[number]> = [];
    for (const event of track) {
      if (event.type === 'noteOn' && event.velocity > 0 && !channels.has(event.channel)) {
        channels.add(event.channel);
        if (event.channel !== 9) {
          out.push({ type: 'programChange', delta: 0, channel: event.channel, program });
        }
      }
      out.push(event);
    }
    return out;
  });
  return { ...doc, tracks };
}
