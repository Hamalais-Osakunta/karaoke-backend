"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = void 0;
const firebaseAdmin_1 = require("./firebaseAdmin");
const config_1 = require("./config");
const loginCredentials = require('./loginCredentials.json');
const LOGIN_URL = 'https://singa.com/fi/login';
const EMAIL = loginCredentials.EMAIL;
const PASSWORD = loginCredentials.PASSWORD;
const LOGIN_SELECTORS = {
    emailInput: '#loginEmail',
    passwordInput: '#loginPassword',
    acceptButton: 'button.is-full.is-primary.button',
    nextButton: 'button.is-transparent-dark.is-regular.is-full-width.button[type="submit"]',
    loginButton: 'button.is-full-width.is-transparent-dark.is-regular.button[type="button"]',
    karaokeInput: 'input[placeholder="Mitä haluaisit laulaa?"][aria-label="Hakukenttä"].input.is-rounded'
};
async function login(page, browser) {
    try {
        await showFullScreenInfoText(page, 'Starting karaoke app...', 'Logging in...');
        await page.goto(LOGIN_URL, { waitUntil: 'networkidle2' });
        await showFullScreenInfoText(page, 'Starting karaoke app...', 'Logging in...');
        console.log('Navigated to login page.');
        await typeText(page, LOGIN_SELECTORS.emailInput, EMAIL, 'email');
        const acceptButtonExists = await page.$(LOGIN_SELECTORS.acceptButton);
        if (acceptButtonExists) {
            await clickButton(page, LOGIN_SELECTORS.acceptButton, 'Accept');
        }
        else {
            console.log('Accept button not found, proceeding...');
        }
        await clickButton(page, LOGIN_SELECTORS.nextButton, 'Next');
        await showFullScreenInfoText(page, 'Starting karaoke app...', 'Logging in...');
        await typeText(page, LOGIN_SELECTORS.passwordInput, PASSWORD, 'password');
        await clickButton(page, LOGIN_SELECTORS.loginButton, 'Login');
        await clickButton(page, LOGIN_SELECTORS.loginButton, 'Login');
        try {
            await page.waitForSelector(LOGIN_SELECTORS.karaokeInput, { timeout: 100000 });
            console.log('Login complete, karaoke input found.');
            await removeFullScreenInfoText(page);
        }
        catch (error) {
            console.warn('Login did not complete in time:', error);
            await browser.close();
        }
        await firebaseAdmin_1.db.collection(config_1.FIRESTORE_COLLECTIONS.settings).doc('karaokePlayer').update({
            progress: 0,
            isPlayingUpdated: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
            isPlaying: false,
            songName: '',
            artistName: '',
            overlayMode: 'QUEUE',
        });
    }
    catch (error) {
        console.error('Error during login:', error);
        await browser.close();
    }
}
exports.login = login;
async function clickButton(page, selector, actionDescription) {
    try {
        await page.waitForSelector(selector, { timeout: 5000 });
        await page.click(selector);
        console.log(`Clicked ${actionDescription} button.`);
    }
    catch (error) {
        console.warn(`Could not click ${actionDescription} button:`, error);
    }
}
async function typeText(page, selector, text, fieldDescription) {
    try {
        await page.waitForSelector(selector);
        await page.type(selector, text);
        console.log(`Typed ${fieldDescription}.`);
    }
    catch (error) {
        console.error(`Error typing in ${fieldDescription}:`, error);
        throw error;
    }
}
async function removeFullScreenInfoText(page) {
    await page.evaluate(() => {
        const overlay = document.getElementById('custom-overlay');
        if (overlay)
            overlay.remove();
    });
}
async function showFullScreenInfoText(page, mainText, subText) {
    await page.evaluate((overlayMainText, overlaySubText) => {
        const existingOverlay = document.getElementById('custom-overlay');
        if (existingOverlay)
            existingOverlay.remove();
        const overlay = document.createElement('div');
        overlay.id = 'custom-overlay';
        Object.assign(overlay.style, {
            pointerEvents: 'none',
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            zIndex: '1000',
            padding: '20px',
            boxSizing: 'border-box',
            textAlign: 'center',
        });
        const mainElement = document.createElement('div');
        mainElement.textContent = overlayMainText;
        mainElement.style.fontSize = '32px';
        mainElement.style.marginBottom = '10px';
        const subElement = document.createElement('div');
        subElement.textContent = overlaySubText;
        subElement.style.fontSize = '18px';
        overlay.appendChild(mainElement);
        overlay.appendChild(subElement);
        document.body.appendChild(overlay);
    }, mainText, subText);
}
