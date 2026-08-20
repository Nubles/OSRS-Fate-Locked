import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  failed: boolean;
}

export class RuneProofErrorBoundary extends React.Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render(): React.ReactNode {
    if (this.state.failed) {
      return (
        <div
          role="status"
          className="rounded-lg border border-amber-500/25 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-200"
        >
          RuneProof preview is unavailable. The Goal Planner is still available.
        </div>
      );
    }
    return this.props.children;
  }
}
