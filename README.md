# TapIN Organizer

A web app for creating and managing TapIN2Events events — built with React, TypeScript, Tailwind, and Supabase (Postgres + Auth + Storage).

This is **Phase 1** of the TapIN2Events rebuild, focused on **organizer tools**: sign in, create/edit events, manage tasks, invite collaborators, and review vendor applications. It talks directly to your live `TapIN2Events` Supabase project.

## Quick start

```bash
npm install
npm run dev
```

The app opens at `http://localhost:5173`. Your Supabase URL and public (anon) key are already filled in in `.env` — the anon key is safe to expose in client code; every table is protected by Row Level Security, so people can only read/write rows they're allowed to.

Sign up with any email/password to create your organizer account (a `profiles` row is created automatically). Then create an event, add tasks, invite a collaborator by email, and try publishing it.

## What's included

- **Auth** — email/password sign up & sign in via Supabase Auth
- **Dashboard** — your events as "ticket stub" cards, grouped by date
- **Create/Edit event** — title, description, category, dates, venue, pricing, capacity, poster image upload, draft/publish toggle
- **Event detail**, with tabs:
  - **Overview** — tickets sold, revenue, key details
  - **Tasks** — assign to-dos to your team, track status
  - **Team** — invite collaborators by email with a role (admin/editor/viewer)
  - **Vendor applications** — approve/reject vendors who've applied to sell at your event

## Database

The full schema (13 tables covering events, tickets, orders, products, donations, tasks, collaborations, vendor applications, and notifications) already lives in your Supabase project (`TapIN2Events`, ref `ylliuomglomfasbpvplt`) with Row Level Security policies matching the access rules from your original Base44 app.

Tables not yet used by this app (but already created, ready for the next phase): `tickets`, `orders`, `event_products`, `donations`, `notifications` — the Overview tab already reads from `tickets` and `orders`.

## Deploying

This is a standard Vite app — `npm run build` produces a static `dist/` folder that works on any static host (Vercel, Netlify, Cloudflare Pages, etc.). Set the same two environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in your host's dashboard.

## Migrating your Base44 data

Your live Base44 app still has all your real events, users, tickets, and orders. That data hasn't been touched — this new Supabase database is currently empty except for whatever you create through this app. Migrating the live data over is the next step; let's tackle it once you're happy with this organizer flow.

## What's next (not built yet)

- Public event discovery / browsing (the attendee-facing side)
- Ticket purchase & checkout (Stripe)
- Social feed (video posts, likes, comments, follows)
- Vendor/resource marketplace and booking flow
- Messaging & notifications UI
- Data migration from Base44
