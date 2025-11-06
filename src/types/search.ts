export interface Audio {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  duration?: number;
  audio_url: string;
  category?: {
    id: string;
    name: string;
  };
}

export interface Playlist {
  id: string;
  title: string;
  description?: string;
  cover_url?: string;
  total_duration?: number;
  audio_count?: number;
  is_challenge?: boolean;
  category?: {
    id: string;
    name: string;
  };
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  order_position?: number;
}

export interface SearchResults {
  audios: Audio[];
  playlists: Playlist[];
  categories: Category[];
  verses: import('@/lib/search').SearchResult[];
}