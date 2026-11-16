# Future Robot Adventure

> **Learn to Code. Explore the Future.**  
> **เรียนรู้การเขียนโค้ด ผจญภัยสู่โลกอนาคต**

A real-time, bilingual (Thai & English) 2D visual block-coding educational game built for a college Open House event supporting **50–100 concurrent players**.

## Architecture

- **Player (`/play`)**: Anonymous student registration (display name & school), interactive lessons with live command demos, world/level progression, bilingual Google Blockly editor (`Command[]` JSON — no `eval()`), authoritative server compilation, Phaser 3 2D robot animations, server-authoritative timer, scoring, and atomic reward claims.
- **Dashboard (`/dashboard`)**: TV/projector display with lightweight animated SVG robots (no Phaser instances), 3 display modes (**Robot Grid**, **Planet Map**, **Spotlight**), real-time updates via Supabase Broadcast & Presence, sequence-ordered event deduplication, and automatic reconnect snapshot recovery.
- **Admin (`/admin`)**: Supabase Auth protected control panel with 18 modules covering settings, branding, robot/sprite manager, scene manager, visual grid level editor with live solvability testing, block manager, lesson editor, hint manager, scoring rules, timer settings, reward inventory & claim desk, player manager with CSV export, dashboard editor, live i18n overrides, session lifecycle, system health, and audit logs.
- **Shared Engine (`supabase/functions/_shared/engine`)**: Pure TypeScript validator, deterministic interpreter, scorer, and snapshot builder shared identically by the browser and Supabase Edge Functions.

## Required Environment Variables

### Frontend (`.env` locally & Cloudflare Pages environment variables)

| Variable | Description |
| --- | --- |
| `VITE_SUPABASE_URL` | Your Supabase project URL (`https://<ref>.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase public `anon` key |

### Supabase Edge Functions (auto-injected by Supabase, optional custom secrets)

| Variable | Description |
| --- | --- |
| `SUPABASE_URL` | Auto-injected by Supabase |
| `SUPABASE_ANON_KEY` | Auto-injected by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected by Supabase (**never expose in frontend**) |
| `ALLOWED_ORIGINS` | Optional comma-separated CORS allow-list (e.g. `https://your-site.pages.dev`) |

## External Setup (Supabase & Cloudflare)

1. **Create a Supabase Project**
   - Free tier works for local development and small tests. Upgrade to **Supabase Pro** for a 50–100 concurrent player event (higher Realtime connection & message quotas).
2. **Enable Anonymous Sign-ins**
   - In Supabase Dashboard → **Authentication → Providers → Anonymous Sign-Ins**, toggle **Enable**.
3. **Apply Database Migrations & Seed Data**
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   # Run supabase/seed.sql once against the empty database (via SQL Editor or psql)
   ```
4. **Create an Admin User**
   - Create a user in **Authentication → Users → Add user** (email + password).
   - Grant admin access in the **SQL Editor**:
     ```sql
     insert into public.admins (user_id, email, role)
     select id, email, 'SUPER_ADMIN'
     from auth.users
     where email = 'admin@yourcollege.ac.th';
     ```
5. **Deploy Edge Functions**
   ```bash
   npx supabase functions deploy register-player --no-verify-jwt=false
   npx supabase functions deploy player-action --no-verify-jwt=false
   npx supabase functions deploy submit-solution --no-verify-jwt=false
   npx supabase functions deploy claim-reward --no-verify-jwt=false
   npx supabase functions deploy publish-config --no-verify-jwt=false
   npx supabase functions deploy admin-action --no-verify-jwt=false
   ```
   *(All functions verify caller JWTs internally with `requireUser`/`requireAdmin`.)*
6. **Deploy to Cloudflare Pages**
   - Push this repository to GitHub.
   - Connect the repository in **Cloudflare Pages** with:
     - Build command: `npm run build`
     - Build output directory: `dist`
     - Environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   - Add your `https://<project>.pages.dev` URL to Supabase **Authentication → URL Configuration → Site URL / Redirect URLs**.

## Local Development

```bash
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite development server |
| `npm run build` | Type-check (`tsc -b`) and create production bundle in `dist/` |
| `npm run lint` | Run ESLint across the codebase |
| `npm run format` | Format with Prettier |
| `npm test` | Run Vitest unit & integration tests (engine, i18n, 100-player dashboard, PGlite SQL) |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run seed:generate` | Regenerate `supabase/seed.sql` from `supabase/seed/content.ts` & `sample-levels.ts` |
