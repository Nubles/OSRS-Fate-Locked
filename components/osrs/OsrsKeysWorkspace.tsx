import React from 'react';
import { useOsrsNav } from '../../utils/osrsNav';
import OsrsFarmKeys from './OsrsFarmKeys';
import OsrsSpend from './OsrsSpend';
import OsrsHistory from './OsrsHistory';

/**
 * The wide Keys interface (screen 'keys'): the FarmKeys-NPCs, SpendRoll and
 * History boards. Each view draws its own windows and the shared tab strip
 * (OsrsKeysTabs) where its board puts it; this only picks the tab.
 */
export const OsrsKeysWorkspace: React.FC = () => {
  const { keysTab } = useOsrsNav();
  return (
    <div className="okeys-screen" style={{ height: '100%', minHeight: 0 }}>
      {keysTab === 'farm' && <OsrsFarmKeys wide />}
      {keysTab === 'spend' && <OsrsSpend wide />}
      {keysTab === 'history' && <OsrsHistory wide />}
    </div>
  );
};
export default OsrsKeysWorkspace;
