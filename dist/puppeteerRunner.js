"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const puppeteer_1 = __importDefault(require("puppeteer"));
const login_1 = require("./login");
const PlaybackService_1 = require("./PlaybackService");
async function main() {
    // const url = process.env.URL;
    let browser = null;
    try {
        browser = await puppeteer_1.default.launch({
            headless: false,
            args: ['--kiosk'],
            // Testaukseen ei-kokonäyttö
            /* args: [
              '--window-size=1920,1080',
              '--disable-infobars',
              '--start-maximized'
            ], */
            defaultViewport: null,
        });
        const page = await browser.newPage();
        page.setBypassCSP(true);
        // Expose a function for overlay mode updates
        await page.exposeFunction('setOverlayMode', async (status) => {
            console.log('Overlay mode set to:', status);
            await page.evaluate((newStatus) => {
                const overlay = document.getElementById('song-list-overlay');
                const openButton = document.getElementById('open-queue-button');
                const closeButton = document.getElementById('close-queue-button');
                if (overlay) {
                    if (newStatus === 'CLOSED') {
                        overlay.style.display = 'none';
                    }
                    else if (newStatus === 'QUEUE') {
                        overlay.style.display = 'flex';
                        overlay.style.pointerEvents = 'auto';
                    }
                }
                if (openButton) {
                    if (newStatus === 'CLOSED') {
                        openButton.style.display = 'block';
                    }
                    else if (newStatus === 'QUEUE') {
                        openButton.style.display = 'none';
                    }
                }
                if (closeButton) {
                    if (newStatus === 'CLOSED') {
                        closeButton.style.display = 'none';
                    }
                    else if (newStatus === 'QUEUE') {
                        closeButton.style.display = 'block';
                    }
                }
            }, status);
        });
        await (0, login_1.login)(page, browser);
        // Kommentoi yllä oleva rivi ja ota alla oleva rivi käyttöön, jos haluat testata ilman kirjautumista
        // await page.goto('https://singa.com/fi/discover/', { waitUntil: 'networkidle2' });
        (0, PlaybackService_1.monitorKaraokePlayer)(page);
        (0, PlaybackService_1.monitorPlayingSong)(page);
        (0, PlaybackService_1.startKaraokePlayerListener)(page);
    }
    catch (error) {
        console.error('Error in main function:', error);
        if (browser)
            await browser.close();
    }
}
main().catch((error) => {
    console.error('Unhandled error in main:', error);
});
