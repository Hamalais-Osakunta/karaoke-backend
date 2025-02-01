/**
 * OverlayService huolehtii queue‑overlayjen luomisesta ja päivittämisestä
 * Puppeteer‑sovelluksen sivulla.
 */
declare global {
  interface Window {
    setOverlayMode: (mode: string) => void;
  }
}

export async function openUnclickableKaraokeQueue(page: any): Promise<void> {
    try {
      await createKaraokeQueueToggle(page, 'https://karaoke-29c39.web.app/trying-to-play-screen');
      await page.evaluate(() => {
        const overlay = document.getElementById('song-list-overlay');
        const openButton = document.getElementById('open-queue-button');
        if (overlay) {
          overlay.style.display = 'flex';
          overlay.style.pointerEvents = 'none';
        }
        if (openButton) {
          openButton.style.display = 'none';
        }
        const smallIframe = document.getElementById('small-iframe');
        if (smallIframe) smallIframe.remove();
      });
    } catch (error) {
      console.error('Error in openUnclickableKaraokeQueue:', error);
    }
  }
  
  export async function openKaraokeQueue(page: any): Promise<void> {
    try {
      await createKaraokeQueueToggle(page, 'https://karaoke-29c39.web.app/karaoke-screen');
      await page.evaluate(() => {
        const overlay = document.getElementById('song-list-overlay');
        const openButton = document.getElementById('open-queue-button');
        if (overlay) {
          overlay.style.pointerEvents = 'auto';
          overlay.style.display = 'flex';
        }
        if (openButton) {
          openButton.style.display = 'none';
        }
        const smallIframe = document.getElementById('small-iframe');
        if (smallIframe) smallIframe.remove();
      });
    } catch (error) {
      console.error('Error in openKaraokeQueue:', error);
    }
  }
  
  export async function closeKaraokeQueue(page: any): Promise<void> {
    try {
      await createKaraokeQueueToggle(page, 'https://karaoke-29c39.web.app/karaoke-screen');
      await page.evaluate(() => {
        const overlay = document.getElementById('song-list-overlay');
        const openButton = document.getElementById('open-queue-button');
        if (overlay) {
          overlay.style.display = 'none';
          overlay.style.pointerEvents = 'auto';
        }
        if (openButton) {
          openButton.style.display = 'block';
        }
        let smallIframe = document.getElementById('small-iframe');
        if (!smallIframe) {
          smallIframe = document.createElement('iframe');
          smallIframe.id = 'small-iframe';
          (smallIframe as HTMLIFrameElement).src = 'https://karaoke-29c39.web.app/scrolling-bar';
          Object.assign(smallIframe.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '80px',
            border: 'none',
            overflow: 'hidden',
            pointerEvents: 'none',
            zIndex: '1003',
            opacity: 0.8,
          });
          document.body.appendChild(smallIframe);
        }
      });
    } catch (error) {
      console.error('Error in closeKaraokeQueue:', error);
    }
  }
  
  async function createKaraokeQueueToggle(page: any, url: string): Promise<void> {
    try {
      await page.evaluate((iframeUrl: string) => {
        let openButton = document.getElementById('open-queue-button');
        if (!openButton) {
          openButton = document.createElement('button');
          openButton.id = 'open-queue-button';
          openButton.textContent = 'Avaa Hämis-jono';
          Object.assign(openButton.style, {
            position: 'absolute',
            top: '20px',
            right: '20px',
            padding: '10px 20px',
            backgroundColor: '#FF0000',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            zIndex: '2002',
            fontSize: '1em',
            transition: 'background-color 0.3s',
            display: 'block',
          });
          openButton.addEventListener('mouseenter', () => {
            if (openButton) {
              openButton.style.backgroundColor = '#e60000';
            }
          });
          openButton.addEventListener('mouseleave', () => {
            if (openButton) {
              openButton.style.backgroundColor = '#FF0000';
            }
          });
          openButton.addEventListener('click', () => {
            if (typeof window.setOverlayMode === 'function') {
              window.setOverlayMode('QUEUE');
            } else {
              console.error('setOverlayMode is not available');
            }
          });
          document.body.appendChild(openButton);
        }
        let overlay = document.getElementById('song-list-overlay');
        let mainIframe = document.getElementById('karaoke-queue-iframe');
        if (mainIframe) {
          if (mainIframe.getAttribute('src') !== iframeUrl) {
            mainIframe.setAttribute('src', iframeUrl);
          }
        } else {
          mainIframe = document.createElement('iframe');
          mainIframe.id = 'karaoke-queue-iframe';
          mainIframe.setAttribute('src', iframeUrl);
          Object.assign(mainIframe.style, {
            width: '90%',
            height: '90%',
            border: 'none',
            borderRadius: '8px',
            zIndex: '1000',
          });
        }
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.id = 'song-list-overlay';
          Object.assign(overlay.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            zIndex: '2001',
            display: 'none',
            justifyContent: 'center',
            alignItems: 'center',
          });
          const closeButton = document.createElement('button');
          closeButton.id = 'close-overlay-button';
          closeButton.textContent = 'Sulje';
          Object.assign(closeButton.style, {
            position: 'absolute',
            top: '20px',
            right: '20px',
            padding: '10px 20px',
            backgroundColor: '#FF0000',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            zIndex: '2002',
            fontSize: '1em',
          });
          closeButton.addEventListener('click', () => {
            if (typeof window.setOverlayMode === 'function') {
              window.setOverlayMode('CLOSED');
            } else {
              console.error('setOverlayMode is not available');
            }
          });
          overlay.appendChild(closeButton);
          overlay.appendChild(mainIframe);
          document.body.appendChild(overlay);
        } else {
          if (!overlay.contains(mainIframe)) {
            overlay.appendChild(mainIframe);
          }
        }
        const smallIframe = document.getElementById('small-iframe');
        if (smallIframe) smallIframe.remove();
      }, url);
    } catch (error) {
      console.error('Error creating karaoke queue toggle:', error);
    }
  }
  