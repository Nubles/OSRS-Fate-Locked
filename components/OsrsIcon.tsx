import React from 'react';
import type { LucideProps } from 'lucide-react';
import { WIKI_UI_ICONS } from '../data/wikiUiIcons';
import { WikiIcon } from './WikiIcon';

/** Matches the size/className API of the former feature glyphs, using real Wiki artwork. */
function artwork(name: keyof typeof WIKI_UI_ICONS): React.FC<LucideProps> {
  const Icon: React.FC<LucideProps> = ({ size = 24, className, style, 'aria-label': label, 'aria-hidden': hidden }) => (
    <WikiIcon file={WIKI_UI_ICONS[name]} alt={hidden === true || hidden === 'true' ? '' : label ?? ''} size={size}
      className={className} style={style} />
  );
  Icon.displayName = `Osrs${name}`;
  return Icon;
}

export const Activity = artwork('Activity');
export const Award = artwork('Award');
export const BookOpen = artwork('BookOpen');
export const Box = artwork('Box');
export const Boxes = artwork('Boxes');
export const BrainCircuit = artwork('BrainCircuit');
export const Coins = artwork('Coins');
export const Compass = artwork('Compass');
export const Crosshair = artwork('Crosshair');
export const Crown = artwork('Crown');
export const Dice5 = artwork('Dice5');
export const Dices = artwork('Dices');
export const Dna = artwork('Dna');
export const Dumbbell = artwork('Dumbbell');
export const Eye = artwork('Eye');
export const Flag = artwork('Flag');
export const Flame = artwork('Flame');
export const Footprints = artwork('Footprints');
export const Gamepad2 = artwork('Gamepad2');
export const Gem = artwork('Gem');
export const Gift = artwork('Gift');
export const Globe = artwork('Globe');
export const GraduationCap = artwork('GraduationCap');
export const Hammer = artwork('Hammer');
export const Hand = artwork('Hand');
export const Heart = artwork('Heart');
export const Home = artwork('Home');
export const Key = artwork('Key');
export const Landmark = artwork('Landmark');
export const Library = artwork('Library');
export const Lightbulb = artwork('Lightbulb');
export const Map = artwork('Map');
export const MapPin = artwork('MapPin');
export const Navigation = artwork('Navigation');
export const Package = artwork('Package');
export const PartyPopper = artwork('PartyPopper');
export const Scroll = artwork('Scroll');
export const ScrollText = artwork('ScrollText');
export const Shield = artwork('Shield');
export const Shirt = artwork('Shirt');
export const ShoppingBag = artwork('ShoppingBag');
export const Skull = artwork('Skull');
export const Sparkles = artwork('Sparkles');
export const Sprout = artwork('Sprout');
export const Star = artwork('Star');
export const Store = artwork('Store');
export const Sword = artwork('Sword');
export const Swords = artwork('Swords');
export const Target = artwork('Target');
export const Tent = artwork('Tent');
export const Trophy = artwork('Trophy');
export const User = artwork('User');
export const Users = artwork('Users');
export const Wand2 = artwork('Wand2');
export const Zap = artwork('Zap');


export const FlaskConical = artwork('FlaskConical');
export const Pickaxe = artwork('Pickaxe');
