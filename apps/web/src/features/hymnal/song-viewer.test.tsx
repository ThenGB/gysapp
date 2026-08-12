import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChordedTextLines } from './song-viewer';
import type { ChordedLine } from '@gysapp/core';

const lines: ChordedLine[] = [
  {
    text: 'Pujilah Allah Yang Maha Esa',
    chords: [
      { chord: 'C', pos: 0.05 },
      { chord: 'G', pos: 0.3 },
      { chord: 'Am', pos: 0.55 },
    ],
  },
];

describe('ChordedTextLines (mode teks)', () => {
  it('renders chord badges above the lyric line', () => {
    render(<ChordedTextLines lines={lines} />);
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText('G')).toBeInTheDocument();
    expect(screen.getByText('Am')).toBeInTheDocument();
    expect(screen.getByText('Pujilah Allah Yang Maha Esa')).toBeInTheDocument();
  });

  it('positions badges by percentage of line width', () => {
    render(<ChordedTextLines lines={lines} />);
    const badges = screen.getAllByText(/^(C|G|Am)$/);
    const lefts = badges.map((b) => (b as HTMLElement).style.left);
    // jsdom menormalkan serialisasi CSS ('5.00%' -> '5%').
    expect(lefts).toEqual(['5%', '30%', '55%']);
  });

  it('renders enharmonic flat names when mol mode is selected', () => {
    render(
      <ChordedTextLines
        lines={[{ text: 'Nada', chords: [{ chord: 'C#', pos: 0.2 }] }]}
        accidentalMode="flat"
      />,
    );
    expect(screen.getByText('D♭')).toBeInTheDocument();
    expect(screen.queryByText('C♯')).not.toBeInTheDocument();
  });

  it('keeps text chord display synchronized with midi transpose', () => {
    render(
      <ChordedTextLines
        lines={[{ text: 'Nada', chords: [{ chord: 'C', pos: 0.2 }] }]}
        transposeStep={2}
      />,
    );
    expect(screen.getByText('D')).toBeInTheDocument();
  });

  it('shows empty state without lines', () => {
    render(<ChordedTextLines lines={[]} />);
    expect(screen.getByText(/Belum ada data chord/)).toBeInTheDocument();
  });
});
