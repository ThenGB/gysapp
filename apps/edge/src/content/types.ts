export interface SauhItem {
  slug: string;
  title: string;
  url: string;
  imageUrl: string | null;
  excerpt: string;
  publishedAt: string | null;
}

export interface SauhResult {
  /** true bila post hari ini ditemukan via slug sbjYYMMDD. */
  isToday: boolean;
  items: SauhItem[];
}

export interface TrueVoiceItem {
  title: string;
  url: string;
  imageUrl: string | null;
  description: string;
  author: string | null;
}

export interface ContentFeedResult<T> {
  items: T[];
  fetchedAt: string;
  stale: boolean;
}
