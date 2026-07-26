import React from 'react';
import { Download } from 'lucide-react';
import type { RollInboxRow } from '../services/rollInboxStore';
import type { LogEntry } from '../types';
import { buildDetectorPlaytestReport } from '../utils/detectorPlaytestReport';

interface DetectorPlaytestExportProps {
  inbox: RollInboxRow[];
  history: LogEntry[];
}

export function DetectorPlaytestExport({
  inbox,
  history,
}: DetectorPlaytestExportProps) {
  const download = () => {
    const report = buildDetectorPlaytestReport(inbox, history);
    const url = URL.createObjectURL(new Blob(
      [JSON.stringify(report, null, 2)],
      { type: 'application/json' },
    ));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `fate-detector-playtest-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={download}
      className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[10px] text-gray-500 hover:bg-white/5 hover:text-gray-200"
      title="Downloads aggregate counts only; no account name, event evidence, or exact timestamps."
    >
      <Download size={10} />
      Export playtest report
    </button>
  );
}
