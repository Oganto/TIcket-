# THE TAKE OVER — EKSU ticketing

Ticketing site for **THE TAKE OVER**, November 20, Club Luna (opposite EKSU Field).
React + TypeScript + Vite, Supabase (auth, database, storage, email function), deployed on Vercel.

Flow: landing → passes → bank-transfer payment → proof upload → admin approval → QR ticket by email.

## What is in this repo right now

- `src/pages/*` — all pages (Home, Tickets, Payment, Ticket, Auth, Dashboard redesigned; Admin, Verify unchanged)
- `src/components/*` — new 3D flyer card, pass cards, countdown
- `src/styles/redesign.css` — the new design system (all classes prefixed `to-`)
- `src/App.tsx`, `src/data/event.ts`
- `supabase/functions/send-ticket-email/index.ts` — emails the QR ticket after approval

## Not in this repo yet (so it will not build on its own)

`package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `vercel.json`,
`.env.example`, `src/main.tsx`, `src/index.css`, `src/vite-env.d.ts`, `src/lib/supabase.ts`,
`src/hooks/useTicketCatalog.ts`, `src/hooks/usePublicEvent.ts`,
`src/components/SiteHeader.tsx`, `ScrollProgress.tsx`, `EventCountdown.tsx`, and `supabase/migrations/*.sql`.

The live site is currently deployed straight to Vercel (project `the-take-over-tickets`).

## Never commit secrets

`.env` is in `.gitignore`. Keep Supabase and Resend keys in Vercel / Supabase environment settings.
