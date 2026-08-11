import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { firstTempoMpqn, parseSmf } from '../../src/midi/parser';
import { encodeSmf } from '../../src/midi/writer';
import { scaleTempo } from '../../src/midi/tempo';
import { transposeNotes } from '../../src/midi/transform';

const MIDI = fileURLToPath(new URL('../../../../tests/fixtures/midi/KR001.mid', import.meta.url));
const SF = fileURLToPath(new URL('../../../../tests/fixtures/midi/TimGM6mb.sf2', import.meta.url));

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const libfluidsynth = require('js-synthesizer/libfluidsynth');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const JSSynth = require('js-synthesizer');

type JsSynthSynth = {
  init(sampleRate: number): void;
  loadSFont(buffer: ArrayBuffer): Promise<unknown>;
  addSMFDataToPlayer(buffer: ArrayBuffer): Promise<unknown>;
  playPlayer(): Promise<unknown>;
  waitForPlayerStopped(): Promise<unknown>;
  render(out: Float32Array[]): void;
  close(): void;
};
interface JsSynthModule {
  Synthesizer: {
    initializeWithFluidSynthModule(mod: unknown): void;
    new (): JsSynthSynth;
  };
  waitForReady(): Promise<unknown>;
}

async function renderMidi(
  midiBytes: Uint8Array,
  sfBuffer: ArrayBuffer,
): Promise<{ frames: number; peak: number }> {
  const mod = JSSynth as JsSynthModule;
  mod.Synthesizer.initializeWithFluidSynthModule(libfluidsynth);
  await mod.waitForReady();
  const synth = new mod.Synthesizer();
  synth.init(48000);
  try {
    await synth.loadSFont(sfBuffer);
    const midiCopy = new Uint8Array(midiBytes);
    await synth.addSMFDataToPlayer(midiCopy.buffer.slice(0) as ArrayBuffer);
    await synth.playPlayer();
    // Render chunk 1 detik sampai ada sinyal atau cap 60 detik.
    const chunk = 48000;
    let peak = 0;
    let rendered = 0;
    for (let i = 0; i < 60 && peak < 0.001; i++) {
      const left = new Float32Array(chunk);
      const right = new Float32Array(chunk);
      synth.render([left, right]);
      for (let j = 0; j < chunk; j++) {
        const v = Math.abs(left[j] ?? 0);
        if (v > peak) peak = v;
      }
      rendered += chunk;
    }
    return { frames: rendered, peak };
  } finally {
    synth.close();
  }
}

describe('midi render spike (js-synthesizer + FluidSynth WASM di Node)', () => {
  it('renders KR 001 into PCM with audible signal', async () => {
    const midi = new Uint8Array(await readFile(MIDI));
    const sf = await readFile(SF);
    const sfBuffer = sf.buffer.slice(sf.byteOffset, sf.byteOffset + sf.byteLength) as ArrayBuffer;

    const doc = parseSmf(midi);
    expect(firstTempoMpqn(doc)).toBeGreaterThan(0);

    // Pipeline spike: transpose +2, tempo asli, render.
    const transformed = transposeNotes(scaleTempo(doc, 1) ?? doc, 2);
    const bytes = encodeSmf(transformed);

    const result = await renderMidi(bytes, sfBuffer);
    expect(result.peak).toBeGreaterThan(0.001);
  }, 120_000);
});
