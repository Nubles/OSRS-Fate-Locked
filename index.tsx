import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

// Streamer overlay: `#/overlay?code=XYZ` renders a transparent OBS-friendly
// badge bar instead of the app (hash-based so it works on GitHub Pages with
// no router, lazy so the main bundle doesn't pay for it).
const StreamOverlay = lazy(() => import('./components/StreamOverlay'));
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
