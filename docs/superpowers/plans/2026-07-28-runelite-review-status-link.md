# RuneLite Plugin Hub Status Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe, clickable Plugin Hub review link to the existing RuneLite What's New release so players know the approved plugin update is live.

**Architecture:** Extend the authored changelog note type with one explicit linked-note variant while preserving all existing string notes. Render that variant as plain text plus one safe external anchor in the existing modal, then publish through the mandatory player-facing release gate.

**Tech Stack:** TypeScript, React, Vitest, jsdom, GitHub Actions, GitHub Pages.

## Global Constraints

- The notice says the RuneLite Plugin Hub update has been approved and is now live.
- Only `Plugin Hub PR #14395` is linked.
- The destination is `https://github.com/runelite/plugin-hub/pull/14395`.
- The link opens in a new tab with `rel=noopener noreferrer`.
- Existing plain-string changelog notes retain their current rendering.
- No Markdown or HTML parsing is introduced.
- The status must be rechecked immediately before publishing so stale review wording is never deployed.
- No production dependency is added.

---

## File map

- `data/changelog.ts`: linked-note type and authored approved-and-live notice.
- `data/changelog.test.ts`: exact copy and destination contract.
- `components/ChangelogModal.tsx`: string-or-link note rendering.
- `components/ChangelogModal.dom.test.tsx`: accessible link, new-tab, safety, punctuation, and string-note coverage.

### Task 1: Author the Plugin Hub status note

**Files:**
- Modify: `data/changelog.test.ts`
- Modify: `data/changelog.ts`

**Interfaces:**
- Produces: `ChangelogNote`, a union of `string` and `LinkedChangelogNote`.
- Produces: `LinkedChangelogNote` with `text` and `link` fields.
- Preserves: `ChangelogRelease.sections` as the single authored source of player-facing release notes.

- [ ] **Step 1: Write the failing authored-data test**

Add this assertion to the RuneLite release test:

```ts
expect(LATEST_CHANGELOG.sections.changed).toContainEqual({
  text: 'The RuneLite Plugin Hub update has been approved and is now live. View the merged',
  link: {
    label: 'Plugin Hub PR #14395',
    href: 'https://github.com/runelite/plugin-hub/pull/14395',
  },
});
```

- [ ] **Step 2: Run the focused test and verify the red state**

Run:

```powershell
npx vitest run data/changelog.test.ts
```

Expected: failure because the linked status note is absent.

- [ ] **Step 3: Add the linked-note type and authored entry**

Define:

```ts
export interface LinkedChangelogNote {
  text: string;
  link: {
    label: string;
    href: string;
  };
}

export type ChangelogNote = string | LinkedChangelogNote;
```

Change the `sections` value type to `readonly ChangelogNote[]`, then prepend
the exact tested object to the 28 July release's `changed` notes.

- [ ] **Step 4: Run the focused test and verify the green state**

Run:

```powershell
npx vitest run data/changelog.test.ts
```

Expected: all authored changelog tests pass.

- [ ] **Step 5: Commit the authored status**

```powershell
git add -- data/changelog.ts data/changelog.test.ts
git commit -m "feat: add RuneLite review status link"
```

### Task 2: Render safe linked changelog notes

**Files:**
- Modify: `components/ChangelogModal.dom.test.tsx`
- Modify: `components/ChangelogModal.tsx`

**Interfaces:**
- Consumes: `ChangelogNote` values from `ChangelogRelease.sections`.
- Produces: unchanged text for string notes and one external anchor for `LinkedChangelogNote` values.

- [ ] **Step 1: Add a linked note to the modal test fixture**

Keep the existing `added: ['Added note']` string fixture and add:

```ts
changed: [
  {
    text: 'The RuneLite Plugin Hub update has been approved and is now live. View the merged',
    link: {
      label: 'Plugin Hub PR #14395',
      href: 'https://github.com/runelite/plugin-hub/pull/14395',
    },
  },
],
```

- [ ] **Step 2: Write the failing DOM rendering test**

Mount `ChangelogModal` with the fixture and assert:

```ts
const link = host.querySelector<HTMLAnchorElement>(
  'a[href="https://github.com/runelite/plugin-hub/pull/14395"]',
);
expect(link).not.toBeNull();
expect(link?.textContent).toBe('Plugin Hub PR #14395');
expect(link?.target).toBe('_blank');
expect(link?.rel.split(/\s+/).sort()).toEqual(['noopener', 'noreferrer']);
expect(link?.closest('li')?.textContent).toBe(
  'The RuneLite Plugin Hub update has been approved and is now live. View the merged Plugin Hub PR #14395.',
);
expect(host.textContent).toContain('Added note');
```

- [ ] **Step 3: Run the DOM test and verify the red state**

Run:

```powershell
npx vitest run components/ChangelogModal.dom.test.tsx
```

Expected: failure because React cannot render the structured note as a child.

- [ ] **Step 4: Implement string-or-link rendering**

Replace the one-line note mapping with:

```tsx
{notes.map((note) => {
  const noteKey = typeof note === 'string'
    ? note
    : `${note.text}:${note.link.href}`;

  return (
    <li key={noteKey}>
      {typeof note === 'string' ? note : (
        <>
          {note.text}{' '}
          <a
            href={note.link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-300 underline decoration-amber-500/50 underline-offset-2 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80"
          >
            {note.link.label}
          </a>
          .
        </>
      )}
    </li>
  );
})}
```

- [ ] **Step 5: Run both focused suites and verify the green state**

Run:

```powershell
npx vitest run data/changelog.test.ts components/ChangelogModal.dom.test.tsx
```

Expected: authored data and modal DOM tests pass.

- [ ] **Step 6: Commit the renderer**

```powershell
git add -- components/ChangelogModal.tsx components/ChangelogModal.dom.test.tsx
git commit -m "feat: render safe changelog links"
```

### Task 3: Verify, publish, and deploy the status notice

**Files:**
- Verify: all branch changes
- Publish: GitHub pull request targeting `main`

**Interfaces:**
- Consumes: the authored note and linked-note renderer commits.
- Produces: merged production commit and updated GitHub Pages companion.

- [ ] **Step 1: Run the complete release gate**

Run:

```powershell
npm run release:verify
git diff --check origin/main...HEAD
git status --short --branch
```

Expected: the mandatory changelog gate, all tests, TypeScript, deterministic
content verification, production build, and whitespace checks pass with a
clean worktree.

- [ ] **Step 2: Review scope and secrets**

Run:

```powershell
git diff --stat origin/main...HEAD
git diff --name-status origin/main...HEAD
git log --oneline origin/main..HEAD
```

Expected: only the specification, plan, changelog data/tests, and modal
renderer/tests appear; no credentials, save data, generated content, or
unrelated main-worktree files appear.

- [ ] **Step 3: Push and open a ready pull request**

Push `fix/runelite-review-status-link` and open a pull request titled:

```text
Show RuneLite Plugin Hub live status
```

The body states that the approved plugin update is live, links the merged review,
describes safe new-tab rendering, and lists the exact verification results.

- [ ] **Step 4: Wait for hosted CI and merge**

Wait for `CI / quality` to succeed on the exact head commit. Merge only when
the pull request is clean and mergeable.

- [ ] **Step 5: Confirm GitHub Pages deployment**

Wait for the merge-triggered `Deploy to GitHub Pages` workflow. Confirm HTTP
200 for:

```text
https://nubles.github.io/OSRS-Fate-Locked/
https://nubles.github.io/OSRS-Fate-Locked/version.json
```

Verify `version.json` contains the merge commit and the deployed JavaScript
contains the approved-and-live text, PR label, and official PR URL.

- [ ] **Step 6: Refresh the local preview**

Rebuild and restart the hidden local preview at
`http://127.0.0.1:4173/`. Confirm HTTP 200 and tell the user to refresh their
existing tab to inspect the notice.
