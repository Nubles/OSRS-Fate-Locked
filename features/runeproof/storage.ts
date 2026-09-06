import type { GuidePack, GuideProgress } from './model';
import { freshProgress } from './engine';

export interface GuideSave { schema: 1; runId: string; questId: string; packVersion: number; revision: number; progress: GuideProgress }
export interface GuideLoad { save: GuideSave; token: string | null; warning?: string; blocked?: boolean }
export type GuideStorage = Pick<Storage, 'getItem' | 'setItem'>;
// Match the decoder's existing serialized-string limit before touching storage.
const MAX_GUIDE_SAVE_LENGTH = 500000;
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export const guideKey = (runId: string, questId: string) => `FATE_RUNEPROOF_2:${encodeURIComponent(runId)}:${encodeURIComponent(questId)}`;
export function validProgress(value: unknown, pack: GuidePack): value is GuideProgress {
  if (!record(value) || value.version !== pack.version || !Array.isArray(value.completed) || !Array.isArray(value.history)
    || !record(value.inventory) || !record(value.answers)) return false;
  const ids = new Set(pack.steps.map(step => step.id));
  const validInventory = (inventory: unknown) => record(inventory) && Object.entries(inventory).every(([id, quantity]) =>
    pack.items.some(item => item.id === id) && typeof quantity === 'number' && Number.isSafeInteger(quantity) && quantity >= 0 && quantity <= 1000000);
  if (!validInventory(value.inventory) || value.completed.length > pack.steps.length || new Set(value.completed).size !== value.completed.length
    || !value.completed.every(id => typeof id === 'string' && ids.has(id)) || value.history.length !== value.completed.length) return false;
  if (!Object.entries(value.answers).every(([id, answer]) => pack.questions.some(question => question.id === id && question.options.some(option => option.id === answer)))) return false;
  if (!value.history.every((entry, index) => record(entry) && entry.stepId === (value.completed as string[])[index] && validInventory(entry.inventory))) return false;
  const completed = new Set<string>();
  const answers = value.answers as Record<string, string>;
  for (const id of value.completed as string[]) {
    const step = pack.steps.find(candidate => candidate.id === id)!;
    const before = (value.history[completed.size] as {inventory: Record<string, number>}).inventory;
    if (step.requires.some(requirement => requirement.kind === 'item' && (before[requirement.id] ?? 0) < requirement.quantity)) return false;
    if (Object.entries(step.consume ?? {}).some(([item, quantity]) => (before[item] ?? 0) < quantity)) return false;
    if (Object.entries(step.produce ?? {}).some(([item, quantity]) => (before[item] ?? 0) - (step.consume?.[item] ?? 0) + quantity > 1000000)) return false;
    if (step.branch && answers[step.branch.question] !== step.branch.answer) return false;
    if (step.requires.some(requirement => requirement.kind === 'answer' && answers[requirement.id] !== requirement.value)) return false;
    if (!step.after.every(dependency => {
      if (completed.has(dependency)) return true;
      const branch = pack.steps.find(candidate => candidate.id === dependency)?.branch;
      return !!branch && !!answers[branch.question] && answers[branch.question] !== branch.answer;
    })) return false;
    completed.add(id);
  }
  return true;
}
export function decodeGuide(raw: string, pack: GuidePack, runId: string): GuideSave | null {
  try {
    if (raw.length > MAX_GUIDE_SAVE_LENGTH) return null;
    const value: unknown = JSON.parse(raw);
    if (!record(value) || value.schema !== 1 || value.runId !== runId || value.questId !== pack.id || value.packVersion !== pack.version
      || !Number.isSafeInteger(value.revision) || Number(value.revision) < 0 || !own(value, 'progress') || !validProgress(value.progress, pack)) return null;
    return value as unknown as GuideSave;
  } catch { return null; }
}
export function readGuide(storage: GuideStorage, runId: string, pack: GuidePack): GuideLoad {
  const empty: GuideSave = {schema: 1, runId, questId: pack.id, packVersion: pack.version, revision: 0, progress: freshProgress(pack)};
  try {
    const token = storage.getItem(guideKey(runId, pack.id));
    if (token === null) return { save: empty, token };
    const parsed = decodeGuide(token, pack, runId);
    if (parsed) return { save: parsed, token };
    const backup = storage.getItem(`${guideKey(runId, pack.id)}:backup`);
    const restored = backup && decodeGuide(backup, pack, runId);
    if (restored) return {save: restored, token, warning: 'Recovered your guide from its previous save.'};
    return {save: empty, token, blocked: true, warning: 'This guide save could not be read. Export the saved data before starting a new guide.'};
  } catch { return {save: empty, token: null, blocked: true, warning: 'Guide storage is unavailable. Your account progress is unaffected.'}; }
}
export function writeGuide(storage: GuideStorage, previous: GuideLoad, progress: GuideProgress, pack: GuidePack): GuideLoad {
  if (!Number.isSafeInteger(previous.save.revision + 1)) throw new Error('Guide save revision is too large. Export your progress before starting a new guide.');
  if (previous.save.questId !== pack.id || previous.save.packVersion !== pack.version) throw new Error('This save belongs to a different guide.');
  if (previous.blocked) throw new Error('This guide save needs recovery before changes can be saved.');
  if (!validProgress(progress, pack)) throw new Error('This guide change could not be saved.');
  const key = guideKey(previous.save.runId, pack.id);
  if (storage.getItem(key) !== previous.token) throw new Error('This guide changed in another tab. Reopen RuneProof to load its latest progress.');
  const save = {...previous.save, revision: previous.save.revision + 1, progress};
  const token = JSON.stringify(save);
  if (token.length > MAX_GUIDE_SAVE_LENGTH) throw new Error('This guide save is too large. Your previous progress is unchanged; export it before continuing.');
  if (previous.token !== null && decodeGuide(previous.token, pack, previous.save.runId)) storage.setItem(`${key}:backup`, previous.token);
  storage.setItem(key, token);
  if (storage.getItem(key) !== token) throw new Error('Guide save verification failed. Reopen RuneProof before continuing.');
  return {save, token};
}
