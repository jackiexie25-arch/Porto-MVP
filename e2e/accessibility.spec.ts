import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, latestLink, newInviteCode, seedProfile, shareLink, signUp, sql, test, unique } from './helpers';

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Scans the page with axe and returns readable problems (empty when it passes). */
async function scan(page: Page, label: string): Promise<string[]> {
  // Let fades finish first, or half-faded text reads as low contrast.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return results.violations.map(
    (v) => `${label}: ${v.id} (${v.impact}) ${v.help} → ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`,
  );
}

test.describe('accessibility (WCAG 2.2 AA, axe)', () => {
  test('public pages', async ({ page }) => {
    const problems: string[] = [];
    for (const path of ['/', '/signup', '/signin', '/privacy', '/demo', '/deleted', '/check-email']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      problems.push(...(await scan(page, path)));
    }
    await page.goto('/auth/callback#error=access_denied&error_code=otp_expired');
    await expect(page.getByRole('heading', { name: 'This sign-in link has closed' })).toBeVisible();
    problems.push(...(await scan(page, 'expired sign-in link')));

    // Error states keep their meaning for screen readers too.
    await page.goto('/signup');
    await page.getByRole('button', { name: 'Email me a sign-in link' }).click();
    problems.push(...(await scan(page, '/signup with errors')));
    expect(problems).toEqual([]);
  });

  test('family pages, in their main states', async ({ page }) => {
    const problems: string[] = [];

    // Consent, before agreeing
    const email = `${unique('a11y')}@example.test`;
    const code = await newInviteCode();
    await page.goto('/signup');
    await page.getByLabel('Your email').fill(email);
    await page.getByLabel('Invite code').fill(code);
    await page.getByRole('button', { name: 'Email me a sign-in link' }).click();
    await page.goto(await latestLink(email));
    await expect(page.getByRole('heading', { name: 'Before you start' })).toBeVisible();
    problems.push(...(await scan(page, '/consent')));
    await page.getByLabel('I’ve read this and I agree to Porto storing this information.').check();
    await page.getByRole('button', { name: 'Agree and continue' }).click();
    await expect(page.getByRole('heading', { name: 'About your child' })).toBeVisible();

    for (const step of [1, 2, 3, 4, 5, 6]) {
      await page.goto(`/setup/${step}`);
      await expect(page.getByText(`Step ${step} of 6`, { exact: true })).toBeVisible();
      problems.push(...(await scan(page, `/setup/${step}`)));
    }
    await page.goto('/setup/5');
    await page.getByRole('button', { name: 'A phrase they repeat' }).click();
    problems.push(...(await scan(page, '/setup/5 with the cue form open')));

    await seedProfile(email);
    const link = await shareLink(page);
    problems.push(...(await scan(page, '/share with a new link')));

    // A note in the inbox
    const token = link.split('/s/')[1]!;
    await sql(`select public.worker_log_note($1, $2)`, [
      token,
      JSON.stringify({ cue_text: 'Flaps both hands', outcome: 'partly', worker_name: 'Jo' }),
    ]);

    for (const path of ['/card', '/card/print', '/cues', '/cues/new', '/share', '/inbox', '/account', '/team']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      problems.push(...(await scan(page, path)));
    }
    await page.goto('/card');
    await page.getByRole('button', { name: 'Preview as a worker' }).click();
    problems.push(...(await scan(page, '/card preview')));
    await page.getByRole('button', { name: 'Back to editing' }).click();
    await page.getByRole('button', { name: 'Edit Toileting' }).click();
    problems.push(...(await scan(page, '/card editing a section')));

    await page.goto('/cues');
    await page.getByRole('link', { name: 'Edit Cookie time' }).click();
    problems.push(...(await scan(page, '/cues/:id')));

    await page.goto('/account');
    await page.getByRole('button', { name: 'Delete this profile and everything in it' }).click();
    problems.push(...(await scan(page, '/account delete sheet')));
    expect(problems).toEqual([]);
  });

  test('worker pages on a phone', async ({ page, browser }) => {
    const { email } = await signUp(page);
    await seedProfile(email);
    const link = await shareLink(page);
    const context = await browser.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });
    const worker = await context.newPage();
    const problems: string[] = [];

    await worker.goto(link);
    await expect(worker.getByText('Shared by Ari’s family')).toBeVisible();
    problems.push(...(await scan(worker, 'worker, first screen')));
    await worker.getByRole('searchbox').fill('cookie');
    await expect(worker.getByRole('heading', { name: 'Cookie time', level: 3 })).toBeVisible();
    problems.push(...(await scan(worker, 'worker, results')));
    await worker.getByRole('button', { name: 'Show larger: Cookie time' }).click();
    problems.push(...(await scan(worker, 'worker, larger view')));
    await worker.keyboard.press('Escape');
    await worker.getByRole('searchbox').fill('giraffe');
    await expect(worker.getByText('Nothing in Ari’s profile matches yet.')).toBeVisible();
    problems.push(...(await scan(worker, 'worker, no match')));
    await worker.getByRole('button', { name: 'Log what happened' }).click();
    problems.push(...(await scan(worker, 'worker, log form')));
    await worker.getByRole('button', { name: 'Send to Ari’s family' }).click();
    problems.push(...(await scan(worker, 'worker, log form with errors')));

    await worker.goto('/s/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
    await expect(worker.getByRole('heading', { name: 'This link has closed' })).toBeVisible();
    problems.push(...(await scan(worker, 'worker, closed link')));
    await context.close();
    expect(problems).toEqual([]);
  });
});

test.describe('keyboard, zoom and small screens', () => {
  test('the worker view works with a keyboard alone', async ({ page }) => {
    await page.goto('/demo');
    await expect(page.getByRole('searchbox')).toBeVisible();

    // The first Tab reaches the skip link, which jumps to the content.
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);

    // Search, choose a place with the keyboard, and open a result larger.
    await page.getByRole('searchbox').focus();
    await page.keyboard.type('cookie');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'School' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'School' })).toHaveAttribute('aria-pressed', 'true');

    const larger = page.getByRole('button', { name: 'Show larger: Cookie time' });
    await larger.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Cookie time' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
    // Focus stays inside the sheet, and Escape closes it and returns focus.
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(larger).toBeFocused();
  });

  test('every focused control shows a visible focus ring', async ({ page }) => {
    await page.goto('/demo');
    await page.getByRole('searchbox').waitFor();
    const missing: string[] = [];
    for (let i = 0; i < 14; i += 1) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const s = getComputedStyle(el);
        const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2) || s.boxShadow !== 'none';
        return { ring, name: `${el.tagName.toLowerCase()} ${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 30)}` };
      });
      if (info && !info.ring) missing.push(info.name);
    }
    expect(missing).toEqual([]);
  });

  for (const { width, label } of [
    { width: 320, label: '320px (reflow)' },
    { width: 360, label: '360px phone' },
    { width: 640, label: '200% zoom on a 1280px screen' },
  ]) {
    test(`no sideways scrolling at ${label}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width, height: 800 } });
      const page = await context.newPage();
      const wide: string[] = [];
      for (const path of ['/', '/signup', '/privacy', '/demo']) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
        if (!fits) wide.push(path);
      }
      await context.close();
      expect(wide).toEqual([]);
    });
  }

  test('respects reduced motion', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('/demo');
    const duration = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--motion-fade').trim());
    expect(duration).toBe('0ms');
    await context.close();
  });
});
