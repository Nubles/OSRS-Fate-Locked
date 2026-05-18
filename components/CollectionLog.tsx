
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { COLLECTION_LOG_DATA } from '../data/collectionLogData';
import { Search, CheckCircle2, Lock, ListFilter, Coins, TrendingUp } from 'lucide-react';
import { DropSource } from '../types';
import { DROP_RATES } from '../constants';
import { FixedSizeGrid as Grid } from 'react-window';
import { wikiService } from '../services/WikiService';
import { priceService } from '../services/PriceService';

interface CollectionLogProps {
  searchTerm?: string;
}

// Separate component to handle async image fetching
const LogItemImage = ({ name }: { name: string }) => {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    wikiService.fetchImage(name).then((url) => {
      if (mounted && url) setSrc(url);
    });
    return () => { mounted = false; };
  }, [name]);

  if (!src) {
      return (
          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
              <span className="text-[8px] text-gray-600">?</span>
          </div>
      );
  }

  return (
    <img 
        src={src} 
        alt={name}
        loading="lazy"
        className="max-w-full max-h-full object-contain drop-shadow-md"
        onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
    />
  );
};

const Cell = ({ columnIndex, rowIndex, style, data }: any) => {
  const { items, unlocks, searchTerm, handleItemClick } = data;
  const index = rowIndex * 4 + columnIndex; // 4 columns
  if (index >= items.length) return null;
  
  const item = items[index];
  const count = unlocks.collectionLog[item.id] || 0;
  const isUnlocked = count > 0;
  const isHighlighted = searchTerm && item.name.toLowerCase().includes(searchTerm.toLowerCase());

  return (
    <div style={style} className="p-1">
       <div 
         className={`
           group relative flex flex-col items-center justify-center p-1 rounded transition-all duration-200 cursor-pointer h-full border border-transparent
           ${isHighlighted ? 'bg-white/10 ring-1 ring-[#ff981f]' : 'hover:bg-white/5 hover:border-[#ff981f]/30'}
         `}
         onClick={(e) => handleItemClick(e, item.id, item.name)}
         title={`${item.name} ${isUnlocked ? `(x${count})` : '(Locked)'}`}
       >
         <div className="relative w-10 h-10 flex items-center justify-center">
           <div className={`transition-all duration-300 w-full h-full flex items-center justify-center ${isUnlocked ? 'opacity-100' : 'opacity-30 grayscale blur-[1px] group-hover:blur-0'}`}>
               <LogItemImage name={item.name} />
           </div>
           
           {isUnlocked && count > 1 && (
             <div className="absolute -top-1 -right-1 text-[8px] font-bold text-black bg-[#ff981f] px-1 rounded-full border border-black shadow-sm leading-tight z-10">
               {count}
             </div>
           )}
           {!isUnlocked && (
             <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-40">
               <Lock size={12} className="text-[#887]" />
             </div>
           )}
         </div>
         <span className={`text-[8px] mt-1 text-center leading-tight line-clamp-2 w-full ${isUnlocked ? 'text-green-400' : 'text-[#887]'} ${isHighlighted ? 'text-white font-bold' : ''}`}>
           {item.name}
         </span>
         {item.sourcePage && (
             <span className="text-[7px] text-[#ff981f]/60 mt-0.5 text-center leading-none w-full truncate px-1">
                 {item.sourcePage}
             </span>
         )}
       </div>
    </div>
  );
};

export const CollectionLog: React.FC<CollectionLogProps> = ({ searchTerm = '' }) => {
  const { unlocks, logCollectionItem, rollForKey } = useGame();
  const [activeTab, setActiveTab] = useState(Object.keys(COLLECTION_LOG_DATA)[0]);
  const [activePage, setActivePage] = useState<string>('');
  const [viewMode, setViewMode] = useState<'PAGE' | 'SEARCH_ALL'>('PAGE');
  
  // Pricing State
  const [vaultValue, setVaultValue] = useState(0);
  const [mostValuable, setMostValuable] = useState<{name: string, value: number} | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Init Prices and Calculate Wealth
  useEffect(() => {
    const calcWealth = async () => {
        await priceService.init();
        let total = 0;
        let maxItem = { name: '', value: 0 };

        // Iterate all known collection log items
        Object.values(COLLECTION_LOG_DATA).forEach(tab => {
            Object.values(tab.pages).forEach(page => {
                page.items.forEach(item => {
                    const count = unlocks.collectionLog[item.id] || 0;
                    if (count > 0) {
                        const price = priceService.getPrice(item.name);
                        const stackValue = price * count;
                        if (price > 0) {
                            total += stackValue;
                            if (price > maxItem.value) {
                                maxItem = { name: item.name, value: price };
                            }
                        }
                    }
                });
            });
        });
        setVaultValue(total);
        setMostValuable(maxItem.value > 0 ? maxItem : null);
    };
    calcWealth();
  }, [unlocks.collectionLog]);

  const formatNumber = (num: number) => {
      if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
      if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
      if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
      return num.toLocaleString();
  };

  useEffect(() => {
    if (containerRef.current) {
      setContainerSize({
        width: containerRef.current.offsetWidth,
        height: containerRef.current.offsetHeight
      });
    }
    const observer = new ResizeObserver(entries => {
      if (entries[0]) {
        setContainerSize({
          width: entries[0].contentRect.width,
          height: entries[0].contentRect.height
        });
      }
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const currentTabContent = COLLECTION_LOG_DATA[activeTab];
  
  // Reset to default page on tab switch if not searching or if invalid page
  useEffect(() => {
    if (viewMode === 'PAGE' && currentTabContent && !currentTabContent.pages[activePage]) {
      const firstPage = Object.keys(currentTabContent.pages)[0];
      setActivePage(firstPage);
    }
  }, [activeTab, currentTabContent, activePage, viewMode]);

  // Switch to search mode on search term change
  useEffect(() => {
      if (searchTerm) {
          setViewMode('SEARCH_ALL');
      } else {
          setViewMode('PAGE');
      }
  }, [searchTerm]);

  const handleItemClick = (e: React.MouseEvent, itemId: number, itemName: string) => {
    const isNewUnlock = !unlocks.collectionLog[itemId];
    logCollectionItem(itemId);
    if (isNewUnlock) {
       rollForKey(`Col. Log: ${itemName}`, DROP_RATES[DropSource.COLLECTION_LOG], e.clientX, e.clientY);
    }
  };

  // 1. Gather all matching pages for the Sidebar
  const filteredPages = useMemo(() => {
    if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase();
        const results: { tab: string; key: string; data: any }[] = [];
        Object.entries(COLLECTION_LOG_DATA).forEach(([tabName, tabData]) => {
            Object.entries(tabData.pages).forEach(([pageKey, pageData]) => {
                const nameMatch = pageData.name.toLowerCase().includes(lowerSearch);
                const itemMatch = pageData.items.some(item => item.name.toLowerCase().includes(lowerSearch));
                if (nameMatch || itemMatch) results.push({ tab: tabName, key: pageKey, data: pageData });
            });
        });
        return results;
    }
    if (!currentTabContent) return [];
    return Object.entries(currentTabContent.pages).map(([key, data]) => ({ tab: activeTab, key, data }));
  }, [activeTab, currentTabContent, searchTerm]);

  // 2. Gather ALL matching items for "All Results" view
  const allSearchItems = useMemo(() => {
      if (!searchTerm) return [];
      const lowerSearch = searchTerm.toLowerCase();
      const results: any[] = [];
      
      Object.entries(COLLECTION_LOG_DATA).forEach(([tabName, tabData]) => {
        Object.entries(tabData.pages).forEach(([pageKey, pageData]) => {
          const pageNameMatch = pageData.name.toLowerCase().includes(lowerSearch);
          if (pageNameMatch) {
             // If page matches, include all items
             pageData.items.forEach(item => results.push({ ...item, sourcePage: pageData.name, sourceTab: tabName }));
          } else {
             // Otherwise include only matching items
             pageData.items.forEach(item => {
                if (item.name.toLowerCase().includes(lowerSearch)) {
                   results.push({ ...item, sourcePage: pageData.name, sourceTab: tabName });
                }
             });
          }
        });
      });
      return results;
  }, [searchTerm]);

  // 3. Determine which items to show in the Grid
  const activeItems = useMemo(() => {
      if (searchTerm && viewMode === 'SEARCH_ALL') {
          return allSearchItems;
      }
      return currentTabContent?.pages[activePage]?.items || [];
  }, [viewMode, searchTerm, allSearchItems, currentTabContent, activePage]);

  const itemData = useMemo(() => ({
    items: activeItems,
    unlocks,
    searchTerm,
    handleItemClick
  }), [activeItems, unlocks, searchTerm]);

  const globalStats = useMemo(() => {
    let obtained = 0, total = 0;
    Object.values(COLLECTION_LOG_DATA).forEach(tab => Object.values(tab.pages).forEach(page => page.items.forEach(item => {
        total++;
        if (unlocks.collectionLog[item.id]) obtained++;
    })));
    return { obtained, total };
  }, [unlocks.collectionLog]);

  return (
    <div className="flex flex-col h-full bg-[#3e3529] border-2 border-[#5a5245] rounded-lg overflow-hidden font-sans shadow-2xl relative text-[#ff981f]">
      {/* Top Bar */}
      <div className="flex justify-between items-center p-2 bg-[#3e3529] border-b-2 border-[#5a5245] shadow-md shrink-0">
        <h2 className="text-[#ff981f] text-shadow font-bold px-2 text-sm uppercase tracking-wider">Collection Log</h2>
        
        {/* Wealth Ticker */}
        <div className="flex items-center gap-4">
            {mostValuable && (
                <div className="hidden md:flex items-center gap-2 text-[10px] bg-[#2c241b] px-2 py-1 rounded border border-[#5a5245] shadow-inner text-[#d4c5b0]">
                    <span className="text-[#ff981f] font-bold flex items-center gap-1"><TrendingUp size={10} /> MVP:</span>
                    <span className="truncate max-w-[80px] text-white">{mostValuable.name}</span>
                    <span className="text-green-400 font-mono">({formatNumber(mostValuable.value)})</span>
                </div>
            )}
            <div className="flex items-center gap-2 text-xs font-mono bg-black/30 px-3 py-1 rounded border border-[#5a5245] text-osrs-gold shadow-inner">
                <Coins size={12} className="text-yellow-400" />
                <span>{formatNumber(vaultValue)} gp</span>
            </div>
            <div className="text-xs font-mono bg-black/30 px-2 py-1 rounded border border-[#5a5245]">
               <span className="text-white">{globalStats.obtained}</span> / {globalStats.total}
            </div>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex bg-[#3e3529] border-b border-[#5a5245] overflow-x-auto no-scrollbar shrink-0">
        {Object.keys(COLLECTION_LOG_DATA).map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setViewMode('PAGE'); }}
            className={`flex-1 min-w-[80px] py-1.5 text-center text-[10px] font-bold border-r border-[#5a5245] hover:bg-[#4b4236] transition-colors uppercase tracking-wide
              ${activeTab === tab && !searchTerm ? 'bg-[#4b4236] text-white shadow-[inset_0_0_5px_rgba(0,0,0,0.5)]' : 'text-[#ff981f] bg-[#3e3529]'}
              ${searchTerm ? 'opacity-50' : 'opacity-100'}
            `}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar List */}
        <div className="w-1/3 min-w-[120px] bg-[#3e3529] border-r-2 border-[#5a5245] flex flex-col">
           <div className="overflow-y-auto custom-scrollbar flex-1 bg-[#3e3529]">
             {searchTerm && (
                 <button
                    onClick={() => setViewMode('SEARCH_ALL')}
                    className={`w-full text-left px-2 py-2 border-b border-[#463d32] hover:bg-[#4b4236] flex items-center gap-2 transition-colors ${viewMode === 'SEARCH_ALL' ? 'bg-[#52483a] text-white' : 'text-[#ff981f]'}`}
                 >
                    <ListFilter size={14} />
                    <span className="text-[10px] font-bold uppercase">All Results ({allSearchItems.length})</span>
                 </button>
             )}

             {filteredPages.map(({ tab, key, data }) => {
                const totalItems = data.items.length;
                const unlockedItems = data.items.filter(i => unlocks.collectionLog[i.id]).length;
                const isComplete = totalItems > 0 && totalItems === unlockedItems;
                const isActive = viewMode === 'PAGE' && activePage === key && (searchTerm ? true : activeTab === tab);
                
                return (
                  <button
                    key={`${tab}-${key}`}
                    onClick={() => { 
                        if(searchTerm) setActiveTab(tab); 
                        setActivePage(key); 
                        setViewMode('PAGE'); 
                    }}
                    className={`w-full text-left px-2 py-1.5 border-b border-[#463d32] hover:bg-[#4b4236] flex flex-col transition-colors ${isActive ? 'bg-[#52483a]' : ''}`}
                  >
                    <div className="flex justify-between items-center w-full">
                        <span className={`text-[10px] truncate pr-1 ${isActive ? 'text-white' : isComplete ? 'text-green-400' : 'text-[#ff981f]'}`}>{data.name}</span>
                        {isComplete && <CheckCircle2 size={8} className="text-green-500 shrink-0" />}
                    </div>
                    {searchTerm && <span className="text-[8px] text-[#887] uppercase tracking-wide leading-tight">{tab}</span>}
                  </button>
                );
             })}
             {filteredPages.length === 0 && !allSearchItems.length && <div className="p-4 text-center text-[10px] text-[#887] italic">No results found</div>}
           </div>
        </div>

        {/* Grid Area */}
        <div className="w-2/3 bg-[#1e1b16] flex flex-col relative">
           <div className="p-1.5 text-center border-b border-[#3e3529] bg-[#2c241b] shadow-md shrink-0">
             <h3 className="text-[#ff981f] text-sm font-bold text-shadow truncate px-2">
                {viewMode === 'SEARCH_ALL' ? `Search: "${searchTerm}"` : (currentTabContent?.pages[activePage]?.name || "Select a Category")}
             </h3>
             <div className="text-[9px] text-[#887] mt-0.5">
                  {viewMode === 'SEARCH_ALL' ? 
                    `${allSearchItems.filter(i => unlocks.collectionLog[i.id]).length} / ${allSearchItems.length} Found` :
                    currentTabContent?.pages[activePage] ? 
                    `${currentTabContent.pages[activePage].items.filter(i => unlocks.collectionLog[i.id]).length} / ${currentTabContent.pages[activePage].items.length} Obtained` : 
                    ''
                  }
             </div>
           </div>

           <div className="flex-1 bg-[url('https://www.transparenttextures.com/patterns/dark-leather.png')]" ref={containerRef}>
             {activeItems.length > 0 && containerSize.width > 0 ? (
               <Grid
                 columnCount={4}
                 columnWidth={containerSize.width / 4}
                 height={containerSize.height}
                 rowCount={Math.ceil(activeItems.length / 4)}
                 rowHeight={90}
                 width={containerSize.width}
                 itemData={itemData}
               >
                 {Cell}
               </Grid>
             ) : (
               <div className="flex flex-col items-center justify-center h-full text-[#5a5245] italic text-xs gap-2">
                 <Search size={24} className="opacity-20" />
                 <span>{searchTerm && allSearchItems.length === 0 ? "No matches found" : "Select a category to view items"}</span>
               </div>
             )}
           </div>
        </div>
      </div>
    </div>
  );
};
