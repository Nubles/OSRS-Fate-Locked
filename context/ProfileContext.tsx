
import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { Profile, ProfileMetadata } from '../types';
import { showToast } from '../utils/toast';
import { commitProfileMetadata, deleteProfileTransaction, profileBaseKey, profileDeletionNotice } from '../utils/profileStorage';

const PROFILES_KEY = 'FATE_PROFILES';
const LEGACY_SAVE_KEY = 'FATE_UIM_SAVE_V1';
const MAX_PROFILES = 10;
const MAX_NAME_LENGTH = 30;

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
};

const sanitizeName = (name: string): string => {
  return name.trim().slice(0, MAX_NAME_LENGTH) || 'Unnamed Profile';
};

/** One-time initialization: migrate legacy save or create default profile */
const initializeProfiles = (): ProfileMetadata => {
  const existing = localStorage.getItem(PROFILES_KEY);
  if (existing) {
    try {
      return JSON.parse(existing);
    } catch {
      // Corrupted metadata, fall through to create fresh
    }
  }

  const newId = generateId();
  const defaultProfile: Profile = {
    id: newId,
    name: 'Main Account',
    createdAt: Date.now(),
  };

  // Migrate legacy save if it exists
  const legacySave = localStorage.getItem(LEGACY_SAVE_KEY);
  if (legacySave) {
    localStorage.setItem(profileBaseKey(newId), legacySave);
  }

  const metadata: ProfileMetadata = {
    profiles: [defaultProfile],
    activeProfileId: newId,
  };
  localStorage.setItem(PROFILES_KEY, JSON.stringify(metadata));
  return metadata;
};

interface ProfileContextType {
  profiles: Profile[];
  activeProfileId: string;
  activeProfileName: string;
  storageKeyForActiveProfile: string;
  createProfile: (name: string) => void;
  switchProfile: (id: string) => void;
  renameProfile: (id: string, newName: string) => void;
  deleteProfile: (id: string) => void;
  /** Id of a profile created since the last clear — used to prompt mode pick. */
  recentlyCreatedId: string | null;
  clearRecentlyCreated: () => void;
}

const ProfileContext = createContext<ProfileContextType | null>(null);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [metadata, setMetadata] = useState<ProfileMetadata>(initializeProfiles);
  const [recentlyCreatedId, setRecentlyCreatedId] = useState<string | null>(null);
  const clearRecentlyCreated = useCallback(() => setRecentlyCreatedId(null), []);

  const metadataRef = useRef(metadata);

  const commitMetadata = useCallback((
    update: (previous: ProfileMetadata) => ProfileMetadata,
  ) => {
    const result = commitProfileMetadata(localStorage, PROFILES_KEY, metadataRef, update);
    if (result.ok) {
      setMetadata(result.metadata);
    } else {
      showToast('Profile changes could not be saved. Your profile list is unchanged.');
    }
    return result;
  }, []);

  const createProfile = useCallback((name: string) => {
    if (metadataRef.current.profiles.length >= MAX_PROFILES) {
      showToast('Maximum of ' + MAX_PROFILES + ' profiles reached');
      return;
    }
    const newProfile: Profile = {
      id: generateId(),
      name: sanitizeName(name),
      createdAt: Date.now(),
    };
    const result = commitMetadata((previous) => ({
      ...previous,
      profiles: [...previous.profiles, newProfile],
      activeProfileId: newProfile.id,
    }));
    if (result.ok) setRecentlyCreatedId(newProfile.id);
  }, [commitMetadata]);

  const switchProfile = useCallback((id: string) => {
    if (!metadataRef.current.profiles.some((profile) => profile.id === id)) return;
    commitMetadata((previous) => ({ ...previous, activeProfileId: id }));
  }, [commitMetadata]);

  const renameProfile = useCallback((id: string, newName: string) => {
    const sanitized = sanitizeName(newName);
    commitMetadata((previous) => ({
      ...previous,
      profiles: previous.profiles.map((profile) =>
        profile.id === id ? { ...profile, name: sanitized } : profile
      ),
    }));
  }, [commitMetadata]);

  const deleteProfile = useCallback((id: string) => {
    const result = deleteProfileTransaction(localStorage, PROFILES_KEY, metadataRef, id);
    if (result.status === 'deleted') setMetadata(result.metadata);
    const notice = profileDeletionNotice(result);
    if (notice) showToast(notice);
  }, []);

  const value = useMemo<ProfileContextType>(() => {
    const activeProfile = metadata.profiles.find(p => p.id === metadata.activeProfileId);
    return {
      profiles: metadata.profiles,
      activeProfileId: metadata.activeProfileId,
      activeProfileName: activeProfile?.name || 'Unknown',
      storageKeyForActiveProfile: profileBaseKey(metadata.activeProfileId),
      createProfile,
      switchProfile,
      renameProfile,
      deleteProfile,
      recentlyCreatedId,
      clearRecentlyCreated,
    };
  }, [metadata, createProfile, switchProfile, renameProfile, deleteProfile, recentlyCreatedId, clearRecentlyCreated]);

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfiles = () => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfiles must be used within a ProfileProvider');
  }
  return context;
};
