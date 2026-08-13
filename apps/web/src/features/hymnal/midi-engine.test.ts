import { describe, expect, it, vi } from 'vitest';
import { MidiEngine, toTransferableArrayBuffer } from './midi-engine';

class FakeSource {
  buffer: AudioBuffer | null = null;
  onended: (() => void) | null = null;
  starts: Array<{ when: number; offset: number }> = [];
  stops = 0;

  connect() {}
  disconnect() {}

  start(when = 0, offset = 0) {
    this.starts.push({ when, offset });
  }

  stop() {
    this.stops += 1;
  }
}

class FakeGain {
  gain = {
    value: 1,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  };

  connect() {}
  disconnect() {}
}

class FakeRenderedBuffer {
  duration: number;
  numberOfChannels = 2;
  readonly copiedChannels: Array<Float32Array | undefined> = [];

  constructor(
    public readonly length: number,
    public readonly sampleRate: number,
  ) {
    this.duration = length / sampleRate;
  }

  copyToChannel(source: Float32Array, channelNumber: number) {
    this.copiedChannels[channelNumber] = source;
  }
}

class FakeAudioContext {
  currentTime = 0;
  readonly sources: FakeSource[] = [];
  readonly buffers: FakeRenderedBuffer[] = [];

  resume = vi.fn(async () => undefined);

  createBufferSource(): AudioBufferSourceNode {
    const source = new FakeSource();
    this.sources.push(source);
    return source as unknown as AudioBufferSourceNode;
  }

  createGain(): GainNode {
    return new FakeGain() as unknown as GainNode;
  }

  createBuffer(_channels: number, length: number, sampleRate: number): AudioBuffer {
    const buffer = new FakeRenderedBuffer(length, sampleRate);
    this.buffers.push(buffer);
    return buffer as unknown as AudioBuffer;
  }
}

type InternalCacheEntry = {
  buffer: AudioBuffer;
  transpose: number;
  instrument: number;
  bytes: number;
  baseBpm: number;
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

type InternalMidiEngine = {
  ctx: AudioContext | null;
  master: GainNode | null;
  sfLoaded: boolean;
  cache: Map<string, InternalCacheEntry>;
  currentUrl: string | null;
  baseBpm: number;
  tempoBpm: number;
  pending: Map<number, PendingRequest>;
  loadSoundFont: () => Promise<void>;
  putCache: (key: string, entry: InternalCacheEntry) => void;
  onWorkerMessage: (msg: {
    type: string;
    id?: number;
    left?: Float32Array;
    right?: Float32Array;
    sampleRate?: number;
    duration?: number;
    presets?: unknown;
    error?: string;
  }) => void;
};

function fakeBuffer(duration: number): AudioBuffer {
  return {
    duration,
    length: Math.round(duration * 48_000),
    numberOfChannels: 2,
  } as AudioBuffer;
}

function cacheEntry(duration: number, baseBpm = 120): InternalCacheEntry {
  const buffer = fakeBuffer(duration);
  return {
    buffer,
    transpose: 0,
    instrument: -1,
    bytes: buffer.length * buffer.numberOfChannels * 4,
    baseBpm,
  };
}

function setupEngine() {
  const engine = new MidiEngine('/soundfont.sf2');
  const ctx = new FakeAudioContext();
  const internal = engine as unknown as InternalMidiEngine;
  internal.ctx = ctx as unknown as AudioContext;
  internal.master = new FakeGain() as unknown as GainNode;
  internal.sfLoaded = true;
  return { engine, ctx, internal };
}

function cacheSong(
  internal: InternalMidiEngine,
  url: string,
  duration: number,
  baseBpm = 120,
): void {
  internal.cache.set(`${url}|0|-1`, cacheEntry(duration, baseBpm));
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function seedPending(
  internal: InternalMidiEngine,
  id: number,
): { resolve: ReturnType<typeof vi.fn>; reject: ReturnType<typeof vi.fn> } {
  const resolve = vi.fn();
  const reject = vi.fn();
  internal.pending.set(id, {
    resolve,
    reject,
    timeout: setTimeout(() => undefined, 10_000),
  });
  return { resolve, reject };
}

describe('MIDI worker transfer buffers', () => {
  it('reuses a full Uint8Array backing ArrayBuffer without another copy', () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const buffer = toTransferableArrayBuffer(bytes);

    expect(buffer).toBe(bytes.buffer);
    expect([...new Uint8Array(buffer)]).toEqual([1, 2, 3, 4]);
  });

  it('copies a subview exactly once and excludes unrelated bytes', () => {
    const source = new Uint8Array([9, 1, 2, 3, 8]);
    const bytes = source.subarray(1, 4);
    const buffer = toTransferableArrayBuffer(bytes);

    expect(buffer).not.toBe(source.buffer);
    expect([...new Uint8Array(buffer)]).toEqual([1, 2, 3]);
  });

  it('consumes transferred PCM views directly instead of cloning both channels again', () => {
    const { ctx, internal } = setupEngine();
    const pending = seedPending(internal, 41);
    const left = new Float32Array([0.1, 0.2, 0.3]);
    const right = new Float32Array([0.4, 0.5, 0.6]);

    internal.onWorkerMessage({
      type: 'rendered',
      id: 41,
      left,
      right,
      sampleRate: 48_000,
      duration: 3 / 48_000,
    });

    expect(pending.reject).not.toHaveBeenCalled();
    expect(pending.resolve).toHaveBeenCalledOnce();
    expect(ctx.buffers).toHaveLength(1);
    expect(ctx.buffers[0]?.copiedChannels[0]).toBe(left);
    expect(ctx.buffers[0]?.copiedChannels[1]).toBe(right);
    expect(internal.pending.has(41)).toBe(false);
  });

  it('resolves the SoundFont request when the worker reports sfLoaded', () => {
    const { internal } = setupEngine();
    internal.sfLoaded = false;
    const pending = seedPending(internal, 7);
    const presets = [[0, 'Piano']];

    internal.onWorkerMessage({ type: 'sfLoaded', id: 7, presets });

    expect(internal.sfLoaded).toBe(true);
    expect(pending.reject).not.toHaveBeenCalled();
    expect(pending.resolve).toHaveBeenCalledWith({ presets });
    expect(internal.pending.has(7)).toBe(false);
  });

  it('rejects malformed transferred PCM without allocating an AudioBuffer', () => {
    const { ctx, internal } = setupEngine();
    const pending = seedPending(internal, 52);

    internal.onWorkerMessage({
      type: 'rendered',
      id: 52,
      left: new Float32Array([0.1, 0.2]),
      right: new Float32Array([0.3]),
      sampleRate: 48_000,
    });

    expect(pending.resolve).not.toHaveBeenCalled();
    expect(pending.reject).toHaveBeenCalledOnce();
    expect(ctx.buffers).toHaveLength(0);
  });
});

describe('MidiEngine render cache bounds', () => {
  it('does not retain a single rendered buffer larger than the 96 MiB cache budget', () => {
    const { engine, internal } = setupEngine();
    const huge = cacheEntry(300);

    internal.putCache('/huge.mid|0|-1', huge);

    expect(internal.cache.size).toBe(0);
    expect(engine.cacheSizeBytes).toBe(0);
  });

  it('accounts for replacement entries instead of double-counting the same key', () => {
    const { engine, internal } = setupEngine();
    const first = cacheEntry(10);
    const replacement = cacheEntry(20);

    internal.putCache('/a.mid|0|-1', first);
    internal.putCache('/a.mid|0|-1', replacement);

    expect(internal.cache.size).toBe(1);
    expect(engine.cacheSizeBytes).toBe(replacement.bytes);
  });
});

describe('MidiEngine playback lifecycle', () => {
  it('actually starts the AudioBufferSourceNode when autoplay is requested', async () => {
    const { engine, ctx, internal } = setupEngine();
    cacheSong(internal, '/a.mid', 12);

    const result = await engine.loadMidi({ url: '/a.mid', autoplay: true });

    expect(result).toEqual({ duration: 12, activated: true });
    expect(ctx.sources).toHaveLength(1);
    expect(ctx.sources[0]?.starts).toEqual([{ when: 0, offset: 0 }]);
    expect(engine.getStatus()).toBe('playing');
  });

  it('does not resume AudioContext again while polling the current playback time', async () => {
    const { engine, ctx, internal } = setupEngine();
    cacheSong(internal, '/a.mid', 12);
    await engine.loadMidi({ url: '/a.mid', autoplay: true });
    const resumeCalls = ctx.resume.mock.calls.length;

    ctx.currentTime = 2.5;
    expect(engine.getTime()).toBe(2.5);
    expect(engine.getTime()).toBe(2.5);

    expect(ctx.resume).toHaveBeenCalledTimes(resumeCalls);
  });

  it('keeps a non-autoplay deck paused until play and resumes from the paused offset', async () => {
    const { engine, ctx, internal } = setupEngine();
    cacheSong(internal, '/a.mid', 20);

    await engine.loadMidi({ url: '/a.mid', autoplay: false });
    expect(ctx.sources[0]?.starts).toHaveLength(0);
    expect(engine.getStatus()).toBe('paused');

    engine.play();
    expect(ctx.sources[0]?.starts).toEqual([{ when: 0, offset: 0 }]);
    ctx.currentTime = 5;
    engine.pause();
    expect(engine.getTime()).toBe(5);
    expect(engine.getStatus()).toBe('paused');

    engine.play();
    expect(ctx.sources).toHaveLength(2);
    expect(ctx.sources[1]?.starts).toEqual([{ when: 0, offset: 5 }]);
    expect(engine.getStatus()).toBe('playing');
  });

  it('allows seeking while paused and starts from the selected offset', async () => {
    const { engine, ctx, internal } = setupEngine();
    cacheSong(internal, '/a.mid', 30);

    await engine.loadMidi({ url: '/a.mid', autoplay: false });
    engine.seek(9.5);
    expect(engine.getTime()).toBe(9.5);
    expect(engine.getStatus()).toBe('paused');

    engine.play();
    expect(ctx.sources.at(-1)?.starts).toEqual([{ when: 0, offset: 9.5 }]);
  });

  it('does not let an older async load replace a newer track', async () => {
    const { engine, ctx, internal } = setupEngine();
    cacheSong(internal, '/old.mid', 11);
    cacheSong(internal, '/new.mid', 22);

    const first = deferred();
    let calls = 0;
    internal.loadSoundFont = () => {
      calls += 1;
      return calls === 1 ? first.promise : Promise.resolve();
    };

    const oldLoad = engine.loadMidi({ url: '/old.mid', autoplay: true });
    const newResult = await engine.loadMidi({ url: '/new.mid', autoplay: true });
    first.resolve();
    const oldResult = await oldLoad;

    expect(newResult.activated).toBe(true);
    expect(oldResult.activated).toBe(false);
    expect(engine.getDuration()).toBe(22);
    expect(ctx.sources).toHaveLength(1);
  });

  it('invalidates an in-flight load when stop is requested', async () => {
    const { engine, ctx, internal } = setupEngine();
    cacheSong(internal, '/old.mid', 11);
    const pending = deferred();
    internal.loadSoundFont = () => pending.promise;

    const load = engine.loadMidi({ url: '/old.mid', autoplay: true });
    engine.stop();
    pending.resolve();

    expect((await load).activated).toBe(false);
    expect(engine.getStatus()).toBe('idle');
    expect(ctx.sources).toHaveLength(0);
  });

  it('resets tempo to the new song base BPM instead of leaking the previous track tempo', async () => {
    const { engine, internal } = setupEngine();
    internal.currentUrl = '/previous.mid';
    internal.baseBpm = 120;
    internal.tempoBpm = 160;
    cacheSong(internal, '/new.mid', 18, 92);

    await engine.loadMidi({ url: '/new.mid', autoplay: false });

    expect(engine.getTempoBpm()).toBe(92);
  });
});
