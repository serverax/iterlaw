# IterLaw UI Build — Complete

**Date:** 2026-05-18  
**Branch:** `feature/iterlaw-ui-build`  
**Status:** Web UI complete (verified build); React Native screens partial (existing `apps/mobile`)

## Screens (web)

| Route | Screen |
|-------|--------|
| `/` | Landing — hero, trust row, features, pricing, footer |
| `/dashboard` | Case dashboard with stats and quick actions |
| `/dashboard/timeline` | Vertical case timeline |
| `/dashboard/documents` | Document upload + OCR stub |
| `/answer` | Law / Meaning / Action + soft paywall |
| `/next-step` | Stage-based guidance |
| `/case/start` | Situation picker + jurisdiction intake |
| `/case/assessment` | Anonymous narrative (existing) |
| `/auth/login` | Login + social stubs + pilot link |
| `/auth/register` | Register stub |

## Components

- `components/ui/` — Button, Card, Badge, Input (textarea mode), Textarea
- `components/answer/AnswerCard.tsx`
- `components/paywall/PaywallSheet.tsx`, `PlanSelector.tsx`
- `components/nav/Header.tsx`, `MobileNav.tsx`
- `components/case/NextSteps.tsx`
- `components/layout/Container.tsx`

## Design system

- Tokens in `apps/web/tailwind.config.ts` + root `tailwind.config.js`
- Fonts: Fraunces, DM Sans, JetBrains Mono (`app/layout.tsx`)
- Globals: scrollbar, typography (`app/globals.css`)

## Verification (2026-05-18)

| Check | Result |
|-------|--------|
| `npm run typecheck` (apps/web) | 0 errors |
| `npm run build` (apps/web) | 26 routes, exit 0 |
| ESLint | 1 warning (`lib/analytics` no-console) |

```bash
cd apps/web && npm run typecheck
cd apps/web && npm run build
```

## Not in scope (this pass)

- Merge to `master` (requires explicit approval + green CI)
- Full React Native screen parity (6 mobile screens in spec)
- Storybook
- Live `/api/case/current` and `/api/case/timeline` backends

## Next

1. Wire dashboard to real case APIs  
2. Connect Stripe checkout on paywall  
3. Extend `apps/mobile` with NativeWind tokens matching web  
