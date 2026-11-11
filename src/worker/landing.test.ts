import { describe, expect, it } from 'vitest';
import { LANDING_GAP, landingDelta } from './landing';

describe('landingDelta', () => {
  it('leaves the page alone when the answer is already in view under the search', () => {
    expect(landingDelta(320, 300, 860)).toBeNull();
  });

  it('scrolls back up just far enough when the answer is above the screen', () => {
    // Scrolled down reading the card: the answer is 1,000px above the top of the screen.
    expect(landingDelta(-1000, 300, 860)).toBe(-1000 - 300 - LANDING_GAP);
  });

  it('scrolls down when the answer is hidden under the pinned search or below the screen', () => {
    expect(landingDelta(200, 300, 860)).toBe(200 - 300 - LANDING_GAP);
    expect(landingDelta(800, 300, 860)).toBe(800 - 300 - LANDING_GAP);
  });
});
