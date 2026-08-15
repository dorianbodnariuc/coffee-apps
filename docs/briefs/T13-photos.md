# T13 — Photo attachments

Goal: 1–3 photos per brew log via Supabase Storage, cascade-deleted with the log.

## Context
- `PHOTO_CAPS` already in `src/constants/index.ts` (maxPerLog 3, maxBytes 5 MB).
- RLS pattern: owner-only. Supabase Storage RLS lives on `storage.objects`
  (bucket-level policies) and `storage.buckets`.
- Photos are private (owner-only) — not public.

## Task 1 — Storage bucket + table
```sql
insert into storage.buckets (id, name, public) values ('brew-photos', 'brew-photos', false);

create table public.brew_photos (
  id           uuid primary key default gen_random_uuid(),
  brew_log_id  uuid not null references public.brew_logs (id) on delete cascade,
  storage_path text not null,
  created_at   timestamptz not null default now()
);
-- RLS: owner-only via join to brew_logs.user_id
```
Storage object policies: owner-only read/write/delete (path prefix
`{user_id}/{brew_log_id}/...`). Deleting a log cascades `brew_photos` rows; also
delete the objects from Storage in the delete flow (no orphans).

## Task 2 — Upload + UI
- Camera-roll picker in the log form (`expo-image-picker`); upload on save;
  thumbnails in the log detail.
- 1–3 photos, 5 MB cap; delete individual photos.

## Acceptance criteria
- Upload works in Expo Go (Android + iOS); photos appear on log detail.
- RLS: user B cannot read user A's photos.
- Deleting a log removes its Storage objects (no orphans).

## Verification
`npm run typecheck && npm run lint && npm test`; on-device upload + delete.
