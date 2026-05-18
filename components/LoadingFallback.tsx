import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Suspense fallback for lazy-loaded modals. Renders a centered spinner over a
 * dimmed backdrop so the modal chunk loading feels intentional rather than a
 * blank flash on slower connections.
 */
export const ModalFallback: React.FC<{ label?: string }> = ({ label = 'Loading…' }) => (
  <div className="fixed inset-0 z-[120] bg-black/70 flex items-center justify-center">
    <div className="flex flex-col items-center gap-3 text-gray-400">
      <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      <span className="text-xs font-medium tracking-wide">{label}</span>
    </div>
  </div>
);
