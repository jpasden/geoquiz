# GeoQuiz — Claude Code Instructions

## Git Workflow
At the end of every session, before stopping:
1. Run `npm run build` to update the dist/ folder
2. Run `git add -A`
3. Run `git commit -m "Session: <brief summary of what changed>"`
4. Run `git push origin main`

Always do this unless I explicitly say "don't push" or "don't build."

## Build Info
- Framework: React + Vite + TypeScript
- Build command: `npm run build`
- Output directory: `dist/`
- The dist/ folder is committed to the repo and used for deployment on Opalstack

## Test
- Run `npm test` to run the test suite (vitest)
