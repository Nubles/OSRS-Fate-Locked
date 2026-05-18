
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { Profile, ProfileMetadata } from '../types';

const PROFILES_KEY = 'FATE_PROFILES';
const LEGACY_SAVE_KEY = 'FATE_UIM_SAVE_V1';
const PROFILE_PREFIX = 'FATE_PROFILE_';
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
    localStorage.setItem(`${PROFILE_PREFIX}${newId}`, legacySave);
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

  const persist = useCallback((updated: ProfileMetadata) => {
    setMetadata(updated);
    localStorage.setItem(PROFILES_KEY, JSON.stringify(updated));
  }, []);

  const createProfile = useCallback((name: string) => {
    const newProfile: Profile = {
      id: generateId(),
      name: sanitizeName(name),
      createdAt: Date.now(),
    };
    setMetadata(prev => {
      if (prev.profiles.length >= MAX_PROFILES) {
        alert(`Maximum of ${MAX_PROFILES} profiles reached.`);
        return prev;
      }
      const updated = {
        ...prev,
        profiles: [...prev.profiles, newProfile],
        activeProfileId: newProfile.id,
      };
      localStorage.setItem(PROFILES_KEY, JSON.stringify(updated));
      return updated;
    });
    setRecentlyCreatedId(newProfile.id);
  }, []);

  const switchProfile = useCallback((id: string) => {
    setMetadata(prev => {
      if (!prev.profiles.some(p => p.id === id)) return prev;
      const updated = { ...prev, activeProfileId: id };
      localStorage.setItem(PROFILES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const renameProfile = useCallback((id: string, newName: string) => {
    setMetadata(prev => {
      const updated = {
        ...prev,
        profiles: prev.profiles.map(p =>
          p.id === id ? { ...p, name: sanitizeName(newName) } : p
        ),
      };
      localStorage.setItem(PROFILES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const deleteProfile = useCallback((id: string) => {
    setMetadata(prev => {
      if (prev.profiles.length <= 1) {
        alert('Cannot delete the last profile.');
        return prev;
      }
      const remaining = prev.profiles.filter(p => p.id !== id);
      const newActiveId = prev.activeProfileId === id
        ? remaining[0].id
        : prev.activeProfileId;

      // Remove the profile's game data
      localStorage.removeItem(`${PROFILE_PREFIX}${id}`);

      const updated = {
        profiles: remaining,
        activeProfileId: newActiveId,
      };
      localStorage.setItem(PROFILES_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const value = useMemo<ProfileContextType>(() => {
    const activeProfile = metadata.profiles.find(p => p.id === metadata.activeProfileId);
    return {
      profiles: metadata.profiles,
      activeProfileId: metadata.activeProfileId,
      activeProfileName: activeProfile?.name || 'Unknown',
      storageKeyForActiveProfile: `${PROFILE_PREFIX}${metadata.activeProfileId}`,
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
