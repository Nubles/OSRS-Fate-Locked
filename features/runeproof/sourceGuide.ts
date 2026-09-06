/** Readable source instructions are separate from reviewed, executable routes. */
export interface SourceGuide {
  questId: string;
  revision: string;
  sections: { id: string; title: string; steps: { id: string; text: string[]; dialogue: string[]; sourcePath: string; role?: 'main' | 'related'; parentId?: string; externalDependency?: boolean; note?: string }[] }[];
  diagnostics: string[];
  sources?: { label: string; path: string; revision: string }[];
}

export function parseSourceGuide(value: unknown, questId: string): SourceGuide | null {
  if (!value || typeof value !== 'object') return null;
  const guide = value as SourceGuide;
  const strings = (input: unknown): input is string[] => Array.isArray(input) && input.every(v => typeof v === 'string');
  if (guide.questId !== questId || typeof guide.revision !== 'string' || !guide.revision
    || !strings(guide.diagnostics) || !Array.isArray(guide.sections) || !guide.sections.length) return null;
  const ids = new Set<string>();
  for (const section of guide.sections) {
    if (!section || typeof section.id !== 'string' || ids.has(section.id) || typeof section.title !== 'string'
      || !section.title.trim() || !Array.isArray(section.steps) || !section.steps.length) return null;
    ids.add(section.id);
    const steps = new Set<string>();
    for (const step of section.steps) {
      if (!step || typeof step.id !== 'string' || !step.id || steps.has(step.id) || !strings(step.text)
        || !step.text.some(text => text.trim()) || !strings(step.dialogue) || typeof step.sourcePath !== 'string'
        || (step.role !== undefined && step.role !== 'main' && step.role !== 'related')
        || (step.parentId !== undefined && typeof step.parentId !== 'string')
        || (step.externalDependency !== undefined && typeof step.externalDependency !== 'boolean')
        || (step.note !== undefined && typeof step.note !== 'string')) return null;
      steps.add(step.id);
    }
  }
  return guide;
}
