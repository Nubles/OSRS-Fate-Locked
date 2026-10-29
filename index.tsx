// First, so it reports errors thrown while the modules below load.
import './utils/errorBeacon';
import { lazyWithRetry } from './utils/lazyRetry';
import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import './components/osrs/osrs-skin.css';
import { applyUiStyle } from './utils/uiStyle';
import { hashView, watchHashView } from './utils/hashView';
import { moveRole, pairingForwardUrl, readMovedRecord } from './utils/moveRole';
import { NEW_TRACKER_URL } from './config/trackerAddress';
// NOTE: deliberately no `vite:preloadError` handler here. Calling
// event.preventDefault() makes Vite SWALLOW the failure — the dynamic import
// then resolves with an undefined module and call sites crash with a mangled
// TypeError instead of a recognizable chunk-load error. Left alone, Vite
// rethrows, the rejection reaches lazyWithRetry, and the error boundaries
// own the reload path once retries are exhausted.

// Streamer overlay: `#/overlay?code=XYZ` renders a transparent OBS-friendly
// badge bar instead of the app (hash-based so it works on GitHub Pages with
// no router, lazy so the main bundle doesn't pay for it).
const StreamOverlay = lazyWithRetry(() => import('./components/StreamOverlay'));
// A run's public Adventurer's Log: `#/log/<run id>`, read-only, lazy like the overlay.
const AdventurersLog = lazyWithRetry(() => import('./components/AdventurersLog'));
const view = hashView(window.location.hash);
// A link to another page pasted into this tab only changes the hash: reload to show it.
watchHashView(view);

// The address move (utils/originMove.ts), inert while NEW_TRACKER_URL is empty.
// The new address shows the move screen at `?move-in`; the old one passes a
// RuneLite pairing link on once every run here has moved.
// While the address is empty, all of this folds away at build time.
const MoveInScreen = /* @__PURE__ */ lazyWithRetry(() => import('./components/MoveInScreen'));
const role = NEW_TRACKER_URL === '' ? null : moveRole(window.location.origin);
const isMoveIn = role === 'new' && new URLSearchParams(window.location.search).has('move-in');
const pairingForward = role === 'old' ? pairingForwardUrl(role, window.location.hash, readMovedRecord()) : null;

// Set <html data-ui> before the first paint so the OSRS skin never flashes.
applyUiStyle();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const start = () => {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      {view.kind === 'overlay'
        ? <Suspense fallback={null}><StreamOverlay /></Suspense>
        : isMoveIn
          ? <Suspense fallback={null}><MoveInScreen /></Suspense>
        : view.kind === 'log'
          ? <Suspense fallback={null}><AdventurersLog id={view.id} /></Suspense>
          : <App />}
    </React.StrictMode>
  );
};

// The private preview build carries its own copies of wiki images; the live
// build drops this branch at compile time.
if (pairingForward !== null) {
  window.location.replace(pairingForward);
} else if (import.meta.env.VITE_PREVIEW_IMAGE_PACK === '1') {
  import('./utils/previewImagePack').then(m => m.installPreviewImagePack()).catch(() => {}).finally(start);
} else {
  start();
}
