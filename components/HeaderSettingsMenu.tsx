import React from 'react';
import { Download, History, Info, Link2, PauseCircle, PlayCircle, Radio, RotateCcw, SlidersHorizontal, Upload, Telescope, ShieldCheck, Volume2 } from 'lucide-react';
import { confirmSpendPref, soundsPref, tableOutlookPref, welcomeBackPref } from '../utils/viewerPrefs';
import { BookOpen, Lightbulb, ScrollText } from './OsrsIcon';
import { useGame } from '../context/GameContext';
import { RESET_CONFIRM_MESSAGE } from '../utils/backups';
import { FATE_EXPORT_HINT } from '../utils/fateSaveFile';
import { OSRS_MIN_WIDTH, setUiStyle, useIsWideEnoughForOsrs, useUiStyle } from '../utils/uiStyle';
import { DropdownMenu } from './DropdownMenu';
import { FateMapOptions } from './FateMapOptions';
import { setSkillOddsHover, useSkillOddsHover } from '../utils/skillOddsPref';
import { OffDeviceCopyStatus } from './OffDeviceCopyStatus';

interface HeaderSettingsMenuProps {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onOpenRuneliteGuide: (returnFocusTarget: HTMLElement | null) => void;
  onOpenChangelog: (returnFocusTarget: HTMLElement | null) => void;
  onImportSave: () => void;
  onExportSave: () => void;
  setShowSyncCode: (show: boolean) => void;
  setShowDiscord: (show: boolean) => void;
}

/**
 * The classic header's gear menu: guides, display settings and save tools.
 * It loads on first open (App.tsx warms it at idle), keeping the entry chunk small.
 */
const HeaderSettingsMenu: React.FC<HeaderSettingsMenuProps> = ({
  anchorRef, onClose, onOpenRuneliteGuide, onOpenChangelog, onImportSave, onExportSave, setShowSyncCode, setShowDiscord,
}) => {
  const uiStyle = useUiStyle();
  const osrsFits = useIsWideEnoughForOsrs();
  const { animationsEnabled, toggleAnimations, advisorsEnabled, toggleAdvisors, resetGame, gameModeId } = useGame();
  const skillOddsHover = useSkillOddsHover();
  const tableOutlook = tableOutlookPref.use();
  const confirmSpend = confirmSpendPref.use();
  const welcomeBack = welcomeBackPref.use();
  const sounds = soundsPref.use();
  // An item that leaves the menu: focus goes back to the gear first, so a
  // dialog it opens returns focus there when it closes.
  const pickUtil = (run: () => void) => {
    anchorRef.current?.focus({ preventScroll: true });
    onClose();
    run();
  };

  return (
    <DropdownMenu anchorRef={anchorRef} onClose={onClose} label="Settings & save tools" width={224}
      className="bg-[#1c1c1c] border border-white/15 rounded-lg shadow-2xl py-1.5 text-[12px]">
        <button type="button" role="menuitem" onClick={() => {
          pickUtil(() => onOpenRuneliteGuide(anchorRef.current));
        }} className="w-full flex items-center gap-2.5 px-3 py-1.5 focus-visible:outline-none focus-visible:bg-white/10 text-gray-300 hover:bg-white/5 hover:text-amber-300">
          <BookOpen size={13} className="text-amber-300" />
          RuneLite Plugin Guide
        </button>
        <button type="button" role="menuitem" onClick={() => {
          pickUtil(() => onOpenChangelog(anchorRef.current));
        }} className="w-full flex items-center gap-2.5 px-3 py-1.5 focus-visible:outline-none focus-visible:bg-white/10 text-gray-300 hover:bg-white/5 hover:text-amber-300">
          <ScrollText size={13} className="text-amber-300" />
          What's New
        </button>
        <div role="separator" className="my-1 border-t border-white/10" />
        <button type="button" onClick={() => { toggleAnimations(); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 focus-visible:outline-none focus-visible:bg-white/10 text-gray-300 hover:bg-white/5 hover:text-white" role="menuitemcheckbox" aria-checked={animationsEnabled}>
           {animationsEnabled ? <PlayCircle size={13} className="text-green-400" /> : <PauseCircle size={13} className="text-gray-500" />}
           Animations <span className="ml-auto text-[10px] text-gray-500">{animationsEnabled ? 'on' : 'off'}</span>
        </button>
        {gameModeId === 'chunked' && <FateMapOptions />}
        <button type="button" onClick={() => { setUiStyle(uiStyle === 'osrs' ? 'classic' : 'osrs'); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 focus-visible:outline-none focus-visible:bg-white/10 text-gray-300 hover:bg-white/5 hover:text-white" role="menuitemcheckbox" aria-checked={uiStyle === 'osrs'} title={osrsFits ? undefined : `The OSRS layout shows on windows at least ${OSRS_MIN_WIDTH} pixels wide`}>
           <SlidersHorizontal size={13} className={uiStyle === 'osrs' ? 'text-amber-400' : 'text-gray-500'} />
           OSRS layout <span className="ml-auto text-[10px] text-gray-500">{uiStyle === 'osrs' ? (osrsFits ? 'on' : 'on, wide screens') : 'off'}</span>
        </button>
        <button type="button" onClick={() => { toggleAdvisors(); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 focus-visible:outline-none focus-visible:bg-white/10 text-gray-300 hover:bg-white/5 hover:text-white" role="menuitemcheckbox" aria-checked={advisorsEnabled}>
           <Lightbulb size={13} className={advisorsEnabled ? 'text-amber-400' : 'text-gray-500'} />
           Advisor panels <span className="ml-auto text-[10px] text-gray-500">{advisorsEnabled ? 'on' : 'off'}</span>
        </button>
        <button type="button" onClick={() => { setSkillOddsHover(!skillOddsHover); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 focus-visible:outline-none focus-visible:bg-white/10 text-gray-300 hover:bg-white/5 hover:text-white" role="menuitemcheckbox" aria-checked={skillOddsHover} title="On: a skill's roll odds show over the card when you hover it. Off: they open from the small i in the card's corner.">
           <Info size={13} className={skillOddsHover ? 'text-amber-400' : 'text-gray-500'} />
           Skill odds on hover <span className="ml-auto text-[10px] text-gray-500">{skillOddsHover ? 'on' : 'off'}</span>
        </button>
        <button type="button" onClick={() => { tableOutlookPref.set(!tableOutlook); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 focus-visible:outline-none focus-visible:bg-white/10 text-gray-300 hover:bg-white/5 hover:text-white" role="menuitemcheckbox" aria-checked={tableOutlook} title="On: each table on Spend Keys says how many of its draws you could use straight away. A Key still draws from the whole table.">
           <Telescope size={13} className={tableOutlook ? 'text-amber-400' : 'text-gray-500'} />
           Table outlook <span className="ml-auto text-[10px] text-gray-500">{tableOutlook ? 'on' : 'off'}</span>
        </button>
        <button type="button" onClick={() => { confirmSpendPref.set(!confirmSpend); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 focus-visible:outline-none focus-visible:bg-white/10 text-gray-300 hover:bg-white/5 hover:text-white" role="menuitemcheckbox" aria-checked={confirmSpend} title="On: a Yes or No box comes up before a click spends a Key or rolls for one.">
           <ShieldCheck size={13} className={confirmSpend ? 'text-amber-400' : 'text-gray-500'} />
           Ask before Key clicks <span className="ml-auto text-[10px] text-gray-500">{confirmSpend ? 'on' : 'off'}</span>
        </button>
        <button type="button" onClick={() => { welcomeBackPref.set(!welcomeBack); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 focus-visible:outline-none focus-visible:bg-white/10 text-gray-300 hover:bg-white/5 hover:text-white" role="menuitemcheckbox" aria-checked={welcomeBack} title="On: after 12 hours or more away, a short note says what your last session did.">
           <History size={13} className={welcomeBack ? 'text-amber-400' : 'text-gray-500'} />
           Welcome back note <span className="ml-auto text-[10px] text-gray-500">{welcomeBack ? 'on' : 'off'}</span>
        </button>
        <button type="button" onClick={() => { soundsPref.set(!sounds); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 focus-visible:outline-none focus-visible:bg-white/10 text-gray-300 hover:bg-white/5 hover:text-white" role="menuitemcheckbox" aria-checked={sounds} title="On: a soft sound on a missed roll, a chime on a Key and a short fanfare on an unlock.">
           <Volume2 size={13} className={sounds ? 'text-amber-400' : 'text-gray-500'} />
           Sounds <span className="ml-auto text-[10px] text-gray-500">{sounds ? 'on' : 'off'}</span>
        </button>
        <div role="separator" className="my-1 border-t border-white/10" />
        <OffDeviceCopyStatus />
        <button type="button" role="menuitem" onClick={() => pickUtil(() => { onImportSave(); })} className="w-full flex items-center gap-2.5 px-3 py-1.5 focus-visible:outline-none focus-visible:bg-white/10 text-gray-300 hover:bg-white/5 hover:text-white">
           <Upload size={13} /> Import save
        </button>
        <button type="button" role="menuitem" onClick={() => pickUtil(() => { onExportSave(); })} title={FATE_EXPORT_HINT} className="w-full flex items-center gap-2.5 px-3 py-1.5 focus-visible:outline-none focus-visible:bg-white/10 text-gray-300 hover:bg-white/5 hover:text-white">
           <Download size={13} /> Export save file (.fate)
        </button>
        <button type="button" role="menuitem" onClick={() => pickUtil(() => { setShowSyncCode(true); })} className="w-full flex items-center gap-2.5 px-3 py-1.5 focus-visible:outline-none focus-visible:bg-white/10 text-gray-300 hover:bg-white/5 hover:text-cyan-300">
           <Link2 size={13} /> Sync code (move device)
        </button>
        <button type="button" role="menuitem" onClick={() => pickUtil(() => { setShowDiscord(true); })} className="w-full flex items-center gap-2.5 px-3 py-1.5 focus-visible:outline-none focus-visible:bg-white/10 text-gray-300 hover:bg-white/5 hover:text-indigo-300">
           <Radio size={13} /> Discord notifications
        </button>
        <div role="separator" className="my-1 border-t border-white/10" />
        <button type="button" role="menuitem" onClick={() => pickUtil(() => { if(window.confirm(RESET_CONFIRM_MESSAGE)) void resetGame(); })} className="w-full flex items-center gap-2.5 px-3 py-1.5 focus-visible:outline-none focus-visible:bg-white/10 text-red-300/90 hover:bg-red-900/20 hover:text-red-200">
           <RotateCcw size={13} /> Reset all progress
        </button>
    </DropdownMenu>
  );
};

export default HeaderSettingsMenu;
