# Porto trial runbook

How to run the Porto trial day to day. Plain steps, no coding needed unless a step says so.

**Where everything lives**

| What | Where |
| --- | --- |
| Live site | https://porto-app.com |
| Fictional demo (no sign-in) | https://porto-app.com/demo |
| Trial metrics (team only) | https://porto-app.com/team |
| Database, sign-in, email settings | Supabase dashboard, project `qcjtiypfexmdyogaoled` (Sydney) |
| Website hosting | Netlify, project `porto-communicate` |
| Domain and DNS | Cloudflare, `porto-app.com` |
| Sign-in emails | Resend, sending from `hello@porto-app.com` |
| Code | GitHub, `jackiexie25-arch/Porto-MVP` |

The **Supabase SQL Editor** is at Supabase → SQL Editor → New query. Paste a query, check it twice, then click **Run**.

---

## 1. Invite a family

1. Find an unused code:

   ```sql
   select code from public.invite_codes where used_at is null order by created_at;
   ```

2. Send the family **one** code and the link **https://porto-app.com**. Suggested message:

   > Here's your Porto invite code: **PORTO-XXXX-XXXX**. Go to porto-app.com, choose "Start with an invite code", and use the email address you'd like to sign in with. Each code works once.

3. Note privately which family got which code. Porto itself never links a code to a name.

**Need more codes?** On the Mac, in the Porto MVP folder, run `npm run invite-codes -- 5`. It prints 5 codes and an `insert into …` line. Paste that line into the SQL Editor and run it.

**A family says their code doesn't work.** Check it hasn't been used (above). Codes ignore case and spaces. If it was used by mistake, give them a new one.

## 2. Close a share link for a family

Families can close any link themselves: **Share for a shift → Your links → Close this link now**. It stops working straight away.

If a family asks you to do it for them (for example, a lost phone):

1. Find the family's account by email:

   ```sql
   select p.id as profile_id, s.id as share_id, s.label, s.created_at, s.expires_at, s.revoked_at
   from auth.users u
   join public.profiles p on p.owner_id = u.id
   join public.shares s on s.profile_id = p.id
   where u.email = 'parent@example.com'
   order by s.created_at desc;
   ```

2. Close one link (use its `share_id`), or all of that family's open links:

   ```sql
   update public.shares set revoked_at = now() where id = 'SHARE-ID-HERE' and revoked_at is null;
   -- or every open link for the family:
   update public.shares set revoked_at = now() where profile_id = 'PROFILE-ID-HERE' and revoked_at is null;
   ```

Workers opening a closed link see only "This link has closed. Ask the family for a new one." They can't tell whether the link ever existed.

## 3. Delete a family's data on request

Families can do this themselves: **Account → Delete this profile and everything in it**, then type their child's name.

If a family asks you to do it (by email to the privacy contact):

1. **Confirm it's really them.** Reply to the email address they signed up with, and ask them to confirm.
2. Offer them a copy first. They can download everything from **Account → Download everything**.
3. In the SQL Editor, delete the account. Everything cascades: profile, card, cues, meanings, links, notes, searches, feedback, the family's events, and consent records.

   ```sql
   delete from auth.users where email = 'parent@example.com';
   ```

4. Check nothing is left:

   ```sql
   select count(*) from auth.users where email = 'parent@example.com';                        -- should be 0
   select count(*) from public.profiles p left join auth.users u on u.id = p.owner_id where u.id is null; -- should be 0
   ```

5. Reply to confirm it's done. Their invite code stays marked as used.

Supabase's own daily backups (Pro plan only) can keep a copy for up to 7 days before it ages out. Mention this if they ask.

## 4. Give a team member access to `/team`

1. In the SQL Editor:

   ```sql
   insert into public.team_members (email) values ('teammate@example.com');
   ```

2. Give them a sign-in account: Supabase → **Authentication → Users → Invite user** → their email. They don't need an invite code.
3. They sign in at https://porto-app.com/signin, then go to https://porto-app.com/team.

`/team` shows totals only. It never shows children's names, cues, searches, notes or emails. To remove someone: `delete from public.team_members where email = 'teammate@example.com';`

## 5. Check how the trial is going

Open https://porto-app.com/team. **Download totals (CSV)** saves the same numbers for a spreadsheet. The questions it answers:

- Do families finish setup, and in about 15 minutes? (Funnel, and the median minutes.)
- Do workers open links and search? (Funnel, and searches per opened link.)
- Is search finding things? (Searches with no match.)
- Do workers log notes, and do families add them? (Notes logged, and notes added.)

Learn the *details* (what was searched, what notes said) by interviewing families who agree to talk. The database deliberately doesn't show them to the team.

## 6. When something goes wrong

| Symptom | Likely cause | What to do |
| --- | --- | --- |
| Whole site shows errors, or "Something went wrong" everywhere | Supabase free project paused after 7 days of no activity | Supabase dashboard → the project → **Restore**. Consider the Pro plan during the trial. |
| No sign-in email arrives | Email limits, or Resend problem | Check spam. Resend → **Logs** shows each send. Supabase → Authentication → Rate Limits (keep emails per hour at 30 or more). |
| "This sign-in link has closed" | Link already used, or older than an hour | Ask for a new link and use the newest email only. |
| Sign-in link opens the wrong site | Supabase URL settings | Authentication → URL Configuration: Site URL `https://porto-app.com`, Redirect URL `https://porto-app.com/auth/callback`. |
| A new deploy broke something | Code change | Netlify → **Deploys** → pick the last good deploy → **Publish deploy**. That's instant, and the code is untouched. |
| The padlock or certificate fails | DNS or certificate | Netlify → Domain management → HTTPS → **Verify DNS configuration**. Cloudflare records for `@` and `www` must be **DNS only** (grey cloud). |

## 7. Making changes

- **Wording and look:** edit, check at `http://localhost:5173` (`npm run dev`), run `npm run check`, then `git push`. Netlify publishes in about a minute.
- **Database changes** (new files in `supabase/migrations/`): run `npm run db:push` **before** pushing the code that needs them. They affect real data at once.
- **Consent text changes:** bump `CONSENT_VERSION` in `src/lib/consent.ts` and add a migration that changes `public.consent_version()` to match. Everyone is asked to agree again on their next visit.
- **Full test run before a big change:** `npm run check` (lints, types, 228 unit and database tests) and `npm run test:e2e` (19 browser tests against a local stand-in for Supabase).

## 8. Keys and secrets

| Thing | Secret? | Notes |
| --- | --- | --- |
| Supabase URL and **anon** key | No | In Netlify environment variables and `.env.local`. Safe in the browser: the database rules decide what it can do. |
| Supabase **service-role** key | **Yes** | Bypasses every privacy rule. Never put it in the app, Netlify, chat or email. |
| Supabase database password | Yes | Password manager only. |
| Resend API key | Yes | Lives only in Supabase's SMTP settings. Rotate it in Resend if it's ever exposed. |
| Invite codes | Keep private | Anyone with an unused code can create a profile. |

## 9. Before the trial starts (checklist)

- [ ] Supabase region shows **Sydney (ap-southeast-2)** (Project Settings → General).
- [ ] Email templates (Magic Link, Confirm signup) reworded in Porto's voice.
- [ ] `VITE_PRIVACY_CONTACT_EMAIL` set in Netlify, then redeployed.
- [ ] Consent and privacy wording reviewed by someone who knows the Australian Privacy Principles.
- [ ] Netlify's injected "HUD" script (`/.netlify/scripts/hud`) turned off, if Netlify allows it on your plan. See DECISIONS.md.
- [ ] Decide on the Supabase **Pro** plan for the trial weeks (no pausing, daily backups).
- [ ] Try the full flow once on your own phone: sign up → setup → share → open the link on another phone → log a note → add it from the inbox.
