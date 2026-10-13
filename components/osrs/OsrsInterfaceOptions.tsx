import React, { useRef } from 'react';
import {
  setClientLayout,
  setInterfaceStyle,
  setTextSize,
  useClientLayout,
  useInterfaceStyle,
  useIsOsrsUi,
  useTextSize,
} from '../../utils/uiStyle';
import './osrs-options.css';

/**
 * OSRS layout options (interface style, fixed client, bigger text). Rendered
 * inside the settings menu while the OSRS layout is on. Each choice is a
 * per-viewer preference (utils/uiStyle.ts), never part of the save.
 */

type Choice<T extends string> = { value: T; label: string; hint: string };

function OptionRow<T extends string>({ label, value, choices, onPick }: {
  label: string;
  value: T;
  choices: readonly Choice<T>[];
  onPick: (value: T) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  // Radio-group keys: arrows move the choice and the focus together.
  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + choices.length) % choices.length;
    onPick(choices[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div className="osrs-opt-row">
      <span className="osrs-opt-label">{label}</span>
      <div role="radiogroup" aria-label={label} className="osrs-opt-seg">
        {choices.map((choice, index) => {
          const on = choice.value === value;
          return (
            <button
              key={choice.value}
              ref={(el) => { refs.current[index] = el; }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              title={choice.hint}
              className={on ? 'osrs-btn is-on' : 'osrs-btn'}
              onClick={() => onPick(choice.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {choice.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const STYLES = [
  { value: '2007', label: '2007', hint: 'Brown stone interface' },
  { value: '2010', label: '2010', hint: 'Grey stone interface with metal rivets' },
] as const;
const CLIENTS = [
  { value: 'resizable', label: 'Resizable', hint: 'The tracker fills the window' },
  { value: 'fixed', label: 'Fixed', hint: 'The tracker sits in a centred, fixed-width game client' },
] as const;
const TEXT_SIZES = [
  { value: 'normal', label: 'Normal', hint: 'RuneScape fonts at 16px' },
  { value: 'large', label: 'Large', hint: 'RuneScape fonts at 32px' },
] as const;

export const OsrsInterfaceOptions: React.FC = () => {
  const isOsrs = useIsOsrsUi();
  const interfaceStyle = useInterfaceStyle();
  const clientLayout = useClientLayout();
  const textSize = useTextSize();
  if (!isOsrs) return null;
  return (
    <div className="osrs-opts" role="group" aria-label="OSRS layout options">
      <div className="osrs-opts-sec">Interface</div>
      <OptionRow label="Interface style" value={interfaceStyle} choices={STYLES} onPick={setInterfaceStyle} />
      <OptionRow label="Client" value={clientLayout} choices={CLIENTS} onPick={setClientLayout} />
      <OptionRow label="Text size" value={textSize} choices={TEXT_SIZES} onPick={setTextSize} />
    </div>
  );
};
export default OsrsInterfaceOptions;
