import { db, admin } from './firebaseAdmin';
import { FIRESTORE_COLLECTIONS, PlayStatus, TIMEOUTS } from './config';
import { PlayingSong } from './types';
import { openKaraokeQueue, openUnclickableKaraokeQueue, closeKaraokeQueue } from './OverlayService';

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
export const monitorPlayingSong = (page: any): void => {
    db.collection(FIRESTORE_COLLECTIONS.settings)
        .doc('playingSong')
        .onSnapshot(
            (doc) => {
                const data = doc.data() as PlayingSong;
                console.log('playingSong snapshot:', data);
                if (
                    data.status === PlayStatus.TRYING_TO_PLAY
                ) {
                    playSong(page, data);
                }
            },
            (error) => {
                console.error('Error monitoring playingSong:', error);
            }
        );
};

/**
 * Seuraa Firestore‑dokumenttia "karaokePlayer". Tässä kutsutaan 
 * DOM‑päivityksiä overlayn näyttämiseksi tai piilottamiseksi.
 */
export const monitorKaraokePlayer = (page: any): void => {
    db.collection(FIRESTORE_COLLECTIONS.settings)
        .doc('karaokePlayer')
        .onSnapshot(
            (doc) => {
                const data = doc.data();
                console.log('karaokePlayer snapshot:', data);
                try {
                    if (data) {
                        if (data.overlayMode === 'QUEUE') {
                            openKaraokeQueue(page);
                        } else if (data.overlayMode === 'QUEUE_UNCLICKABLE') {
                            openUnclickableKaraokeQueue(page);
                        } else {
                            closeKaraokeQueue(page);
                        }
                    }
                } catch (error) {
                    console.error('Error monitoring karaokePlayer:', error);
                }
            }
        );
};

/**
 * Hakee seuraavan kappaleen jonosta ja asettaa sen TRYING_TO_PLAY-tilaan.
 */
export async function setNextSongToPlay(): Promise<void> {
    try {
        await db.runTransaction(async (transaction) => {
            const songsRef = db.collection(FIRESTORE_COLLECTIONS.songs);
            const playingSongRef = db.collection(FIRESTORE_COLLECTIONS.settings).doc('playingSong');
            const playingSongSnap = await transaction.get(playingSongRef);
            const playingSong = playingSongSnap.data() as PlayingSong;

            if (
                playingSong.status === PlayStatus.PLAYING ||
                playingSong.status === PlayStatus.ENDED
            ) {
                const nextSongQuery = songsRef
                    .where('status', '==', PlayStatus.IN_QUEUE)
                    .orderBy('timestampAdded')
                    .limit(1);
                const nextSongSnapshot = await transaction.get(nextSongQuery);
                if (!nextSongSnapshot.empty) {
                    const nextSongDoc = nextSongSnapshot.docs[0];
                    transaction.update(nextSongDoc.ref, {
                        status: PlayStatus.TRYING_TO_PLAY,
                        timestampTryingToPlay: admin.firestore.FieldValue.serverTimestamp(),
                    });
                    transaction.update(playingSongRef, {
                        ...nextSongDoc.data(),
                        status: PlayStatus.TRYING_TO_PLAY,
                        timestampTryingToPlay: admin.firestore.FieldValue.serverTimestamp(),
                        tries: 0,
                        id: nextSongDoc.ref.id,
                    });
                    console.log(`Next song (${nextSongDoc.id}) set to play.`);
                } else {
                    transaction.update(playingSongRef, {
                        artistName: '',
                        songName: '',
                        singers: '',
                        canonicalUrl: 'https://singa.com/',
                        duration: 0,
                        status: PlayStatus.SONG_NOT_FOUND,
                        tries: 0,
                    });
                    console.log('No more songs found.');
                }
            }
        });
    } catch (error) {
        console.error('Error starting next song:', error);
    }
}

/**
 * Soittaa kappaleen:
 *  - Päivittää ensin Firestore‑dokumentit käyttöliittymätilaa varten.
 *  - Navigoi kappaleen URL‑osoitteeseen.
 *  - Yrittää klikata "play"-nappia ja odottaa slider-elementtiä.
 */
export async function playSong(page: any, song: PlayingSong): Promise<void> {
    try {
        // Päivitetään "karaokePlayer"-dokumenttia käyttöliittymän tilaa varten
        await db.collection(FIRESTORE_COLLECTIONS.settings).doc('karaokePlayer').update({
            overlayMode: 'CLOSED',
            progress: 0,
            isPlayingUpdated: admin.firestore.FieldValue.serverTimestamp(),
            isPlaying: false,
            info: 'Searching for song...',
            endScreenPercentage: ((song.duration - 6) / song.duration) * 100,
        });

        const playingSongSnap = await db.collection(FIRESTORE_COLLECTIONS.settings).doc('playingSong').get();
        const playingSong = playingSongSnap.data() as PlayingSong;

        if (playingSong.status === PlayStatus.TRYING_TO_PLAY && playingSong.tries < 3) {
            await db.collection(FIRESTORE_COLLECTIONS.settings).doc('playingSong').update({
                status: PlayStatus.NAVIGATING_TO_SONG,
                tries: admin.firestore.FieldValue.increment(1),
                statusUpdated: admin.firestore.FieldValue.serverTimestamp(),
            });

            console.log('Navigating to:', song.canonicalUrl);
            await page.goto(song.canonicalUrl, { waitUntil: 'networkidle2' });

            await db.collection(FIRESTORE_COLLECTIONS.settings).doc('karaokePlayer').update({
                overlayMode: 'QUEUE_UNCLICKABLE',
                info: 'Starting song...',
            });

            try {
                await page.waitForSelector(PAGE_PLAY_BUTTON_SELECTOR, { timeout: TIMEOUTS.PAGE_PLAY_BUTTON });
                await page.click(PAGE_PLAY_BUTTON_SELECTOR, { timeout: 500 });
                console.log('Clicked play button.');
                await page.waitForSelector(SLIDER_SELECTOR, { timeout: TIMEOUTS.SLIDER_SELECTOR });
                console.log('Slider found, starting progress monitoring.');
                await db.collection(FIRESTORE_COLLECTIONS.settings).doc('playingSong').update({
                    status: PlayStatus.SLIDER_FOUND,
                    tries: 0,
                    statusUpdated: admin.firestore.FieldValue.serverTimestamp(),
                });
                // Valmis
            } catch (err) {
                await db.collection(FIRESTORE_COLLECTIONS.settings).doc('playingSong').update({
                    status: PlayStatus.TRYING_TO_PLAY,
                    statusUpdated: admin.firestore.FieldValue.serverTimestamp(),
                });
                await db.collection(FIRESTORE_COLLECTIONS.settings).doc('karaokePlayer').update({
                    overlayMode: 'QUEUE_UNCLICKABLE',
                    info: 'Retrying song start...',
                });
            }
        } else {
            await db.collection(FIRESTORE_COLLECTIONS.settings).doc('karaokePlayer').update({
                overlayMode: 'QUEUE',
                info: 'Song could not be started. Please manually close the overlay.',
            });
        }
    } catch (error) {
        console.error('Error playing song:', error);
    }
}

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
export async function startKaraokePlayerListener(page: any): Promise<void> {
    const CHECK_INTERVAL_MS = 1500;
    const MAX_RETRIES_PLAYER = 1;
    const RETRY_THRESHOLD_MS = TIMEOUTS.RETRY_THRESHOLD_MS;

    let playerRetryCount = 0;
    let stuckStartTime: number | null = null;

    // Muuttuja, joka kuvaa, oliko soittimen tila viimeksi "liikkuva"
    let wasMoving = false;
    // Edelliseen intervaliin tallennettu progress-arvo
    let previousProgress = 0;

    setInterval(async () => {
        try {
            // Haetaan progress, kappaleen ja artistin tiedot DOM:sta
            const { progressStr, songName, artistName } = await page.evaluate((selectors: any) => {
                const slider = document.querySelector(selectors.sliderSelector);
                const songElement = document.querySelector(selectors.songNameSelector);
                const artistElement = document.querySelector(selectors.artistSelector);

                // Piilotetaan ylimääräiset elementit
                const button = document.querySelector('.fullscreen-button');
                if (button) (button as HTMLElement).style.display = 'none';
                document.querySelectorAll('.secondscreen-toggle').forEach(div => { (div as HTMLElement).style.display = 'none'; });
                document.querySelectorAll('.queue.mini-queue-button').forEach(btn => { (btn as HTMLElement).style.display = 'none'; });
                document.querySelectorAll('.skip.mini-queue-button').forEach(btn => { (btn as HTMLElement).style.display = 'none'; });

                return {
                    progressStr: slider ? (slider as HTMLElement).style.width : '0%',
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
                    await db.collection(FIRESTORE_COLLECTIONS.settings).doc('playingSong').update({
                        status: PlayStatus.PLAYING,
                        timestampPlaying: admin.firestore.FieldValue.serverTimestamp(),
                        tries: 0,
                    });
                    await db.collection(FIRESTORE_COLLECTIONS.settings).doc('karaokePlayer').update({
                        overlayMode: 'CLOSED',
                        progress: numericProgress,
                        isPlayingUpdated: admin.firestore.FieldValue.serverTimestamp(),
                        isPlaying: true,
                        songName: songName,
                        artistName: artistName,
                        info: '',
                    });
                } else {
                    // Soitin on pysähtynyt: päivitys kertoo, että kappale on keskeytynyt
                    console.log('Transition: playing -> paused/stopped');
                    // Päivitetään "karaokePlayer" dokumentti; tarkastellaan progress-arvoa
                    await db.collection(FIRESTORE_COLLECTIONS.settings).doc('karaokePlayer').update({
                        isPlaying: false,
                        info: numericProgress > 0 ? 'Song is paused.' : 'Song has not started.',
                        overlayMode: 'QUEUE',
                        isPlayingUpdated: admin.firestore.FieldValue.serverTimestamp(),
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
                } else {
                    const elapsedTime = Date.now() - stuckStartTime;
                    if (elapsedTime >= RETRY_THRESHOLD_MS && playerRetryCount < MAX_RETRIES_PLAYER) {
                        playerRetryCount++;
                        console.log(`Song did not start after ${RETRY_THRESHOLD_MS / 1000} seconds, retrying...`);
                        try {
                            await page.waitForSelector(PLAYER_PLAY_BUTTON_SELECTOR, { timeout: 5000 });
                            await page.click(PLAYER_PLAY_BUTTON_SELECTOR, { timeout: 500 });
                            stuckStartTime = null;
                        } catch (err) {
                            console.error('Error in retry loop:', err);
                        }
                    }
                }
            } else {
                // Kun progress ei ole 0, nollataan stuck-mittari ja retry-laskuri
                stuckStartTime = null;
                playerRetryCount = 0;
            }

            // Jos kappale on loppumassa, vaihdetaan overlayMode tilaan QUEUE.
            // Käytetään "endScreenPercentage" kenttää, jos se on asetettu "karaokePlayer" dokumenttiin, muuten oletuksena 97%.
            const karaokePlayerSnap = await db.collection(FIRESTORE_COLLECTIONS.settings).doc('karaokePlayer').get();
            const karaokePlayer = karaokePlayerSnap.data();
            const threshold = karaokePlayer && karaokePlayer.endScreenPercentage ? karaokePlayer.endScreenPercentage : QUEUE_UPDATE_THRESHOLD_PERCENT;
            if (numericProgress >= threshold) {
                try {
                    await db.collection(FIRESTORE_COLLECTIONS.settings).doc('karaokePlayer').update({
                        overlayMode: 'QUEUE'
                    });
                    console.log('OverlayMode updated five seconds before song end.');
                } catch (updateError) {
                    console.error('Failed to update OverlayMode:', updateError);
                }
            }


            // Jos progress saavuttaa END_THRESHOLD_PERCENT (100%), määritellään kappale päättyneeksi
            if (numericProgress >= END_THRESHOLD_PERCENT) {
                console.log('Progress reached 100%. Ending song.');
                await db.collection(FIRESTORE_COLLECTIONS.settings).doc('playingSong').update({
                    status: PlayStatus.ENDED,
                    timestampPlaying: admin.firestore.FieldValue.serverTimestamp(),
                    tries: 0,
                });
                // Jos autoplay on päällä, siirrytään seuraavaan kappaleeseen
                const karaokePlayerSnap = await db.collection(FIRESTORE_COLLECTIONS.settings).doc('karaokePlayer').get();
                const karaokePlayer = karaokePlayerSnap.data();
                if (karaokePlayer && karaokePlayer.isAutoPlay) {
                    console.log('Autoplay is on. Proceeding to next song.');
                    await setNextSongToPlay();
                } else {
                    console.log('Autoplay is off. Waiting for manual action.');
                    await db.collection(FIRESTORE_COLLECTIONS.settings).doc('karaokePlayer').update({
                        overlayMode: 'QUEUE',
                        info: 'No songs in queue.',
                    });
                }
            }

            // Päivitetään edellinen progress seuraavaa kierrosta varten
            previousProgress = numericProgress;

        } catch (err) {
            console.error('Error in progress listener:', err);
        }
    }, CHECK_INTERVAL_MS);
}