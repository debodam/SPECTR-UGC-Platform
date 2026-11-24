# Prompts for Claude Code (paste one at a time)

## 1. Plan only
Read /design/DESIGN.md. Look at every PNG in /design/screens and the HTML in /design/source. Do not change any code yet. Tell me your plan: where tokens, the global font rule, the glass card, rail, header, buttons and status pills will live, and which existing files you will touch. UI only, no changes to routes, data or functionality.

## 2. Foundation
Implement only the design tokens, the global font rule and the shared components (page background, glass card, rail, header, buttons, inputs, tabs, status pills). Replace the old dark theme variables and the Inter and Archivo font settings in src/styles.css. Build a temporary /design-test route that shows every component. Screenshot it for me.

## 3. One screen at a time (repeat per screen)
Restyle [SCREEN] to match /design/screens/[FILE].png and /design/source/[FILE].dc.html exactly. Include all its states (empty, loading, error, steps). Keep all existing logic untouched. Run the app, screenshot each state, and show it next to the design PNG. Stop and wait for my OK.
Order: login, workspaces, setup, dashboard, record, transform, track, distribute, settings, access, landing.

## 4. Proposed items
Build these proposed items: [list]. Skip these: [list].

## 5. Final audit
Search the whole codebase for any font-family outside the global rule, any button, input, select or textarea that does not inherit it, any black active state, and any large white surface. Fix them and report what you changed.
