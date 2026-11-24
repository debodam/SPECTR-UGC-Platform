# Deploying SPECTR to Vercel

Plain steps, in order. Everything here was checked locally against a production build of `ui/rework`. Nothing has been pushed or deployed.

## 1. Environment variables

| Name | Public or secret | What it is | Where to find it |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Public (in the browser bundle) | Your Supabase project URL | Supabase dashboard > Project Settings > API > Project URL |
| `VITE_SUPABASE_ANON_KEY` | Public (in the browser bundle) | The anon, public key. Row level security protects the data | Same page, "anon public" key |
| `ANTHROPIC_API_KEY` | **Secret**, server only | Pays for Claude calls (plans, Transform, insight wording) | console.anthropic.com > Settings > API Keys |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret**, server only | Only used to delete an account from Settings | Supabase > Project Settings > API > "service_role" key |
| `SUPABASE_URL` | Server only, optional | Same as the project URL. Defaults to `VITE_SUPABASE_URL` | Same as the first row |

Notes:
- **Gone:** `DEMO_LIVE_GENERATION` is no longer used. Delete it from Vercel if it is there.
- **Checked:** no secret appears in the browser bundle. A production build was searched for `ANTHROPIC`, `sk-ant-` and `service_role`, and nothing turned up. The only key in the bundle is the anon key.

Ready to paste as `.env` (the same file is in the repo as `.env.example`):

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-public-key
ANTHROPIC_API_KEY=your-anthropic-api-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_URL=https://your-project-ref.supabase.co
```

## 2. Supabase

1. **Run the SQL.** Open SQL Editor > New query, paste all of `design/RUN-IN-SUPABASE.sql` and run it.
   - It covers migrations 002 to 011 and is safe to run again. Run it even if you think it already ran: the first version failed on `queue_items`.
   - Migration 001 (profiles and the signup trigger) is left out on purpose, because your project already has signups working.
2. **Confirm the tables exist.** Run this query:
   ```sql
   select table_name from information_schema.tables
   where table_schema = 'public' order by table_name;
   ```
   You should see:
   - `companies`, `experiments`, `generations`, `growth_plans`, `insights`
   - `perf_entries`, `plays`, `profiles`, `queue_items`, `saved_contexts`
   - `transcripts`, `workspaces`
3. **Double check row level security** (Authentication > Policies). Every table above should show RLS enabled, with an owner-only policy.
   - **`companies`:** this table was not created by the repo's migrations, so check its policies by hand. Users must only see companies they created.
   - **Logo storage bucket:** check its policies too. Uploads should be limited to the signed-in user.
4. **The access code.** There is no access code table. The code lives in `src/routes/access.tsx` and is checked in the browser, so anyone who reads the bundle can find it. It is a soft gate, not security. Real security is the Supabase sign-in plus RLS. Moving the check server side is still an open decision (see `design/audit-report.md`).
5. **Auth URLs.** Go to Authentication > URL Configuration.
   - Set **Site URL** to `https://tryspectr.online`.
   - Add `https://tryspectr.online/**` and your `*.vercel.app` preview URL under Redirect URLs, so sign-up emails link to the right place.

## 3. Vercel

The repo already has `vercel.json` and `scripts/build-vercel.mjs`. The build creates Vercel's Build Output: the static files plus one Node function that runs the server.

1. **Import the project.** At vercel.com, choose Add New > Project, then import the GitHub repo.
2. **Framework preset:** choose **Other**. Leave the build settings at their defaults; `vercel.json` already sets them:
   - Build Command: `node scripts/build-vercel.mjs`
   - Output Directory: `.vercel/output`
   - Install Command: `npm install` (the default)
3. **Node.js version:** go to Project Settings > General and choose **22.x**. The server function runs on Node 22 (Vercel has retired Node 20).
4. **Environment variables:** go to Project Settings > Environment Variables. Add the five variables from section 1 for **Production** and **Preview**. Mark `ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` as Sensitive.
5. **Production branch:** go to Project Settings > Git and set Production Branch to **`main`**.
6. **Redeploy:** go to Deployments, open the latest one, then choose ... > Redeploy, so the new variables apply.
7. **Custom domain `tryspectr.online`:**
   1. In Project Settings > Domains, add `tryspectr.online` and `www.tryspectr.online`. Let Vercel redirect `www` to the bare domain.
   2. At your domain registrar, add the DNS records Vercel shows on that page. Usually that's:
      - an `A` record for `@` pointing to `76.76.21.21`
      - a `CNAME` for `www` pointing to `cname.vercel-dns.com`
   3. Wait until Vercel shows both domains as Valid. HTTPS is issued automatically.

Health check: `https://tryspectr.online/api/health` returns `{"ok":true,...}`.

## 4. Smoke test after deploy

- [ ] **Landing page:** `https://tryspectr.online/welcome` fits the screen with no scrollbar on a laptop. The screenshot carousel rotates.
- [ ] **Demo, start to finish:** **Try the demo** opens the guided tour.
  - [ ] Walk it to the end. The sample recording plays with sound and its transcript keeps up.
  - [ ] Stop moves you on to Transform.
  - [ ] The closing card's "See what else I've built" opens `https://debodam.com`, and the banner says "Built by Debojeet Dam".
- [ ] **Open app:** **Open app** asks for the access code.
- [ ] **Real use:** sign in with a real account and do one real Transform generation. It should return real text, not a sample.
- [ ] **Zero tokens from `/demo`:** after a full demo run, check console.anthropic.com > Usage. Only your real generation should appear.
  - Why it can't spend: the browser blocks every AI and Supabase request in demo mode, and the server refuses any request marked as demo.
- [ ] **Health:** `https://tryspectr.online/api/health` returns ok.
- [ ] **Tables:** Supabase > Table Editor shows rows for your real account only.

## 5. Ship it

Run these yourself. I did not push or merge anything.

`main` is already fully contained in `ui/rework` (checked after `git fetch` on 2026-11-24), so this is a clean fast-forward with no conflicts.

```bash
git push -u origin ui/rework
```

```bash
gh pr create --base main --head ui/rework --title "UI rework, growth engine, guided demo, landing page" --body "Full redesign, growth engine, posting queue, results, guided demo (Fastbreak AI) with zero token spend, one screen landing page, smoothed animations, Vercel readiness. See design/MORNING-REPORT.md and design/DEPLOY.md."
```

Wait for the CI checks on the pull request (typecheck, lint, build, e2e) to pass, then merge:

```bash
gh pr merge --merge
```

What Vercel does next:
- **The pull request:** while it is open, Vercel builds a Preview deployment and comments its URL on the PR. Use that for the smoke test before merging if you like.
- **The merge:** merging into `main` triggers a Production deployment. When it finishes, `tryspectr.online` serves the new version.
- **Rolling back:** if anything is wrong, open Deployments, pick the previous production deployment, and choose ... > Promote to Production.
