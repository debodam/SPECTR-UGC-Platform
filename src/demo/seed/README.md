# Fastbreak AI demo seed data

A complete fictional company for the SPECTR demo. Everything is invented. It typechecks with the repo's tsc (strict).

Company: Fastbreak AI, an AI coach that builds personalized weekly training programs for basketball and team athletes. Demo user: Marcus Bell, co-founder and CEO. Tour example: a coach describing a 6 week basketball training program.

## What is in it

- company.ts: workspace (company, goal, baseline, 12 week targets, audience), a second light workspace, 3 saved contexts
- results.ts: 32 performance entries over 9 weeks (followers 2,140 to 3,123, weekly impressions 4.6k to 12.8k, video scripts average 2.4x posts) and a 16 item Distribute queue (posted, posted awaiting results, due today, upcoming ready, drafts)
- content.ts: 7 recordings with full transcripts, 8 generated pieces (articles, posts, video scripts), guided prompts per play, and the scripted tutorial play with a streamed sample recording, prewritten outputs for all three formats, and a refine example
- growth.ts: Growth plan (north star, 4 pillars, cadence), plan history (3 versions), 13 plays across 3 weeks in every status, 3 experiments (2 concluded, 1 running), 6 insights computed from the data
- recruiter.config.ts: text and link for the closing screen (points to debodam.com). Nothing else to fill in.
- index.ts: buildDemoSeed(now) returns everything with dates relative to today, so the demo never looks stale.

## Consistency rules (do not break)

- Weekly sums of entries match the story: followers gained across entries is 983, so current followers is 3,123 against a 4,000 target.
- Insights read from the same entries, so Results charts and Growth insights always agree.
- The tutorial play is "The 6 week basketball program that added 3.5 inches to a vertical" (status: suggested). Everything for it is prewritten.
- No em dashes anywhere in the copy.
