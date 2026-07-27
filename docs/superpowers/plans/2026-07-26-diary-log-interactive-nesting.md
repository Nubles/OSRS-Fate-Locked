# Diary Log Valid Interactive Nesting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every expanded Diary Log task use valid native interactive markup, so task completion, the Wiki link, training guides, and map controls work independently without interactive descendants inside a button.

**Architecture:** Keep DiaryLog's data lookup, eligibility evaluation, manual-attestation request, and completion handler intact. Replace only the task-row outer button with a noninteractive `div`, make a labelled native completion button responsible for completion, and render the Wiki and actionable requirement controls as siblings; retain static requirement evidence inside the completion control. The existing server-rendered test remains the regression boundary and gains a small balanced-element helper so it checks the real task row's DOM structure rather than relying on a global substring.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest 4, React DOM server rendering.

## Global Constraints

- Modify only `components/DiaryLog.tsx` and `components/DiaryLog.test.tsx`; do not change diary content, generated data, eligibility, fate rates, balance, saves, or unlock pools.
- Use a noninteractive task-row container and native `<button>` / `<a>` controls; do not use a clickable `div`, `role="button"`, synthetic keyboard handling, or nested interactive elements.
- The completion button must have the exact accessible label `Complete diary task: ${task.description}` when the description is non-empty, and `Complete diary task` when it is empty.
- Preserve `handleTaskToggle`'s eligibility evaluation, manual-attestation confirmation and cancellation, and its `completeDiaryTask(task.id, e.clientX, e.clientY, attestation)` completion coordinates.
- A completed tier or completed task must keep the native completion button disabled; Wiki/help controls remain independently usable when present.
- Preserve the Wiki URL, `target="_blank"`, and `rel="noopener noreferrer"`; Wiki activation must not complete the task or expand/collapse the tier.
- Unmet skill controls must keep recording `e.currentTarget.getBoundingClientRect()` and opening the matching training popover; mappable regions must keep calling `showChunkOnMap(chunk.cx, chunk.cy)` and unmappable regions must remain disabled with a useful label.
- Remove task-row `stopPropagation` calls that existed only because controls were nested beneath the old task button.
- Do not introduce new dependencies, do not stage `utils/taskIdMigrations.ts`, and use only visible `apply_patch` or checked plain patch edits; never use encoded, obfuscated, dynamic, or PowerShell/Python file-write commands.

---

## File Structure

- Modify `components/DiaryLog.tsx`: split each expanded task into a noninteractive row, its labelled completion button, and sibling Wiki/requirement action controls while preserving current data and callback behavior.
- Modify `components/DiaryLog.test.tsx`: add an SSR structural regression for the real `ard_easy_2` `Steal a cake from the Ardougne market stalls.` task, alongside the existing access-evidence test.

### Task 1: Render valid, independently operable Diary task controls

**Files:**
- Modify: `components/DiaryLog.tsx:157-166, 339-477`
- Modify: `components/DiaryLog.test.tsx:1-40`

**Interfaces:**
- Consumes: `DiaryTask`, `evaluateDiaryTaskEligibility(task, unlocks, gameModeId)`, `requestManualAttestation(task.description, eligibility, confirm)`, `completeDiaryTask(task.id, e.clientX, e.clientY, attestation)`, `setSkillPopover(SkillPopoverState)`, `chunkForPlace(region)`, and `showChunkOnMap(cx, cy)`.
- Produces: `data-diary-task-row={task.id}` on each noninteractive row; a completion button with `aria-label={task.description ? \`Complete diary task: ${task.description}\` : 'Complete diary task'}`; sibling Wiki, unmet-skill, and mappable-region controls.

- [ ] **Step 1: Add the failing structure-aware SSR regression test**

Add these helpers immediately after the existing Vitest mocks in `components/DiaryLog.test.tsx`. They locate a requested element, balance only matching open/close tags, and return that element's complete SSR subtree; this scopes assertions to one real task row instead of searching the entire page string.

```tsx
const elementMarkup = (markup: string, openingTagPrefix: string) => {
  const start = markup.indexOf(openingTagPrefix);
  if (start === -1) {
    throw new Error(`Could not find element starting with ${openingTagPrefix}`);
  }

  const openingEnd = markup.indexOf('>', start);
  const openingTag = markup.slice(start, openingEnd + 1);
  const tagName = /^<([a-z0-9-]+)/i.exec(openingTag)?.[1];
  if (!tagName) {
    throw new Error(`Could not read an element name from ${openingTag}`);
  }

  const tagPattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi');
  tagPattern.lastIndex = start;
  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(markup))) {
    if (match[0].startsWith('</')) {
      depth -= 1;
      if (depth === 0) return markup.slice(start, tagPattern.lastIndex);
    } else if (!match[0].endsWith('/>')) {
      depth += 1;
    }
  }

  throw new Error(`Could not find the closing ${tagName} for ${openingTagPrefix}`);
};

const openingTagWith = (markup: string, attribute: string) => {
  const start = markup.indexOf(attribute);
  if (start === -1) {
    throw new Error(`Could not find ${attribute}`);
  }
  const openingStart = markup.lastIndexOf('<', start);
  const openingEnd = markup.indexOf('>', start);
  return markup.slice(openingStart, openingEnd);
};

const innerMarkup = (element: string, tagName: string) => {
  const openingEnd = element.indexOf('>');
  const closingTag = `</${tagName}>`;
  const closingStart = element.lastIndexOf(closingTag);
  if (openingEnd === -1 || closingStart === -1) {
    throw new Error(`Could not extract the inner ${tagName} markup`);
  }
  return element.slice(openingEnd + 1, closingStart);
};
```

Then add this test to the existing DiaryLog access-evidence describe block, after the current access-evidence test:

```tsx
  it('keeps the real Steal a cake completion, Wiki, and training controls as siblings', () => {
    const description = 'Steal a cake from the Ardougne market stalls.';
    const markup = renderToStaticMarkup(
      <DiaryLog searchTerm="Steal a cake" suspendModals />,
    );
    const row = elementMarkup(markup, '<div data-diary-task-row="ard_easy_2"');
    const completion = elementMarkup(
      row,
      `<button aria-label="Complete diary task: ${description}"`,
    );
    const completionChildren = innerMarkup(completion, 'button');
    const wikiOpeningTag = openingTagWith(
      row,
      `aria-label="Open Wiki for diary task: ${description}"`,
    );
    const skillOpeningTag = openingTagWith(row, 'title="Training guide: Thieving"');

    expect(row.startsWith('<div ')).toBe(true);
    expect(completion.startsWith('<button ')).toBe(true);
    expect(completionChildren).not.toMatch(/<(?:a|button)\\b/);
    expect(completionChildren).not.toContain(wikiOpeningTag);
    expect(completionChildren).not.toContain(skillOpeningTag);
    expect(row).not.toMatch(/^<button\\b/);
  });
```

The test intentionally searches the real `ard_easy_2` source task: it has an unmet Thieving requirement for the mocked empty unlock state, so it proves an interactive requirement control exists as a sibling. The currently rendered row has no `data-diary-task-row` attribute, so this must fail before implementation.

- [ ] **Step 2: Run the focused test to confirm RED**

Run:

```powershell
npm test -- components/DiaryLog.test.tsx
```

Expected: FAIL in `keeps the real Steal a cake completion, Wiki, and training controls as siblings` with `Could not find element starting with <div data-diary-task-row="ard_easy_2"`. The existing `shows partial Barbarian Fishing access without a completion blocker` test remains passing.

- [ ] **Step 3: Remove only obsolete task-row propagation handling**

In `components/DiaryLog.tsx`, keep the handler signature and all eligibility, confirmation, cancellation, and coordinate logic, but delete only the first line shown below:

```tsx
  const handleTaskToggle = (task: DiaryTask, e: React.MouseEvent) => {
      const eligibility = evaluateDiaryTaskEligibility(task, unlocks, gameModeId);
      const attestation = requestManualAttestation(
        task.description,
        eligibility,
        message => window.confirm(message),
      );
      if (attestation === null) return;
      completeDiaryTask(task.id, e.clientX, e.clientY, attestation);
  };
```

Do not change `handleToggle`, which belongs to the separate diary header interaction. Do not change the manual-attestation callback or `completeDiaryTask` arguments.

- [ ] **Step 4: Compute static evidence and actionable sibling controls for each task**

Within the existing task-map callback, immediately after the existing `hasReqs` declaration, add the following values. They make static met requirements available to the completion button and ensure that an action-wrapper is rendered only when it has at least one real control.

```tsx
                          const skillRequirements = Object.entries(task.skills ?? {});
                          const unmetSkillRequirements = skillRequirements.filter(([skill, level]) =>
                            !meetsSkillRequirement(unlocks, skill, level as number),
                          );
                          const regionRequirements = (task.regions ?? []).map((region) => ({
                            region,
                            chunk: chunkForPlace(region),
                          }));
                          const hasRequirementActions = unmetSkillRequirements.length > 0
                            || regionRequirements.length > 0;
                          const completionLabel = task.description
                            ? `Complete diary task: ${task.description}`
                            : 'Complete diary task';
```

This key-preserving filter deliberately retains the skill name instead of inferring it from a level, so equal skill levels remain independent.

- [ ] **Step 5: Replace the nested task button with the noninteractive row and sibling controls**

Replace the complete current task-row `return` block beginning with its outer `<button key={task.id}>` and ending at its matching `</button>` with the following complete row. Keep the static chip markup exactly as shown inside the completion button; it preserves current evidence colors while putting every Wiki, unmet-skill, and region action outside that button.

```tsx
                          return (
                            <div
                              key={task.id}
                              data-diary-task-row={task.id}
                              className={`w-full flex flex-wrap items-start gap-2 p-2 rounded group ${(isCompleted || isTaskDone) ? 'cursor-default opacity-70' : 'hover:bg-white/5'}`}
                            >
                              <button
                                onClick={(e) => handleTaskToggle(task, e)}
                                disabled={isCompleted || isTaskDone}
                                aria-label={completionLabel}
                                className={`min-w-0 flex-1 flex items-start gap-3 text-left ${(isCompleted || isTaskDone) ? 'cursor-default' : 'cursor-pointer'}`}
                              >
                                <div className={`mt-0.5 ${isTaskDone ? 'text-green-400' : 'text-gray-600 group-hover:text-gray-400'}`}>
                                  {isTaskDone ? <CheckSquare size={14} /> : <Square size={14} />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <span className={`text-xs ${isTaskDone ? 'text-gray-400 line-through' : 'text-gray-300'}`}>{task.description}</span>
                                  {hasReqs && !isTaskDone && (
                                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                                      {skillRequirements.filter(([skill, level]) => meetsSkillRequirement(unlocks, skill, level as number)).map(([skill, level]) => (
                                        <span key={skill} className="text-[9px] px-1.5 py-0.5 rounded border flex items-center gap-1 border-white/5 text-gray-500 bg-black/30">
                                          <BookOpen size={8} /> {skill} {level as number}
                                        </span>
                                      ))}
                                      {task.items?.map(item => (
                                        <span key={item} className="text-[9px] px-1.5 py-0.5 rounded border flex items-center gap-1 border-white/5 text-gray-500 bg-black/30">
                                          <BookOpen size={8} /> {item}
                                        </span>
                                      ))}
                                      {task.quests?.map(q => {
                                        const met = unlocks.quests.includes(q);
                                        return (
                                          <span key={q} className={`text-[9px] px-1.5 py-0.5 rounded border flex items-center gap-1 ${met ? 'border-white/5 text-gray-500 bg-black/30' : 'border-red-500/30 text-red-400 bg-red-900/10'}`}>
                                            <BookOpen size={8} /> {q}
                                          </span>
                                        );
                                      })}
                                      {alternativeLabel && (
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded border flex items-center gap-1 ${taskEligibility.blockers.some(blocker => blocker.kind === 'alternative') ? 'border-red-500/30 text-red-400 bg-red-900/10' : 'border-white/5 text-gray-500 bg-black/30'}`}>
                                          <BookOpen size={8} /> One of: {alternativeLabel}
                                        </span>
                                      )}
                                      {[task.combatLevel ? `Combat level ${task.combatLevel}` : undefined, task.allQuests ? 'All quests' : undefined, task.anySkillLevel ? `Any skill ${task.anySkillLevel}` : undefined].filter((label): label is string => Boolean(label)).map(label => {
                                        const met = !taskEligibility.blockers.some(blocker => blocker.label === label);
                                        return <span key={label} className={`text-[9px] px-1.5 py-0.5 rounded border flex items-center gap-1 ${met ? 'border-white/5 text-gray-500 bg-black/30' : 'border-red-500/30 text-red-400 bg-red-900/10'}`}><BookOpen size={8} /> {label}</span>;
                                      })}
                                    </div>
                                  )}
                                </div>
                              </button>

                              <a
                                href={getDiaryWikiLink(task.tierId)}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Open Wiki for diary task: ${task.description}`}
                                className="shrink-0 text-gray-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                title="Open Wiki"
                              >
                                <ExternalLink size={10} />
                              </a>

                              {hasRequirementActions && !isTaskDone && (
                                <div className="basis-full flex flex-wrap gap-1.5">
                                  {unmetSkillRequirements.map(([skill, level]) => {
                                    const current = effectiveSkillLevel(unlocks, skill);
                                    return (
                                      <button
                                        key={skill}
                                        onClick={(e) => setSkillPopover({ skill, requiredLevel: level as number, currentLevel: current, anchorRect: e.currentTarget.getBoundingClientRect() })}
                                        className="text-[9px] px-1.5 py-0.5 rounded border flex items-center gap-1 border-red-500/30 text-red-400 bg-red-900/10 hover:bg-red-900/20 hover:border-red-400/40 transition-colors cursor-pointer"
                                        title={`Training guide: ${skill}`}
                                      >
                                        <BookOpen size={8} /> {skill} {level as number} <TrendingUp size={7} className="opacity-60" />
                                      </button>
                                    );
                                  })}
                                  {regionRequirements.map(({ region, chunk }) => {
                                    const isUnlocked = isAreaReachable(region, unlocks, gameModeId);
                                    const cls = isUnlocked ? 'border-white/5 text-gray-500 bg-black/30 hover:bg-white/5' : 'border-red-500/30 text-red-400 bg-red-900/10 hover:bg-red-900/20';
                                    return (
                                      <button
                                        key={region}
                                        onClick={() => { if (chunk) showChunkOnMap(chunk.cx, chunk.cy); }}
                                        disabled={!chunk}
                                        title={chunk ? `Show ${region} on the map` : region}
                                        aria-label={chunk ? `Show ${region} on the map` : `${region} is unavailable on the map`}
                                        className={`text-[9px] px-1.5 py-0.5 rounded border flex items-center gap-1 transition-colors ${cls} ${chunk ? 'cursor-pointer' : 'cursor-default'}`}
                                      >
                                        <MapPin size={8} /> {region}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
```

This row deliberately has no `onClick` itself. Remove the former `onClick={(e) => e.stopPropagation()}` from the Wiki anchor, the former skill-button `e.stopPropagation()`, and the former region-button `e.stopPropagation()`: their controls are siblings rather than descendants of a click target. Keep all existing tier-header handling outside this block unchanged.

- [ ] **Step 6: Run the focused regression test to confirm GREEN**

Run:

```powershell
npm test -- components/DiaryLog.test.tsx
```

Expected: PASS. Both DiaryLog tests pass: the existing Barbarian Fishing access-evidence test and the new scoped SSR structural test. The new test proves that the `ard_easy_2` row is a `div`, the exact labelled completion control is a native button, its inner markup has no anchor/button descendants, and the real Wiki and unmet-Thieving controls are outside that completion subtree.

- [ ] **Step 7: Typecheck the changed JSX and callbacks**

Run:

```powershell
npm run typecheck
```

Expected: exit code 0. In particular, React accepts the native button/link hierarchy, the `React.MouseEvent` completion callback still provides `clientX`/`clientY`, and the requirement tuples preserve `string` skill names with numeric levels.

- [ ] **Step 8: Run the full automated test suite**

Run:

```powershell
npm test
```

Expected: exit code 0 with all existing tests plus the new DiaryLog structural regression passing.

- [ ] **Step 9: Perform the local keyboard and console smoke test**

Run the local app:

```powershell
npm run dev
```

With the browser developer console open, use the Diary Log to expand the Ardougne Easy tier and inspect `Steal a cake from the Ardougne market stalls.`. Tab through its completion button, `Open Wiki` link, unmet-skill training button, and map button. Confirm each focusable control receives focus independently; activating Wiki does not complete the task; activating Training guide opens the matching popover; activating the map button shows the mapped chunk; and no nested-interactive or console errors appear. Trigger a manual-attestation task, cancel its confirmation, and confirm it produces no completion action. Also inspect a completed task/tier: completion is disabled while its available Wiki/help controls remain usable.

- [ ] **Step 10: Inspect the exact change and commit it**

Run:

```powershell
git diff --check
git diff -- components/DiaryLog.tsx components/DiaryLog.test.tsx
git status --short
```

Expected: no whitespace errors; only `components/DiaryLog.tsx` and `components/DiaryLog.test.tsx` are task changes. Leave the pre-existing `utils/taskIdMigrations.ts` modification unstaged.

Commit exactly the two task files:

```powershell
git add components/DiaryLog.tsx components/DiaryLog.test.tsx
git commit -m "fix: use valid diary task interactions"
```

## Self-Review

1. **Spec coverage:** Task 1 replaces the invalid outer task button, labels the native completion button, preserves manual-attestation and coordinate behavior, preserves disabled completion, keeps Wiki security attributes, keeps training/map behavior, removes obsolete propagation handling, retains static requirement evidence, and verifies real SSR structure plus focused/type/full/local smoke checks. It makes no data, eligibility, balance, save, or pool changes.
2. **Placeholder scan:** This plan contains no `TBD`, `TODO`, `implement later`, `fill in details`, or cross-task references. Every code/test step includes the concrete target code and every verification step names its command and expected outcome.
3. **Type consistency:** `skillRequirements` and `unmetSkillRequirements` are `[string, number][]` entries from `Record<string, number>`; they feed `meetsSkillRequirement`, `effectiveSkillLevel`, and `SkillPopoverState` with the existing signatures. The completion handler remains `React.MouseEvent` so its exact `clientX` and `clientY` arguments remain available.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-26-diary-log-interactive-nesting.md`. Two execution options:

1. **Subagent-Driven (recommended)** - Dispatch a fresh subagent for the single TDD task, then review it with a separate fresh subagent.

2. **Inline Execution** - Execute the task in this session using executing-plans, with a verification checkpoint before commit.

Which approach?
