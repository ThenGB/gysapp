import {
  applyInstrumentOverride,
  encodeSmf,
  firstTempoMpqn,
  parseSmf,
  scaleTempo,
  transposeNotes,
} from '@gysapp/core';
import { assetUrl } from '../../lib/asset-url';
import { LatestRequestGuard } from '../../lib/latest-request';

export type MidiStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'ended';

export interface MidiLoadOptions {
  url: string;
  transpose?: number;
  instrument?: number;
  autoplay?: boolean;
  tempoBpm?: number;
  onProgress?: (pct: number) => void;
}

export interface MidiLoadResult {
  duration: number;
  activated: boolean;
}

interface Deck {
  source: AudioBufferSourceNode;
  gain: GainNode;
  buffer: AudioBuffer;
  startOffset: number;
  startCtxTime: number;
  started: boolean;
  ended: boolean;
  manualStop: boolean;
}

interface CacheEntry {
  buffer: AudioBuffer;
  transpose: number;
  instrument: number;
  bytes: number;
  baseBpm: number;
}

const CACHE_MAX_BYTES = 96 * 1024 * 1024;
const WORKER_URL = assetUrl('/js/midi-render-worker.js');

function cacheKey(url: string, transpose: number, instrument: number): string {
  return `${url}|${transpose}|${instrument}`;
}

function isTempoNeutral(baseBpm: number, tempoBpm: number): boolean {
  if (baseBpm <= 0) return true;
  return Math.abs(tempoBpm / baseBpm - 1) < 1e-4;
}

/**
 * MIDI engine: render offline di worker (js-synthesizer + FluidSynth WASM),
 * playback AudioBufferSourceNode, cache LRU per (url, transpose, instrument)
 * dengan byte cap. Render cache hanya menyimpan tempo-neutral supaya perubahan
 * tempo tidak membuat cache membengkak.
 *
 * Load guard menjamin request lama tidak boleh mengaktifkan deck setelah user
 * sudah pindah lagu/menekan stop. AudioBufferSourceNode benar-benar dimulai
 * lewat source.start(); paused deck baru dimulai saat play() dipanggil.
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
  private readonly loadGuard = new LatestRequestGuard();

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

  /** Transpose ulang lagu aktif tanpa mengubah posisi. */
  async setTranspose(step: number): Promise<void> {
    const url = this.currentUrl;
    if (!url) return;
    const wasPlaying = this.status === 'playing';
    const position = this.getTime();
    const result = await this.loadMidi({
      url,
      transpose: step,
      instrument: this.instrument,
      autoplay: false,
    });
    if (!result.activated) return;
    this.seek(position);
    if (wasPlaying) this.play();
  }

  /** Ubah tempo (BPM) sambil mempertahankan posisi lagu aktif. */
  async setTempoBpm(bpm: number): Promise<void> {
    const clamped = Math.max(30, Math.min(220, Math.round(bpm)));
    const url = this.currentUrl;
    if (!url || this.baseBpm <= 0) return;
    const wasPlaying = this.status === 'playing';
    const position = this.getTime();
    const result = await this.loadMidi({
      url,
      transpose: this.transpose,
      instrument: this.instrument,
      autoplay: false,
      tempoBpm: clamped,
    });
    if (!result.activated) return;
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

  async loadMidi(options: MidiLoadOptions): Promise<MidiLoadResult> {
    const loadToken = this.loadGuard.begin();
    const isCurrent = () => this.loadGuard.isCurrent(loadToken);
    const reportProgress = (pct: number) => {
      if (isCurrent()) options.onProgress?.(pct);
    };
    const inactive = (duration = 0): MidiLoadResult => ({ duration, activated: false });

    try {
      const transpose = options.transpose ?? 0;
      const instrument = options.instrument ?? -1;
      const sameTrack = this.currentUrl === options.url;
      const requestedTempo = options.tempoBpm ?? (sameTrack ? this.tempoBpm : null);
      const key = cacheKey(options.url, transpose, instrument);

      await this.loadSoundFont();
      if (!isCurrent()) return inactive();
      this.ensureContext();

      const cached = this.cache.get(key);
      let entry: CacheEntry | null = null;
      let effectiveTempo = requestedTempo ?? 0;

      if (cached) {
        effectiveTempo = requestedTempo ?? cached.baseBpm;
        if (isTempoNeutral(cached.baseBpm, effectiveTempo)) {
          entry = cached;
          this.cache.delete(key);
          this.cache.set(key, entry); // LRU touch
        }
      }

      if (!entry) {
        this.setStatus('loading');
        reportProgress(5);
        const raw = await fetch(options.url).then(async (r) => {
          if (!r.ok) throw new Error(`midi fetch failed: ${r.status}`);
          return new Uint8Array(await r.arrayBuffer());
        });
        if (!isCurrent()) return inactive();
        reportProgress(15);

        const doc = parseSmf(raw);
        const detectedBpm = Math.round(60_000_000 / firstTempoMpqn(doc));
        effectiveTempo = requestedTempo ?? detectedBpm;
        const tempoRate = detectedBpm > 0 ? effectiveTempo / detectedBpm : 1;
        const scaled = scaleTempo(doc, tempoRate);
        const prepared = applyInstrumentOverride(
          transposeNotes(scaled ?? doc, transpose),
          instrument >= 0 ? instrument : null,
        );
        const bytes = encodeSmf(prepared);
        reportProgress(30);

        const result = (await this.request(
          'render',
          { midiBuffer: bytes.buffer.slice(0), sampleRate: 48000, transpose, instrument },
          120_000,
          [bytes.buffer.slice(0)],
        )) as { buffer: AudioBuffer; duration: number };
        const bytesCount = result.buffer.length * result.buffer.numberOfChannels * 4;
        const fresh: CacheEntry = {
          buffer: result.buffer,
          transpose,
          instrument,
          bytes: bytesCount,
          baseBpm: detectedBpm,
        };
        if (isTempoNeutral(detectedBpm, effectiveTempo)) this.putCache(key, fresh);
        entry = fresh;
      }

      if (!isCurrent()) return inactive(entry.buffer.duration);

      this.currentUrl = options.url;
      this.transpose = transpose;
      this.instrument = instrument;
      this.baseBpm = entry.baseBpm;
      this.tempoBpm = effectiveTempo || entry.baseBpm;

      if (this.deck) this.disposeDeck(this.deck);
      const deck = this.createDeck(entry.buffer, 0, 0, options.autoplay === true);
      this.deck = deck;
      reportProgress(100);
      this.setStatus(options.autoplay ? 'playing' : 'paused');
      return { duration: entry.buffer.duration, activated: true };
    } catch (err) {
      if (!isCurrent()) return inactive();
      throw err;
    }
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

  private createDeck(
    buffer: AudioBuffer,
    offset: number,
    fadeMs: number,
    startImmediately: boolean,
  ): Deck {
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
      startOffset: Math.max(0, Math.min(offset, buffer.duration)),
      startCtxTime: ctx.currentTime,
      started: false,
      ended: false,
      manualStop: false,
    };
    source.onended = () => {
      deck.ended = true;
      if (!deck.manualStop) deck.startOffset = deck.buffer.duration;
      if (this.deck === deck && !deck.manualStop) this.setStatus('ended');
    };

    if (startImmediately) this.startDeckSource(deck);
    return deck;
  }

  private startDeckSource(deck: Deck): void {
    if (deck.started || deck.ended) return;
    const ctx = this.ensureContext();
    deck.startCtxTime = ctx.currentTime;
    deck.started = true;
    deck.manualStop = false;
    deck.source.start(0, Math.max(0, Math.min(deck.startOffset, deck.buffer.duration)));
  }

  private disposeDeck(deck: Deck): void {
    deck.manualStop = true;
    if (deck.started && !deck.ended) {
      try {
        deck.source.stop();
      } catch {
        // Source sudah berhenti.
      }
    }
    try {
      deck.source.disconnect();
    } catch {
      // no-op
    }
    try {
      deck.gain.disconnect();
    } catch {
      // no-op
    }
    deck.ended = true;
  }

  play(): void {
    let deck = this.deck;
    if (!deck) return;
    void this.ensureContext().resume();

    if (deck.ended) {
      const offset = deck.startOffset >= deck.buffer.duration ? 0 : deck.startOffset;
      deck = this.createDeck(deck.buffer, offset, 0, true);
      this.deck = deck;
    } else if (!deck.started) {
      this.startDeckSource(deck);
    }
    this.setStatus('playing');
  }

  pause(): void {
    const deck = this.deck;
    if (!deck || this.status !== 'playing' || !deck.started || deck.ended) return;
    deck.startOffset = this.getTime();
    this.disposeDeck(deck);
    this.setStatus('paused');
  }

  seek(time: number): void {
    const deck = this.deck;
    if (!deck) return;
    const wasPlaying = this.status === 'playing';
    const buffer = deck.buffer;
    const target = Math.max(0, Math.min(time, buffer.duration));
    this.disposeDeck(deck);
    this.deck = this.createDeck(buffer, target, 0, wasPlaying);
    this.setStatus(wasPlaying ? 'playing' : 'paused');
  }

  stop(): void {
    this.loadGuard.invalidate();
    if (this.deck) {
      this.disposeDeck(this.deck);
      this.deck = null;
    }
    this.setStatus('idle');
  }

  getTime(): number {
    const deck = this.deck;
    if (!deck) return 0;
    if (!deck.started || deck.ended) {
      return Math.max(0, Math.min(deck.startOffset, deck.buffer.duration));
    }
    const elapsed = this.ensureContext().currentTime - deck.startCtxTime;
    return Math.max(0, Math.min(deck.startOffset + elapsed, deck.buffer.duration));
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

export const midiEngine = new MidiEngine(assetUrl('/assets/soundfont/TimGM6mb.sf2'));
