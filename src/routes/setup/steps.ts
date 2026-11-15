import { copy } from '../../copy/en-AU';
import { partWritten, type CardModel, type CardPart } from '../../lib/card';

/** Setup is the card, written part by part. The card-ready page (/setup/ready) follows the last step. */
export interface SetupStepInfo {
  /** Short name for the progress line. */
  name: string;
  /** The parts of the card this step writes: marked in the preview, ticked in progress once written. */
  parts: readonly CardPart[];
  /** A fair guess at the time it takes, for "about 11 minutes left". They add up to 15. */
  minutes: number;
}

const names = copy.setup.stepNames;

/** Who to call comes second: it's short, and a worker can't do without it. */
export const STEP_INFO: readonly SetupStepInfo[] = [
  { name: names[0], parts: ['about'], minutes: 3 },
  { name: names[1], parts: ['who'], minutes: 1 },
  { name: names[2], parts: ['toileting'], minutes: 2 },
  { name: names[3], parts: ['food_drink'], minutes: 2 },
  { name: names[4], parts: ['overstimulation', 'calms', 'avoid'], minutes: 3 },
  { name: names[5], parts: ['cues'], minutes: 4 },
];

/** Stored as profiles.setup_step, which the database keeps between 1 and 6. */
export const SETUP_STEPS = STEP_INFO.length;

/** The step that writes a part, for "Add" links on the card-ready page. */
export function stepFor(part: CardPart): number {
  return STEP_INFO.findIndex((s) => s.parts.includes(part)) + 1;
}

/** Minutes for this step and the ones after it. */
export function minutesLeft(step: number): number {
  return STEP_INFO.slice(step - 1).reduce((sum, s) => sum + s.minutes, 0);
}

/** A step counts as written when any of its parts has something a worker would read. */
export function stepWritten(model: CardModel, step: number): boolean {
  return STEP_INFO[step - 1]!.parts.some((part) => partWritten(model, part));
}

/** Where "Save and continue" goes from a step. */
export function nextPath(step: number): string {
  return step >= SETUP_STEPS ? '/setup/ready' : `/setup/${step + 1}`;
}
