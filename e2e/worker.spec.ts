import type { Browser, Page } from '@playwright/test';
import { expect, seedProfile, shareLink, signUp, sql, test, watchOrigins, ALLOWED_ORIGINS } from './helpers';

const PHONE = { viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true };

/** A worker's phone: no account, nothing shared with the family's browser. */
async function openAsWorker(browser: Browser, link: string): Promise<{ worker: Page; close: () => Promise<void> }> {
  const context = await browser.newContext(PHONE);
  const origins = watchOrigins(context);
  const worker = await context.newPage();
  await worker.goto(link);
  return {
    worker,
    close: async () => {
      expect([...origins].filter((o) => !ALLOWED_ORIGINS.includes(o))).toEqual([]);
      await context.close();
    },
  };
}

async function familyWithLink(page: Page): Promise<{ email: string; profileId: string; link: string }> {
  const { email } = await signUp(page);
  const profileId = await seedProfile(email);
  const link = await shareLink(page);
  return { email, profileId, link };
}

test.describe('worker view', () => {
  test('a worker finds a cue by typing within seconds, and is told plainly when nothing matches', async ({ page, browser }) => {
    const { link } = await familyWithLink(page);
    const { worker, close } = await openAsWorker(browser, link);

    await expect(worker.getByText('Shared by Ari’s family')).toBeVisible();
    await expect(worker).toHaveURL(/\/s\/open$/);

    // Acceptance 2: find a cue by typing a phrase within about 10 seconds.
    const started = Date.now();
    await worker.getByRole('button', { name: 'School' }).click();
    await worker.getByRole('searchbox', { name: 'What did Ari do or say?' }).fill('cookie time');
    const result = worker.getByRole('heading', { name: 'Cookie time', level: 3 });
    await expect(result).toBeVisible();
    expect(Date.now() - started).toBeLessThan(10_000);
    const item = result.locator('xpath=ancestor::li[1]');
    await expect(item.getByText('I need a break')).toBeVisible();
    await expect(item.getByText(/^At school · /).first()).toBeVisible();
    await expect(item.getByText('What to do').first()).toBeVisible();

    await worker.getByRole('searchbox').fill('giraffe trampoline');
    await expect(worker.getByText('Nothing in Ari’s profile matches yet.')).toBeVisible();
    await expect(worker.getByText('Lower the noise. Offer his headphones.').first()).toBeVisible();

    // The card is there too, and the page doesn't scroll sideways on a 360px phone.
    await expect(worker.getByRole('heading', { name: 'Ari’s first-shift card' })).toBeVisible();
    expect(await worker.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await close();
  });

  test('a very long unbroken label never makes the page scroll sideways', async ({ page, browser }) => {
    const { profileId, link } = await familyWithLink(page);
    const long = 'Bluebottle'.repeat(12); // 120 characters, no spaces: the longest label allowed.
    const [cue] = await sql<{ id: string }>(
      `insert into public.cues (profile_id, label, cue_type, category) values ($1, $2, 'phrase', 'other') returning id`,
      [profileId, long],
    );
    await sql(
      `insert into public.cue_meanings (cue_id, context_tags, context_text, meaning, what_to_do, what_to_avoid)
       values ($1, '{other}', $2, $2, $2, $2)`,
      [cue!.id, long],
    );
    const fits = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

    for (const width of [320, 360]) {
      await page.setViewportSize({ width, height: 780 });
      await page.goto('/cues');
      await expect(page.getByRole('heading', { name: long })).toBeVisible();
      expect(await fits(page), `library at ${width}px`).toBe(true);
      await page.goto(`/cues/${cue!.id}`);
      await expect(page.getByRole('heading', { level: 1, name: long })).toBeVisible();
      expect(await fits(page), `editor at ${width}px`).toBe(true);
    }

    const { worker, close } = await openAsWorker(browser, link);
    for (const width of [320, 360]) {
      await worker.setViewportSize({ width, height: 780 });
      await worker.getByRole('searchbox', { name: 'Type what you heard or saw' }).fill(long);
      await expect(worker.getByRole('heading', { name: long, level: 3 })).toBeVisible();
      expect(await fits(worker), `worker search at ${width}px`).toBe(true);
    }
    await close();
  });

  test('a worker logs what happened, the family adds it, and search then finds it', async ({ page, browser }) => {
    const { link } = await familyWithLink(page);
    const { worker, close } = await openAsWorker(browser, link);

    // From a result: "Did this help? Yes", then "Add a note" opens the form about that cue.
    await worker.getByRole('searchbox').fill('cookie');
    await worker.getByRole('button', { name: 'Yes: Cookie time helped' }).click();
    await worker.getByRole('button', { name: 'Add a note about Cookie time' }).click();
    const sheet = worker.getByRole('dialog', { name: 'Tell Ari’s family what happened' });
    await expect(sheet.getByText('Cookie time')).toBeVisible();
    await sheet.getByText('Add more detail').click();
    await sheet.getByLabel(/^What do you think they needed\?/).fill('A drink after swimming');
    await sheet.getByRole('button', { name: 'Camp' }).click();
    await sheet.getByLabel(/^What did you try\?/).fill('Gave him his water bottle');
    await sheet.getByRole('button', { name: 'Yes', exact: true }).click();
    await sheet.getByLabel(/^Your first name/).fill('Jo');
    await sheet.getByRole('button', { name: 'Send to Ari’s family' }).click();
    await expect(sheet.getByText('Thank you. Ari’s family will see this.')).toBeVisible();
    await sheet.getByRole('button', { name: 'Close' }).click();

    // The family sees it in the inbox, with a count, and adds it in one tap.
    await page.goto('/inbox');
    await expect(page.getByRole('link', { name: 'Inbox 1 new' })).toBeAttached();
    await expect(page.getByText('From Jo,', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Add to profile: Cookie time' }).click();
    await expect(page.getByText('Added to the profile.')).toBeVisible();

    // Acceptance 5: the worker's search now finds the new meaning, first for camp.
    await worker.getByRole('button', { name: 'Camp' }).click();
    await worker.getByRole('searchbox').fill('swimming');
    const result = worker.getByRole('heading', { name: 'Cookie time', level: 3 }).locator('xpath=ancestor::li[1]');
    await expect(result.getByText('A drink after swimming')).toBeVisible();
    await close();
  });

  test('closing a link stops it working straight away', async ({ page, browser }) => {
    const { link } = await familyWithLink(page);
    const { worker, close } = await openAsWorker(browser, link);
    await expect(worker.getByText('Shared by Ari’s family')).toBeVisible();

    await page.goto('/share');
    await page.getByRole('button', { name: 'Close this link now: Test shift' }).click();
    await expect(page.getByText('Link closed. It no longer works.')).toBeVisible();

    await worker.reload();
    await expect(worker.getByRole('heading', { name: 'This link has closed' })).toBeVisible();
    await expect(worker.getByText('Ari')).toHaveCount(0);
    await close();
  });

  test('an expired link shows only the calm closed message', async ({ page, browser }) => {
    const { profileId, link } = await familyWithLink(page);
    await sql(
      `update public.shares set created_at = now() - interval '2 days', expires_at = now() - interval '1 minute' where profile_id = $1`,
      [profileId],
    );
    const { worker, close } = await openAsWorker(browser, link);
    await expect(worker.getByRole('heading', { name: 'This link has closed' })).toBeVisible();
    await expect(worker.getByText('Ask the family for a new one.')).toBeVisible();
    await expect(worker.getByRole('searchbox')).toHaveCount(0);
    await close();
  });
});
