/**
 * "Shops & Wares" -> "Shops & wares", "POH Facilities" -> "POH facilities":
 * sentence case for the OSRS boards' short labels. Only Title-cased words
 * after the first are lowered; acronyms (POH, XP) and words with inner
 * capitals keep their spelling.
 */
export const sentenceCaseLabel = (label: string): string => {
  let first = true;
  return label.replace(/[A-Za-z][A-Za-z']*/g, word => {
    if (first) {
      first = false;
      return word.charAt(0).toUpperCase() + word.slice(1);
    }
    return /^[A-Z][a-z']*$/.test(word) ? word.toLowerCase() : word;
  });
};
