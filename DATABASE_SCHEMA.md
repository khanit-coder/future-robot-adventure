# Database Schema — Future Robot Adventure

PostgreSQL schema defined across [supabase/migrations](supabase/migrations):
- `20260101000000_schema.sql` — tables, constraints, indexes, `updated_at` triggers
- `20260101000100_functions.sql` — security helpers, audit triggers, rate limiting, `apply_submission`, `reserve_reward`, `set_claim_status`, `dashboard_snapshot`
- `20260101000150_snapshot_version.sql` — locks `published_configs.snapshot.version` to its identity `version`
- `20260101000200_rls.sql` — RLS policies, privilege revocations, `game-assets` storage bucket, realtime publication

## Entity Overview

```
game_sessions 1──* players 1──1 player_sessions *──1 published_configs(version)
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          ▼                         ▼                         ▼
player_level_progress         lesson_progress          score_records
          │                                            reward_claims *──1 rewards
          ▼
     submissions

worlds 1──* levels 1──1 missions
               ├──* level_translations (th, en)
               └──* hints
lessons 1──* lesson_translations (th, en)
```

## Tables

| Table | Purpose | Key Constraints & Indexes |
| --- | --- | --- |
| `admins` | Authorized administrators linked to `auth.users` | `user_id` unique; `role` (`SUPER_ADMIN`, `ADMIN`) |
| `game_settings` | Singleton branding, language, maintenance, timer, scoring, and reward toggles | `singleton` unique `CHECK (singleton)`; hex color checks |
| `dashboard_settings` | Singleton TV/projector layout, display mode (`GRID`, `PLANET`, `SPOTLIGHT`), columns, theme | `singleton` unique `CHECK (singleton)` |
| `game_sessions` | Open House event sessions | Partial unique index `game_sessions_one_active` allows only one `ACTIVE` session |
| `robot_assets` | Builtin SVG/canvas robots and uploaded sprite sheets with animation frame ranges | Partial unique index `robot_assets_one_default`; spritesheet dimensions check |
| `scene_assets` | Builtin themes and custom background/parallax scene images | Image URL required when `kind = 'image'` |
| `worlds` | World groupings (`training`, `energy`, `station`, `final`) | Ordered by `position` |
| `levels` | Level metadata, difficulty, max score, unlock rule, asset links, version | `code` unique; `(world_id, position)` index |
| `level_translations` | Localized level title and description (`th`, `en`) | `unique (level_id, lang)` |
| `missions` | Grid map (`map`), `robot_start`, `objectives`, `rules`, `expected_solutions` | `level_id` unique |
| `hints` | Ordered progressive hints per level (`{th, en}`) | `(level_id, position)` index |
| `lessons` | Educational tutorial steps with optional image, video URL, and `demo_program` | Ordered by `position` |
| `lesson_translations` | Localized lesson title, summary, and markdown-lite body (`th`, `en`) | `unique (lesson_id, lang)` |
| `block_definitions` | Safe whitelist of the 11 predefined command blocks, labels, colors, and parameter limits | `command_type` unique |
| `i18n_overrides` | Admin-editable UI translation overrides merged into `i18next` | `unique (lang, namespace, key)` |
| `published_configs` | Immutable versioned snapshots frozen at Publish time | `version` `GENERATED ALWAYS AS IDENTITY UNIQUE` |
| `players` | Student registration (`display_name`, `school`, `grade`, `lang`) | `unique (game_session_id, auth_user_id)` stops duplicate registrations |
| `player_sessions` | Authoritative status, pinned `config_version`, `started_at`, `expires_at`, score & counters | `(game_session_id, total_score desc, finished_at)` rank index |
| `player_level_progress` | Per-level attempts, failed attempts, hints used, completion time, score | `unique (player_session_id, level_id)` |
| `submissions` | Every program submitted to `submit-solution` | `unique (player_session_id, client_submission_id)` guarantees idempotency |
| `lesson_progress` | Completed lesson tracking per player session | `unique (player_session_id, lesson_id)` |
| `score_records` | Immutable score ledger (`MISSION` or admin `ADJUSTMENT`) | Partial unique `score_records_one_mission` prevents double scoring a level |
| `rewards` | Reward catalog, eligibility `min_score`, and stock counters | `CHECK (reserved_count + claimed_count <= stock_total)` prevents negative stock |
| `reward_claims` | Player reward reservations & handed-out claims with `claim_code` | Partial unique `reward_claims_one_per_player` limits 1 active reward per player |
| `game_events` | Ordered realtime event log with global `seq` identity column | `(game_session_id, seq desc)` index |
| `audit_logs` | Admin edit and action trail | `(created_at desc)` index |
| `rate_limits` | Server-side fixed-window rate-limiting buckets (no client access) | `key` primary key |

## Security & Transactional RPCs

- **Row Level Security** is enabled on every table. Players sign in anonymously via Supabase Auth (`auth.uid()`), can only read public live configuration and their own session/progress rows, and have all direct DML (`INSERT`/`UPDATE`/`DELETE`) revoked on gameplay, score, event, and published tables.
- **`apply_submission(...)`**: Locks `player_sessions` and `player_level_progress`, checks idempotency (`client_submission_id`), verifies server clock (`now() <= expires_at`), records attempts, awards mission score once, adds optional bonus time, and marks `FINISHED` when all levels are solved.
- **`reserve_reward(...)`**: Locks the target `rewards` row, verifies eligibility (`FINISHED` or `TIME_EXPIRED`, `total_score >= min_score`, `reserved_count + claimed_count < stock_total`), enforces one active claim per player, generates a 6-character `claim_code`, and increments `reserved_count`.
- **`set_claim_status(...)`**: Admin-only RPC transitioning claims between `RESERVED`, `CLAIMED`, and `CANCELLED` while updating `reserved_count` and `claimed_count` atomically.
- **`dashboard_snapshot(p_session_id)`**: `SECURITY DEFINER` RPC returning only public display fields (`display_name`, `school`, `status`, `score`, `levels_completed`, recent events) so TV dashboards never query private tables directly.
