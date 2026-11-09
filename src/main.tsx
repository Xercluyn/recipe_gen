import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import './i18n';
import App from './App';
import './styles.css';

registerSW({
  immediate: true,
  // iOS keeps home-screen apps alive for a long time; look for a new version whenever the
  // app comes back to the foreground (and hourly) so users never run a stale build.
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    const check = () => {
      if (navigator.onLine) registration.update().catch(() => {});
    };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
    setInterval(check, 60 * 60 * 1000);
  },
});

// Ask the browser not to evict saved recipes.
try {
  void navigator.storage?.persist?.().catch(() => undefined);
} catch {
  /* unsupported */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);

// One-time cleanup: older versions ran the AI on-device (WebLLM) and cached
// model files (can be >1 GB). Remove them after first render, without blocking.
const CLEANUP_FLAG = 'recipe-gen:webllm-cleaned';
async function cleanupOldModelData(): Promise<void> {
  try {
    if (localStorage.getItem(CLEANUP_FLAG)) return;
  } catch {
    return; // no storage: can't record that we ran, skip
  }
  try {
    if (typeof caches !== 'undefined') {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith('webllm')).map((n) => caches.delete(n)));
    }
  } catch {
    /* ignore */
  }
  try {
    if (typeof indexedDB !== 'undefined' && typeof indexedDB.databases === 'function') {
      const dbs = await indexedDB.databases();
      for (const { name } of dbs) {
        if (name && name.startsWith('webllm')) indexedDB.deleteDatabase(name);
      }
    }
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(CLEANUP_FLAG, '1');
  } catch {
    /* ignore */
  }
}
setTimeout(() => void cleanupOldModelData(), 3000);
