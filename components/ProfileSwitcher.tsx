
import React, { useState, useRef, useEffect } from 'react';
import { useProfiles } from '../context/ProfileContext';
import { ChevronDown, Plus, Pencil, Trash2, Check, X } from 'lucide-react';

export const ProfileSwitcher: React.FC = () => {
  const { profiles, activeProfileId, activeProfileName, createProfile, switchProfile, renameProfile, deleteProfile } = useProfiles();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setEditingId(null);
        setShowCreate(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Focus inputs when they appear
  useEffect(() => {
    if (editingId) editInputRef.current?.focus();
  }, [editingId]);
  useEffect(() => {
    if (showCreate) createInputRef.current?.focus();
  }, [showCreate]);

  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    createProfile(trimmed);
    setNewName('');
    setShowCreate(false);
    setOpen(false);
  };

  const handleRename = (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed) { setEditingId(null); return; }
    renameProfile(id, trimmed);
    setEditingId(null);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Delete profile "${name}"? All progress for this profile will be permanently lost.`)) {
      deleteProfile(id);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1 bg-[#252525] border border-white/10 rounded-lg text-xs text-gray-300 hover:text-white hover:border-white/20 transition-colors max-w-[160px]"
      >
        <span className="truncate font-medium">{activeProfileName}</span>
        <ChevronDown size={12} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-1 right-0 w-64 bg-[#252525] border border-white/10 rounded-lg shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3 py-2 border-b border-white/5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Profiles</span>
          </div>

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
                    onSubmit={e => { e.preventDefault(); handleRename(p.id); }}
                  >
                    <input
                      ref={editInputRef}
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      maxLength={30}
                      className="flex-1 bg-black/30 border border-white/10 rounded px-2 py-0.5 text-xs text-white outline-none focus:border-amber-500/50"
                    />
                    <button type="submit" className="text-green-400 hover:text-green-300"><Check size={14} /></button>
                    <button type="button" onClick={() => setEditingId(null)} className="text-gray-500 hover:text-gray-300"><X size={14} /></button>
                  </form>
                ) : (
                  <>
                    <button
                      onClick={() => { if (p.id !== activeProfileId) { switchProfile(p.id); setOpen(false); } }}
                      className="flex-1 text-left text-xs truncate"
                    >
                      <span className={p.id === activeProfileId ? 'text-amber-300 font-bold' : 'text-gray-300'}>
                        {p.name}
                      </span>
                    </button>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => { setEditingId(p.id); setEditName(p.name); }}
                        className="text-gray-500 hover:text-blue-400"
                        title="Rename"
                      >
                        <Pencil size={12} />
                      </button>
                      {profiles.length > 1 && (
                        <button
                          onClick={() => handleDelete(p.id, p.name)}
                          className="text-gray-500 hover:text-red-400"
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
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
                onSubmit={e => { e.preventDefault(); handleCreate(); }}
              >
                <input
                  ref={createInputRef}
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Profile name..."
                  maxLength={30}
                  className="flex-1 bg-black/30 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-amber-500/50 placeholder:text-gray-600"
                />
                <button type="submit" className="text-green-400 hover:text-green-300"><Check size={14} /></button>
                <button type="button" onClick={() => { setShowCreate(false); setNewName(''); }} className="text-gray-500 hover:text-gray-300"><X size={14} /></button>
              </form>
            ) : (
              <button
                onClick={() => setShowCreate(true)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-gray-400 hover:text-amber-300 hover:bg-white/5 rounded transition-colors"
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
