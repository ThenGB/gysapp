import {
  applyInstrumentOverride,
  encodeSmf,
  firstTempoMpqn,
  parseSmf,
  scaleTempo,
  transposeNotes,
} from '@gysapp/core';
import { assetUrl } from '../../lib/asset-url';

export type MidiStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'ended';

export interface MidiLoadOptions {
  url: string;
  transpose?: number;
  instrument?: number;
  autoplay?: boolean;
  tempoBpm?: number;
  onProgress?: (pct: number) => void;
}

interface Deck {
  source: AudioBufferSourceNode;
  gain: GainNode;
  buffer: AudioBuffer;
  startOffset: number;
  startCtxTime: number;
  ended: boolean;
}

interface CacheEntry {
  buffer: AudioBuffer;
  transpose: number;
  instrument: number;
  bytes: number;
}

const CACHE_MAX_BYTES = 96 * 1024 * 1024;
const WORKER_URL = assetUrl('/js/midi-render-worker.js');

function cacheKey(url: string, transpose: number, instrument: number): string {
  return `${url}|${transpose}|${instrument}`;
}

/**
 * MIDI engine: render offline di worker (js-synthesizer + FluidSynth WASM),
 * playback AudioBufferSourceNode + A/B deck sederhana, cache LRU per
 * (url, transpose, instrument) dengan byte cap. Tempo TIDAK masuk key cache
 * (render tempo-neutral, kontrak gyschordweb).
 */
export class MidiEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private worker: Worker | null = null;
  private deck: Deck | null = null;
  private status: MidiStatus = 'idle';
  private volume = 0.8;

  private readonly cache = new Map<string, CacheEntry>();
  private cacheBytes = 0;
  private readonly pending = new Map<
    number,
    {
      resolve: (v: unknown) => void;
      reject: (e: Error) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();
  private requestId = 0;
  private sfLoaded = false;
  private sfLoading: Promise<void> | null = null;

  private onStateChange: ((status: MidiStatus) => void) | null = null;
  private currentUrl: string | null = null;
  private transpose = 0;
  private instrument = -1;
  private baseBpm = 120;
  private tempoBpm = 120;

  constructor(private readonly soundfontUrl: string) {}

  getTranspose(): number {
    return this.transpose;
  }

  getTempoBpm(): number {
    return this.tempoBpm;
  }

  /** Transpose ulang lagu aktif tanpa mengubah posisi (render baru). */
  async setTranspose(step: number): Promise<void> {
    const url = this.currentUrl;
    if (!url) return;
    const wasPlaying = this.status === 'playing';
    const position = this.getTime();
    this.transpose = step;
    await this.loadMidi({ url, transpose: step, instrument: this.instrument, autoplay: false });
    this.seek(position);
    if (wasPlaying) this.play();
  }

  /** Ubah tempo (BPM); rate != 1 memicu render tempo-scaled (tanpa cache). */
  async setTempoBpm(bpm: number): Promise<void> {
    const clamped = Math.max(30, Math.min(220, Math.round(bpm)));
    const url = this.currentUrl;
    this.tempoBpm = clamped;
    if (!url || this.baseBpm <= 0) return;
    const wasPlaying = this.status === 'playing';
    const position = this.getTime();
    await this.loadMidi({
      url,
      transpose: this.transpose,
      instrument: this.instrument,
      autoplay: false,
      tempoBpm: clamped,
    });
    this.seek(position);
    if (wasPlaying) this.play();
  }

  setStateListener(fn: ((status: MidiStatus) => void) | null): void {
    this.onStateChange = fn;
  }

  private setStatus(status: MidiStatus): void {
    this.status = status;
    this.onStateChange?.(status);
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -0.3;
      comp.ratio.value = 20;
      comp.attack.value = 0.002;
      comp.knee.value = 0.5;
      comp.release.value = 0.05;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
    }
    void this.ctx.resume();
    return this.ctx;
  }

  private ensureWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(WORKER_URL);
      this.worker.onmessage = (e) => this.onWorkerMessage(e.data);
      this.worker.onerror = () => {
        for (const p of this.pending.values()) p.reject(new Error('midi worker crashed'));
        this.pending.clear();
      };
    }
    return this.worker;
  }

  private onWorkerMessage(msg: {
    type: string;
    id?: number;
    left?: Float32Array;
    right?: Float32Array;
    sampleRate?: number;
    duration?: number;
    presets?: unknown;
    error?: string;
  }): void {
    if (msg.type === 'rendered' && msg.id !== undefined) {
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      clearTimeout(p.timeout);
      const left = new Float32Array(msg.left as Float32Array);
      const right = new Float32Array(msg.right as Float32Array);
      const buffer = this.ensureContext().createBuffer(2, left.length, msg.sampleRate ?? 48000);
      buffer.copyToChannel(left, 0);
      buffer.copyToChannel(right, 1);
      p.resolve({ buffer, duration: msg.duration ?? left.length / (msg.sampleRate ?? 48000) });
    } else if (msg.type === 'sfLoaded') {
      this.sfLoaded = true;
    } else if (msg.type === 'error' && msg.id !== undefined) {
      const p = this.pending.get(msg.id);
      if (p) {
        this.pending.delete(msg.id);
        clearTimeout(p.timeout);
        p.reject(new Error(msg.error ?? 'midi render failed'));
      }
    }
  }

  private send(msg: Record<string, unknown>, transfer?: Transferable[]): void {
    const worker = this.ensureWorker();
    if (transfer) worker.postMessage(msg, transfer);
    else worker.postMessage(msg);
  }

  private request(
    type: string,
    payload: Record<string, unknown>,
    timeoutMs = 120_000,
    transfer?: Transferable[],
  ): Promise<unknown> {
    const id = ++this.requestId;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`midi worker timeout: ${type}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
      this.send({ ...payload, type, id }, transfer);
    });
  }

  private loadSoundFont(): Promise<void> {
    if (this.sfLoaded) return Promise.resolve();
    if (this.sfLoading) return this.sfLoading;
    this.sfLoading = (async () => {
      const res = await fetch(this.soundfontUrl);
      if (!res.ok) throw new Error(`soundfont fetch failed: ${res.status}`);
      const buffer = await res.arrayBuffer();
      await this.request('loadSoundFont', { url: this.soundfontUrl, buffer }, 60_000, [buffer]);
    })().catch((err) => {
      this.sfLoading = null;
      throw err;
    });
    return this.sfLoading;
  }

  async loadMidi(options: MidiLoadOptions): Promise<{ duration: number }> {
    const transpose = options.transpose ?? 0;
    const instrument = options.instrument ?? -1;
    const tempoBpm = options.tempoBpm ?? this.tempoBpm;
    const key = cacheKey(options.url, transpose, instrument);

    await this.loadSoundFont();
    this.ensureContext();

    const cached = this.cache.get(key);
    let entry: CacheEntry | null = null;
    const tempoRate = this.baseBpm > 0 ? tempoBpm / this.baseBpm : 1;
    const tempoNeutral = Math.abs(tempoRate - 1) < 1e-4;

    // Cache hanya menyimpan render tempo-neutral (kontrak gyschordweb).
    if (tempoNeutral && cached) {
      entry = cached;
      this.cache.delete(key);
      this.cache.set(key, entry); // LRU touch
    }
    if (!entry) {
      this.setStatus('loading');
      options.onProgress?.(5);
      const raw = await fetch(options.url).then(async (r) => {
        if (!r.ok) throw new Error(`midi fetch failed: ${r.status}`);
        return new Uint8Array(await r.arrayBuffer());
      });
      options.onProgress?.(15);
      const doc = parseSmf(raw);
      const detectedBpm = Math.round(60_000_000 / firstTempoMpqn(doc));
      if (this.currentUrl !== options.url || tempoNeutral) {
        this.baseBpm = detectedBpm;
        this.tempoBpm = tempoNeutral ? detectedBpm : tempoBpm;
      }
      const scaled = scaleTempo(doc, this.baseBpm > 0 ? this.tempoBpm / this.baseBpm : 1);
      const prepared = applyInstrumentOverride(
        transposeNotes(scaled ?? doc, transpose),
        instrument >= 0 ? instrument : null,
      );
      const bytes = encodeSmf(prepared);
      options.onProgress?.(30);
      const result = (await this.request(
        'render',
        { midiBuffer: bytes.buffer.slice(0), sampleRate: 48000, transpose, instrument },
        120_000,
        [bytes.buffer.slice(0)],
      )) as { buffer: AudioBuffer; duration: number };
      const bytesCount = result.buffer.length * result.buffer.numberOfChannels * 4;
      const fresh: CacheEntry = { buffer: result.buffer, transpose, instrument, bytes: bytesCount };
      if (tempoNeutral) this.putCache(key, fresh);
      entry = fresh;
    }

    this.currentUrl = options.url;
    this.transpose = transpose;
    this.instrument = instrument;

    const deck = this.startDeck(entry.buffer, 0, 0);
    this.deck = deck;
    options.onProgress?.(100);
    if (options.autoplay) this.setStatus('playing');
    else this.setStatus('paused');
    return { duration: entry.buffer.duration };
  }

  private putCache(key: string, entry: CacheEntry): void {
    this.cache.set(key, entry);
    this.cacheBytes += entry.bytes;
    while (this.cacheBytes > CACHE_MAX_BYTES && this.cache.size > 1) {
      const oldest = this.cache.keys().next().value as string;
      const evicted = this.cache.get(oldest);
      if (!evicted) break;
      this.cache.delete(oldest);
      this.cacheBytes -= evicted.bytes;
    }
  }

  private startDeck(buffer: AudioBuffer, offset: number, fadeMs: number): Deck {
    const ctx = this.ensureContext();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    if (fadeMs > 0) {
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(1, ctx.currentTime + fadeMs / 1000);
    } else {
      gain.gain.value = 1;
    }
    source.connect(gain);
    gain.connect(this.master as GainNode);
    const deck: Deck = {
      source,
      gain,
      buffer,
      startOffset: offset,
      startCtxTime: ctx.currentTime,
      ended: false,
    };
    source.onended = () => {
      deck.ended = true;
      if (this.deck === deck) this.setStatus('ended');
    };
    return deck;
  }

  play(): void {
    if (!this.deck) return;
    void this.ensureContext().resume();
    if (this.deck.ended) {
      // Resume dari posisi terakhir (pause/seek sebelumnya).
      const buffer = this.deck.buffer;
      const offset = this.deck.startOffset;
      this.deck = this.startDeck(buffer, offset, 0);
    }
    this.setStatus('playing');
  }

  pause(): void {
    if (!this.deck || this.deck.ended) return;
    this.deck.startOffset = this.getTime();
    this.deck.source.stop();
    this.deck.source.disconnect();
    this.deck.gain.disconnect();
    this.deck.ended = true;
    this.setStatus('paused');
  }

  seek(time: number): void {
    if (!this.deck || this.deck.ended) {
      return;
    }
    const wasPlaying = this.status === 'playing';
    const buffer = this.deck.buffer;
    this.deck.source.stop();
    this.deck.source.disconnect();
    this.deck.gain.disconnect();
    this.deck.ended = true;
    const deck = this.startDeck(buffer, Math.max(0, Math.min(time, buffer.duration)), 0);
    this.deck = deck;
    if (wasPlaying) this.setStatus('playing');
  }

  stop(): void {
    if (this.deck) {
      try {
        this.deck.source.stop();
      } catch {
        // sudah berhenti
      }
      this.deck.source.disconnect();
      this.deck.gain.disconnect();
      this.deck.ended = true;
      this.deck = null;
    }
    this.setStatus('idle');
  }

  getTime(): number {
    if (!this.deck || this.deck.ended) return 0;
    const elapsed = this.ensureContext().currentTime - this.deck.startCtxTime;
    return Math.max(0, Math.min(this.deck.startOffset + elapsed, this.deck.buffer.duration));
  }

  getDuration(): number {
    return this.deck?.buffer.duration ?? 0;
  }

  getStatus(): MidiStatus {
    return this.status;
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.volume;
  }

  get cacheSizeBytes(): number {
    return this.cacheBytes;
  }
}

/** Singleton app-level; di-reset di fase berikutnya bersama lifecycle. */
export const midiEngine = new MidiEngine(assetUrl('/assets/soundfont/TimGM6mb.sf2'));
