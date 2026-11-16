# Future Robot Adventure — Implementation Plan

> Learn to Code. Explore the Future. / เรียนรู้การเขียนโค้ด ผจญภัยสู่โลกอนาคต

## 1. Architecture summary

```
 Browser (React + Vite + Tailwind)                 Supabase
 ┌───────────────────────────────┐        ┌───────────────────────────────────┐
 │ /play       Player            │        │ Postgres (RLS, RPCs, triggers)    │
 │ /dashboard  TV / projector    │◄──────►│ Auth (anonymous players, admins)  │
 │ /admin      Admin panel       │  REST  │ Realtime (Broadcast + Presence)   │
 │                               │        │ Storage (game-assets bucket)      │
 │ Blockly ─► JSON program       │        │ Edge Functions (Deno)             │
 │ Phaser  ◄─ execution trace    │        │   register-player  player-action  │
 └───────────────────────────────┘        │   submit-solution  claim-reward   │
            ▲                              │   publish-config   admin-action   │
            │ shared pure TypeScript       └───────────────────────────────────┘
            ▼
   supabase/functions/_shared/engine   (interpreter, validator, scoring)
   — the SAME code runs in the browser (for preview/typing) and on the server (authoritative).
```

### Key design decisions

| Concern | Decision |
| --- | --- |
| Player identity | Supabase **anonymous sign-in** gives each player a real `auth.uid()`, so RLS can isolate students without e-mail/password. A `players` row (own UUID) is created by the `register-player` Edge Function. |
| Admin identity | Supabase Auth e-mail + password. Authorization = row in `admins` (checked by `is_admin()` in RLS and by Edge Functions). |
| Program format | Blockly workspace → **structured JSON** (`{type, steps/times/body}`) → validated → deterministic grid interpreter. No `eval`, no generated JS. |
| Authoritative verification | `submit-solution` re-validates the program, re-runs the interpreter against the mission of the player's **pinned config version**, computes the score, writes it in one SQL transaction (`apply_submission`), then returns the execution trace. Phaser only plays the trace the server returned. |
| Success checks | Game-state/objective based (reach goal, collect all crystals, activate generators, rescue friends, celebrate…). Many programs can solve a level. |
| Time | `player_sessions.started_at / expires_at` are set by Postgres `now()`. Clients receive `server_now` and compute an offset. Expired sessions reject submissions (`TIME_EXPIRED`). |
| Versioned config | Draft = normal admin tables. **Publish** snapshots gameplay config into `published_configs(version, snapshot)`. Players pin `config_version` at registration. Global settings (branding, dashboard look, announcements) apply live. |
| Realtime | One channel `fra:live` (Broadcast for events, Presence for online players). Events carry `event_id`, `sequence_number` (DB identity), `session_id`, `player_id`, `timestamp`, `payload`. Dashboard dedupes by `event_id`, orders by sequence, and refetches `dashboard_snapshot()` after reconnects. |
| Dashboard privacy | Public dashboard reads only through the `dashboard_snapshot()` security-definer RPC (display name, school, status, score, progress). |
| i18n | `i18next` with static JSON dictionaries + DB overrides (`i18n_overrides`) editable in Admin. Content tables use translation rows (`level_translations`, `lesson_translations`) or `{th,en}` JSON for short strings, with fallback to the default language. |
| Dashboard performance | Lightweight CSS/SVG robots (no Phaser), paginated/auto-rotating grid, memoized cards, throttled snapshot refresh. |

## 2. Required environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Frontend (`.env`, Cloudflare Pages) | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Public anon key |
| `SUPABASE_URL` | Edge Functions (auto-injected) | |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions (auto-injected, **never in frontend**) | Server-side writes |
| `SUPABASE_ANON_KEY` | Edge Functions (auto-injected) | Verify caller JWT |
| `ALLOWED_ORIGINS` | Edge Function secret (optional) | CORS allow-list |

## 3. External setup that needs the owner's credentials

1. Create a Supabase project (free tier is fine for development; use **Pro** for 100 concurrent realtime users at an event).
2. Enable **Anonymous sign-ins** (Authentication → Providers → Anonymous).
3. Run migrations (`supabase db push`) and the seed (`supabase/seed.sql`).
4. Create at least one admin user in Supabase Auth and insert it in `admins` (see README).
5. Deploy Edge Functions (`supabase functions deploy`).
6. Create a GitHub repository and connect it to Cloudflare Pages; set the two `VITE_*` variables.
7. Add the Cloudflare Pages domain to Supabase Auth → URL configuration.

## 4. Phases

| Phase | Scope | Verification |
| --- | --- | --- |
| 1 Foundation | Vite/React/TS strict, Tailwind v4, shadcn-style UI kit, router, Supabase client, migrations, seed, design system, i18n skeleton | `npm run build`, `npm run lint` |
| 2 Player | Registration, language switch, lessons, level map, Blockly, command validation, shared interpreter, Phaser scene + robot rig, timer, scoring, refresh recovery | Vitest unit tests (interpreter/scoring/validators), build |
| 3 Dashboard | Presence, broadcast events, robot grid / planet map / spotlight, leaderboard, achievements, reconnect + snapshot | 100-player render test |
| 4 Admin | Auth gate, all 18 modules (settings, branding, robots, scenes, levels w/ visual grid editor, blocks, lessons, hints, score, timer, rewards, players + CSV, dashboard editor, languages, sessions, system, audit) | Build, component tests |
| 5 Integration | Publish pipeline with solvability check, config broadcast, version pinning, atomic reward reservation, session management, recovery | SQL tests (PGlite), unit tests |
| 6 QA | Vitest + RTL, PGlite SQL tests (constraints, inventory race), Playwright e2e (Supabase network stubbed), production build | `npm test`, `npm run build` |

## 5. Definition of done per feature

A feature is done when: it is reachable from the UI, persisted via the real Supabase layer, translated in Thai and English, handles loading/error states, and (where logic-heavy) is covered by a test.
