import type {
  BibleBook,
  BibleChapter,
  BiblePericopes,
  BibleRefsByChapter,
  BibleParalelsByChapter,
  ChapterCounts,
} from '@gysapp/contracts';

export interface BibleBookCatalog {
  books: BibleBook[];
  chapterCounts: ChapterCounts;
  refs: BibleRefsByChapter;
  paralels: BibleParalelsByChapter;
}

export interface BibleSource {
  loadCatalog(): Promise<BibleBookCatalog>;
  loadChapter(bookId: number, chapterId: number): Promise<BibleChapter | null>;
  loadPericopes(bookId: number, chapterId: number): Promise<BiblePericopes | null>;
}

/** Abstraksi satu "paket" Alkitab (bundel JSON atau SQLite nanti). */
export interface BiblePort {
  readonly code: string;
  readonly label: string;
  loadCatalog(): Promise<BibleBookCatalog>;
  loadChapter(bookId: number, chapterId: number): Promise<BibleChapter | null>;
  loadPericopes(bookId: number, chapterId: number): Promise<BiblePericopes | null>;
}
