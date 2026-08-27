import React, { useState, useRef, useEffect } from 'react';
import { useProfiles } from '../context/ProfileContext';
import { ChevronDown, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import type { ProfileMutationFailure, ProfileTransactionResult } from '../utils/profileMetadataTransaction';

const PROFILE_MUTATION_MESSAGES: Record<ProfileMutationFailure, string> = {
  busy: 'Another tab is updating profiles. Try again in a moment.',
  profile_in_use: 'That profile is open in another tab. Switch away from it in every tab, then try again.',
  max_profiles: 'Maximum of 10 profiles reached.',
  not_found: 'That profile no longer exists. The list has been refreshed.',
  last_profile: 'You cannot delete the last profile.',
  unsupported_metadata: 'Profiles are read-only until this app supports the stored profile version.',
  storage_unavailable: 'Browser storage is unavailable. Your profile list is unchanged.',
  invalid_metadata: 'Profile data could not be validated. Your profile list is unchanged.',
  backup_failed: 'The safety backup could not be verified. Your profile list is unchanged.',
  verification_failed: 'The profile change could not be verified. Your profile list is unchanged.',
};

export const profileMutationMessage = (reason: ProfileMutationFailure): string =>
  PROFILE_MUTATION_MESSAGES[reason];

type CleanupFailureReason = Extract<
  ProfileMutationFailure,
  'busy' | 'profile_in_use' | 'storage_unavailable' | 'unsupported_metadata' | 'invalid_metadata'
>;

const CLEANUP_FAILURE_MESSAGES: Record<CleanupFailureReason, string> = {
  busy: 'Another tab is cleaning up profile storage. Try again in a moment.',
  profile_in_use: "Another tab is using this profile's storage. Switch away from it there, then retry cleanup.",
  storage_unavailable: 'Browser storage is unavailable. Cleanup is still pending.',
  unsupported_metadata: 'Profile cleanup is read-only until this app supports the stored profile version.',
  invalid_metadata: 'Profile cleanup metadata could not be validated. Cleanup is still pending.',
};

const cleanupFailureReason = (error: unknown): CleanupFailureReason | null => {
  if (typeof error !== 'object' || error === null) return null;
  const record = error as { name?: unknown; reason?: unknown };
  if (record.name !== 'ProfileDeletionCleanupRetryError' || typeof record.reason !== 'string') {
    return null;
  }
  return Object.prototype.hasOwnProperty.call(CLEANUP_FAILURE_MESSAGES, record.reason)
    ? record.reason as CleanupFailureReason
    : null;
};

export const ProfileSwitcher: React.FC = () => {
  const {
    profiles,
    activeProfileId,
    activeProfileName,
    pendingAction,
    metadataReadOnly,
    pendingDeletionCount,
    retryProfileDeletionCleanup,
    createProfile,
    switchProfile,
    renameProfile,
    deleteProfile,
  } = useProfiles();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [localPending, setLocalPending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [cleanupPending, setCleanupPending] = useState(false);
  const [cleanupFeedback, setCleanupFeedback] = useState<{
    kind: 'success' | 'failure';
    message: string;
  } | null>(null);
  const actionGuardRef = useRef(false);
  const cleanupGuardRef = useRef(false);
  const cleanupAttemptRef = useRef(0);
  const mountedRef = useRef(false);
  const retryFunctionRef = useRef(retryProfileDeletionCleanup);
  const previousDeletionCountRef = useRef(pendingDeletionCount);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);
  const isPending = pendingAction !== null || localPending;
  const mutationsDisabled = isPending || cleanupPending || metadataReadOnly;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanupAttemptRef.current += 1;
      cleanupGuardRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (retryFunctionRef.current === retryProfileDeletionCleanup) return;
    retryFunctionRef.current = retryProfileDeletionCleanup;
    cleanupAttemptRef.current += 1;
    cleanupGuardRef.current = false;
    setCleanupPending(false);
    setCleanupFeedback(null);
  }, [retryProfileDeletionCleanup]);

  useEffect(() => {
    const previous = previousDeletionCountRef.current;
    previousDeletionCountRef.current = pendingDeletionCount;
    if (previous <= 0 || pendingDeletionCount !== 0) return;
    cleanupAttemptRef.current += 1;
    cleanupGuardRef.current = false;
    setCleanupPending(false);
    setCleanupFeedback({ kind: 'success', message: 'Profile storage cleanup complete.' });
  }, [pendingDeletionCount]);

  // Close on outside click unless an in-flight action needs to retain its UI.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        if (actionGuardRef.current || pendingAction !== null) return;
        setOpen(false);
        setEditingId(null);
        setShowCreate(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, pendingAction]);

  // Focus inputs when they appear.
  useEffect(() => {
    if (editingId) editInputRef.current?.focus();
  }, [editingId]);
  useEffect(() => {
    if (showCreate) createInputRef.current?.focus();
  }, [showCreate]);

  const runAction = async (
    action: () => Promise<ProfileTransactionResult>,
  ): Promise<ProfileTransactionResult | null> => {
    if (
      actionGuardRef.current
      || cleanupGuardRef.current
      || pendingAction !== null
      || metadataReadOnly
    ) return null;
    actionGuardRef.current = true;
    setLocalPending(true);
    setFeedback(null);
    try {
      const result = await action();
      if (result.ok === false) setFeedback(profileMutationMessage(result.reason));
      return result;
    } catch {
      setFeedback(profileMutationMessage('invalid_metadata'));
      return null;
    } finally {
      actionGuardRef.current = false;
      setLocalPending(false);
    }
  };

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const result = await runAction(() => createProfile(trimmed));
    if (result?.ok !== true) return;
    setNewName('');
    setShowCreate(false);
    setOpen(false);
  };

  const handleRename = async (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed) {
      setFeedback('Enter a profile name before saving.');
      return;
    }
    const result = await runAction(() => renameProfile(id, trimmed));
    if (result?.ok !== true) return;
    setEditName('');
    setEditingId(null);
  };

  const handleSwitch = async (id: string) => {
    if (id === activeProfileId) return;
    const result = await runAction(() => switchProfile(id));
    if (result?.ok === true) setOpen(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete profile "${name}"? All progress for this profile will be permanently lost.`)) return;
    const result = await runAction(() => deleteProfile(id));
    if (result?.ok !== true) return;
    setEditingId(null);
    setShowCreate(false);
    setOpen(false);
  };

  const handleCleanupRetry = async () => {
    if (
      cleanupGuardRef.current
      || actionGuardRef.current
      || isPending
      || pendingDeletionCount <= 0
      || metadataReadOnly
    ) return;
    cleanupGuardRef.current = true;
    const attempt = cleanupAttemptRef.current + 1;
    cleanupAttemptRef.current = attempt;
    setCleanupPending(true);
    setCleanupFeedback(null);
    try {
      await retryProfileDeletionCleanup();
      if (!mountedRef.current || cleanupAttemptRef.current !== attempt) return;
      setCleanupFeedback({ kind: 'success', message: 'Profile storage cleanup complete.' });
    } catch (error) {
      if (!mountedRef.current || cleanupAttemptRef.current !== attempt) return;
      const reason = cleanupFailureReason(error);
      setCleanupFeedback({
        kind: 'failure',
        message: reason === null
          ? 'Storage cleanup could not be completed. Try again.'
          : CLEANUP_FAILURE_MESSAGES[reason],
      });
    } finally {
      if (!mountedRef.current || cleanupAttemptRef.current !== attempt) return;
      cleanupGuardRef.current = false;
      setCleanupPending(false);
    }
  };

  const handleTriggerClick = () => {
    if (actionGuardRef.current || pendingAction !== null) return;
    setOpen(current => !current);
  };

  const cleanupNotice = pendingDeletionCount > 0 ? (
    <div
      role="alert"
      aria-live="assertive"
      className="border-b border-amber-400/30 bg-amber-950/95 px-3 py-2 text-[11px] leading-relaxed text-amber-100"
    >
      <p>Profile removed; storage cleanup pending.</p>
      {cleanupFeedback !== null && (
        <p role={cleanupFeedback.kind === 'success' ? 'status' : undefined} className="mt-1 text-amber-200">
          {cleanupFeedback.message}
        </p>
      )}
      <button
        type="button"
        aria-label="Retry profile storage cleanup"
        onClick={() => { void handleCleanupRetry(); }}
        disabled={cleanupPending || isPending || metadataReadOnly}
        className="mt-1.5 rounded border border-amber-300/30 px-2 py-1 font-bold text-amber-100 hover:bg-amber-300/10 disabled:cursor-wait disabled:opacity-50"
      >
        {cleanupPending ? 'Retrying…' : 'Retry'}
      </button>
    </div>
  ) : cleanupFeedback?.kind === 'success' ? (
    <p
      role="status"
      aria-live="polite"
      className="border border-emerald-400/30 bg-emerald-950/95 px-3 py-2 text-[11px] text-emerald-100"
    >
      {cleanupFeedback.message}
    </p>
  ) : null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={handleTriggerClick}
        aria-label={`Switch profile. Current profile: ${activeProfileName}`}
        aria-expanded={open}
        data-profile-switcher-trigger
        className="flex items-center gap-1.5 px-2.5 py-1 bg-[#252525] border border-white/10 rounded-lg text-xs text-gray-300 hover:text-white hover:border-white/20 transition-colors max-w-[160px]"
      >
        <span className="truncate font-medium">{activeProfileName}</span>
        <ChevronDown size={12} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {!open && cleanupNotice !== null && (
        <div className="absolute right-0 top-full z-[101] mt-1 w-64 overflow-hidden rounded-lg border border-white/10 shadow-2xl">
          {cleanupNotice}
        </div>
      )}

      {open && (
        <div className="absolute top-full mt-1 right-0 w-64 bg-[#252525] border border-white/10 rounded-lg shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3 py-2 border-b border-white/5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Profiles</span>
          </div>

          {cleanupNotice}

          {feedback !== null && (
            <p role="alert" aria-live="assertive" className="border-b border-red-400/20 bg-red-950/40 px-3 py-2 text-[11px] leading-relaxed text-red-200">
              {feedback}
            </p>
          )}

          <div className="max-h-60 overflow-y-auto">
            {profiles.map(p => (
              <div
                key={p.id}
                className={`flex items-center gap-2 px-3 py-2 group transition-colors ${
                  p.id === activeProfileId ? 'bg-amber-500/10' : 'hover:bg-white/5'
                }`}
              >
                {editingId === p.id ? (
                  <form
                    className="flex items-center gap-1 flex-1"
                    onSubmit={e => { e.preventDefault(); void handleRename(p.id); }}
                  >
                    <input
                      ref={editInputRef}
                      aria-label={`Rename ${p.name}`}
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      maxLength={30}
                      disabled={mutationsDisabled}
                      className="flex-1 bg-black/30 border border-white/10 rounded px-2 py-0.5 text-xs text-white outline-none focus:border-amber-500/50 disabled:cursor-wait disabled:opacity-60"
                    />
                    <button
                      type="submit"
                      aria-label="Save profile name"
                      disabled={mutationsDisabled}
                      className="text-green-400 hover:text-green-300 disabled:cursor-wait disabled:opacity-50"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label="Cancel renaming profile"
                      disabled={isPending}
                      onClick={() => { setEditingId(null); setEditName(''); }}
                      className="text-gray-500 hover:text-gray-300 disabled:cursor-wait disabled:opacity-50"
                    >
                      <X size={14} />
                    </button>
                  </form>
                ) : (
                  <>
                    <button
                      type="button"
                      aria-label={p.id === activeProfileId ? `Current profile ${p.name}` : `Switch to ${p.name}`}
                      onClick={() => { void handleSwitch(p.id); }}
                      disabled={p.id === activeProfileId || mutationsDisabled}
                      className="flex-1 text-left text-xs truncate disabled:cursor-default"
                    >
                      <span className={p.id === activeProfileId ? 'text-amber-300 font-bold' : 'text-gray-300'}>
                        {p.name}
                      </span>
                    </button>
                    <div className="flex items-center gap-1 opacity-100 transition-opacity">
                      <button
                        type="button"
                        aria-label={`Rename ${p.name}`}
                        onClick={() => { setFeedback(null); setEditingId(p.id); setEditName(p.name); }}
                        disabled={mutationsDisabled}
                        className="text-gray-500 hover:text-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
                        title="Rename"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${p.name}`}
                        onClick={() => { void handleDelete(p.id, p.name); }}
                        disabled={p.id === activeProfileId || profiles.length === 1 || mutationsDisabled}
                        className="text-gray-500 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
                        title={p.id === activeProfileId
                          ? 'Switch profiles before deleting this profile'
                          : metadataReadOnly
                            ? 'Profile changes are read-only'
                            : isPending
                              ? 'A profile change is in progress'
                              : 'Delete'}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-white/5 p-2">
            {showCreate ? (
              <form
                className="flex items-center gap-1"
                onSubmit={e => { e.preventDefault(); void handleCreate(); }}
              >
                <input
                  ref={createInputRef}
                  aria-label="New profile name"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Profile name..."
                  maxLength={30}
                  disabled={mutationsDisabled}
                  className="flex-1 bg-black/30 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-amber-500/50 placeholder:text-gray-600 disabled:cursor-wait disabled:opacity-60"
                />
                <button
                  type="submit"
                  aria-label="Create profile"
                  disabled={mutationsDisabled}
                  className="text-green-400 hover:text-green-300 disabled:cursor-wait disabled:opacity-50"
                >
                  <Check size={14} />
                </button>
                <button
                  type="button"
                  aria-label="Cancel creating profile"
                  disabled={isPending}
                  onClick={() => { setShowCreate(false); setNewName(''); }}
                  className="text-gray-500 hover:text-gray-300 disabled:cursor-wait disabled:opacity-50"
                >
                  <X size={14} />
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => { setFeedback(null); setShowCreate(true); }}
                disabled={mutationsDisabled}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-gray-400 hover:text-amber-300 hover:bg-white/5 rounded transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus size={12} /> New Profile
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
