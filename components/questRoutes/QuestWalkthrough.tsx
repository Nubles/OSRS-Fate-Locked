import type {
  PresentedQuestWalkthrough,
  PresentedWalkthroughAction,
} from '../../utils/questWalkthroughs/presenter';

export interface QuestWalkthroughProps {
  readonly walkthrough: PresentedQuestWalkthrough;
  readonly onShowActionOnMap: (actionId: string) => void;
}

const WalkthroughRow = ({
  action,
  onShowActionOnMap,
}: {
  action: PresentedWalkthroughAction;
  onShowActionOnMap: QuestWalkthroughProps['onShowActionOnMap'];
}) => (
  <li
    id={action.anchorId}
    tabIndex={-1}
    className="min-w-0 rounded-md border border-white/10 bg-[#1b1b1b] p-2.5"
  >
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wide text-cyan-300">
          Step {action.sourceOrder}
        </p>
        <p className="mt-0.5 break-words text-xs leading-relaxed text-gray-100">
          {action.instruction}
        </p>
      </div>
      <div className="shrink-0 space-y-1 text-right">
        <p className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[10px] font-semibold text-gray-200">
          {action.statusText}
        </p>
        {action.canShowOnMap && (
          <button
            type="button"
            aria-label={`Show ${action.instruction} on map`}
            onClick={() => onShowActionOnMap(action.id)}
            className="rounded border border-cyan-400/30 bg-cyan-950/30 px-2 py-1 text-[10px] font-semibold text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            Show on map
          </button>
        )}
      </div>
    </div>

    {(action.blockerNotes.length > 0 || action.itemNotes.length > 0) && (
      <div className="mt-2 space-y-1 text-[11px] leading-relaxed">
        {action.blockerNotes.map((note, index) => (
          <p key={`blocker:${note}:${index}`} className="break-words text-amber-200">
            {note}
          </p>
        ))}
        {action.itemNotes.map((note, index) => (
          <p key={`item:${note}:${index}`} className="break-words text-gray-300">
            {note}
          </p>
        ))}
      </div>
    )}

    <details className="mt-2 rounded border border-white/10 bg-black/15 px-2 py-1.5 text-[11px] text-gray-300">
      <summary className="cursor-pointer font-semibold text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
        Evidence and source wording
      </summary>
      <p className="mt-1 break-words leading-relaxed">{action.evidenceText}</p>
      <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
        {action.sourceWording.map(line => (
          <p key={line.id} className="break-words leading-relaxed">
            {line.text}
          </p>
        ))}
        {action.sourceWording.length === 0 && (
          <p className="break-words leading-relaxed">No pinned source wording recorded.</p>
        )}
      </div>
    </details>
  </li>
);

const WalkthroughGroup = ({
  title,
  actions,
  onShowActionOnMap,
}: {
  title: 'Prepare' | 'Quest walkthrough';
  actions: readonly PresentedWalkthroughAction[];
  onShowActionOnMap: QuestWalkthroughProps['onShowActionOnMap'];
}) => (
  <section className="space-y-2">
    <h2 className="text-sm font-bold text-gray-100">{title}</h2>
    <ol className="space-y-2">
      {actions.map(action => (
        <WalkthroughRow
          key={action.id}
          action={action}
          onShowActionOnMap={onShowActionOnMap}
        />
      ))}
    </ol>
  </section>
);

export const QuestWalkthrough = ({
  walkthrough,
  onShowActionOnMap,
}: QuestWalkthroughProps) => (
  <section aria-label="Quest walkthrough" className="min-w-0 space-y-3">
    <WalkthroughGroup
      title="Prepare"
      actions={walkthrough.prepareActions}
      onShowActionOnMap={onShowActionOnMap}
    />
    <WalkthroughGroup
      title="Quest walkthrough"
      actions={walkthrough.questActions}
      onShowActionOnMap={onShowActionOnMap}
    />

    <footer
      data-runeproof-walkthrough-attribution=""
      className="space-y-1 border-t border-white/10 pt-2 text-[10px] leading-relaxed text-gray-400"
    >
      <p>
        <a
          href={walkthrough.attribution.wikiUrl}
          target="_blank"
          rel="noreferrer"
          className="text-cyan-300 underline"
        >
          {walkthrough.attribution.wikiLabel}
        </a>
        {' · '}
        <a
          href={walkthrough.attribution.licenceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-cyan-300 underline"
        >
          {walkthrough.attribution.licenceLabel}
        </a>
      </p>
      {walkthrough.attribution.kind === 'CHUNK_PICKER_REVIEW' ? (
        <p>
          {walkthrough.attribution.chunkPickerLabel}; commit{' '}
          <code className="break-all">{walkthrough.attribution.chunkPickerCommit}</code>
        </p>
      ) : (
        <p>
          Independently authored by {walkthrough.attribution.author} on {walkthrough.attribution.authoredAt}.
          {' '}{walkthrough.attribution.methodology}
        </p>
      )}
      <p>{walkthrough.attribution.reuseStatusText}</p>
    </footer>
  </section>
);

export default QuestWalkthrough;
