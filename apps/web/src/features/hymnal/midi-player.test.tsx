import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MiniMidiPlayer } from './midi-player';
import type { MidiStatus } from './midi-engine';

const { mockEngine } = vi.hoisted(() => ({
  mockEngine: {
    setStateListener: vi.fn(),
    getStatus: vi.fn(() => 'idle'),
    getTime: vi.fn(() => 12),
    getDuration: vi.fn(() => 165),
    loadMidi: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    seek: vi.fn(),
    setTranspose: vi.fn(),
    setTempoBpm: vi.fn(),
    getTempoBpm: vi.fn(() => 120),
    getTranspose: vi.fn(() => 0),
  },
}));

vi.mock('./midi-engine', () => ({
  midiEngine: mockEngine,
}));

let statusListener: ((s: MidiStatus) => void) | null = null;

function emitStatus(status: MidiStatus) {
  act(() => statusListener?.(status));
}

describe('MiniMidiPlayer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    statusListener = null;
    mockEngine.setStateListener.mockImplementation((fn: (s: MidiStatus) => void) => {
      statusListener = fn;
    });
    mockEngine.getStatus.mockReturnValue('idle');
    mockEngine.getTime.mockReturnValue(12);
    mockEngine.getDuration.mockReturnValue(165);
    mockEngine.loadMidi.mockResolvedValue({ duration: 165 });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('loads the given midi url on first play', () => {
    render(<MiniMidiPlayer url="/data/hymnal/midi/kr/001_Test.mid" title="KR 001 — Test" />);
    fireEvent.click(screen.getByRole('button', { name: 'Putar' }));
    expect(mockEngine.loadMidi).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/data/hymnal/midi/kr/001_Test.mid', autoplay: true }),
    );
  });

  it('disables play when no midi url', () => {
    render(<MiniMidiPlayer url={null} title="Tanpa MIDI" />);
    expect(screen.getByRole('button', { name: 'Putar' })).toBeDisabled();
  });

  it('resumes from paused state without reloading', () => {
    mockEngine.getStatus.mockReturnValue('paused');
    render(<MiniMidiPlayer url="/x.mid" title="X" />);
    emitStatus('paused');
    fireEvent.click(screen.getByRole('button', { name: 'Putar' }));
    expect(mockEngine.loadMidi).not.toHaveBeenCalled();
    expect(mockEngine.play).toHaveBeenCalled();
  });
});
