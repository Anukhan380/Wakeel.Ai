-- Run this in Supabase SQL Editor
-- Go to: supabase.com → your project → SQL Editor → New Query → paste this → Run

-- LAWYERS TABLE
create table if not exists lawyers (
  id text primary key,
  name text not null,
  city text,
  phone text,
  bar_number text,
  experience text,
  specialty text[],
  plan text default 'basic',
  access_code text unique,
  active boolean default true,
  created_at timestamp default now()
);

-- DOCUMENTS TABLE
create table if not exists documents (
  id text primary key,
  type text,
  description text,
  name text,
  phone text,
  email text,
  price text,
  status text default 'pending',
  document text,
  created_at timestamp default now(),
  completed_at timestamp
);

-- Insert sample lawyer for testing
insert into lawyers (id, name, city, phone, bar_number, experience, specialty, plan, access_code, active)
values (
  'LAW001',
  'Barrister Ahmed Khan',
  'Peshawar',
  '0300-1234567',
  'KPK-1234',
  '12 years',
  ARRAY['criminal','property'],
  'premium',
  'LAW-2847',
  true
) on conflict (id) do nothing;

-- Enable Row Level Security (optional but good practice)
alter table lawyers enable row level security;
alter table documents enable row level security;

-- Allow all operations (you control via API key)
create policy "Allow all" on lawyers for all using (true);
create policy "Allow all" on documents for all using (true);
