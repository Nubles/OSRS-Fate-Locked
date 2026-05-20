
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { RESOURCE_MAP, RESOURCE_CATEGORIES, ITEM_CATEGORY } from '../data/resourceData';
import { calculateSupplyChain, isItemAvailableWithCtx, buildAvailabilityContext, computeFullBreakdown, flattenRawMaterials, flattenMultiBreakdown, findEasiestPath, getNextAchievableItems } from '../utils/supplyChain';
import { wikiService } from '../services/WikiService';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { X, Search, CheckCircle2, Lock, Box, ShoppingBag, Sword, Sprout, MapPin, Database, ExternalLink, RefreshCw, ArrowLeft, ArrowRight, Hammer, HelpCircle, Layers, Coins, Calculator, ListFilter, Star, ChevronDown, ChevronRight, Hand, ScrollText, Percent, Compass, Pin } from 'lucide-react';

const FAVORITES_KEY = 'FATE_RESOURCE_FAVORITES';
const INVENTORY_KEY = 'FATE_RESOURCE_INVENTORY';
const RECENT_KEY = 'FATE_RESOURCE_RECENT';
const PLAN_KEY = 'FATE_RESOURCE_PLAN';
const MAX_FAVORITES = 20;
const MAX_RECENT = 10;

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
        case 'PICKPOCKET': return <Hand size={14} className="text-purple-400" />;
        case 'CLUE': return <ScrollText size={14} className="text-orange-400" />;
        case 'QUEST': return <HelpCircle size={14} className="text-cyan-400" />;
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
  const { togglePin, pinnedGoals } = gameState;
  const [query, setQuery] = useState('');
  const [targetQty, setTargetQty] = useState(1);
  const [history, setHistory] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter(x => typeof x === 'string' && RESOURCE_MAP[x]) : [];
    } catch {
      return [];
    }
  });
  // Persistent "I already have N of this" map for the recipe breakdown. Lets
  // the player subtract their inventory from the totalRequired so the panel
  // shows what's still to gather rather than what the raw recipe demands.
  const [inventory, setInventory] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(INVENTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const cleaned: Record<string, number> = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'number' && v > 0 && Number.isFinite(v)) cleaned[k] = v;
        }
        return cleaned;
      }
      return {};
    } catch {
      return {};
    }
  });
  // Auto-tracked recently-viewed items (most recent first). Like Favorites
  // but no manual curation — every navigate-to-item prepends here.
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? parsed.filter((x) => typeof x === 'string' && RESOURCE_MAP[x]).slice(0, MAX_RECENT)
        : [];
    } catch {
      return [];
    }
  });
  // Bulk Planner: item -> target qty. Combined raw-material breakdown is
  // computed via flattenMultiBreakdown across every entry > 0.
  const [planTargets, setPlanTargets] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(PLAN_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const cleaned: Record<string, number> = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'number' && v > 0 && Number.isFinite(v) && RESOURCE_MAP[k]) cleaned[k] = v;
        }
        return cleaned;
      }
      return {};
    } catch {
      return {};
    }
  });
  const [showPlan, setShowPlan] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    } catch {
      /* localStorage unavailable — favorites stay in-memory only */
    }
  }, [favorites]);

  useEffect(() => {
    try {
      localStorage.setItem(INVENTORY_KEY, JSON.stringify(inventory));
    } catch {
      /* localStorage unavailable — inventory stays in-memory only */
    }
  }, [inventory]);

  useEffect(() => {
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(recent)); } catch {}
  }, [recent]);

  useEffect(() => {
    try { localStorage.setItem(PLAN_KEY, JSON.stringify(planTargets)); } catch {}
  }, [planTargets]);

  const trackRecent = (item: string) => {
    if (!RESOURCE_MAP[item]) return;
    setRecent((prev) => [item, ...prev.filter((x) => x !== item)].slice(0, MAX_RECENT));
  };

  const clearInventory = () => setInventory({});

  const setPlanTarget = (item: string, qty: number) => {
    setPlanTargets((prev) => {
      const next = { ...prev };
      if (qty > 0 && RESOURCE_MAP[item]) next[item] = qty;
      else delete next[item];
      return next;
    });
  };
  const togglePlanItem = (item: string) => {
    setPlanTargets((prev) => {
      const next = { ...prev };
      if (next[item]) delete next[item];
      else next[item] = 1;
      return next;
    });
  };
  const addFavoritesToPlan = () => {
    setPlanTargets((prev) => {
      const next = { ...prev };
      for (const f of favorites) {
        if (RESOURCE_MAP[f] && !next[f]) next[f] = 1;
      }
      return next;
    });
  };

  const [planCopied, setPlanCopied] = useState(false);
  const copyPlanToClipboard = async () => {
    const lines: string[] = ['Crafting Plan', '-------------'];
    for (const [item, qty] of Object.entries(planTargets)) lines.push(`  ${item} × ${qty}`);
    lines.push('', 'Raw materials needed:');
    for (const { item, qty } of planRawMaterials) {
      const have = inventory[item] || 0;
      const stillNeed = Math.max(0, qty - have);
      lines.push(stillNeed === 0
        ? `  [✓] ${item} × ${qty}  (covered)`
        : `  ${item} × ${qty}${have ? ` (have ${have}, need ${stillNeed} more)` : ''}`);
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setPlanCopied(true);
      setTimeout(() => setPlanCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  // Combined raw materials across every planTargets entry. Sorted, summed,
  // identical to the single-item breakdown but spanning the whole plan.
  const planRawMaterials = useMemo(
    () => flattenMultiBreakdown(planTargets),
    [planTargets],
  );

  const setInventoryFor = (item: string, n: number) => {
    setInventory(prev => {
      const next = { ...prev };
      if (n > 0) next[item] = n;
      else delete next[item];
      return next;
    });
  };

  const toggleFavorite = (item: string) => {
    setFavorites(prev => {
      if (prev.includes(item)) return prev.filter(f => f !== item);
      return [item, ...prev].slice(0, MAX_FAVORITES);
    });
  };

  // Availability of every item, recomputed only when game state changes.
  // Building the AvailabilityContext once (Sets from the gameState's arrays)
  // makes each per-item check O(1) lookups instead of repeatedly scanning
  // arrays — far cheaper across 750+ items.
  const availabilityMap = useMemo(() => {
    const ctx = buildAvailabilityContext(gameState);
    const map: Record<string, boolean> = {};
    for (const key of Object.keys(RESOURCE_MAP)) {
      map[key] = isItemAvailableWithCtx(key, ctx);
    }
    return map;
  }, [gameState]);

  // Filter the database index by query, category, and availability toggle.
  const availableItems = useMemo(() => {
    const q = query.toLowerCase();
    return Object.keys(RESOURCE_MAP)
      .filter(key => key.toLowerCase().includes(q))
      .filter(key => !activeCategory || ITEM_CATEGORY[key] === activeCategory)
      .filter(key => !availableOnly || availabilityMap[key])
      .sort();
  }, [query, activeCategory, availableOnly, availabilityMap]);

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

  // Recursive raw-material breakdown for the selected item (if it has a recipe).
  const rawMaterials = useMemo(() => {
      if (!selectedResult) return null;
      const hasRecipe = selectedResult.sources.some(
          s => s.source.inputs && Object.keys(s.source.inputs).length > 0,
      );
      if (!hasRecipe) return null;
      return flattenRawMaterials(computeFullBreakdown(selectedResult.itemName, targetQty));
  }, [selectedResult, targetQty]);

  // When the selected item is fully locked, surface the source closest to
  // being unlockable so the player has a clear next-step list rather than a
  // wall of red "missing X" chips spread across every source card.
  const easiestPath = useMemo(() => {
      if (!selectedResult) return null;
      return findEasiestPath(selectedResult.itemName, gameState);
  }, [selectedResult, gameState]);

  // Top-down recommendations: locked items the player is closest to unlocking,
  // ranked by the effort heuristic. Shown only in the empty/index state so it
  // doesn't compete with the detail view when an item is selected.
  const nextAchievable = useMemo(
      () => getNextAchievableItems(gameState, 8),
      [gameState],
  );

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
      setShowBreakdown(false);
      trackRecent(newItem);
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
                                    <span className="text-xs text-gray-500">•</span>
                                    <button
                                        onClick={() => toggleFavorite(selectedResult.itemName)}
                                        aria-pressed={favorites.includes(selectedResult.itemName)}
                                        title={favorites.includes(selectedResult.itemName) ? 'Remove from favorites' : 'Add to favorites'}
                                        className={`text-xs transition-colors flex items-center gap-1 ${favorites.includes(selectedResult.itemName) ? 'text-yellow-400 hover:text-yellow-300' : 'text-gray-500 hover:text-yellow-400'}`}
                                    >
                                        <Star size={12} className={favorites.includes(selectedResult.itemName) ? 'fill-yellow-400' : ''} />
                                        {favorites.includes(selectedResult.itemName) ? 'Favorited' : 'Favorite'}
                                    </button>
                                    <span className="text-xs text-gray-500">•</span>
                                    <button
                                        onClick={() => togglePin(selectedResult.itemName)}
                                        aria-pressed={pinnedGoals.includes(selectedResult.itemName)}
                                        title={pinnedGoals.includes(selectedResult.itemName) ? 'Remove from Active Goals' : 'Track in Active Goals (Dashboard)'}
                                        className={`text-xs transition-colors flex items-center gap-1 ${pinnedGoals.includes(selectedResult.itemName) ? 'text-purple-300 hover:text-purple-200' : 'text-gray-500 hover:text-purple-400'}`}
                                    >
                                        <Pin size={12} className={pinnedGoals.includes(selectedResult.itemName) ? 'fill-purple-400' : ''} />
                                        {pinnedGoals.includes(selectedResult.itemName) ? 'Pinned Goal' : 'Pin as Goal'}
                                    </button>
                                    <span className="text-xs text-gray-500">•</span>
                                    <button
                                        onClick={() => togglePlanItem(selectedResult.itemName)}
                                        aria-pressed={!!planTargets[selectedResult.itemName]}
                                        title={planTargets[selectedResult.itemName] ? 'Remove from crafting plan' : 'Add to crafting plan'}
                                        className={`text-xs transition-colors flex items-center gap-1 ${planTargets[selectedResult.itemName] ? 'text-cyan-300 hover:text-cyan-200' : 'text-gray-500 hover:text-cyan-400'}`}
                                    >
                                        <Layers size={12} className={planTargets[selectedResult.itemName] ? 'fill-cyan-400/40' : ''} />
                                        {planTargets[selectedResult.itemName] ? `In Plan (×${planTargets[selectedResult.itemName]})` : 'Add to Plan'}
                                    </button>
                                    {ITEM_CATEGORY[selectedResult.itemName] && (
                                        <>
                                            <span className="text-xs text-gray-500">•</span>
                                            <span className="text-xs text-gray-500">{ITEM_CATEGORY[selectedResult.itemName]}</span>
                                        </>
                                    )}
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

                    {/* --- SHORTEST PATH PANEL (only when fully locked) --- */}
                    {easiestPath && (
                        <div className="mb-6 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-900/15 to-transparent p-5">
                            <div className="flex items-center gap-2 mb-3">
                                <Compass size={16} className="text-amber-400" />
                                <span className="text-xs font-bold text-amber-300 uppercase tracking-widest">
                                    Shortest path to unlock
                                </span>
                                <div className="flex-1 h-px bg-amber-500/10"></div>
                                <span className="text-[10px] text-amber-400/60 font-mono">
                                    via {easiestPath.source.type === 'SKILL' ? easiestPath.source.name : `${easiestPath.source.type.toLowerCase()}: ${easiestPath.source.name}`}
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {easiestPath.missing.map((reason, i) => {
                                    // If the missing line names an item that's in RESOURCE_MAP,
                                    // make it clickable so the player can drill into it.
                                    const itemMatch = /^(?:Quest|Unlock):\s*(.+)$/.exec(reason);
                                    const linkTo = itemMatch && RESOURCE_MAP[itemMatch[1]] ? itemMatch[1] : null;
                                    return (
                                        <button
                                            key={i}
                                            onClick={linkTo ? () => handleNavigate(linkTo) : undefined}
                                            disabled={!linkTo}
                                            className={`text-xs px-3 py-1.5 rounded-lg border flex items-center gap-2 ${linkTo ? 'bg-amber-900/20 border-amber-500/30 text-amber-200 hover:bg-amber-900/40 hover:border-amber-400 cursor-pointer' : 'bg-black/30 border-amber-500/15 text-amber-200/80 cursor-default'}`}
                                        >
                                            <Lock size={11} />
                                            {reason}
                                            {linkTo && <ArrowRight size={11} className="opacity-60" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

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
                                                {entry.source.rarity && (
                                                    <div className="flex items-center gap-2 col-span-2 md:col-span-1">
                                                        <Percent size={12} className="text-pink-400 shrink-0" />
                                                        <span className="font-mono text-gray-400">{entry.source.rarity}</span>
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

                    {/* --- FULL BREAKDOWN SECTION --- */}
                    {rawMaterials && rawMaterials.length > 0 && (
                        <div className="mb-8">
                            <div className="w-full flex items-center gap-2 mb-3">
                                <button
                                    onClick={() => setShowBreakdown(v => !v)}
                                    className="flex items-center gap-2 group flex-1 text-left"
                                >
                                    {showBreakdown ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronRight size={14} className="text-gray-500" />}
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest group-hover:text-gray-300 transition-colors">
                                        Full Breakdown — Raw Materials for {targetQty}
                                    </span>
                                </button>
                                {showBreakdown && Object.keys(inventory).length > 0 && (
                                    <button
                                        onClick={clearInventory}
                                        className="text-[10px] text-gray-600 hover:text-red-400 font-mono uppercase tracking-wide transition-colors"
                                        title="Clear saved inventory counts for every material"
                                    >
                                        reset inventory
                                    </button>
                                )}
                                <div className="flex-1 h-px bg-white/10"></div>
                            </div>
                            {showBreakdown && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 animate-in fade-in duration-200">
                                    {rawMaterials.map(({ item, qty }) => {
                                        const isLinkable = !!RESOURCE_MAP[item];
                                        const have = inventory[item] || 0;
                                        const stillNeed = Math.max(0, qty - have);
                                        const isCovered = stillNeed === 0;
                                        return (
                                            <div
                                                key={item}
                                                className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${isCovered ? 'bg-emerald-900/10 border-emerald-500/20' : 'bg-[#1a1a1a] border-white/5'}`}
                                            >
                                                {item === 'Coins' ? (
                                                    <div className="w-10 h-10 flex items-center justify-center bg-yellow-900/20 rounded border border-yellow-500/20 shrink-0"><Coins size={18} className="text-yellow-400" /></div>
                                                ) : (
                                                    <ItemImage name={item} size="md" />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    {isLinkable ? (
                                                        <button onClick={() => handleNavigate(item)} className="text-sm font-bold text-gray-300 hover:text-white truncate block text-left">
                                                            {item}
                                                        </button>
                                                    ) : (
                                                        <span className="text-sm font-bold text-gray-300 truncate block">{item}</span>
                                                    )}
                                                    <span className={`text-[10px] font-mono ${isCovered ? 'text-emerald-400' : 'text-gray-500'}`}>
                                                        {isCovered ? `Covered (need ${formatQty(qty)})` : `Need x${formatQty(stillNeed)}${have > 0 ? ` of ${formatQty(qty)}` : ''}`}
                                                    </span>
                                                </div>
                                                {/* Persistent "have" input — left blank until used, value 0 not stored */}
                                                <input
                                                    type="number"
                                                    min={0}
                                                    placeholder="have"
                                                    title={`How many ${item} you already have`}
                                                    value={have || ''}
                                                    onChange={(e) => setInventoryFor(item, Math.max(0, parseInt(e.target.value, 10) || 0))}
                                                    className="w-16 text-[11px] font-mono bg-black/40 border border-white/10 rounded px-1.5 py-1 text-gray-200 focus:outline-none focus:border-emerald-500/50 shrink-0"
                                                />
                                                {isLinkable && (
                                                    <span
                                                        className={`w-2 h-2 rounded-full shrink-0 ${availabilityMap[item] ? 'bg-emerald-500' : 'bg-red-500'}`}
                                                        title={availabilityMap[item] ? 'Available' : 'Locked'}
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

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
                    {/* Favorites */}
                    {favorites.length > 0 && (
                        <div className="mb-5">
                            <div className="flex items-center gap-2 mb-2 px-2">
                                <Star size={14} className="text-yellow-400 fill-yellow-400" />
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Favorites ({favorites.length})</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {favorites.filter(f => RESOURCE_MAP[f]).map(item => (
                                    <div
                                        key={item}
                                        className="flex items-center gap-2 px-3 py-2 bg-[#1a1a1a] border border-yellow-500/10 rounded-lg text-sm group"
                                    >
                                        <span
                                            className={`w-2 h-2 rounded-full shrink-0 ${availabilityMap[item] ? 'bg-emerald-500' : 'bg-red-500'}`}
                                            title={availabilityMap[item] ? 'Available' : 'Locked'}
                                        />
                                        <button onClick={() => handleNavigate(item)} className="flex-1 truncate text-left text-gray-300 hover:text-white transition-colors">
                                            {item}
                                        </button>
                                        <button
                                            onClick={() => toggleFavorite(item)}
                                            title="Remove from favorites"
                                            className="text-yellow-400 hover:text-red-400 transition-colors shrink-0"
                                        >
                                            <Star size={12} className="fill-yellow-400" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Empty-plan nudge: when favorites exist but the plan is empty,
                        offer a one-click shortcut to add them all. */}
                    {Object.keys(planTargets).length === 0 && favorites.length > 0 && (
                        <button
                            onClick={addFavoritesToPlan}
                            className="mb-3 w-full px-3 py-2 text-xs text-cyan-300 hover:text-cyan-200 bg-cyan-900/10 hover:bg-cyan-900/20 border border-cyan-500/15 hover:border-cyan-400/30 rounded-lg transition-all flex items-center justify-center gap-2"
                        >
                            <Layers size={12} /> Add all {favorites.length} favorites to a crafting plan
                        </button>
                    )}

                    {/* Crafting Plan — multi-target combined raw-material breakdown. */}
                    {Object.keys(planTargets).length > 0 && (
                        <div className="mb-5 rounded-xl border border-cyan-500/20 bg-gradient-to-r from-cyan-900/10 to-transparent p-4">
                            <div className="w-full flex items-center gap-2 mb-3">
                                <button
                                    onClick={() => setShowPlan(v => !v)}
                                    className="flex items-center gap-2 group flex-1 text-left"
                                >
                                    {showPlan ? <ChevronDown size={14} className="text-cyan-400" /> : <ChevronRight size={14} className="text-cyan-400" />}
                                    <Layers size={14} className="text-cyan-400" />
                                    <span className="text-xs font-bold text-cyan-300 uppercase tracking-widest group-hover:text-cyan-200 transition-colors">
                                        Crafting Plan — {Object.keys(planTargets).length} item{Object.keys(planTargets).length !== 1 ? 's' : ''}
                                    </span>
                                    <span className="text-[10px] text-cyan-400/60 font-mono">
                                        {planRawMaterials.length} raw material{planRawMaterials.length !== 1 ? 's' : ''} combined
                                    </span>
                                </button>
                                <div className="flex-1 h-px bg-cyan-500/10"></div>
                                <button
                                    onClick={copyPlanToClipboard}
                                    className="text-[10px] text-gray-600 hover:text-cyan-300 font-mono uppercase tracking-wide transition-colors shrink-0"
                                    title="Copy a text summary of the plan to the clipboard"
                                >
                                    {planCopied ? 'copied ✓' : 'copy'}
                                </button>
                                <button
                                    onClick={() => setPlanTargets({})}
                                    className="text-[10px] text-gray-600 hover:text-red-400 font-mono uppercase tracking-wide transition-colors shrink-0"
                                    title="Empty the plan"
                                >
                                    clear plan
                                </button>
                            </div>

                            {/* Target list — always shown so the player can edit qty without expanding the breakdown. */}
                            <div className="flex flex-wrap gap-2 mb-3">
                                {Object.entries(planTargets).map(([item, qty]) => (
                                    <div key={item} className="flex items-center gap-2 px-2.5 py-1.5 bg-[#1a1a1a] border border-cyan-500/15 rounded-lg text-xs">
                                        <button onClick={() => handleNavigate(item)} className="flex items-center gap-2 text-cyan-100 hover:text-white transition-colors">
                                            <ItemImage name={item} size="sm" />
                                            <span className="font-medium max-w-[160px] truncate" title={item}>{item}</span>
                                        </button>
                                        <input
                                            type="number"
                                            min={1}
                                            value={qty}
                                            onChange={(e) => setPlanTarget(item, Math.max(1, parseInt(e.target.value, 10) || 1))}
                                            className="w-14 text-[11px] font-mono bg-black/40 border border-white/10 rounded px-1.5 py-0.5 text-center text-gray-200 focus:outline-none focus:border-cyan-500/50"
                                        />
                                        <button
                                            onClick={() => togglePlanItem(item)}
                                            title="Remove from plan"
                                            className="text-gray-600 hover:text-red-400 transition-colors"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {showPlan && planRawMaterials.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 animate-in fade-in duration-200">
                                    {planRawMaterials.map(({ item, qty }) => {
                                        const isLinkable = !!RESOURCE_MAP[item];
                                        const have = inventory[item] || 0;
                                        const stillNeed = Math.max(0, qty - have);
                                        const isCovered = stillNeed === 0;
                                        return (
                                            <div
                                                key={item}
                                                className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all ${isCovered ? 'bg-emerald-900/10 border-emerald-500/20' : 'bg-[#1a1a1a] border-white/5'}`}
                                            >
                                                {item === 'Coins' ? (
                                                    <div className="w-8 h-8 flex items-center justify-center bg-yellow-900/20 rounded border border-yellow-500/20 shrink-0"><Coins size={14} className="text-yellow-400" /></div>
                                                ) : (
                                                    <ItemImage name={item} size="sm" />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    {isLinkable ? (
                                                        <button onClick={() => handleNavigate(item)} className="text-xs font-bold text-gray-300 hover:text-white truncate block text-left">
                                                            {item}
                                                        </button>
                                                    ) : (
                                                        <span className="text-xs font-bold text-gray-300 truncate block">{item}</span>
                                                    )}
                                                    <span className={`text-[10px] font-mono ${isCovered ? 'text-emerald-400' : 'text-gray-500'}`}>
                                                        {isCovered ? `Covered (need ${formatQty(qty)})` : `Need x${formatQty(stillNeed)}${have > 0 ? ` of ${formatQty(qty)}` : ''}`}
                                                    </span>
                                                </div>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    placeholder="have"
                                                    value={have || ''}
                                                    onChange={(e) => setInventoryFor(item, Math.max(0, parseInt(e.target.value, 10) || 0))}
                                                    className="w-14 text-[10px] font-mono bg-black/40 border border-white/10 rounded px-1 py-0.5 text-gray-200 focus:outline-none focus:border-emerald-500/50 shrink-0"
                                                />
                                                {isLinkable && (
                                                    <span
                                                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${availabilityMap[item] ? 'bg-emerald-500' : 'bg-red-500'}`}
                                                        title={availabilityMap[item] ? 'Available' : 'Locked'}
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Recently viewed — auto-tracked, complements the curated Favorites list. */}
                    {recent.length > 0 && (
                        <div className="mb-5">
                            <div className="flex items-center justify-between gap-2 mb-2 px-2">
                                <div className="flex items-center gap-2">
                                    <RefreshCw size={14} className="text-gray-500" />
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Recently viewed</span>
                                </div>
                                <button
                                    onClick={() => setRecent([])}
                                    className="text-[10px] text-gray-600 hover:text-gray-300 font-mono uppercase tracking-wide transition-colors"
                                    title="Clear recent history"
                                >
                                    clear
                                </button>
                            </div>
                            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
                                {recent.map((item) => (
                                    <button
                                        key={item}
                                        onClick={() => handleNavigate(item)}
                                        className="shrink-0 flex items-center gap-2 px-2.5 py-1.5 bg-[#1a1a1a] border border-white/5 rounded-lg text-xs hover:bg-[#252525] hover:border-white/10 transition-all"
                                        title={item}
                                    >
                                        <ItemImage name={item} size="sm" />
                                        <span className="text-gray-300 max-w-[140px] truncate">{item}</span>
                                        <span
                                            className={`w-1.5 h-1.5 rounded-full ${availabilityMap[item] ? 'bg-emerald-500' : 'bg-red-500'}`}
                                        />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Closest to unlocking — top-down recommendations */}
                    {nextAchievable.length > 0 && (
                        <div className="mb-5">
                            <div className="flex items-center gap-2 mb-2 px-2">
                                <Compass size={14} className="text-amber-400" />
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Closest to unlocking</span>
                                <span className="text-[10px] text-gray-600 font-mono">items the engine knows you're nearly there on</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {nextAchievable.map(({ item, missing }) => (
                                    <button
                                        key={item}
                                        onClick={() => handleNavigate(item)}
                                        className="flex items-center gap-3 px-3 py-2 bg-[#1a1a1a] border border-amber-500/15 rounded-lg text-sm hover:bg-amber-900/10 hover:border-amber-500/30 transition-all group"
                                    >
                                        <ItemImage name={item} size="sm" />
                                        <div className="flex-1 min-w-0 text-left">
                                            <div className="text-gray-200 truncate font-medium">{item}</div>
                                            <div className="text-[10px] text-amber-400/70 truncate font-mono" title={missing.join(' · ')}>
                                                {missing.length === 1 ? missing[0] : `${missing[0]} · +${missing.length - 1} more`}
                                            </div>
                                        </div>
                                        <ArrowRight size={12} className="text-gray-600 group-hover:text-amber-400 transition-colors shrink-0" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Category browser */}
                    <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-2 mb-3 -mx-1 px-1">
                        <button
                            onClick={() => setActiveCategory(null)}
                            className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${activeCategory === null ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-[#1a1a1a] border-white/5 text-gray-400 hover:text-white'}`}
                        >
                            All ({Object.keys(RESOURCE_MAP).length})
                        </button>
                        {Object.keys(RESOURCE_CATEGORIES).map(cat => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(c => c === cat ? null : cat)}
                                className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap ${activeCategory === cat ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-[#1a1a1a] border-white/5 text-gray-400 hover:text-white'}`}
                            >
                                {cat} ({RESOURCE_CATEGORIES[cat].length})
                            </button>
                        ))}
                    </div>

                    {/* Index header + availability filter */}
                    <div className="flex items-center justify-between gap-2 mb-4 px-2">
                        <div className="flex items-center gap-2">
                            <ListFilter size={14} className="text-gray-500" />
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Database Index ({availableItems.length})</span>
                        </div>
                        <button
                            onClick={() => setAvailableOnly(v => !v)}
                            aria-pressed={availableOnly}
                            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${availableOnly ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-[#1a1a1a] border-white/5 text-gray-400 hover:text-white'}`}
                        >
                            <CheckCircle2 size={12} /> Available only
                        </button>
                    </div>

                    {availableItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center flex-1 text-gray-500 space-y-4 opacity-50 py-10">
                            <Search size={48} />
                            <p className="text-sm">
                                {query ? `No items found matching "${query}"` : 'No items match the current filters'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {availableItems.map(item => (
                                <button
                                    key={item}
                                    onClick={() => handleNavigate(item)}
                                    className="text-left px-3 py-3 bg-[#1a1a1a] hover:bg-[#252525] border border-white/5 rounded-xl text-sm text-gray-300 hover:text-white transition-all flex items-center gap-3 group"
                                >
                                    <ItemImage name={item} />
                                    <span className="flex-1 truncate font-medium">{item}</span>
                                    <span
                                        className={`w-2 h-2 rounded-full shrink-0 ${availabilityMap[item] ? 'bg-emerald-500' : 'bg-red-500'}`}
                                        title={availabilityMap[item] ? 'Available' : 'Locked'}
                                    />
                                    <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 text-gray-500 transition-opacity" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

        </div>
      </div>
    </div>
  );
};
