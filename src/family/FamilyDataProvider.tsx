import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Loading } from '../components/Loading';
import { AppShell } from '../components/layout/AppShell';
import { Banner, Button } from '../components/ui';
import { copy } from '../copy/en-AU';
import {
  deleteCue,
  fetchFamilyData,
  saveCue,
  saveSection,
  updateProfile,
  type CueInput,
  type FamilyData,
  type MeaningInput,
} from '../data/family';
import type { CardSectionKind, Cue, NewCue, NewMeaning, ProfilePatch, SectionDraft } from '../data/types';
import { friendlyError } from '../lib/errors';

interface FamilyDataState extends FamilyData {
  saveProfile: (patch: ProfilePatch) => Promise<void>;
  saveSection: (section: CardSectionKind, draft: SectionDraft) => Promise<void>;
  /** Quick add from setup: one meaning, pinned while there's room on the card. */
  addCue: (cue: NewCue, meaning: NewMeaning) => Promise<Cue>;
  saveCue: (cue: CueInput, meanings: MeaningInput[]) => Promise<Cue>;
  deleteCue: (id: string) => Promise<void>;
}

const FamilyDataContext = createContext<FamilyDataState | null>(null);

export const MAX_PINNED = 5;

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
    const profileId = data.profile.id;

    const upsertCue = async (cue: CueInput, meanings: MeaningInput[]) => {
      const saved = await saveCue(profileId, cue, meanings);
      setData((d) => {
        if (!d) return d;
        const exists = d.cues.some((c) => c.id === saved.id);
        return { ...d, cues: exists ? d.cues.map((c) => (c.id === saved.id ? saved : c)) : [...d.cues, saved] };
      });
      return saved;
    };

    return {
      ...data,
      saveProfile: async (patch) => {
        const profile = await updateProfile(profileId, patch);
        setData((d) => (d ? { ...d, profile } : d));
      },
      saveSection: async (section, draft) => {
        const saved = await saveSection(profileId, section, draft);
        setData((d) => (d ? { ...d, sections: [...d.sections.filter((s) => s.section !== section), saved] } : d));
      },
      addCue: (cue, meaning) =>
        upsertCue(
          { ...cue, description: '', aliases: [], pinned: data.cues.filter((c) => c.pinned).length < MAX_PINNED },
          [meaning],
        ),
      saveCue: upsertCue,
      deleteCue: async (id) => {
        await deleteCue(id);
        setData((d) => (d ? { ...d, cues: d.cues.filter((c) => c.id !== id) } : d));
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
