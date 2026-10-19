import React from 'react';
import { OsrsJournalScreen } from './OsrsJournalScreen';

/**
 * The classic layout's Journal tab when Settings says "Ready now"
 * (utils/journalLayout.ts): the OSRS layout's Journal window, drawn inside
 * an .osrs-island so its stylesheets apply here and nowhere else on the page.
 */
const OsrsJournalIsland: React.FC = () => (
  <div className="osrs-island h-full flex flex-col">
    <OsrsJournalScreen shell="classic" />
  </div>
);

export default OsrsJournalIsland;
