/** The coach hint near the Pity Key. Fate can sit at the line (achievement back pay fills it), and then the next miss pays it out. */
export const pityHintText = (fateLeft: number): string => (fateLeft <= 0
  ? 'Your Fate is full: your next failed roll gives you a guaranteed Pity Key.'
  : `${fateLeft} Fate Point${fateLeft === 1 ? '' : 's'} from a guaranteed Pity Key. Failed rolls count toward it.`);
