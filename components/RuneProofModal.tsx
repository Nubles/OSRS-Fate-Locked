import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ShieldCheck, X } from 'lucide-react';
import goalIndexJson from '../data/runeproof-goal-index.json';
import { chunkContentService } from '../services/ChunkContentService';
import { RuneProofService } from '../services/RuneProofService';
import { loadRuneProofSourceAudit } from '../data/runeProofSourceAudit';
import { createRuneProofExecutor } from '../utils/runeproof/engine';
import {
  compileItemGoal, compileProductionActivityGoals, compileProductionDiaryGoals,
  compileProductionQuestGoals, type CompiledGoal,
} from '../utils/runeproof/goalCompiler';
import { factId, type AcquisitionRule, type RequirementExpr, type RuneProofReport } from '../utils/runeproof/model';
import type { RuneProofSourceDocument } from '../utils/runeproof/acquisitionIndex';
import type { RuneProofRunSnapshot } from '../types';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { ProofStatusCard } from './runeproof/ProofStatusCard';
import { ProofRouteList } from './runeproof/ProofRouteList';
import { BlockerList } from './runeproof/BlockerList';

type EvaluationService = Pick<RuneProofService, 'evaluate'>;
type OwnedProofService = EvaluationService & Pick<RuneProofService, 'dispose'>;
type Phase = 'idle' | 'initializing' | 'loading' | 'stale' | 'error';

export interface RuneProofModalProps {
  onClose: () => void;
  snapshot?: RuneProofRunSnapshot;
  /** The caller retains ownership of an injected service. */
  service?: EvaluationService;
  goals?: readonly CompiledGoal[];
  rules?: readonly AcquisitionRule[];
  /** Services created here are owned by the modal and disposed on cleanup. */
  createService?: (current: () => RuneProofRunSnapshot) => Promise<OwnedProofService>;
}

const goalIndex = goalIndexJson as unknown as {
  schemaVersion: 1;
  sourceVersion: string;
  rules: AcquisitionRule[];
};

const itemGoals = (): CompiledGoal[] => {
  const labels = [...new Set(goalIndex.rules.map(rule => rule.output.label))].sort();
  return labels.map(label => compileItemGoal({ id: factId('ITEM', label), label }, 1));
};

const productionGoals = (): CompiledGoal[] => [
  ...itemGoals(), ...compileProductionQuestGoals(), ...compileProductionDiaryGoals(), ...compileProductionActivityGoals(),
].filter(goal => goal.coverage === 'VERIFIED' || hasKnownRequirement(goal.requirement));

const defaultRules = goalIndex.rules;
export function createFailClosedRuneProofAcquisition(
  sourceVersion: string,
): RuneProofSourceDocument {
  const emptyFamily = () => ({
    ruleCount: 0,
    unresolvedCount: 0,
    ruleIds: [],
    unresolvedIds: [],
    coverage: 'UNKNOWN' as const,
  });
  return {
    schemaVersion: 1,
    sourceVersion,
    counts: { rules: 0, unresolvedSources: 0 },
    acquisitionCoverage: 'UNKNOWN',
    sourceFamilyCoverage: {
      DROP: 'UNKNOWN',
      PRODUCTION: 'UNKNOWN',
      RESOURCE_ENGINE: 'UNKNOWN',
      SHOP: 'UNKNOWN',
      SPAWN: 'UNKNOWN',
    },
    sourceFamilyAccounting: {
      DROP: emptyFamily(),
      PRODUCTION: emptyFamily(),
      RESOURCE_ENGINE: emptyFamily(),
      SHOP: emptyFamily(),
      SPAWN: emptyFamily(),
    },
    provenanceCatalog: [],
    rules: [],
    unresolvedSources: [],
  };
}
async function createDefaultService(current: () => RuneProofRunSnapshot): Promise<OwnedProofService> {
  const loaded = await chunkContentService.init();
  if (!loaded) throw new Error(chunkContentService.error || 'Current world data could not be loaded.');
  const audit = await loadRuneProofSourceAudit();
  const acquisition = createFailClosedRuneProofAcquisition(goalIndex.sourceVersion);
  return new RuneProofService(createRuneProofExecutor({
    sourceVersion: acquisition.sourceVersion,
    sourceAudit: audit,
    acquisition,
    locationGraph: {
      startNodeId: 'surface:50,50',
      nodes: chunkContentService.locationNodes(),
      edges: chunkContentService.locationEdges(),
    },
  }, {
    acquisitionUrl: `${import.meta.env.BASE_URL}runeproof-sources.json?v=${encodeURIComponent(goalIndex.sourceVersion)}`,
  }), current);
}

function hasKnownRequirement(requirement: RequirementExpr): boolean {
  return requirement.op === 'FACT' || requirement.terms.some(hasKnownRequirement);
}

function coverageLabel(goal: CompiledGoal): string {
  if (goal.kind === 'ITEM') return 'Current-chunk routes';
  if (goal.coverage === 'VERIFIED') return 'Proof-ready';
  return hasKnownRequirement(goal.requirement)
    ? 'Known-requirement guidance'
    : 'Not yet modeled';
}

function kindLabel(goal: CompiledGoal): string { return goal.kind[0] + goal.kind.slice(1).toLowerCase(); }

export const RuneProofModal: React.FC<RuneProofModalProps> = ({
  onClose, snapshot, service: injectedService, goals: suppliedGoals, rules = defaultRules, createService = createDefaultService,
}) => {
  const latestSnapshot = useRef<RuneProofRunSnapshot | undefined>(snapshot);
  latestSnapshot.current = snapshot;
  const [service, setService] = useState<EvaluationService | null>(injectedService ?? null);
  const [phase, setPhase] = useState<Phase>(injectedService ? 'idle' : 'initializing');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<CompiledGoal | null>(null);
  const [report, setReport] = useState<RuneProofReport | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const goalList = useMemo(() => [...(suppliedGoals ?? productionGoals())]
    .sort((left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id)), [suppliedGoals]);
  const rulesById = useMemo(() => new Map(rules.map(rule => [rule.id, rule])), [rules]);

  useEscapeKey(onClose, true);
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    if (injectedService) {
      setService(injectedService);
      setPhase('idle');
      return;
    }
    if (!snapshot) return;
    let active = true;
    let owned: OwnedProofService | null = null;
    setPhase('initializing');
    createService(() => latestSnapshot.current!)
      .then(value => {
        owned = value;
        if (active) {
          setService(value);
          setPhase('idle');
        } else {
          value.dispose();
        }
      })
      .catch(error => {
        if (active) {
          setPhase('error');
          console.error('RuneProof initialization failed', error);
        }
      });
    return () => {
      active = false;
      owned?.dispose();
    };
  }, [createService, injectedService, snapshot?.runId]);
  useEffect(() => {
    if (!service || !selected || !snapshot) return;
    let active = true;
    setPhase('loading');
    setReport(null);
    service.evaluate({ goal: selected, includeAlternatives: true, includeBlockers: true })
      .then(result => {
        if (!active) return;
        if (result === null) {
          setPhase('stale');
          return;
        }
        setReport(result);
        setPhase('idle');
      })
      .catch(error => {
        if (active) {
          setPhase('error');
          console.error('RuneProof evaluation failed', error);
        }
      });
    return () => { active = false; };
  }, [service, selected, snapshot?.runId, snapshot?.runRevision]);

  const filtered = goalList.filter(goal => {
    const text = `${goal.label} ${goal.kind} ${goal.id}`.toLowerCase();
    return text.includes(query.trim().toLowerCase());
  }).slice(0, 50);
  const proof = report?.routes[0]?.witness;

  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-4" onMouseDown={onClose} role="presentation">
    <section role="dialog" aria-modal="true" aria-label="RuneProof" onMouseDown={event => event.stopPropagation()} className="flex h-[min(88vh,760px)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-cyan-500/30 bg-[#161616] shadow-2xl">
      <header className="flex items-start justify-between gap-3 border-b border-white/10 bg-[#1b1b1b] p-4">
        <div><h1 className="text-lg font-bold text-cyan-200">RuneProof</h1><p className="mt-1 text-xs text-gray-400">Checks what is possible in this run only.</p></div>
        <button type="button" onClick={onClose} aria-label="Close RuneProof" className="rounded p-1 text-gray-400 hover:bg-white/10 hover:text-white"><X size={18} /></button>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(230px,0.8fr)_minmax(0,1.2fr)]">
        <aside aria-label="Goal search" className="flex min-h-0 flex-col border-b border-white/10 md:border-b-0 md:border-r">
          <label className="relative m-3 block"><span className="sr-only">Search goals</span><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={15} /><input ref={inputRef} role="searchbox" aria-label="Search goals" value={query} onChange={event => setQuery(event.target.value)} placeholder={'Search items, quests, diaries\u2026'} className="w-full rounded bg-black/30 py-2 pl-9 pr-3 text-sm text-white outline-none ring-cyan-400 focus:ring-1" /></label>
          <div className="min-h-0 overflow-y-auto px-2 pb-3" aria-label="Goal results">{filtered.map(goal => <button key={goal.id} type="button" onClick={() => setSelected(goal)} className={`mb-1 w-full rounded p-2 text-left text-xs ${selected?.id === goal.id ? 'bg-cyan-950/60 ring-1 ring-cyan-500/50' : 'hover:bg-white/5'}`}><span className="block font-semibold text-gray-100">{goal.label}</span><span className="text-gray-500">{kindLabel(goal)} {'\u00b7'} {coverageLabel(goal)}</span></button>)}</div>
        </aside>
        <main aria-label="Proof result" className="min-h-0 overflow-y-auto p-4" aria-live="polite">
          {!selected && <p className="text-sm text-gray-400">Choose a goal to check current routes. RuneProof only evaluates the current run.</p>}
          {phase === 'initializing' && <p className="text-sm text-gray-400">Preparing current-run evidence{'\u2026'}</p>}
          {phase === 'loading' && <p className="text-sm text-cyan-200">Checking current routes{'\u2026'}</p>}
          {phase === 'stale' && <p className="text-sm text-amber-200">This run changed while checking. The older result was removed.</p>}
          {phase === 'error' && <p className="text-sm text-rose-200">RuneProof could not check this goal. Try again after current world data is available.</p>}
          {report && <div className="space-y-4"><ProofStatusCard report={report} /><ProofRouteList report={report} rules={rulesById} /><BlockerList report={report} />
            {report.status === 'IMPOSSIBLE' && <p className="text-xs text-gray-400">Unlocked chunks that are stranded are not currently reachable, so they cannot supply a route.</p>}
            {proof && report.routesComplete && <div className="rounded border border-emerald-500/25 bg-emerald-950/20 p-2 text-xs text-emerald-100"><ShieldCheck size={14} className="mr-1 inline" />Proof checked for this run.
              <details className="mt-2 text-gray-400"><summary className="cursor-pointer text-gray-200">Verification details</summary><div className="mt-1">Current run revision: {proof.runRevision}<br />Source version: {proof.sourceVersion}<br />Proof record: {proof.proofHash}</div></details>
            </div>}</div>}
        </main>
      </div>
    </section>
  </div>;
};
