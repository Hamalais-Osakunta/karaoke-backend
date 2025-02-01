import { FieldValue } from 'firebase-admin/firestore';

export interface Song {
  id?: string;
  songName: string;
  artistName: string;
  singers: string;
  duration: number;
  canonicalUrl: string;
  status: string;
  timestampAdded: FieldValue;
}

export interface PlayingSong {
  songName: string;
  artistName: string;
  singers: string;
  duration: number;
  canonicalUrl: string;
  status: string;
  tries: number;
  timestampPlaying?: FieldValue;
  timestampTryingToPlay?: FieldValue;
}

export interface KaraokePlayer {
  progress: number;
  isPlaying: boolean;
  songName: string;
  artistName: string;
  overlayMode: 'QUEUE' | 'QUEUE_UNCLICKABLE' | 'CLOSED';
  info?: string;
  isAutoPlay?: boolean;
  endScreenPercentage?: number;
  isPlayingUpdated?: FieldValue;
}
