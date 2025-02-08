export const FIREBASE_CONFIG = {
    serviceAccountPath: './serviceAccountKey.json',
    databaseURL: 'https://karaoke-prod-811c2.firebaseio.com',
  };
  
  export const FIRESTORE_COLLECTIONS = {
    settings: 'settings',
    songs: 'songs',
  };
  
  export const TIMEOUTS = {
    PAGE_PLAY_BUTTON: 5000,
    SLIDER_SELECTOR: 10000,
    RETRY_THRESHOLD_MS: 8000,
  };
  
  export enum PlayStatus {
    IN_QUEUE = 'IN_QUEUE',
    TRYING_TO_PLAY = 'TRYING_TO_PLAY',
    NAVIGATING_TO_SONG = 'NAVIGATING_TO_SONG',
    SLIDER_FOUND = 'SLIDER_FOUND',
    PLAYING = 'PLAYING',
    ENDED = 'ENDED',
    SONG_NOT_FOUND = 'SONG_NOT_FOUND',
  }
