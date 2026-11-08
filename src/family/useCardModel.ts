import { useMemo } from 'react';
import { copy } from '../copy/en-AU';
import { buildCard, cardText, countWords, readingMinutes, LONG_CARD_WORDS, type CardModel } from '../lib/card';
import { useFamilyData } from './FamilyDataProvider';

export interface CardStats {
  model: CardModel;
  words: number;
  minutes: number;
  isLong: boolean;
  /** The child's name, or "your child" until the family adds one. */
  hasName: boolean;
}

export function useCardModel(): CardStats {
  const { profile, sections, cues } = useFamilyData();
  return useMemo(() => {
    const model = buildCard(profile, sections, cues, copy.setup.yourChild);
    const words = countWords(cardText(model));
    return {
      model,
      words,
      minutes: readingMinutes(words),
      isLong: words > LONG_CARD_WORDS,
      hasName: profile.display_name.trim() !== '',
    };
  }, [profile, sections, cues]);
}
