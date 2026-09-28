-- ==============================================================================
-- Migration: Create Employer Requirements & Contact Messages Tables
-- ==============================================================================

-- 1. Table for "For Employers" page -> "Share Your Requirement" submissions
create table if not exists public.employer_requirements (
    id uuid default gen_random_uuid() primary key,
    company_name text not null,
    contact_person text not null,
    email text not null,
    phone text not null,
    requirement text not null,
    positions text default '1',
    details text,
    status text default 'New',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- 2. Table for "Contact Us" page -> "Send a Message" submissions
create table if not exists public.contact_messages (
    id uuid default gen_random_uuid() primary key,
    full_name text not null,
    email text not null,
    phone text,
    subject text,
    message text not null,
    status text default 'Unread',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Enable Row Level Security (RLS)
alter table public.employer_requirements enable row level security;
alter table public.contact_messages enable row level security;

-- Policies for employer_requirements
drop policy if exists "Allow public insert for employer_requirements" on public.employer_requirements;
create policy "Allow public insert for employer_requirements"
    on public.employer_requirements for insert
    with check (true);

drop policy if exists "Allow public all for employer_requirements" on public.employer_requirements;
create policy "Allow public all for employer_requirements"
    on public.employer_requirements for all
    using (true)
    with check (true);

-- Policies for contact_messages
drop policy if exists "Allow public insert for contact_messages" on public.contact_messages;
create policy "Allow public insert for contact_messages"
    on public.contact_messages for insert
    with check (true);

drop policy if exists "Allow public all for contact_messages" on public.contact_messages;
create policy "Allow public all for contact_messages"
    on public.contact_messages for all
    using (true)
    with check (true);

-- Indexes for fast ordering & search
create index if not exists idx_employer_requirements_created_at
    on public.employer_requirements (created_at desc);

create index if not exists idx_contact_messages_created_at
    on public.contact_messages (created_at desc);
