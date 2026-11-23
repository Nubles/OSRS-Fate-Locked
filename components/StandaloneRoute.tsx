import React, { ReactNode, Suspense } from 'react';
import { PanelErrorBoundary } from './PanelErrorBoundary';

/**
 * A page that index.tsx renders instead of the app (the stream overlay, a
 * public Adventurer's Log). App's own boundary does not cover these, so wrap
 * the lazy page here: a failed chunk load reloads for a new build or shows
 * Reload, and a crash shows a message instead of a blank page.
 */
export const StandaloneRoute: React.FC<{ name: string; children: ReactNode }> = ({ name, children }) => (
  <PanelErrorBoundary name={name}>
    <Suspense fallback={null}>{children}</Suspense>
  </PanelErrorBoundary>
);
