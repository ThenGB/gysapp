export function encodeVerseId(bookId: number, chapterId: number, verseId: number): number {
  return bookId * 1_000_000 + chapterId * 1_000 + verseId;
}

export function decodeVerseId(id: number): { bookId: number; chapterId: number; verseId: number } {
  return {
    bookId: Math.floor(id / 1_000_000),
    chapterId: Math.floor((id % 1_000_000) / 1_000),
    verseId: id % 1_000,
  };
}

/** Key "bc" untuk lookup refs/paralel: chapter tanpa leading zero (mis. 1001). */
export function chapterKey(bookId: number, chapterId: number): string {
  return `${bookId}${chapterId}`;
}
