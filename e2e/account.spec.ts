import { expect, seedProfile, shareLink, signUp, sql, test } from './helpers';

test.describe('account', () => {
  test('deleting the profile removes everything and closes every link', async ({ page, browser }) => {
    const { email } = await signUp(page);
    const profileId = await seedProfile(email);
    const link = await shareLink(page);

    await page.goto('/account');
    await page.getByRole('button', { name: 'Delete this profile and everything in it' }).click();
    const sheet = page.getByRole('dialog', { name: 'Delete everything?' });
    await sheet.getByLabel('Type Ari to confirm').fill('Ar');
    await sheet.getByRole('button', { name: 'Delete everything' }).click();
    await expect(sheet.getByText('That doesn’t match.', { exact: false })).toBeVisible();
    await sheet.getByLabel('Type Ari to confirm').fill('ari');
    await sheet.getByRole('button', { name: 'Delete everything' }).click();
    await expect(page.getByRole('heading', { name: 'Everything has been deleted' })).toBeVisible();

    const [left] = await sql<{ n: number }>(
      `select (select count(*) from auth.users where email = $1)
            + (select count(*) from public.profiles where id = $2)
            + (select count(*) from public.cues where profile_id = $2)
            + (select count(*) from public.shares where profile_id = $2) as n`,
      [email, profileId],
    );
    expect(Number(left!.n)).toBe(0);

    const worker = await (await browser.newContext()).newPage();
    await worker.goto(link);
    await expect(worker.getByRole('heading', { name: 'This link has closed' })).toBeVisible();
  });

  test('a family can download everything as a versioned JSON file', async ({ page }) => {
    const { email } = await signUp(page);
    await seedProfile(email);
    await page.goto('/account');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download everything (JSON file)' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^porto-ari-\d{4}-\d{2}-\d{2}\.json$/);
    const data = JSON.parse(await (await download.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8')));
    expect(data.schema_version).toBe(1);
    expect(data.profile.display_name).toBe('Ari');
    expect(data.cues[0].meanings).toHaveLength(2);
    expect(JSON.stringify(data)).not.toMatch(/token_hash/);
  });
});
