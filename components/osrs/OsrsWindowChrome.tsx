import React from 'react';
import './osrs-windows-b.css';

/**
 * The OSRS layout's window chrome for the modal windows that keep their
 * classic component (Fate Thread, Kill Planner, Share Run, Timelapse, Your
 * Pets): the centred orange title bar of the Journal and Keys windows with
 * the square stone close button and its orange cross. Only rendered when
 * useIsOsrsUi() is true, so the classic layout never sees it.
 */
export const OsrsCloseButton: React.FC<{ onClose: () => void; label?: string; className?: string }> = ({ onClose, label = 'Close', className }) => (
  <button type="button" className={`osrs-btn owb-close${className ? ` ${className}` : ''}`} aria-label={label} title="Close" onClick={onClose}>
    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="2.5" /></svg>
  </button>
);

export const OsrsTitleBar: React.FC<{
  title: React.ReactNode;
  /** id for the heading, when the dialog is labelled by it. */
  id?: string;
  onClose?: () => void;
  closeLabel?: string;
  /** Small controls drawn just left of the close button, such as a "?" guide. */
  tools?: React.ReactNode;
}> = ({ title, id, onClose, closeLabel, tools }) => (
  <div className="owb-titlebar">
    <h2 id={id} className="owb-title">{title}</h2>
    {(tools || onClose) && (
      <span className="owb-titlebar-tools">
        {tools}
        {onClose && <OsrsCloseButton onClose={onClose} label={closeLabel} />}
      </span>
    )}
  </div>
);
