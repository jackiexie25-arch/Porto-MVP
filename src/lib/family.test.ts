import { describe, expect, it } from 'vitest';
import { copy } from '../copy/en-AU';
import { linkFailed } from '../routes/auth/AuthCallback';
import { friendlyError } from './errors';
import { meetsNeed, nextFamilyStep, type FamilyStatus } from './family';
import { looksLikeEmail, normaliseInviteCode } from './invite';

const out: FamilyStatus = { signedIn: false, consented: false, profileId: null };
const fresh: FamilyStatus = { signedIn: true, consented: false, profileId: null };
const consented: FamilyStatus = { signedIn: true, consented: true, profileId: null };
const ready: FamilyStatus = { signedIn: true, consented: true, profileId: 'p1' };

describe('nextFamilyStep', () => {
  it('walks sign in → consent → profile → home', () => {
    expect(nextFamilyStep(out)).toBe('/signin');
    expect(nextFamilyStep(fresh)).toBe('/consent');
    expect(nextFamilyStep(consented)).toBe('/start');
    expect(nextFamilyStep(ready)).toBe('/home');
  });
});

describe('meetsNeed', () => {
  it('blocks the app until consent is given', () => {
    expect(meetsNeed(fresh, 'session')).toBe(true);
    expect(meetsNeed(fresh, 'consent')).toBe(false);
    expect(meetsNeed(fresh, 'profile')).toBe(false);
    expect(meetsNeed(consented, 'profile')).toBe(false);
    expect(meetsNeed(ready, 'profile')).toBe(true);
    expect(meetsNeed(out, 'session')).toBe(false);
  });
});

describe('invite codes and email', () => {
  it('normalises the way the database does', () => {
    expect(normaliseInviteCode(' porto-7kqm x4td ')).toBe('PORTO-7KQMX4TD');
  });

  it('checks email shape only loosely', () => {
    expect(looksLikeEmail('name@example.com')).toBe(true);
    expect(looksLikeEmail('name@example')).toBe(false);
    expect(looksLikeEmail('')).toBe(false);
  });
});

describe('friendlyError', () => {
  it('maps database and network errors to calm copy', () => {
    expect(friendlyError({ message: 'invalid_invite_code' })).toBe(copy.errors.inviteCode);
    expect(friendlyError({ message: 'consent_required' })).toBe(copy.errors.consentFirst);
    expect(friendlyError({ status: 429, message: 'x' })).toBe(copy.common.tryAgainSoon);
    expect(friendlyError(new TypeError('Failed to fetch'))).toBe(copy.errors.offline);
    expect(friendlyError(new Error('not_configured'))).toBe(copy.errors.notConfigured);
    expect(friendlyError(null)).toBe(copy.errors.generic);
  });
});

describe('linkFailed', () => {
  it('spots expired or used magic links', () => {
    expect(linkFailed('#error=access_denied&error_code=otp_expired', '')).toBe(true);
    expect(linkFailed('', '?error=access_denied')).toBe(true);
    expect(linkFailed('#access_token=abc&type=magiclink', '')).toBe(false);
  });
});
