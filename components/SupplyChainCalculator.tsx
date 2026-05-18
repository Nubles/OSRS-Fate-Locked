
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { RESOURCE_MAP } from '../data/resourceData';
import { calculateSupplyChain } from '../utils/supplyChain';
import { wikiService } from '../services/WikiService';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { X, Search, CheckCircle2, Lock, Box, ShoppingBag, Sword, Sprout, MapPin, Database, ExternalLink, RefreshCw, ArrowLeft, ArrowRight, Hammer, HelpCircle, Layers, Coins, Calculator, ListFilter } from 'lucide-react';

interface SupplyChainCalculatorProps {
  onClose: () => void;
}

const SourceIcon = ({ type }: { type: string }) => {
    switch (type) {
        case 'DROP': return <Sword size={14} className="text-red-400" />;
        case 'SHOP': return <ShoppingBag size={14} className="text-yellow-400" />;
        case 'SKILL': return <Sprout size={14} className="text-green-400" />;
        case 'SPAWN': return <MapPin size={14} className="text-blue-400" />;
        case 'MERCHANT': return <ShoppingBag size={14} className="text-amber-400" />;
        default: return <Box size={14} className="text-gray-400" />;
    }
};

// --- Item Image Component ---
const ItemImage = ({ name, size = 'md', qty }: { name: string, size?: 'sm' | 'md' | 'lg', qty?: number }) => {
    const [src, setSrc] = useState<string | null>(null);
    useEffect(() => {
        let mounted = true;
        wikiService.fetchImage(name).then((url) => {
            if (mounted && url) setSrc(url);
        });
        return () => { mounted = false; };
    }, [name]);

    const dims = size === 'sm' ? 'w-6 h-6' : size === 'lg' ? 'w-16 h-16' : 'w-10 h-10';
    const iconSize = size === 'sm' ? 12 : size === 'lg' ? 24 : 18;

    return (
        <div className={`relative ${dims} rounded bg-[#252525] border border-white/5 flex items-center justify-center shadow-inner shrink-0 group`}>
            {src ? (
                 <img src={src} alt={name} className="max-w-full max-h-full object-contain p-0.5 drop-shadow-lg transition-transform group-hover:scale-110" />
            ) : (
                 <Box size={iconSize} className="text-gray-600" />
            )}
            {qty && qty > 1 && (
                <div className="absolute -top-1 -right-1 bg-yellow-600 text-white text-[9px] font-bold px-1 rounded-sm shadow-sm leading-tight border border-black z-10">
                    {qty >= 1000 ? `${(qty/1000).toFixed(0)}k` : qty}
                </div>
            )}
        </div>
    );
};

export const SupplyChainCalculator: React.FC<SupplyChainCalculatorProps> = ({ onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);
  const gameState = useGame();
  const [query, setQuery] = useState('');
  const [targetQty, setTargetQty] = useState(1);
  const [history, setHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  // Filter available items from database based on query
  const availableItems = useMemo(() => {
      return Object.keys(RESOURCE_MAP).filter(key => key.toLowerCase().includes(query.toLowerCase())).sort();
  }, [query]);

  // If query matches an item exactly (or user clicks one), show detail
  const selectedResult = useMemo(() => {
      const exact = availableItems.find(i => i.toLowerCase() === query.toLowerCase());
      if (exact) return calculateSupplyChain(exact, gameState);
      return null;
  }, [query, availableItems, gameState]);

  // Calculate Reverse Dependencies ("Used In")
  const usedIn = useMemo(() => {
      if (!selectedResult) return [];
      const currentItemName = selectedResult.itemName;
      const uses: string[] = [];
      
      // Iterate entire DB to find items that list currentItem as input
      Object.entries(RESOURCE_MAP).forEach(([prodName, sources]) => {
          // Input is now a Record<string, number>, check keys
          const isUsed = sources.some(source => source.inputs && Object.keys(source.inputs).includes(currentItemName));
          if (isUsed && !uses.includes(prodName)) {
              uses.push(prodName);
          }
      });
      return uses.sort();
  }, [selectedResult]);

  const handleWikiOpen = (e: React.MouseEvent, name: string) => {
      e.stopPropagation();
      const url = `https://oldschool.runescape.wiki/w/${encodeURIComponent(name.replace(/ /g, '_'))}`;
      window.open(url, '_blank');
  };

  const handleNavigate = (newItem: string) => {
      if (newItem.toLowerCase() === query.toLowerCase()) return;
      setHistory(prev => [...prev, query]); // Push current query to history
      setQuery(newItem);
      setTargetQty(1); // Reset qty on nav
  };

  const handleBack = () => {
      if (history.length === 0) return;
      const prev = history[history.length - 1];
      setHistory(prev => prev.slice(0, -1));
      setQuery(prev);
      setTargetQty(1);
  };

  const formatQty = (n: number) => {
     if (n % 1 !== 0) return n.toFixed(1);
     return n;
  };

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Supply chain calculator" tabIndex={-1} className="fixed inset-0 z-[160] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-[#121212] border border-[#333] w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="bg-[#1a1a1a] p-4 border-b border-[#333] flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-900/20 rounded-lg border border-emerald-500/30">
                <Database className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
                <h2 className="text-lg font-bold text-gray-100">The Resource Engine</h2>
                <p className="text-xs text-gray-500">Supply Chain Solver</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Search Bar & Navigation */}
        <div className="p-4 bg-[#161616] border-b border-[#333] flex gap-2">
            <button 
                onClick={handleBack} 
                disabled={history.length === 0}
                className={`p-3 rounded-lg border border-white/10 flex items-center justify-center transition-colors ${history.length === 0 ? 'bg-black/20 text-gray-700 cursor-not-allowed' : 'bg-black/50 text-gray-300 hover:text-white hover:bg-white/5'}`}
            >
                <ArrowLeft size={18} />
            </button>

            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search for item (e.g. 'Prayer Potion', 'Oak Plank')..."
                    className="w-full bg-black/50 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-sm text-gray-200 focus:outline-none focus:border-emerald-500/50 transition-colors placeholder-gray-600 font-mono"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
            </div>
        </div>

        {/* Breadcrumbs */}
        {history.length > 0 && (
            <div className="px-4 py-2 bg-[#0a0a0a] border-b border-white/5 flex items-center gap-2 overflow-x-auto no-scrollbar whitespace-nowrap">
                <span className="text-[10px] text-gray-600 uppercase font-bold tracking-wider">Path:</span>
                {history.map((step, i) => (
                    <React.Fragment key={i}>
                        <button onClick={() => {
                            setHistory(prev => prev.slice(0, i));
                            setQuery(step);
                            setTargetQty(1);
                        }} className="text-xs text-gray-500 hover:text-emerald-400 transition-colors hover:underline">
                            {step}
                        </button>
                        <span className="text-gray-700 text-[10px]">/</span>
                    </React.Fragment>
                ))}
                <span className="text-xs text-emerald-500 font-bold">{query}</span>
            </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-[#0a0a0a] space-y-6">
            
            {/* If detailed result found */}
            {selectedResult ? (
                <div className="animate-in slide-in-from-right-4 duration-300">
                    {/* Item Header */}
                    <div className="flex flex-col md:flex-row md:items-start justify-between pb-6 border-b border-white/10 mb-6 gap-4">
                        <div className="flex items-center gap-5">
                            <div className="relative">
                                <ItemImage name={selectedResult.itemName} size="lg" />
                                <div className="absolute -bottom-2 -right-2 bg-black/80 rounded-full p-1 border border-white/10">
                                    {selectedResult.sources.some(s => s.status.isAvailable) ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Lock size={16} className="text-red-500" />}
                                </div>
                            </div>
                            <div>
                                <h3 className="text-3xl font-black text-white tracking-wide">{selectedResult.itemName}</h3>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className={`text-xs px-2 py-0.5 rounded border ${selectedResult.sources.some(s => s.status.isAvailable) ? 'text-emerald-400 bg-emerald-900/20 border-emerald-500/20' : 'text-red-400 bg-red-900/20 border-red-500/20'}`}>
                                        {selectedResult.sources.filter(s => s.status.isAvailable).length} Available Sources
                                    </span>
                                    <span className="text-xs text-gray-500">•</span>
                                    <button 
                                        onClick={(e) => handleWikiOpen(e, selectedResult.itemName)}
                                        className="text-xs text-gray-500 hover:text-white transition-colors flex items-center gap-1 group"
                                    >
                                        Wiki <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Quantity Calculator */}
                        <div className="flex items-center bg-[#1a1a1a] rounded-lg border border-white/10 p-1">
                             <div className="px-3 py-1 bg-black/40 rounded-md mr-2">
                                <span className="text-[10px] text-gray-500 font-bold uppercase">Target Qty</span>
                             </div>
                             <input 
                                type="number" 
                                min="1" 
                                className="bg-transparent text-white font-mono font-bold text-center w-16 focus:outline-none"
                                value={targetQty}
                                onChange={(e) => setTargetQty(Math.max(1, parseInt(e.target.value) || 1))}
                             />
                             <div className="text-gray-600 px-2"><Calculator size={14} /></div>
                        </div>
                    </div>

                    {/* --- SOURCES SECTION --- */}
                    <div className="space-y-4 mb-8">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Acquisition Methods</span>
                            <div className="flex-1 h-px bg-white/10"></div>
                        </div>

                        {selectedResult.sources.length === 0 && (
                            <div className="p-8 text-center border-2 border-dashed border-white/5 rounded-xl">
                                <Search size={32} className="mx-auto text-gray-700 mb-2" />
                                <p className="text-gray-500 text-sm italic">No acquisition methods recorded in database.</p>
                            </div>
                        )}

                        {selectedResult.sources.map((entry, idx) => {
                            const yieldPerAction = entry.source.outputYield || 1;
                            const opsRequired = Math.ceil(targetQty / yieldPerAction);
                            
                            return (
                                <div 
                                    key={idx} 
                                    className={`
                                        relative overflow-hidden rounded-xl border transition-all duration-200
                                        ${entry.status.isAvailable 
                                            ? 'bg-gradient-to-r from-emerald-900/10 to-transparent border-emerald-500/30' 
                                            : 'bg-[#121212] border-[#2a2a2a]'}
                                    `}
                                >
                                    <div className="flex flex-col md:flex-row">
                                        {/* Left: Source Info */}
                                        <div className="flex-1 p-5">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-1.5 rounded-lg border flex items-center justify-center ${entry.status.isAvailable ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-[#222] border-[#333] text-gray-500'}`}>
                                                        <SourceIcon type={entry.source.type} />
                                                    </div>
                                                    <div>
                                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-0.5">{entry.source.type}</span>
                                                        <div className="flex items-center gap-2">
                                                            <h4 className={`font-bold text-base leading-none ${entry.status.isAvailable ? 'text-white' : 'text-gray-400'}`}>{entry.source.name}</h4>
                                                            {yieldPerAction > 1 && (
                                                                <span className="text-[9px] bg-yellow-900/30 text-yellow-400 px-1.5 py-0.5 rounded border border-yellow-500/20">
                                                                    x{yieldPerAction} per action
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-y-2 gap-x-6 text-xs text-gray-400 pl-1">
                                                <div className="flex items-center gap-2 col-span-2 md:col-span-1">
                                                    <MapPin size={12} className="text-blue-400 shrink-0" />
                                                    <span className="truncate">{entry.source.regions.join(', ')}</span>
                                                </div>
                                                {entry.source.notes && (
                                                    <div className="flex items-center gap-2 col-span-2 md:col-span-1">
                                                        <RefreshCw size={12} className="text-yellow-400 shrink-0" />
                                                        <span className="italic text-gray-500">{entry.source.notes}</span>
                                                    </div>
                                                )}
                                                {entry.source.skills && (
                                                    <div className="col-span-2 flex flex-wrap gap-2 mt-2 pt-2 border-t border-white/5">
                                                        {Object.entries(entry.source.skills).map(([skill, lvl]) => {
                                                            const currentLvl = gameState.unlocks.levels[skill] || 1;
                                                            const isLocked = !gameState.unlocks.skills[skill];
                                                            const isLow = currentLvl < lvl;
                                                            
                                                            return (
                                                                <span key={skill} className={`px-2 py-1 rounded border text-[10px] font-mono flex items-center gap-1 ${isLocked ? 'bg-red-900/20 text-red-400 border-red-500/30' : isLow ? 'bg-yellow-900/20 text-yellow-400 border-yellow-500/30' : 'bg-black/40 text-blue-300 border-white/5'}`}>
                                                                    {isLocked ? <Lock size={8} /> : null}
                                                                    {skill} {currentLvl}/{lvl}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Recipe Ingredients Section */}
                                            {entry.source.inputs && Object.keys(entry.source.inputs).length > 0 && (
                                                <div className="mt-4 pt-3 border-t border-white/5">
                                                    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 flex items-center gap-1.5">
                                                        <Hammer size={10} /> Requirements for {targetQty} items ({opsRequired} actions)
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {Object.entries(entry.source.inputs).map(([inputName, inputQty], i) => {
                                                            const qty = inputQty as number;
                                                            const totalRequired = qty * opsRequired;
                                                            const isLinkable = !!RESOURCE_MAP[inputName];
                                                            
                                                            return (
                                                                <button 
                                                                    key={i}
                                                                    onClick={isLinkable ? () => handleNavigate(inputName) : undefined}
                                                                    disabled={!isLinkable}
                                                                    className={`
                                                                        flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs transition-all
                                                                        ${isLinkable 
                                                                            ? 'bg-[#222] border-white/10 hover:bg-[#333] hover:border-white/20 text-gray-200 cursor-pointer group/ing' 
                                                                            : 'bg-transparent border-transparent text-gray-500 cursor-default'}
                                                                    `}
                                                                >
                                                                    {inputName === 'Coins' ? (
                                                                        <div className="w-6 h-6 flex items-center justify-center bg-yellow-900/20 rounded-full border border-yellow-500/20"><Coins size={12} className="text-yellow-400" /></div>
                                                                    ) : (
                                                                        <ItemImage name={inputName} size="sm" qty={0} />
                                                                    )}
                                                                    <div className="flex flex-col items-start leading-none">
                                                                        <span>{inputName}</span>
                                                                        <span className="text-[9px] text-gray-500 font-mono mt-0.5">x{formatQty(totalRequired)}</span>
                                                                    </div>
                                                                    {isLinkable && <ArrowRight size={10} className="opacity-0 group-hover/ing:opacity-100 transition-opacity ml-1 text-emerald-400" />}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Right: Status Panel */}
                                        <div className={`md:w-40 p-4 flex flex-col justify-center border-t md:border-t-0 md:border-l border-white/5 ${entry.status.isAvailable ? 'bg-emerald-900/5' : 'bg-black/20'}`}>
                                            {entry.status.isAvailable ? (
                                                <div className="flex flex-col items-center text-center">
                                                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center mb-2">
                                                        <CheckCircle2 size={18} className="text-emerald-400" />
                                                    </div>
                                                    <div className="text-emerald-400 font-bold text-sm">Available</div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex items-center justify-center gap-1 text-red-400 font-bold text-xs uppercase tracking-wide">
                                                        <Lock size={12} /> Locked
                                                    </div>
                                                    <div className="space-y-1">
                                                        {entry.status.missing.map((reason, i) => (
                                                            <div key={i} className="text-[9px] text-red-300/70 bg-red-900/10 px-1.5 py-1 rounded border border-red-500/10 text-center leading-tight">
                                                                {reason}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* --- USED IN SECTION --- */}
                    {usedIn.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Used to Create</span>
                                <div className="flex-1 h-px bg-white/10"></div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {usedIn.map((prodName, i) => (
                                    <button 
                                        key={i}
                                        onClick={() => handleNavigate(prodName)}
                                        className="flex items-center gap-3 p-3 rounded-lg bg-[#1a1a1a] border border-white/5 hover:bg-[#252525] hover:border-white/10 transition-all text-left group"
                                    >
                                        <ItemImage name={prodName} size="md" />
                                        <div className="flex-1 min-w-0">
                                            <span className="text-sm font-bold text-gray-300 group-hover:text-white truncate block">{prodName}</span>
                                            <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                                <Layers size={10} /> Ingredient
                                            </span>
                                        </div>
                                        <ArrowRight size={14} className="text-gray-600 group-hover:text-emerald-400 transition-colors" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                // Suggestion / Empty State
                <div className="flex flex-col h-full">
                    {query && availableItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4 opacity-50">
                            <Search size={48} />
                            <p className="text-sm">No items found matching "{query}"</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between gap-2 mb-4 px-2">
                                <div className="flex items-center gap-2">
                                    <ListFilter size={14} className="text-gray-500" />
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Database Index ({availableItems.length})</span>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {availableItems.map(item => (
                                    <button
                                        key={item}
                                        onClick={() => handleNavigate(item)}
                                        className="text-left px-3 py-3 bg-[#1a1a1a] hover:bg-[#252525] border border-white/5 rounded-xl text-sm text-gray-300 hover:text-white transition-all flex items-center gap-3 group"
                                    >
                                        <ItemImage name={item} />
                                        <span className="flex-1 truncate font-medium">{item}</span>
                                        <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 text-gray-500 transition-opacity" />
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

        </div>
      </div>
    </div>
  );
};
