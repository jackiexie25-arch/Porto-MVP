import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Loading } from '../components/Loading';
import { AppShell } from '../components/layout/AppShell';
import { Banner, Button } from '../components/ui';
import { copy } from '../copy/en-AU';
import { addCue, fetchFamilyData, saveSection, updateProfile, type FamilyData } from '../data/family';
import type { CardSectionKind, Cue, NewCue, NewMeaning, ProfilePatch, SectionDraft } from '../data/types';
import { friendlyError } from '../lib/errors';

interface FamilyDataState extends FamilyData {
  saveProfile: (patch: ProfilePatch) => Promise<void>;
  saveSection: (section: CardSectionKind, draft: SectionDraft) => Promise<void>;
  addCue: (cue: NewCue, meaning: NewMeaning) => Promise<Cue>;
}

const FamilyDataContext = createContext<FamilyDataState | null>(null);

const MAX_PINNED = 5;

/** Loads the family's profile, card and cues once, and keeps them in step with every save. */
export function FamilyDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<FamilyData | null>(null);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setError(undefined);
    try {
      setData(await fetchFamilyData());
    } catch (err) {
      setError(friendlyError(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const value = useMemo<FamilyDataState | null>(() => {
    if (!data) return null;
    return {
      ...data,
      saveProfile: async (patch) => {
        const profile = await updateProfile(data.profile.id, patch);
        setData((d) => (d ? { ...d, profile } : d));
      },
      saveSection: async (section, draft) => {
        const saved = await saveSection(data.profile.id, section, draft);
        setData((d) => (d ? { ...d, sections: [...d.sections.filter((s) => s.section !== section), saved] } : d));
      },
      addCue: async (cue, meaning) => {
        const pinnedCount = data.cues.filter((c) => c.pinned).length;
        const pin =
          pinnedCount < MAX_PINNED ? { pinned: true, pin_order: pinnedCount + 1 } : { pinned: false, pin_order: null };
        const created = await addCue(data.profile.id, cue, meaning, pin);
        setData((d) => (d ? { ...d, cues: [...d.cues, created] } : d));
        return created;
      },
    };
  }, [data]);

  if (error) {
    return (
      <AppShell>
        <Banner tone="error">{error}</Banner>
        <div>
          <Button variant="outlined" onClick={() => void load()}>
            {copy.common.tryAgain}
          </Button>
        </div>
      </AppShell>
    );
  }
  if (!value) return <Loading />;
  return <FamilyDataContext.Provider value={value}>{children}</FamilyDataContext.Provider>;
}

export function useFamilyData(): FamilyDataState {
  const ctx = useContext(FamilyDataContext);
  if (!ctx) throw new Error('useFamilyData must be used inside FamilyDataProvider');
  return ctx;
}
