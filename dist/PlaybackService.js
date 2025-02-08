"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startKaraokePlayerListener = exports.playSong = exports.setNextSongToPlay = exports.monitorKaraokePlayer = exports.monitorPlayingSong = void 0;
const firebaseAdmin_1 = require("./firebaseAdmin");
const config_1 = require("./config");
const OverlayService_1 = require("./OverlayService");
const SLIDER_SELECTOR = '.b-slider-fill';
const SONG_NAME_SELECTOR = '.song-title';
const SONG_ARTIST_SELECTOR = '.song-artist';
const PLAYER_PLAY_BUTTON_SELECTOR = 'button[name="play song"]';
const PAGE_PLAY_BUTTON_SELECTOR = '.play-button.button[type="button"]';
const END_THRESHOLD_PERCENT = 100;
const QUEUE_UPDATE_THRESHOLD_PERCENT = 97;
/**
 * Seuraa Firestore‑dokumenttia "playingSong" ja käynnistää kappaleen soittamisen,
 * kun status on TRYING_TO_PLAY.
 */
const monitorPlayingSong = (page) => {
    firebaseAdmin_1.db.collection(config_1.FIRESTORE_COLLECTIONS.settings)
        .doc('playingSong')
        .onSnapshot((doc) => {
        const data = doc.data();
        console.log('playingSong snapshot:', data);
        if (data.status === config_1.PlayStatus.TRYING_TO_PLAY) {
            playSong(page, data);
        }
    }, (error) => {
        console.error('Error monitoring playingSong:', error);
    });
};
exports.monitorPlayingSong = monitorPlayingSong;
/**
 * Seuraa Firestore‑dokumenttia "karaokePlayer". Tässä kutsutaan
 * DOM‑päivityksiä overlayn näyttämiseksi tai piilottamiseksi.
 */
const monitorKaraokePlayer = (page) => {
    firebaseAdmin_1.db.collection(config_1.FIRESTORE_COLLECTIONS.settings)
        .doc('karaokePlayer')
        .onSnapshot((doc) => {
        const data = doc.data();
        console.log('karaokePlayer snapshot:', data);
        try {
            if (data) {
                if (data.overlayMode === 'QUEUE') {
                    (0, OverlayService_1.openKaraokeQueue)(page);
                }
                else if (data.overlayMode === 'QUEUE_UNCLICKABLE') {
                    (0, OverlayService_1.openUnclickableKaraokeQueue)(page);
                }
                else {
                    (0, OverlayService_1.closeKaraokeQueue)(page);
                }
            }
        }
        catch (error) {
            console.error('Error monitoring karaokePlayer:', error);
        }
    });
};
exports.monitorKaraokePlayer = monitorKaraokePlayer;
/**
 * Hakee seuraavan kappaleen jonosta ja asettaa sen TRYING_TO_PLAY-tilaan.
 */
async function setNextSongToPlay() {
    try {
        await firebaseAdmin_1.db.runTransaction(async (transaction) => {
            const songsRef = firebaseAdmin_1.db.collection(config_1.FIRESTORE_COLLECTIONS.songs);
            const playingSongRef = firebaseAdmin_1.db.collection(config_1.FIRESTORE_COLLECTIONS.settings).doc('playingSong');
            const playingSongSnap = await transaction.get(playingSongRef);
            const playingSong = playingSongSnap.data();
            if (playingSong.status === config_1.PlayStatus.PLAYING ||
                playingSong.status === config_1.PlayStatus.ENDED) {
                const nextSongQuery = songsRef
                    .where('status', '==', config_1.PlayStatus.IN_QUEUE)
                    .orderBy('timestampAdded')
                    .limit(1);
                const nextSongSnapshot = await transaction.get(nextSongQuery);
                if (!nextSongSnapshot.empty) {
                    const nextSongDoc = nextSongSnapshot.docs[0];
                    transaction.update(nextSongDoc.ref, {
                        status: config_1.PlayStatus.TRYING_TO_PLAY,
                        timestampTryingToPlay: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
                    });
                    transaction.update(playingSongRef, {
                        ...nextSongDoc.data(),
                        status: config_1.PlayStatus.TRYING_TO_PLAY,
                        timestampTryingToPlay: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
                        tries: 0,
                        id: nextSongDoc.ref.id,
                    });
                    console.log(`Next song (${nextSongDoc.id}) set to play.`);
                }
                else {
                    transaction.update(playingSongRef, {
                        artistName: '',
                        songName: '',
                        singers: '',
                        canonicalUrl: 'https://singa.com/',
                        duration: 0,
                        status: config_1.PlayStatus.SONG_NOT_FOUND,
                        tries: 0,
                    });
                    console.log('No more songs found.');
                }
            }
        });
    }
    catch (error) {
        console.error('Error starting next song:', error);
    }
}
exports.setNextSongToPlay = setNextSongToPlay;
/**
 * Soittaa kappaleen:
 *  - Päivittää ensin Firestore‑dokumentit käyttöliittymätilaa varten.
 *  - Navigoi kappaleen URL‑osoitteeseen.
 *  - Yrittää klikata "play"-nappia ja odottaa slider-elementtiä.
 */
async function playSong(page, song) {
    try {
        // Päivitetään "karaokePlayer"-dokumenttia käyttöliittymän tilaa varten
        await firebaseAdmin_1.db.collection(config_1.FIRESTORE_COLLECTIONS.settings).doc('karaokePlayer').update({
            overlayMode: 'CLOSED',
            progress: 0,
            isPlayingUpdated: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
            isPlaying: false,
            info: 'Searching for song...',
            endScreenPercentage: ((song.duration - 6) / song.duration) * 100,
        });
        const playingSongSnap = await firebaseAdmin_1.db.collection(config_1.FIRESTORE_COLLECTIONS.settings).doc('playingSong').get();
        const playingSong = playingSongSnap.data();
        if (playingSong.status === config_1.PlayStatus.TRYING_TO_PLAY && playingSong.tries < 3) {
            await firebaseAdmin_1.db.collection(config_1.FIRESTORE_COLLECTIONS.settings).doc('playingSong').update({
                status: config_1.PlayStatus.NAVIGATING_TO_SONG,
                tries: firebaseAdmin_1.admin.firestore.FieldValue.increment(1),
                statusUpdated: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log('Navigating to:', song.canonicalUrl);
            await page.goto(song.canonicalUrl, { waitUntil: 'networkidle2' });
            await firebaseAdmin_1.db.collection(config_1.FIRESTORE_COLLECTIONS.settings).doc('karaokePlayer').update({
                overlayMode: 'QUEUE_UNCLICKABLE',
                info: 'Starting song...',
            });
            try {
                await page.waitForSelector(PAGE_PLAY_BUTTON_SELECTOR, { timeout: config_1.TIMEOUTS.PAGE_PLAY_BUTTON });
                await page.click(PAGE_PLAY_BUTTON_SELECTOR, { timeout: 500 });
                console.log('Clicked play button.');
                await page.waitForSelector(SLIDER_SELECTOR, { timeout: config_1.TIMEOUTS.SLIDER_SELECTOR });
                console.log('Slider found, starting progress monitoring.');
                await firebaseAdmin_1.db.collection(config_1.FIRESTORE_COLLECTIONS.settings).doc('playingSong').update({
                    status: config_1.PlayStatus.SLIDER_FOUND,
                    tries: 0,
                    statusUpdated: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
                });
                // Valmis
            }
            catch (err) {
                await firebaseAdmin_1.db.collection(config_1.FIRESTORE_COLLECTIONS.settings).doc('playingSong').update({
                    status: config_1.PlayStatus.TRYING_TO_PLAY,
                    statusUpdated: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
                });
                await firebaseAdmin_1.db.collection(config_1.FIRESTORE_COLLECTIONS.settings).doc('karaokePlayer').update({
                    overlayMode: 'QUEUE_UNCLICKABLE',
                    info: 'Retrying song start...',
                });
            }
        }
        else {
            await firebaseAdmin_1.db.collection(config_1.FIRESTORE_COLLECTIONS.settings).doc('karaokePlayer').update({
                overlayMode: 'QUEUE',
                info: 'Song could not be started. Please manually close the overlay.',
            });
        }
    }
    catch (error) {
        console.error('Error playing song:', error);
    }
}
exports.playSong = playSong;
/**
 * Kuuntelee säännöllisesti soittimen progressia selaimen DOM:sta ja
 * tekee tietokantapäivityksiä vain, kun soittimen tila (liikkuuko vai ei)
 * muuttuu. Tämä optimoi tietokantakutsujen määrää.
 *
 * Tila päivittyy vain, kun:
 *  - Progress vaihtaa "paikallaan" (pysähtynyt) tilaan tai
 *  - Progress alkaa liikkua uudelleen.
 *
 * Lisäksi jos progress pysyy nollassa yli RETRY_THRESHOLD_MS, yritetään uudelleen käynnistää play.
 */
async function startKaraokePlayerListener(page) {
    const CHECK_INTERVAL_MS = 1500;
    const MAX_RETRIES_PLAYER = 1;
    const RETRY_THRESHOLD_MS = config_1.TIMEOUTS.RETRY_THRESHOLD_MS;
    let playerRetryCount = 0;
    let stuckStartTime = null;
    // Muuttuja, joka kuvaa, oliko soittimen tila viimeksi "liikkuva"
    let wasMoving = false;
    // Edelliseen intervaliin tallennettu progress-arvo
    let previousProgress = 0;
    setInterval(async () => {
        try {
            // Haetaan progress, kappaleen ja artistin tiedot DOM:sta
            const { progressStr, songName, artistName } = await page.evaluate((selectors) => {
                const slider = document.querySelector(selectors.sliderSelector);
                const songElement = document.querySelector(selectors.songNameSelector);
                const artistElement = document.querySelector(selectors.artistSelector);
                // Piilotetaan ylimääräiset elementit
                const button = document.querySelector('.fullscreen-button');
                if (button)
                    button.style.display = 'none';
                document.querySelectorAll('.secondscreen-toggle').forEach(div => { div.style.display = 'none'; });
                document.querySelectorAll('.queue.mini-queue-button').forEach(btn => { btn.style.display = 'none'; });
                document.querySelectorAll('.skip.mini-queue-button').forEach(btn => { btn.style.display = 'none'; });
                return {
                    progressStr: slider ? slider.style.width : '0%',
                    songName: songElement ? songElement.textContent?.trim() || '' : '',
                    artistName: artistElement ? artistElement.textContent?.trim() || '' : '',
                };
            }, {
                sliderSelector: SLIDER_SELECTOR,
                songNameSelector: SONG_NAME_SELECTOR,
                artistSelector: SONG_ARTIST_SELECTOR,
            });
            // Muunnetaan progress prosenttimuotoon
            const numericProgress = parseFloat(progressStr) || 0;
            console.log(`Progress: ${numericProgress}%`);
            // Määritellään nykyinen tila: "liikkuuko" progress verrattuna edelliseen mittaukseen.
            // Käytämme pientä deltaa (esim. > 0.1), jotta pieniä vaihteluita ei pidetä tilan muutoksena.
            const delta = 0.1;
            const isMoving = (numericProgress - previousProgress) > delta;
            // Päivitetään tietokantaa vain, jos soittimen liikkeessä tapahtuu tilamuutos
            if (isMoving !== wasMoving) {
                if (isMoving) {
                    // Soitin on alkanut liikkua: asetetaan status PLAYING
                    console.log('Transition: paused -> playing');
                    await firebaseAdmin_1.db.collection(config_1.FIRESTORE_COLLECTIONS.settings).doc('playingSong').update({
                        status: config_1.PlayStatus.PLAYING,
                        timestampPlaying: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
                        tries: 0,
                    });
                    await firebaseAdmin_1.db.collection(config_1.FIRESTORE_COLLECTIONS.settings).doc('karaokePlayer').update({
                        overlayMode: 'CLOSED',
                        progress: numericProgress,
                        isPlayingUpdated: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
                        isPlaying: true,
                        songName: songName,
                        artistName: artistName,
                        info: '',
                    });
                }
                else {
                    // Soitin on pysähtynyt: päivitys kertoo, että kappale on keskeytynyt
                    console.log('Transition: playing -> paused/stopped');
                    // Päivitetään "karaokePlayer" dokumentti; tarkastellaan progress-arvoa
                    await firebaseAdmin_1.db.collection(config_1.FIRESTORE_COLLECTIONS.settings).doc('karaokePlayer').update({
                        isPlaying: false,
                        info: numericProgress > 0 ? 'Song is paused.' : 'Song has not started.',
                        overlayMode: 'QUEUE',
                        isPlayingUpdated: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
                        songName: songName,
                        artistName: artistName,
                    });
                }
                // Päivitetään tilan tallennus
                wasMoving = isMoving;
            }
            // Retry-logiikka: jos progress pysyy nollassa liian kauan, yritetään uudelleen käynnistää play
            if (numericProgress === 0) {
                if (stuckStartTime === null) {
                    stuckStartTime = Date.now();
                }
                else {
                    const elapsedTime = Date.now() - stuckStartTime;
                    if (elapsedTime >= RETRY_THRESHOLD_MS && playerRetryCount < MAX_RETRIES_PLAYER) {
                        playerRetryCount++;
                        console.log(`Song did not start after ${RETRY_THRESHOLD_MS / 1000} seconds, retrying...`);
                        try {
                            await page.waitForSelector(PLAYER_PLAY_BUTTON_SELECTOR, { timeout: 5000 });
                            await page.click(PLAYER_PLAY_BUTTON_SELECTOR, { timeout: 500 });
                            stuckStartTime = null;
                        }
                        catch (err) {
                            console.error('Error in retry loop:', err);
                        }
                    }
                }
            }
            else {
                // Kun progress ei ole 0, nollataan stuck-mittari ja retry-laskuri
                stuckStartTime = null;
                playerRetryCount = 0;
            }
            // Jos kappale on loppumassa, vaihdetaan overlayMode tilaan QUEUE.
            // Käytetään "endScreenPercentage" kenttää, jos se on asetettu "karaokePlayer" dokumenttiin, muuten oletuksena 97%.
            const karaokePlayerSnap = await firebaseAdmin_1.db.collection(config_1.FIRESTORE_COLLECTIONS.settings).doc('karaokePlayer').get();
            const karaokePlayer = karaokePlayerSnap.data();
            const threshold = karaokePlayer && karaokePlayer.endScreenPercentage ? karaokePlayer.endScreenPercentage : QUEUE_UPDATE_THRESHOLD_PERCENT;
            if (numericProgress >= threshold) {
                try {
                    await firebaseAdmin_1.db.collection(config_1.FIRESTORE_COLLECTIONS.settings).doc('karaokePlayer').update({
                        overlayMode: 'QUEUE'
                    });
                    console.log('OverlayMode updated five seconds before song end.');
                }
                catch (updateError) {
                    console.error('Failed to update OverlayMode:', updateError);
                }
            }
            // Jos progress saavuttaa END_THRESHOLD_PERCENT (100%), määritellään kappale päättyneeksi
            if (numericProgress >= END_THRESHOLD_PERCENT) {
                console.log('Progress reached 100%. Ending song.');
                await firebaseAdmin_1.db.collection(config_1.FIRESTORE_COLLECTIONS.settings).doc('playingSong').update({
                    status: config_1.PlayStatus.ENDED,
                    timestampPlaying: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
                    tries: 0,
                });
                // Jos autoplay on päällä, siirrytään seuraavaan kappaleeseen
                const karaokePlayerSnap = await firebaseAdmin_1.db.collection(config_1.FIRESTORE_COLLECTIONS.settings).doc('karaokePlayer').get();
                const karaokePlayer = karaokePlayerSnap.data();
                if (karaokePlayer && karaokePlayer.isAutoPlay) {
                    console.log('Autoplay is on. Proceeding to next song.');
                    await setNextSongToPlay();
                }
                else {
                    console.log('Autoplay is off. Waiting for manual action.');
                    await firebaseAdmin_1.db.collection(config_1.FIRESTORE_COLLECTIONS.settings).doc('karaokePlayer').update({
                        overlayMode: 'QUEUE',
                        info: 'No songs in queue.',
                    });
                }
            }
            // Päivitetään edellinen progress seuraavaa kierrosta varten
            previousProgress = numericProgress;
        }
        catch (err) {
            console.error('Error in progress listener:', err);
        }
    }, CHECK_INTERVAL_MS);
}
exports.startKaraokePlayerListener = startKaraokePlayerListener;
