import { expect, test as base, type BrowserContext, type Page } from '@playwright/test';
import { APP_URL, MINI_SUPABASE_URL } from './constants.mjs';

/** Runs SQL as the database admin on the test stand-in (seeding codes, expiring links). */
export async function sql<T = Record<string, unknown>>(query: string, params: unknown[] = []): Promise<T[]> {
  const res = await fetch(`${MINI_SUPABASE_URL}/__test/sql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql: query, params }),
  });
  if (!res.ok) throw new Error(`sql failed: ${await res.text()}`);
  return ((await res.json()) as { rows: T[] }).rows;
}

let counter = 0;
export function unique(prefix: string): string {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter}`.toLowerCase();
}

export async function newInviteCode(): Promise<string> {
  const code = `E2E-${unique('').toUpperCase()}`;
  await sql(`insert into public.invite_codes (code) values ($1)`, [code]);
  return code;
}

/** The newest magic link sent to this address (the stand-in keeps emails in a test mailbox). */
export async function latestLink(email: string): Promise<string> {
  for (let i = 0; i < 50; i += 1) {
    const res = await fetch(`${MINI_SUPABASE_URL}/__test/mailbox?email=${encodeURIComponent(email)}`);
    const { links } = (await res.json()) as { links: string[] };
    if (links.length) return links[links.length - 1]!;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`no email for ${email}`);
}

/** Sign up with a fresh invite code, open the magic link and agree to consent. Ends on setup step 1. */
export async function signUp(page: Page, email = `${unique('family')}@example.test`): Promise<{ email: string }> {
  const code = await newInviteCode();
  await page.goto('/signup');
  await page.getByLabel('Your email').fill(email);
  await page.getByLabel('Invite code').fill(code.toLowerCase());
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

  await page.goto(await latestLink(email));
  await expect(page.getByRole('heading', { name: 'Before you start' })).toBeVisible();
  await page.getByLabel('I’ve read this and I agree to Porto storing this information.').check();
  await page.getByRole('button', { name: 'Agree and continue' }).click();
  await expect(page.getByRole('heading', { name: 'About your child' })).toBeVisible();
  return { email };
}

/** Fills in a small fictional profile directly (for tests that aren't about setup itself). */
export async function seedProfile(email: string): Promise<string> {
  const [profile] = await sql<{ id: string }>(
    `update public.profiles p set display_name = 'Ari', setup_step = 6, setup_started_at = now() - interval '12 minutes', setup_completed_at = now()
     from auth.users u where u.id = p.owner_id and u.email = $1 returning p.id`,
    [email],
  );
  const id = profile!.id;
  await sql(
    `insert into public.card_sections (profile_id, section, body) values ($1, 'calms', 'Lower the noise. Offer his headphones.')`,
    [id],
  );
  const [cue] = await sql<{ id: string }>(
    `insert into public.cues (profile_id, label, cue_type, category, aliases, pinned, pin_order)
     values ($1, 'Cookie time', 'phrase', 'food_drink', '{cookie}', true, 1) returning id`,
    [id],
  );
  await sql(
    `insert into public.cue_meanings (cue_id, context_tags, meaning, what_to_do) values
     ($1, '{home,mealtime}', 'I’m hungry', 'Offer a snack from his lunchbox.'),
     ($1, '{school}', 'I need a break', 'Walk with him to the quiet corner.')`,
    [cue!.id],
  );
  return id;
}

/** Makes a share link through the real share page and returns the worker link. */
export async function shareLink(page: Page, label = 'Test shift'): Promise<string> {
  await page.goto('/share');
  await page.getByLabel('What’s this link for?').fill(label);
  await page.getByRole('button', { name: 'Share for this shift' }).click();
  await expect(page.getByRole('heading', { name: 'Link ready' })).toBeVisible();
  const link = await page.getByRole('textbox', { name: 'Share link' }).inputValue();
  expect(link).toMatch(new RegExp(`^${APP_URL}/s/[A-Za-z0-9_-]{43}$`));
  return link;
}

/** Records every request origin, so a test can prove nothing goes to a third party (acceptance 7). */
export function watchOrigins(context: BrowserContext): Set<string> {
  const origins = new Set<string>();
  context.on('request', (req) => {
    const url = new URL(req.url());
    if (url.protocol === 'http:' || url.protocol === 'https:') origins.add(url.origin);
  });
  return origins;
}

export const ALLOWED_ORIGINS = [APP_URL, MINI_SUPABASE_URL];

/** Every test checks, at the end, that its pages only talked to the app and the database. */
export const test = base.extend<{ origins: Set<string> }>({
  origins: [
    async ({ context }, use) => {
      const origins = watchOrigins(context);
      await use(origins);
      expect([...origins].filter((o) => !ALLOWED_ORIGINS.includes(o))).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
