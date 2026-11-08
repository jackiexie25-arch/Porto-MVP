/** Mirrors public.normalise_invite_code(): uppercase, no whitespace. */
export function normaliseInviteCode(code: string): string {
  return code.replace(/\s/g, '').toUpperCase();
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function looksLikeEmail(value: string): boolean {
  return EMAIL.test(value.trim());
}
