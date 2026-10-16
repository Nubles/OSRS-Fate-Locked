import React from 'react';
import type { BankDef } from '../../data/banks';
import { EntityModel } from '../EntityModel';
import { useModelFor } from '../../hooks/useModelFor';
import { bankChunks, bankModelName } from '../../utils/bankPicture';
import { OsrsAreaMap } from './OsrsAreaMap';

const BANK_ICON = `${import.meta.env.BASE_URL}osrs-ui/bank_icon.png`;

/**
 * A bank unlock's picture on the Activities detail stage: the game's model for
 * its kind of bank, turning, with its spot on the world map in the corner
 * (the map alone until the model list loads, or for a kind with no model).
 */
export const OsrsBankStage: React.FC<{ bank: BankDef; animate: boolean }> = ({ bank, animate }) => {
  const model = useModelFor(bankModelName(bank));
  const chunks = bankChunks(bank);
  if (!model) {
    return chunks.length
      ? <div style={{ position: 'absolute', inset: '24px 0 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <OsrsAreaMap name={bank.name} chunks={chunks} marker={BANK_ICON} maxWidth={300} maxHeight={190} />
        </div>
      : <span className="osrs-slot oact-stage-slot"><img className="osrs-px" src={BANK_ICON} alt="" aria-hidden="true" width={45} height={45} /></span>;
  }
  return (
    <>
      <div style={{ position: 'absolute', inset: '22px 0 0' }}>
        <EntityModel src={model} alt={bank.name} fill interactive autoRotate={animate} />
      </div>
      {chunks.length > 0 && (
        <div style={{ position: 'absolute', left: 8, bottom: 8 }}>
          <OsrsAreaMap name={bank.name} chunks={chunks} marker={BANK_ICON} markerSize={15} maxWidth={150} maxHeight={110} />
        </div>
      )}
    </>
  );
};

/** A bank unlock's picture in the unlock reveal: its spot on the world map. */
export const OsrsBankReveal: React.FC<{ bank: BankDef; animate: boolean }> = ({ bank, animate }) => {
  const model = useModelFor(bankModelName(bank));
  const chunks = bankChunks(bank);
  if (!chunks.length) {
    return model
      ? <EntityModel src={model} alt={bank.name} size={220} interactive autoRotate={animate} />
      : <div className="osrs-slot" style={{ width: 104, height: 96, marginBottom: 30 }}><img className="osrs-px" src={BANK_ICON} alt={bank.name} width={45} height={45} /></div>;
  }
  return (
    <div style={{ position: 'relative' }}>
      <OsrsAreaMap name={bank.name} chunks={chunks} marker={BANK_ICON} maxWidth={340} maxHeight={210} />
      <span className="osrs-tooltip" style={{ position: 'absolute', left: 8, bottom: 6, lineHeight: '16px' }}>Now unlocked</span>
    </div>
  );
};
