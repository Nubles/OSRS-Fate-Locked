import type { CSSProperties } from 'react';
import artworkSources from '../../public/runeproof/sources.json';
export const QUEST_ART: Record<string, string> = {
  "Cook's Assistant": 'cook', 'Sheep Shearer': 'ball-of-wool', 'Rune Mysteries': 'air-talisman', 'Romeo & Juliet': 'cadava-potion',
  'Imp Catcher': 'yellow-bead', "Doric's Quest": 'iron-ore', 'Goblin Diplomacy': 'goblin-mail', "Witch's Potion": 'eye-of-newt',
  'X Marks the Spot': 'spade', 'The Restless Ghost': 'ghostspeak-amulet', 'Ernest the Chicken': 'oil-can', "Pirate's Treasure": 'karamjan-rum',
};
const ART_IDS = new Set(artworkSources.images.map(image => image.id));
/** Reviewed OSRS Wiki artwork, bundled locally; surrounding text names the action. */
export function WikiArt({id, size = 18}: {id: string; size?: number}) {
  if (!ART_IDS.has(id)) return null;
  const style: CSSProperties = {width: size, height: size, objectFit: 'contain', flexShrink: 0};
  return <img className="rp-wiki-image" src={`${import.meta.env.BASE_URL}runeproof/${id}.png`} alt="" aria-hidden="true" width={size} height={size} style={style} draggable={false} onError={event => { event.currentTarget.hidden = true; }} />;
}
