import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import './i18n';
import App from './App';
import './styles.css';

registerSW({ immediate: true });

// Ask the browser not to evict the (large) cached model + saved recipes.
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
