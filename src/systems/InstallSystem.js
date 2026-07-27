import { Events, eventBus } from '../core/EventBus.js';

// Getting the game onto her home screen so it behaves like a normal app: its own
// icon, no browser chrome, and it opens with the wifi off.
//
// Everything here is best-effort by design. If the browser never offers an install
// prompt, she is shown the manual steps instead; if the service worker fails to
// register, the game still works online. Neither path is allowed to break play.

let deferredPrompt = null;

export function watchForInstallPrompt(ui) {
  // Already installed: running standalone means there is nothing to offer.
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone;
  if (standalone) {
    ui.setInstallAvailable(false);
    return;
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    // Chrome shows its own mini-infobar unless this is prevented; a big obvious
    // button on the greeting screen is far easier for her to find.
    event.preventDefault();
    deferredPrompt = event;
    ui.setInstallAvailable(true);
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    ui.setInstallAvailable(false);
  });

  eventBus.on(Events.UI_INSTALL, async () => {
    if (!deferredPrompt) {
      // Samsung Internet in particular often never fires beforeinstallprompt, so the
      // fallback is to tell her exactly which menu item to look for.
      ui.showInstallHelp();
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') ui.setInstallAvailable(false);
    deferredPrompt = null;
  });
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // Dev has no service worker to register, and caching a dev server would make
  // changes appear not to take effect.
  if (!import.meta.env.PROD) return;

  window.addEventListener('load', () => {
    // A relative URL, so it resolves under the GitHub Pages project path rather than
    // the domain root — the same trap as every other asset in this project.
    const url = new URL('sw.js', document.baseURI).href;
    navigator.serviceWorker.register(url, { scope: './' }).catch((error) => {
      console.warn('offline support unavailable:', error);
    });
  });
}
