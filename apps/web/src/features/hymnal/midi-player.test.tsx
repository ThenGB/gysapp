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

  it('starts loading the demo song on first play', () => {
    render(<MiniMidiPlayer />);
    fireEvent.click(screen.getByRole('button', { name: 'Putar' }));
    expect(mockEngine.loadMidi).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/assets/midi/KR001.mid', autoplay: true }),
    );
  });

  it('pauses while playing', () => {
    mockEngine.getStatus.mockReturnValue('playing');
    render(<MiniMidiPlayer />);
    emitStatus('playing');
    fireEvent.click(screen.getByRole('button', { name: 'Jeda' }));
    expect(mockEngine.pause).toHaveBeenCalled();
  });

  it('resumes from paused state without reloading', () => {
    mockEngine.getStatus.mockReturnValue('paused');
    render(<MiniMidiPlayer />);
    emitStatus('paused');
    fireEvent.click(screen.getByRole('button', { name: 'Putar' }));
    expect(mockEngine.loadMidi).not.toHaveBeenCalled();
    expect(mockEngine.play).toHaveBeenCalled();
  });

  it('shows time as m:ss while playing', () => {
    render(<MiniMidiPlayer />);
    emitStatus('playing');
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByText('0:12 / 2:45')).toBeInTheDocument();
  });
});
