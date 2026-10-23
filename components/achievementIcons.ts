import type React from 'react';
import type { LucideProps } from 'lucide-react';
import {
  Trophy, BookOpen, Dumbbell, MapPin, Shield, Map, Swords, Skull, Gamepad2, Library, Crown, Star, Sparkles, Flame,
  Key, Gift, Wand2, Heart, Navigation, Zap, Home, ShoppingBag, Package, Users, Sprout, Landmark,
} from './OsrsIcon';
import type { AchievementIcon } from '../utils/achievements';

/**
 * Map an achievement's icon key to OSRS Wiki artwork. Shared by the reveal and
 * the Achievements dialog; it lives apart so the reveal doesn't pull the
 * lazily loaded dialog into the first download.
 */
export const ACHIEVEMENT_ICON: Record<AchievementIcon, React.ComponentType<LucideProps>> = {
  quest: BookOpen,
  skill: Dumbbell,
  region: MapPin,
  equipment: Shield,
  diary: Map,
  combat: Swords,
  boss: Skull,
  minigame: Gamepad2,
  collection: Library,
  trophy: Trophy,
  crown: Crown,
  star: Star,
  map: Map,
  sparkles: Sparkles,
  flame: Flame,
  key: Key,
  chaos: Gift,
  altar: Wand2,
  pet: Heart,
  mobility: Navigation,
  arcana: Zap,
  housing: Home,
  merchant: ShoppingBag,
  storage: Package,
  guild: Users,
  farming: Sprout,
  slayer: Skull,
  bank: Landmark,
};
