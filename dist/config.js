"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayStatus = exports.TIMEOUTS = exports.FIRESTORE_COLLECTIONS = exports.FIREBASE_CONFIG = void 0;
exports.FIREBASE_CONFIG = {
    serviceAccountPath: './serviceAccountKey.json',
    databaseURL: 'https://karaoke-29c39.firebaseio.com',
};
exports.FIRESTORE_COLLECTIONS = {
    settings: 'settings',
    songs: 'songs',
};
exports.TIMEOUTS = {
    PAGE_PLAY_BUTTON: 5000,
    SLIDER_SELECTOR: 10000,
    RETRY_THRESHOLD_MS: 8000,
};
var PlayStatus;
(function (PlayStatus) {
    PlayStatus["IN_QUEUE"] = "IN_QUEUE";
    PlayStatus["TRYING_TO_PLAY"] = "TRYING_TO_PLAY";
    PlayStatus["NAVIGATING_TO_SONG"] = "NAVIGATING_TO_SONG";
    PlayStatus["SLIDER_FOUND"] = "SLIDER_FOUND";
    PlayStatus["PLAYING"] = "PLAYING";
    PlayStatus["ENDED"] = "ENDED";
    PlayStatus["SONG_NOT_FOUND"] = "SONG_NOT_FOUND";
})(PlayStatus = exports.PlayStatus || (exports.PlayStatus = {}));
