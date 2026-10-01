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

## Project files

The Vite app, Supabase client, hooks, migrations, and config are in this repo.
Build with `npm install` and `npm run build`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel (see `.env.example`). Do not commit `.env`.

The live site is deployed on Vercel (project `the-take-over-tickets`).

## Never commit secrets

`.env` is in `.gitignore`. Keep Supabase and Resend keys in Vercel / Supabase environment settings.
