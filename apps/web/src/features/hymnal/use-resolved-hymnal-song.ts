import { useEffect, useState } from 'react';
import { hymnalCatalog, type ResolvedSong } from '../../data/hymnal/hymnal-catalog';
import { rememberHymnalSong } from './hymnal-recent-store';
import { setHymnalPlayerTrack } from './hymnal-player-store';
import type { AccidentalMode } from './song-viewer-v2-model';

export function useResolvedHymnalSong({
  book,
  song,
  accidentalMode,
  transposeStep,
}: {
  book: string;
  song: string;
  accidentalMode: AccidentalMode;
  transposeStep: number;
}) {
  const [resolved, setResolved] = useState<ResolvedSong | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setResolved(null);
    setMissing(false);
    void hymnalCatalog.resolveSong(book, song).then((value) => {
      if (cancelled) return;
      setResolved(value);
      setMissing(value === null);
    });
    return () => {
      cancelled = true;
    };
  }, [book, song]);

  useEffect(() => {
    if (!resolved) return;
    const title = `${book} ${resolved.entry.number} — ${resolved.entry.title}`;
    rememberHymnalSong({ book, song, title });
    if (!resolved.midiUrl) return;
    setHymnalPlayerTrack(
      { key: `${book}:${song}`, url: resolved.midiUrl, title },
      { accidentalMode, transposeStep },
    );
  }, [accidentalMode, book, resolved, song, transposeStep]);

  return { resolved, missing };
}
