import { expect, latestLink, shareLink, signUp, test, unique } from './helpers';

test.describe('family sign-up and setup', () => {
  test('a wrong invite code is refused and what was typed stays', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel('Your email').fill('someone@example.test');
    await page.getByLabel('Invite code').fill('NOT-A-REAL-CODE');
    await page.getByRole('button', { name: 'Email me a sign-in link' }).click();
    await expect(page.getByText('That code doesn’t match an unused invite.', { exact: false })).toBeVisible();
    await expect(page.getByLabel('Your email')).toHaveValue('someone@example.test');
  });

  test('sign up with an invite code, set up the profile and share it', async ({ page }) => {
    const started = Date.now();
    await signUp(page);

    // Step 1: about the child
    await page.getByLabel('First name or nickname').fill('Ari');
    await page.getByLabel('Sounds').check();
    await page.getByLabel('Gestures').check();
    await page.getByRole('button', { name: 'Save and continue' }).click();

    // Step 2: toileting
    await expect(page.getByText('Step 2 of 6')).toBeVisible();
    await page.getByLabel('How do they show they need the toilet?').fill('Taps the bathroom door twice.');
    await page.getByLabel('What should a new worker do?').fill('Take him straight away.');
    await page.getByRole('button', { name: 'Save and continue' }).click();

    // Step 3: skipped
    await expect(page.getByText('Step 3 of 6')).toBeVisible();
    await page.getByRole('button', { name: 'Skip this step' }).click();

    // Step 4: calming
    await expect(page.getByText('Step 4 of 6')).toBeVisible();
    await page.getByLabel('What helps them calm?').fill('Lower the noise. Offer his headphones.');
    await page.getByRole('button', { name: 'Save and continue' }).click();

    // Step 5: a first cue, added by Save and continue
    await expect(page.getByText('Step 5 of 6')).toBeVisible();
    await page.getByRole('button', { name: 'A phrase they repeat' }).click();
    await page.getByLabel('What you’ll see or hear').fill('Cookie time');
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.getByLabel('What it usually means').fill('I’m hungry');
    await page.getByLabel('What to do', { exact: true }).fill('Offer a snack.');
    await page.getByRole('button', { name: 'Save and continue' }).click();

    // Step 6: preview, then share
    await expect(page.getByRole('heading', { name: 'Your first-shift card' })).toBeVisible();
    await expect(page.getByText(/minutes? to read/)).toBeVisible();
    await expect(page.getByText('Taps the bathroom door twice.')).toBeVisible();
    await expect(page.getByText('Cookie time')).toBeVisible();
    await page.getByRole('button', { name: 'Share it' }).click();

    const link = await shareLink(page, 'Camp weekend');
    await expect(page.getByRole('img', { name: 'QR code for the share link' })).toBeVisible();
    expect(link).toContain('/s/');

    // Acceptance 1: a family can get from sign-up to a share link in well under 15 minutes.
    expect(Date.now() - started).toBeLessThan(15 * 60_000);
  });

  test('sign-in never reveals whether an account exists', async ({ page }) => {
    await page.goto('/signin');
    await page.getByLabel('Your email').fill(`${unique('nobody')}@example.test`);
    await page.getByRole('button', { name: 'Email me a sign-in link' }).click();
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  });

  test('a used sign-in link shows the calm closed message', async ({ page }) => {
    const { email } = await signUp(page);
    await page.goto('/auth/callback#error=access_denied&error_code=otp_expired');
    await expect(page.getByRole('heading', { name: 'This sign-in link has closed' })).toBeVisible();
    expect(await latestLink(email)).toContain('access_token');
  });
});
