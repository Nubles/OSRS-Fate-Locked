import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { isChunkLoadError, reloadIfNewBuild } from '../utils/chunkLoadError';
import { reportError } from '../utils/errorBeacon';

interface Props {
  /** Human-readable panel name, shown in the fallback message. */
  name: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Scoped error boundary for a single panel. Unlike the app-level boundary,
 * a crash here only blanks this panel — the rest of the app keeps running —
 * and "Try again" re-mounts the subtree without a full page reload.
 */
export class PanelErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.name}] panel error:`, error, info);
    reportError('panel', error); // before the reload below, as in App's boundary
    // A code-split chunk 404'd because a newer build has since been deployed —
    // retrying the same import can't succeed, so reload to fetch the new build.
    // A dropped connection stays put and shows the Reload button below.
    if (isChunkLoadError(error)) void reloadIfNewBuild();
  }

  private retry = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;

    if (isChunkLoadError(this.state.error)) {
      return (
        <div className="h-full min-h-[160px] flex items-center justify-center p-6">
          <div className="bg-[#1e1e1e] border border-amber-500/30 rounded-lg p-5 max-w-sm text-center">
            <RotateCcw className="w-8 h-8 text-amber-400 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-amber-300 mb-1">Couldn't load {this.props.name}</h3>
            <p className="text-xs text-gray-500 mb-3">Your connection may have dropped for a moment. Your save data is safe.</p>
            {/* Auto-reload only happens for a new build (and once per 15s), so
                this button is how a player recovers from a dropped connection. */}
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold transition-colors"
            >
              <RotateCcw size={12} />
              Reload now
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full min-h-[160px] flex items-center justify-center p-6">
        <div className="bg-[#1e1e1e] border border-red-500/30 rounded-lg p-5 max-w-sm text-center">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-red-300 mb-1">
            {this.props.name} hit an error
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            The rest of the tracker is still running. Your save data is safe.
          </p>
          {this.state.error?.message && (
            <pre className="text-[10px] text-red-300/60 bg-black/40 rounded p-2 mb-3 text-left overflow-auto max-h-24">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.retry}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold transition-colors"
          >
            <RotateCcw size={12} />
            Try again
          </button>
        </div>
      </div>
    );
  }
}
