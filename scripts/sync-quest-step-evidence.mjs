import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';
import { readPinnedChunkSource } from './chunk-source.mjs';
import { readQuestHelperSource, sha256, stableJson } from './quest-helper-source.mjs';
import { extractQuestHelperFile } from './quest-helper-evidence.mjs';
import { buildChunkQuestEvidence, worldPointToChunk, resolveRegionAccess } from './quest-chunk-evidence.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
export const EVIDENCE_PATHS = {
  catalogue: join(root, 'data/sources/quest-step-evidence.json.gz'),
  summary: join(root, 'data/sources/quest-step-evidence-summary.json'),
  report: join(root, 'docs/reviews/2026-09-23-quest-source-harvest.md'),
  notices: join(root, 'docs/third-party/quest-helper-NOTICES.txt'),
  runtime: join(root, 'public/chunk-content.json'),
};
const normalise = value => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

export function buildQuestStepEvidence({ chunkSource, questHelper, runtime, runtimeSha256 }) {
  const chunkPicker = buildChunkQuestEvidence(chunkSource.data, runtime);
  const enumFile = questHelper.data.files.find(file => file.path.endsWith('/questinfo/QuestHelperQuest.java'));
  if (!enumFile) throw new Error('Quest Helper catalogue source missing');
  const entries = [...enumFile.content.matchAll(/^\s*([A-Z][A-Z_0-9]*)\(new\s+(\w+)\(/gm)]
    .map(match => ({ entryId: match[1], className: match[2] }));
  const helperFiles = questHelper.data.files.filter(file => /\/helpers\/(quests|miniquests)\//.test(file.path));
  const helpers = helperFiles.map(file => {
    const extracted = extractQuestHelperFile({ path: file.path, content: file.content });
    const entryIds = entries.filter(entry => entry.className === extracted.className).map(entry => entry.entryId);
    const questMatches = chunkPicker.quests.filter(quest => entryIds.some(id => normalise(id) === normalise(quest.questId)))
      .map(quest => quest.questId);
    const steps = extracted.steps.map(step => {
      const physicalChunk = step.worldPoint ? worldPointToChunk(step.worldPoint) : null;
      return {
        ...step,
        physicalChunk,
        accessCandidates: physicalChunk ? resolveRegionAccess(physicalChunk.regionId, runtime) : [],
        travelCoverage: 'NOT_EVALUATED',
      };
    });
    return {
      ...extracted,
      entryIds,
      questMatches,
      identityStatus: questMatches.length === 1 ? 'NAME_MATCH_CANDIDATE' : questMatches.length ? 'AMBIGUOUS' : 'UNMATCHED',
      steps,
    };
  }).sort((a, b) => compare(a.sourcePath, b.sourcePath));
  const matched = new Set(helpers.flatMap(helper => helper.questMatches));
  const counts = {
    chunkPickerQuests: chunkPicker.quests.length,
    chunkPickerTasks: chunkPicker.quests.reduce((sum, quest) => sum + quest.tasks.length, 0),
    questHelperSourceFiles: helperFiles.length,
    questHelperCatalogueEntries: helpers.reduce((sum, helper) => sum + helper.entryIds.length, 0),
    stepDefinitions: helpers.reduce((sum, helper) => sum + helper.steps.length, 0),
    literalStepCoordinates: helpers.reduce((sum, helper) => sum + helper.steps.filter(step => step.physicalChunk).length, 0),
    conditionalGroups: helpers.reduce((sum, helper) => sum + helper.conditionalSteps.length, 0),
    conditionBranches: helpers.reduce((sum, helper) => sum + helper.conditionalSteps.reduce((n, group) => n + group.branches.length, 0), 0),
    itemRequirements: helpers.reduce((sum, helper) => sum + helper.itemRequirements.length, 0),
    equippedItemRequirements: helpers.reduce((sum, helper) => sum + helper.itemRequirements.filter(item => item.mustBeEquipped === true).length, 0),
    nameMatchedQuestGroups: matched.size,
    sourceIssues: helpers.reduce((sum, helper) => sum + helper.issues.length, 0),
    automaticallyApprovedGuides: 0,
  };
  const sources = {
    chunkPicker: { repository: chunkSource.manifest.repository, commit: chunkSource.manifest.commit, sha256: chunkSource.manifest.rawSha256 },
    questHelper: { repository: questHelper.manifest.repository, commit: questHelper.manifest.commit, sha256: questHelper.manifest.rawSha256, licence: questHelper.manifest.licence },
    chunkRuntime: { version: runtime.version, sha256: runtimeSha256 },
  };
  const catalogue = {
    schemaVersion: 1,
    kind: 'FATE_QUEST_STEP_CANDIDATE_EVIDENCE',
    status: 'CANDIDATE_ONLY',
    sources,
    counts,
    limitations: [
      'Java expressions and client-state conditions are retained as evidence, not executed.',
      'Name matches link candidate records only; they do not approve quest identity or coverage.',
      'Destination and entrance candidates do not establish legal travel between steps.',
      'Multiple location candidates are alternatives or ambiguities, never an inferred all-chunks requirement.',
      'Unresolved records remain in the catalogue. No runtime guide or release list is generated.',
    ],
    chunkPicker,
    questHelper: helpers,
  };
  const summary = {
    schemaVersion: 1,
    status: catalogue.status,
    sources,
    counts,
    chunkPickerCounts: chunkPicker.counts,
    unmatchedQuestGroups: chunkPicker.quests.filter(quest => !matched.has(quest.questId)).map(quest => quest.questId),
    helpers: helpers.map(helper => ({
      sourcePath: helper.sourcePath,
      className: helper.className,
      entryIds: helper.entryIds,
      questMatches: helper.questMatches,
      steps: helper.steps.length,
      literalCoordinates: helper.steps.filter(step => step.physicalChunk).length,
      branches: helper.conditionalSteps.reduce((sum, group) => sum + group.branches.length, 0),
      issues: helper.issues.length,
      coverage: helper.coverage,
    })),
  };
  const notices = [...new Set(helpers.flatMap(helper => helper.notices))].sort(compare);
  return {
    catalogue,
    summary,
    notices: `Quest Helper source evidence\nSource: https://github.com/${questHelper.manifest.repository}/tree/${questHelper.manifest.commit}\n\nThe unmodified per-file notices below accompany imported evidence. The complete source snapshot also preserves each original header.\n\n${questHelper.data.licenceText}\n\n${notices.join('\n\n')}\n`,
  };
}

export function renderEvidenceReport(summary) {
  const count = summary.counts;
  const rows = summary.helpers.filter(helper => helper.entryIds.length)
    .map(helper => `| ${helper.entryIds.join(', ')} | ${helper.steps} | ${helper.literalCoordinates} | ${helper.branches} | ${helper.issues} | ${helper.questMatches.join(', ') || 'Needs identity review'} |`);
  return `# Quest source harvest\n\nGenerated from immutable source snapshots; candidate evidence only.\n\n` +
    `- Chunk Picker: ${count.chunkPickerTasks} tasks in ${count.chunkPickerQuests} quest-related groups.\n` +
    `- Quest Helper: ${count.questHelperSourceFiles} quest/miniquest Java source files, ${count.questHelperCatalogueEntries} catalogue entries.\n` +
    `- Extracted ${count.stepDefinitions} step definitions, including ${count.literalStepCoordinates} literal target coordinates.\n` +
    `- Retained ${count.conditionBranches} ordered branches in ${count.conditionalGroups} conditional groups.\n` +
    `- Found ${count.equippedItemRequirements} explicitly equipped item requirements.\n` +
    `- ${count.nameMatchedQuestGroups} Chunk Picker quest groups have candidate name matches. No guide is automatically approved.\n\n` +
    `## Source pins\n\n` +
    `- [Quest Helper ${summary.sources.questHelper.commit}](https://github.com/Zoinkwiz/quest-helper/tree/${summary.sources.questHelper.commit}) — BSD 2-Clause; licence and per-file notices retained under docs/third-party.\n` +
    `- [Chunk Picker ${summary.sources.chunkPicker.commit}](https://github.com/source-chunk/chunk-picker-v2/tree/${summary.sources.chunkPicker.commit}).\n\n` +
    `## Review boundary\n\nThe extract is not a playable walkthrough. It retains raw expressions, conditional priority, unresolved locations and source identifiers for review. Source statements can also disagree: the pinned Restless Ghost recovery tooltip places Urhney in the south-east, while the helper's action, coordinates and reviewed Wiki place him west. That tooltip must not become player guidance automatically.\n\n` +
    `The Restless Ghost pilot review is in data/sources/quest-step-evidence-review.json. It checks chunk destinations and the worn amulet against the existing public guide; it does not approve every helper condition or publish additional quests. Travel between targets still requires separate verification.\n\n` +
    `## Catalogue coverage\n\nNumbers count extracted source definitions, not unique player actions or certified complete quests. Supporting helper files may contain additional definitions outside these catalogue-entry rows.\n\n` +
    `| Helper entry | Step definitions | Literal targets | Branches | Review issues | Candidate Chunk Picker match |\n|---|---:|---:|---:|---:|---|\n${rows.join('\n')}\n\n` +
    `## Unmatched Chunk Picker groups\n\n${summary.unmatchedQuestGroups.map(quest => `- ${quest}`).join('\n')}\n`;
}

export async function runQuestEvidenceSync({ mode = 'check', paths = EVIDENCE_PATHS } = {}) {
  if (!['check', 'generate'].includes(mode)) throw new Error('Use --check or --generate');
  const [chunkSource, questHelper, runtimeRaw] = await Promise.all([
    readPinnedChunkSource(), readQuestHelperSource(), readFile(paths.runtime),
  ]);
  const result = buildQuestStepEvidence({ chunkSource, questHelper, runtime: JSON.parse(runtimeRaw.toString('utf8')), runtimeSha256: sha256(runtimeRaw) });
  const catalogueRaw = Buffer.from(stableJson(result.catalogue));
  const summary = { ...result.summary, catalogueSha256: sha256(catalogueRaw), catalogueBytes: catalogueRaw.length };
  const files = [[paths.summary, stableJson(summary)], [paths.report, renderEvidenceReport(summary)], [paths.notices, result.notices]];
  if (mode === 'generate') {
    await mkdir(join(root, 'docs/reviews'), { recursive: true });
    await mkdir(join(root, 'docs/third-party'), { recursive: true });
    await writeFile(paths.catalogue, gzipSync(catalogueRaw, { level: 9, mtime: 0 }));
    for (const [path, content] of files) await writeFile(path, content);
  } else {
    if (!gunzipSync(await readFile(paths.catalogue)).equals(catalogueRaw)) throw new Error('Candidate catalogue differs from offline extraction; regenerate and review changes');
    for (const [path, content] of files) {
      if ((await readFile(path, 'utf8')).replaceAll('\r\n', '\n') !== content.replaceAll('\r\n', '\n')) throw new Error(`Generated evidence differs: ${path}`);
    }
  }
  console.log(`Quest evidence ${mode === 'check' ? 'verified' : 'generated'}: ${summary.counts.chunkPickerTasks} Chunk Picker tasks; ${summary.counts.stepDefinitions} Quest Helper step definitions; 0 automatically approved guides.`);
  return summary;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  if (argv.length !== 1 || !['--check', '--generate'].includes(argv[0])) throw new Error('Use --check or --generate');
  await runQuestEvidenceSync({ mode: argv[0].slice(2) });
}
