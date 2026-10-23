// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { JUMP_GAP_PX, journalStickyHeaderFor, jumpScrollMargin, setJumpScrollMargin } from './journalJump';

// The classic Quest Journal: an 8 px padded scroll area whose section header
// ("QUESTS (193)", 25 px) sticks at top 0, as in components/QuestLog.tsx.
const journal = (withHeader: boolean, headerHeight = 25) => {
  document.body.innerHTML = `
    <div style="overflow-y: auto; padding-top: 8px">
      <div data-journal-section>
        ${withHeader ? '<h3 data-journal-sticky style="position: sticky; top: 0px">Quests (193)</h3>' : ''}
        <div><div data-journal-id="Priest in Peril"></div></div>
      </div>
    </div>`;
  const header = document.querySelector<HTMLElement>('[data-journal-sticky]');
  if (header) header.getBoundingClientRect = () => ({ height: headerHeight } as DOMRect);
  return document.querySelector<HTMLElement>('[data-journal-id]')!;
};

describe('journal jump landing', () => {
  it('lands the card a small gap below where the header sticks', () => {
    expect(JUMP_GAP_PX).toBe(8);
    // 8 px list padding + 25 px header + 8 px gap.
    expect(jumpScrollMargin(25, 8)).toBe(41);
    expect(jumpScrollMargin(25)).toBe(33);
    // A fractional header (zoom, a larger font) rounds up, never under it.
    expect(jumpScrollMargin(24.2, 8)).toBe(41);
  });

  it('keeps the small gap alone when there is no sticky header', () => {
    expect(jumpScrollMargin()).toBe(8);
    expect(jumpScrollMargin(null, 8)).toBe(8);
    expect(jumpScrollMargin(0, 8)).toBe(8);
    expect(jumpScrollMargin(Number.NaN)).toBe(8);
    expect(jumpScrollMargin(-4)).toBe(8);
  });

  it('finds the sticky header of the section holding the card', () => {
    expect(journalStickyHeaderFor(journal(true))?.textContent).toBe('Quests (193)');
    expect(journalStickyHeaderFor(journal(false))).toBeNull();
  });

  it('sets the card’s scroll margin from the header’s measured height and stuck position', () => {
    const card = journal(true, 33);
    setJumpScrollMargin(card);
    expect(card.style.scrollMarginTop).toBe('49px');

    const bare = journal(false);
    setJumpScrollMargin(bare);
    expect(bare.style.scrollMarginTop).toBe('8px');
  });
});
