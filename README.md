# Porto

Know what to do, from the first shift.

Porto is a family-controlled profile app. It helps a new support worker, camp leader or school aide understand a minimally verbal autistic child from day one. This repository is the trial MVP.

## Run it locally

You need Node 20 or newer.

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Then open http://localhost:5173. The styleguide is at `/styleguide`. Without Supabase values, the app still runs, but sign-up shows a "not connected yet" message.

## Checks

```bash
npm run check
```

This runs the copy lint, the colour lint, the type-check and every test. CI runs the same checks plus a production build.

- `npm test` runs the unit tests and the database tests.
- `npm run test:db` runs only the database tests. They apply every migration from scratch to an in-memory Postgres ([PGlite](https://pglite.dev)) with a small stand-in for Supabase's `auth` schema and default grants (`supabase/tests/supabase-shim.sql`). Then they check row-level security, invite codes and cascading deletes. No Docker needed.

## Set up Supabase (once)

1. Create a project at supabase.com. Set the **region to Sydney (ap-southeast-2)**.
2. **Run the migrations.** In the SQL editor, run each file in `supabase/migrations/` in name order. With the Supabase CLI you can run `supabase link` and then `supabase db push` instead.
3. **Set up Auth.** Go to Authentication, then Sign In / Providers:
   - Keep **Email** on and turn on **Confirm email**.
   - Turn off every other provider.
   - Porto never asks for a password. Families only ever get magic links.
4. **Set the URLs.** Go to Authentication, then URL Configuration:
   - Set the **Site URL** to the Netlify URL.
   - Add `https://<your-site>/auth/callback` and `http://localhost:5173/auth/callback` to **Redirect URLs**.
5. **Set the link expiry.** Go to Authentication, then Emails, and set the magic link expiry to 3600 seconds (1 hour). The check-your-email screen says links close after an hour.
6. **Copy the keys.** Copy the project URL and the **anon** key into `.env.local` (and later into Netlify's environment variables). Never use the service-role key in the app.
7. **Update the Content Security Policy.** In `netlify.toml`, replace `PROJECT_REF` in `connect-src` with your project ref.

## Deploy to Netlify

1. In Netlify, choose **Add new site → Import an existing project** and pick `jackiexie25-arch/Porto-MVP`. Netlify reads the build command and headers from `netlify.toml`.
2. Under **Site configuration → Environment variables**, add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_PRIVACY_CONTACT_EMAIL`.
3. Make sure `PROJECT_REF` in `netlify.toml` has been replaced with your Supabase project ref (step 7 above). Otherwise the Content Security Policy blocks every database call.
4. Deploy. Then in Supabase, set the **Site URL** to the Netlify URL and add `https://<your-site>/auth/callback` to **Redirect URLs**.
5. **Check it:**
   - Open `/`, sign up with an invite code, finish setup and share a link.
   - Open the link on a phone. Search for a cue, then close the link from `/share` and refresh the phone.
   - It should show only "This link has closed".

## Add invite codes

```bash
npm run invite-codes -- 10
```

This prints 10 random codes and the SQL to insert them. Paste the SQL into the Supabase SQL editor, then send one code to each family. Codes are never stored in this repo.

## Project rules

See `CLAUDE.md` for the brand, voice and privacy rules, and `DECISIONS.md` for choices and open questions.
