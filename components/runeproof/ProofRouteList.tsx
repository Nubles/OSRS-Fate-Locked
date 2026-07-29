import React, { useState } from 'react';
import type { AcquisitionRule, ProofRoute, RequirementExpr, RuneProofReport } from '../../utils/runeproof/model';

function requirementLabels(requirement: RequirementExpr): string[] {
  if (requirement.op === 'FACT') return [requirement.fact.label];
  return requirement.terms.flatMap(requirementLabels);
}

function RouteSteps({ route, rules }: { route: ProofRoute; rules: ReadonlyMap<string, AcquisitionRule> }) {
  return <ol className="list-decimal space-y-2 pl-5 text-xs text-gray-200">
    {Object.values(route.witness.steps).map((step, index) => {
      const rule = rules.get(step.ruleId);
      const requirements = rule ? requirementLabels(rule.requirements) : [];
      return <li key={`${step.ruleId}-${index}`} className="rounded border border-white/10 bg-black/20 p-2">
        <p className="font-medium text-gray-100">{rule?.sourceLabel ?? step.ruleId}</p>
        {rule && <p className="mt-1 text-gray-400">Exact chunk / section: {rule.locationId}</p>}
        {requirements.length > 0 && <p className="mt-1 text-gray-400">Requires: {requirements.join(', ')}</p>}
        {step.proves.quantity && step.proves.quantity > 1 && <p className="mt-1 text-gray-400">Quantity: {step.proves.quantity}× {step.proves.label}</p>}
        {rule?.probability !== null && rule?.probability !== undefined && <p className="mt-1 text-gray-400">Random drop rate: {(rule.probability * 100).toFixed(2)}%</p>}
        {rule && <details className="mt-1 text-gray-400"><summary className="cursor-pointer text-gray-300">Provenance</summary><p className="mt-1">{rule.provenanceIds.join(', ') || 'No source reference recorded.'}</p></details>}
      </li>;
    })}
  </ol>;
}

export const ProofRouteList: React.FC<{ report: RuneProofReport; rules: ReadonlyMap<string, AcquisitionRule> }> = ({ report, rules }) => {
  const [showAlternatives, setShowAlternatives] = useState(false);
  if (!report.routes.length) return null;
  const [best, ...alternatives] = report.routes.slice(0, 32);
  return <section aria-label="Possible routes" className="space-y-2">
    <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-200">Best route</h2>
    <RouteSteps route={best} rules={rules} />
    {alternatives.length > 0 && <>
      <button type="button" onClick={() => setShowAlternatives(value => !value)} aria-expanded={showAlternatives} className="text-xs font-semibold text-cyan-200 hover:text-cyan-100">
        {showAlternatives ? 'Hide other valid routes' : `Other valid routes (${alternatives.length})`}
      </button>
      {showAlternatives && <div className="space-y-3 border-l border-white/10 pl-3">{alternatives.map(route => <RouteSteps key={route.id} route={route} rules={rules} />)}</div>}
    </>}
  </section>;
};
