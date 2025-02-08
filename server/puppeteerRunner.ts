import puppeteer, { Browser, Page } from 'puppeteer';
import { login } from './login';
import { monitorKaraokePlayer, monitorPlayingSong, startKaraokePlayerListener } from './PlaybackService';

async function main(): Promise<void> {
  // const url = process.env.URL;

  let browser: Browser | null = null;
  try {
    browser = await puppeteer.launch({
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
    const page: Page = await browser.newPage();
    page.setBypassCSP(true);

    // Expose a function for overlay mode updates
    await page.exposeFunction('setOverlayMode', async (status: string) => {
      console.log('Overlay mode set to:', status);
      await page.evaluate((newStatus: string) => {
        const overlay = document.getElementById('song-list-overlay');
        const openButton = document.getElementById('open-queue-button');
        const closeButton = document.getElementById('close-queue-button');

        if (overlay) {
          if (newStatus === 'CLOSED') {
            overlay.style.display = 'none';
          } else if (newStatus === 'QUEUE') {
            overlay.style.display = 'flex';
            overlay.style.pointerEvents = 'auto';
          }
        }
        if (openButton) {
          if (newStatus === 'CLOSED') {
            openButton.style.display = 'block';
          } else if (newStatus === 'QUEUE') {
            openButton.style.display = 'none';
          }
        }
        if (closeButton) {
          if (newStatus === 'CLOSED') {
            closeButton.style.display = 'none';
          } else if (newStatus === 'QUEUE') {
            closeButton.style.display = 'block';
          }
        }
      }, status);
    });

    await login(page, browser);
    // Kommentoi yllä oleva rivi ja ota alla oleva rivi käyttöön, jos haluat testata ilman kirjautumista
    // await page.goto('https://singa.com/fi/discover/', { waitUntil: 'networkidle2' });

    monitorKaraokePlayer(page);
    monitorPlayingSong(page);
    startKaraokePlayerListener(page);

  } catch (error) {
    console.error('Error in main function:', error);
    if (browser) await browser.close();
  }
}

main().catch((error) => {
  console.error('Unhandled error in main:', error);
});
