# 10: Push ui/rework, then merge into main and push main

I (Debo) explicitly authorize every git action in this file, including pushing `ui/rework` and `main`. Do it all without asking me anything, but stop and report if any safety check below fails. No em dashes in commit messages or output.

1. `git status`. There are uncommitted changes: `src/lib/delete-account-fn.ts`, `src/lib/server-auth.ts`, and untracked `design/` files (DESIGN.md, PROMPTS.md, START.md, demo-seed, growth-plan-notes.md, prompts, screens, source).
   - Look at the diff of the two `src/lib` files. If they are clearly intentional and safe (auth or delete-account fixes), commit them in their own commit with an accurate message. If they look accidental, half done, or they weaken any security check, do NOT commit them: stash them with `git stash push -m "pre-merge review" -- src/lib/delete-account-fn.ts src/lib/server-auth.ts` and tell me what was in them.
   - Commit all the `design/` files in one commit ("Add design handoff, prompts and demo seed"). Make sure `.env*`, keys, `node_modules` and large junk are not included. Check `git status` shows nothing else untracked that should not ship.
2. Run typecheck, lint, `npm run build` and `npm run e2e:demo` (and `npm run e2e` if it runs here). All must pass. If anything fails, fix it if it is small, otherwise stop and tell me exactly what failed.
3. `git push origin ui/rework` (set upstream if needed).
4. `git fetch origin`. Then `git checkout main && git pull --ff-only origin main`.
5. Merge: `git merge --no-ff ui/rework -m "Merge ui/rework: blue glass redesign, growth engine, guided demo, one screen landing"`. If there are conflicts, resolve them carefully keeping the ui/rework behavior, then re-run typecheck, build and `npm run e2e:demo`. Never use `-X theirs` or `-X ours` blindly and never force push.
6. Run `npm run build` once more on main. If it passes, `git push origin main`. This triggers the Vercel deploy.
7. Switch back to `ui/rework` (`git checkout ui/rework`) and `git stash list` to make sure nothing was left behind unexpectedly.
8. Report in 5 lines or fewer: commit hashes pushed, whether main and origin/main now match (`git rev-parse main origin/main`), whether anything was stashed, and the first thing to check on Vercel. Append the same to `design/MORNING-REPORT.md` under "10 push and merge" and commit it to `ui/rework`.
