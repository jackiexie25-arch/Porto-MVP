import { describe, expect, it } from 'vitest';
import { answerLength, LONG_ANSWER_WORDS } from './length';

describe('answerLength', () => {
  it('says nothing about an empty answer', () => {
    expect(answerLength('')).toBe('empty');
    expect(answerLength('   \n ')).toBe('empty');
  });

  it('calls a sentence or two about right', () => {
    expect(answerLength('Take him straight away.')).toBe('good');
    expect(answerLength(Array(LONG_ANSWER_WORDS).fill('word').join(' '))).toBe('good');
  });

  it('suggests shorter once an answer runs past what a worker reads at a glance', () => {
    expect(answerLength(Array(LONG_ANSWER_WORDS + 1).fill('word').join(' '))).toBe('long');
  });
});
