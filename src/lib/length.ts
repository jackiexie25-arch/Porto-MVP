import { countWords } from './card';

/** Above this many words, one answer is more than a worker can take in at a glance. */
export const LONG_ANSWER_WORDS = 30;

export type AnswerLength = 'empty' | 'good' | 'long';

/** How an answer reads for length while the family writes it. Shown as a quiet line, never a warning. */
export function answerLength(text: string): AnswerLength {
  const words = countWords(text);
  if (words === 0) return 'empty';
  return words > LONG_ANSWER_WORDS ? 'long' : 'good';
}
