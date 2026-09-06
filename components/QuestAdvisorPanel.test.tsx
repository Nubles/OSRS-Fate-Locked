import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { QuestAdvisorPanel } from './QuestAdvisorPanel';

describe('conditional advisor wording', () => {
  it('shows pending checks and does not claim a candidate is available to complete', () => {
    const html = renderToStaticMarkup(<QuestAdvisorPanel onItemClick={() => {}} ranked={[{
      id: 'cook', name: "Cook's Assistant", points: 1, pendingChecks: ['Legal supplies'],
      newQuestNames: [], newDiaryIds: [], cascadeQuestNames: [], cascadeDiaryIds: [], score: 0, cascadeScore: 0,
    }]} />);
    expect(html).toContain('Needs confirmation: 1 check');
    expect(html).toContain('Legal supplies');
    expect(html).toContain('Planning estimates');
    expect(html).not.toContain('available to complete');
  });
});
