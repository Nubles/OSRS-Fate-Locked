import { ChevronDown, ExternalLink, FileText } from 'lucide-react';
import { useId, useState } from 'react';
import type {
  RuneProofCoachModel,
  RuneProofPackCoachModel,
} from '../../utils/questStrategies/coach';
import { isIndependentReviewWalkthroughSource } from '../../utils/questWalkthroughs/model';

interface LegacyRuneProofProofDrawerProps {
  readonly variant: 'LEGACY';
  readonly proof: RuneProofCoachModel['proof'];
}

interface PackRuneProofProofDrawerProps {
  readonly variant: 'PACK';
  readonly proof: RuneProofPackCoachModel['proof'];
}

export type RuneProofProofDrawerProps =
  | LegacyRuneProofProofDrawerProps
  | PackRuneProofProofDrawerProps;

const LegacyProof = ({ proof }: { readonly proof: RuneProofCoachModel['proof'] }) => {
  const isIndependentGuide = isIndependentReviewWalkthroughSource(proof.source);
  return (
    <>
      <section>
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">
          Provenance
        </h4>
        <div className="mt-2 space-y-1">
          <p>
            <a
              href={proof.source.wikiUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-cyan-200 underline decoration-cyan-400/40 underline-offset-2 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              {proof.source.wikiTitle}
              <ExternalLink size={11} aria-hidden />
            </a>
          </p>
          <p>Wiki revision: {proof.source.wikiRevision}</p>
          <p>Revision captured: {proof.source.wikiRevisionTimestamp}</p>
          <p>
            Wiki licence:{' '}
            <a
              href={proof.source.wikiLicenceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-cyan-200 underline decoration-cyan-400/40 underline-offset-2 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              {proof.source.wikiLicence}
            </a>
          </p>
          {isIndependentGuide ? (
            <>
              <p>Independently authored by {proof.source.author} on {proof.source.authoredAt}.</p>
              <p>{proof.source.methodology}</p>
            </>
          ) : (
            <>
              <p>
                Chunk Picker: {proof.source.chunkPickerRepository}; commit{' '}
                <code className="break-all text-gray-200">{proof.source.chunkPickerCommit}</code>
              </p>
              <p>Chunk Picker reuse status: {proof.source.chunkPickerLicenceStatus}</p>
              {proof.source.permissionReference ? (
                <p>Review record: {proof.source.permissionReference}</p>
              ) : null}
            </>
          )}
        </div>
      </section>

      <section>
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">
          {isIndependentGuide ? 'Guide notes' : 'Reviewed source wording'}
        </h4>
        {proof.sourceLines.length > 0 ? (
          <ol className="mt-2 space-y-2 border-l border-white/10 pl-3">
            {proof.sourceLines.map(line => (
              <li key={line.id}>
                <p className="break-words text-gray-200">{line.rawText}</p>
                <p className="mt-0.5 text-[10px] text-gray-500">
                  {line.section} · line {line.sourceOrder}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-gray-500">
            {isIndependentGuide
              ? 'No additional public guide notes recorded.'
              : 'No pinned source wording recorded.'}
          </p>
        )}
      </section>

      <Diagnostics diagnostics={proof.diagnostics} />
    </>
  );
};

const Diagnostics = ({ diagnostics }: { readonly diagnostics: readonly string[] }) => (
  <section>
    <h4 className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">
      Route diagnostics
    </h4>
    {diagnostics.length > 0 ? (
      <ul className="mt-2 space-y-1 border-l border-white/10 pl-3">
        {diagnostics.map((diagnostic, index) => (
          <li key={diagnostic + ':' + index} className="break-words text-gray-300">
            {diagnostic}
          </li>
        ))}
      </ul>
    ) : (
      <p className="mt-2 text-gray-500">No route diagnostics recorded.</p>
    )}
  </section>
);

const PackProof = ({ proof }: { readonly proof: RuneProofPackCoachModel['proof'] }) => (
  <>
    <section>
      <h4 className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">
        Reviewed sources
      </h4>
      {proof.sources.length > 0 ? (
        <ul className="mt-2 space-y-3 border-l border-white/10 pl-3">
          {proof.sources.map(source => (
            <li key={source.id} className="space-y-0.5">
              <p className="font-semibold text-gray-100">{source.id}</p>
              <p>{source.kind}</p>
              <p>
                <a
                  href={source.uri}
                  className="break-all text-cyan-200 underline decoration-cyan-400/40 underline-offset-2"
                >
                  {source.uri}
                </a>
              </p>
              <p>Revision: {source.revision}</p>
              <p>Revision captured: {source.revisionTimestamp}</p>
              <p>Reviewed: {source.reviewedAt}</p>
              {source.author ? <p>Author: {source.author}</p> : null}
              {source.methodology ? <p>{source.methodology}</p> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-gray-500">No reviewed sources recorded.</p>
      )}
    </section>

    <section>
      <h4 className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">
        Evidence decisions
      </h4>
      {proof.evidence.length > 0 ? (
        <ul className="mt-2 space-y-3 border-l border-white/10 pl-3">
          {proof.evidence.map(evidence => (
            <li key={evidence.id} className="space-y-0.5">
              <p className="font-semibold text-gray-100">{evidence.id}</p>
              <p>Source: {evidence.sourceId}</p>
              <p>Locator: {evidence.sourceLocator}</p>
              <p>{evidence.decision}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-gray-500">No reviewed evidence decisions recorded.</p>
      )}
    </section>

    <Diagnostics diagnostics={proof.diagnostics} />
  </>
);

export function RuneProofProofDrawer(props: RuneProofProofDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = 'runeproof-proof-' + useId();

  return (
    <section className="rounded-lg border border-white/10 bg-[#171717]">
      <h3>
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => setIsOpen(open => !open)}
          className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-gray-200 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        >
          <span className="flex min-w-0 items-center gap-2">
            <FileText size={14} className="shrink-0 text-cyan-300" aria-hidden />
            Proof and sources
          </span>
          <ChevronDown
            size={15}
            className={'shrink-0 text-gray-400 transition-transform ' + (isOpen ? 'rotate-180' : '')}
            aria-hidden
          />
        </button>
      </h3>

      {isOpen ? (
        <div
          id={panelId}
          role="region"
          aria-label="Proof and sources"
          className="space-y-4 border-t border-white/10 px-3 py-3 text-[11px] leading-relaxed text-gray-300"
        >
          {props.variant === 'LEGACY'
            ? <LegacyProof proof={props.proof} />
            : <PackProof proof={props.proof} />}
        </div>
      ) : null}
    </section>
  );
}
