import React, { useId, useMemo, useState } from 'react';
import type { Pet } from '../data/pets';
import { PET_GROUPS, PET_SOURCES, petImageFile, petMatches } from '../data/petSources';
import { WikiIcon } from './WikiIcon';

/** An extra choice above the pets, such as "Not a new pet". */
export interface PetPickerExtra {
  value: string;
  label: string;
}

interface PetPickerProps {
  /** The pets to choose from. */
  pets: readonly Pet[];
  /** The chosen pet's id as text, an extra choice's value, or '' for none. */
  value: string;
  onChange: (value: string) => void;
  /** Names the box for screen readers, e.g. "The pet you got". */
  label: string;
  extra?: PetPickerExtra;
}

type Choice = { value: string; label: string; pet?: Pet };

/**
 * Seventy-odd pets don't fit a dropdown: type part of the pet's name, or where it comes from
 * ("vorkath", "cox", "mining"), and pick from the matches, grouped as the wiki groups them, each
 * with its picture and source. Arrow keys and Enter work too.
 */
export const PetPicker: React.FC<PetPickerProps> = ({ pets, value, onChange, label, extra }) => {
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const chosen = useMemo<Choice | undefined>(() => {
    if (extra && value === extra.value) return { value: extra.value, label: extra.label };
    const pet = pets.find((candidate) => String(candidate.id) === value);
    return pet ? { value: String(pet.id), label: pet.name, pet } : undefined;
  }, [extra, pets, value]);

  const groups = useMemo(() => PET_GROUPS.map(({ group, label: heading }) => ({
    heading,
    choices: pets
      .filter((pet) => (PET_SOURCES[pet.id]?.group ?? 'Other') === group && petMatches(pet, query))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((pet): Choice => ({ value: String(pet.id), label: pet.name, pet })),
  })).filter(({ choices }) => choices.length), [pets, query]);

  const extraShown = extra && (!query.trim() || extra.label.toLowerCase().includes(query.trim().toLowerCase()));
  const flat: Choice[] = [...(extraShown ? [{ value: extra.value, label: extra.label }] : []), ...groups.flatMap(({ choices }) => choices)];
  const activeIndex = Math.min(active, Math.max(0, flat.length - 1));
  const optionId = (index: number) => `${id}-option-${index}`;

  const pick = (choice: Choice) => {
    onChange(choice.value);
    setQuery('');
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((current) => Math.min(flat.length - 1, Math.max(0, Math.min(current, flat.length - 1) + step)));
    } else if (e.key === 'Enter') {
      if (open && flat[activeIndex]) {
        e.preventDefault();
        pick(flat[activeIndex]);
      }
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      setQuery('');
    }
  };

  const renderChoice = (choice: Choice, index: number) => {
    const source = choice.pet ? PET_SOURCES[choice.pet.id]?.source : undefined;
    const selected = choice.value === value;
    return (
      <li
        key={choice.value}
        id={optionId(index)}
        role="option"
        aria-selected={selected}
        data-value={choice.value}
        // Keep the focus in the box, so picking doesn't blur it first.
        onMouseDown={(e) => e.preventDefault()}
        onMouseEnter={() => setActive(index)}
        onClick={() => pick(choice)}
        className={`flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[11px] ${
          index === activeIndex ? 'bg-[#a16207]/40 text-white' : 'text-gray-200'
        } ${selected ? 'font-bold' : ''}`}
      >
        {choice.pet
          ? <WikiIcon file={petImageFile(choice.pet)} alt="" size={20} className="shrink-0" />
          : <span className="inline-block h-5 w-5 shrink-0" aria-hidden />}
        <span className="min-w-0 flex-1 truncate">{choice.label}</span>
        {source && <span className="max-w-[45%] shrink-0 truncate text-[9px] text-gray-500">{source}</span>}
      </li>
    );
  };

  let index = extraShown ? 1 : 0;
  return (
    <div className="w-full">
      <div className="flex items-center gap-1.5 rounded-md border border-[#4c462a] bg-black/70 px-1.5">
        {chosen?.pet && !open
          ? <WikiIcon file={petImageFile(chosen.pet)} alt="" size={18} className="shrink-0" />
          : null}
        <input
          type="text"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && flat.length ? optionId(activeIndex) : undefined}
          placeholder={chosen ? chosen.label : 'Type a pet, boss or skill…'}
          value={open ? query : (chosen?.label ?? '')}
          onFocus={() => { setOpen(true); setActive(0); }}
          onClick={() => setOpen(true)}
          onBlur={() => { setOpen(false); setQuery(''); }}
          onChange={(e) => { setQuery(e.target.value); setActive(0); setOpen(true); }}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent py-1.5 text-[11px] text-gray-200 placeholder:text-gray-500 focus:outline-none"
        />
      </div>
      {open && (
        // In the page's flow rather than floating, so a card that clips its overflow can't hide it.
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-[#4c462a] bg-black/90 p-1"
        >
          {extraShown && renderChoice({ value: extra.value, label: extra.label }, 0)}
          {groups.map(({ heading, choices }) => (
            <li key={heading} role="presentation">
              <div className="px-1.5 pb-0.5 pt-1.5 text-[9px] font-bold uppercase tracking-wide text-[#facc15]/70">{heading}</div>
              <ul role="group" aria-label={heading}>
                {choices.map((choice) => renderChoice(choice, index++))}
              </ul>
            </li>
          ))}
          {flat.length === 0 && (
            <li role="presentation" className="px-1.5 py-1 text-[11px] text-gray-500">No pet matches “{query}”.</li>
          )}
        </ul>
      )}
    </div>
  );
};
