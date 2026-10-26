import { useEffect } from 'react';
import type { TableType } from '../types';
import { useSpendNotes, type SpendNote } from '../hooks/useSpendNotes';

/**
 * Hands the classic Spend Keys cards their outlook and hope lines. Loaded
 * apart from the home screen (GachaSection mounts it lazily), so the first
 * page load doesn't carry the hook or the Settings choice it reads.
 */
export default function SpendNotesBridge({ onNotes }: { onNotes: (notes: ReadonlyMap<TableType, SpendNote>) => void }) {
  const notes = useSpendNotes();
  useEffect(() => { onNotes(notes); }, [notes, onNotes]);
  return null;
}
