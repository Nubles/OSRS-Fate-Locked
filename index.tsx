import { lazyWithRetry } from './utils/lazyRetry';
import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
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
const isOverlay = window.location.hash.startsWith('#/overlay');

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {isOverlay
      ? <Suspense fallback={null}><StreamOverlay /></Suspense>
      : <App />}
  </React.StrictMode>
);
