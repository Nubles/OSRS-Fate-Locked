
import { RESOURCE_MAP, ResourceSource } from '../data/resourceData';
import { GameState, TableType } from '../types';
import { REGION_GROUPS, MISTHALIN_AREAS, MERCHANTS_LIST } from '../constants';

export interface RouteStatus {
  isAvailable: boolean;
  missing: string[]; // Reasons for lock (e.g. "Region: Kandarin", "Slayer 60")
}

export interface SupplyChainResult {
  itemName: string;
  sources: {
    source: ResourceSource;
    status: RouteStatus;
  }[];
}

// Helpers for matching fuzzy merchant names
const normalize = (str: string) => str.toLowerCase().replace(/s$/, '').replace(/stores?/, 'shop').trim();

// Mapping for source names that don't auto-normalize to their Merchant Category
const PLURAL_MAPPINGS: Record<string, string> = {
    'ore seller': 'Ore Merchants',
    'sawmill operator': 'Sawmill Operators',
    'bar': 'Bars & Inns',
    'inn': 'Bars & Inns',
    'pub': 'Bars & Inns',
    'charter ship': 'Charter Ships',
    'charter ships': 'Charter Ships'
};

export const calculateSupplyChain = (itemName: string, gameState: GameState): SupplyChainResult | null => {
  const sources = RESOURCE_MAP[itemName];
  if (!sources) return null;

  const analyzedSources = sources.map(source => {
    const missing: string[] = [];
    
    // 1. Check Region Availability
    const hasRegion = source.regions.some(r => {
        if (r === 'Any') return true;
        if (r === 'Misthalin' || MISTHALIN_AREAS.includes(r)) return true;
        
        // Direct Unlock (Matches exact chunk name e.g. "Catherby")
        if (gameState.unlocks.regions.includes(r)) return true;

        // Group Unlock Reverse Check:
        // If source says 'Asgarnia' (Group), and user has 'Falador' (Child of Asgarnia).
        // We consider the resource available if *any* part of that region group is unlocked,
        // as resourceData often uses broad region names.
        if (REGION_GROUPS[r]) {
             const children = REGION_GROUPS[r];
             if (children.some(child => gameState.unlocks.regions.includes(child))) {
                 return true; 
             }
        }
        
        return false;
    });

    if (!hasRegion) {
        missing.push(`Region: ${source.regions.join(' or ')}`);
    }

    // 2. Check Skills
    if (source.skills) {
        Object.entries(source.skills).forEach(([skill, reqLevel]) => {
            const currentLevel = gameState.unlocks.levels[skill] || 1;
            const isUnlocked = (gameState.unlocks.skills[skill] || 0) > 0;
            if (!isUnlocked) {
                missing.push(`Skill Locked: ${skill}`);
            } else if (currentLevel < reqLevel) {
                missing.push(`${skill} ${currentLevel}/${reqLevel}`);
            }
        });
    }

    // 3. Check Quests
    if (source.quests) {
        source.quests.forEach(q => {
            if (!gameState.unlocks.quests.includes(q)) {
                missing.push(`Quest: ${q}`);
            }
        });
    }

    // 4. Check Specific Unlock (Boss/Minigame/etc)
    if (source.unlockId) {
        let isUnlocked = false;
        if (gameState.unlocks.bosses.includes(source.unlockId)) isUnlocked = true;
        else if (gameState.unlocks.minigames.includes(source.unlockId)) isUnlocked = true;
        else if (gameState.unlocks.farming.includes(source.unlockId)) isUnlocked = true;
        else if (gameState.unlocks.merchants.includes(source.unlockId)) isUnlocked = true;
        else if (gameState.unlocks.guilds.includes(source.unlockId)) isUnlocked = true;
        else if (gameState.unlocks.mobility.includes(source.unlockId)) isUnlocked = true;
        else if (gameState.unlocks.arcana.includes(source.unlockId)) isUnlocked = true;
        else if (gameState.unlocks.storage.includes(source.unlockId)) isUnlocked = true;
        else if (gameState.unlocks.housing.includes(source.unlockId)) isUnlocked = true;

        if (!isUnlocked) {
            missing.push(`Unlock: ${source.unlockId}`);
        }
    }

    // 5. Implicit Merchant Check
    // If it's a shop/merchant and DOESN'T have a specific unlockId, we check if the name matches a Merchant Category.
    if ((source.type === 'SHOP' || source.type === 'MERCHANT') && !source.unlockId) {
        let matchedCategory: string | undefined;
        
        // Check manual mappings first
        const lowerName = source.name.toLowerCase();
        if (PLURAL_MAPPINGS[lowerName]) {
            matchedCategory = PLURAL_MAPPINGS[lowerName];
        } 
        
        // If not found, fuzzy match against MERCHANTS_LIST
        if (!matchedCategory) {
            const normName = normalize(source.name);
            matchedCategory = MERCHANTS_LIST.find(m => normalize(m) === normName);
        }

        if (matchedCategory) {
            // Special Case: Charter Ships are in Mobility, not Merchants
            if (matchedCategory === 'Charter Ships') {
                if (!gameState.unlocks.mobility.includes('Charter Ships')) {
                    missing.push('Mobility: Charter Ships');
                }
            } else {
                // Standard Merchant Check
                if (!gameState.unlocks.merchants.includes(matchedCategory)) {
                    missing.push(`Merchant: ${matchedCategory}`);
                }
            }
        }
    }

    return {
        source,
        status: {
            isAvailable: missing.length === 0,
            missing
        }
    };
  });

  return {
    itemName,
    sources: analyzedSources.sort((a, b) => (a.status.isAvailable === b.status.isAvailable) ? 0 : a.status.isAvailable ? -1 : 1)
  };
};
