# PIXEL PASS — Database Schema

Use PostgreSQL through Supabase.

## 1. profiles

Suggested fields:

```sql
id uuid primary key references auth.users(id) on delete cascade
username text unique not null
full_name text not null
tagline text
bio text
role text
organization text
avatar_url text
github_url text
linkedin_url text
portfolio_url text
public_email text
department text
theme text not null default 'classic'
visibility text not null default 'public'
status text not null default 'draft'
is_featured boolean not null default false
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

## 2. projects

```sql
id uuid primary key default gen_random_uuid()
profile_id uuid not null references profiles(id) on delete cascade
title text not null
description text
cover_url text
project_url text
github_url text
tech_stack text[]
project_date date
sort_order integer not null default 0
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

## 3. user_roles

```sql
user_id uuid primary key references auth.users(id) on delete cascade
role text not null default 'member'
created_at timestamptz not null default now()
```

Roles:
- member
- admin

## 4. Optional reactions

Only implement after MVP:

```sql
id uuid primary key default gen_random_uuid()
profile_id uuid not null references profiles(id) on delete cascade
reaction text not null
visitor_token text not null
created_at timestamptz not null default now()
```

## 5. Status Model

Profile status:

```text
draft
pending_review
approved
rejected
unpublished
```

Normal flow:

```text
draft → pending_review → approved
                         ↘ rejected
approved → unpublished
```

## 6. Row Level Security

Required policies:

### Profiles

Members can:
- read public approved profiles
- read/update their own profile
- insert their own profile

Admins can:
- read all profiles
- update moderation fields
- update featured state

### Projects

Members can:
- create/update/delete their own projects

Visitors can:
- read projects attached to approved public profiles

Admins can:
- read/update all projects as needed for moderation

## 7. Security Rules

Never trust client-provided role values.

Admin authorization must be derived from server-enforced database policy or trusted claims, not from a hidden frontend field.

Validate URLs before saving.

Do not let a member modify another user's profile or projects.
