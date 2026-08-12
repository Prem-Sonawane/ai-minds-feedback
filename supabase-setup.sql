-- ============================================================
-- AI Minds — Feedback table
-- Run this once in: Supabase Dashboard -> SQL Editor -> New query
-- ============================================================

create table if not exists public.feedback (
  id                 uuid primary key default gen_random_uuid(),
  certificate_number text,
  submission_date    date        not null default current_date,
  student_name     text        not null,
  student_contact  text        not null,
  parent_contact   text        not null,
  school_name      text        not null,
  standard         text        not null,
  favorite_ai_tool text        not null,
  rating           smallint    not null check (rating between 1 and 5),
  ai_understood    text        not null,
  reuse_ai         text        not null,
  feedback         text        not null,
  created_at       timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Migration for tables created before certificate numbers existed.
-- Safe to run on a fresh database too.
-- ------------------------------------------------------------
alter table public.feedback
  add column if not exists certificate_number text;

alter table public.feedback
  add column if not exists submission_date date not null default current_date;

-- Handy for exporting submissions in order.
create index if not exists feedback_created_at_idx
  on public.feedback (created_at desc);

-- Certificate numbers are unique per student.
create unique index if not exists feedback_certificate_number_idx
  on public.feedback (certificate_number);

-- ============================================================
-- Row Level Security
-- The anon key is public (it ships in script.js), so the browser
-- is allowed to INSERT only. Nobody can read the data with it —
-- view submissions from the Supabase Dashboard instead.
-- ============================================================

alter table public.feedback enable row level security;

drop policy if exists "Anyone can submit feedback" on public.feedback;

create policy "Anyone can submit feedback"
  on public.feedback
  for insert
  to anon
  with check (true);
