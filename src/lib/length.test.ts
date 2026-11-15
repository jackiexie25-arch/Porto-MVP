import { describe, expect, it } from 'vitest';
import { copy } from '../copy/en-AU';
import { answerLength, LONG_ANSWER_WORDS } from './length';

describe('answerLength', () => {
  it('says nothing about an empty answer', () => {
    expect(answerLength('').kind).toBe('empty');
    expect(answerLength('   \n ').kind).toBe('empty');
  });

  it('calls a sentence or two about right', () => {
    expect(answerLength('Take him straight away.')).toEqual({ kind: 'good', words: 4 });
    expect(answerLength(Array(LONG_ANSWER_WORDS).fill('word').join(' ')).kind).toBe('good');
  });

  it('counts the words once an answer runs past what a worker reads at a glance', () => {
    const long = answerLength(Array(48).fill('word').join(' '));
    expect(long).toEqual({ kind: 'long', words: 48 });
    expect(copy.setup.length.long(long.words)).toBe('About 48 words. A worker reads this in a hurry, so shorter helps.');
  });
});
