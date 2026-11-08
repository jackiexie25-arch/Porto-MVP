# Porto

Know what to do, from the first shift.

Porto is a family-controlled profile app. It helps a new support worker, camp leader or school aide understand a minimally verbal autistic child from day one. This repository is the trial MVP.

## Run it locally

You need Node 20 or newer.

```bash
npm install
npm run dev
```

Then open http://localhost:5173. The styleguide is at `/styleguide`.

## Checks

```bash
npm run check
```

This runs the copy lint, the colour lint, the type-check and the unit tests. CI runs the same checks plus a production build.

Setup for Supabase, deploys and the trial runbook come in later phases. See `CLAUDE.md` for project rules and `DECISIONS.md` for open questions.
