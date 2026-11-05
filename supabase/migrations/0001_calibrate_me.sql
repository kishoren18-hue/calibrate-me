-- Calibrate Me: teacher classes, anonymous play sessions, aggregate question stats.
--
-- Privacy model
--   * Students never create accounts or give an email. They join with a class code and a nickname.
--   * Solo players are fully anonymous (no nickname, no account).
--   * Teachers (email sign-in) can read only sessions in classes they own.
--   * The public can read only aggregates (per-question accuracy and confidence, at least 5 answers).
--   * Writes from anonymous players go through one validated function, rate limited by a hashed IP.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.cm_classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.cm_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references public.cm_classes (id) on delete cascade,
  nickname text check (nickname is null or char_length(nickname) between 1 and 24),
  n integer not null check (n between 5 and 60),
  accuracy real not null,
  mean_conf real not null,
  brier real not null,
  auroc2 real,
  created_at timestamptz not null default now(),
  check ((class_id is null) = (nickname is null))
);
create index if not exists cm_sessions_class on public.cm_sessions (class_id, created_at desc);

create table if not exists public.cm_answers (
  session_id uuid not null references public.cm_sessions (id) on delete cascade,
  question_id text not null check (char_length(question_id) between 1 and 40),
  correct boolean not null,
  confidence real not null check (confidence between 0.5 and 1),
  primary key (session_id, question_id)
);
create index if not exists cm_answers_question on public.cm_answers (question_id);

create table if not exists public.cm_rate (
  ip_hash text not null,
  day date not null default current_date,
  count integer not null default 0,
  primary key (ip_hash, day)
);

alter table public.cm_classes enable row level security;
alter table public.cm_sessions enable row level security;
alter table public.cm_answers enable row level security;
alter table public.cm_rate enable row level security;

-- Teachers manage their own classes.
drop policy if exists "teacher reads own classes" on public.cm_classes;
create policy "teacher reads own classes" on public.cm_classes
  for select to authenticated using (teacher_id = (select auth.uid()));
drop policy if exists "teacher creates classes" on public.cm_classes;
create policy "teacher creates classes" on public.cm_classes
  for insert to authenticated with check (teacher_id = (select auth.uid()));
drop policy if exists "teacher renames own classes" on public.cm_classes;
create policy "teacher renames own classes" on public.cm_classes
  for update to authenticated using (teacher_id = (select auth.uid())) with check (teacher_id = (select auth.uid()));
drop policy if exists "teacher deletes own classes" on public.cm_classes;
create policy "teacher deletes own classes" on public.cm_classes
  for delete to authenticated using (teacher_id = (select auth.uid()));

-- Teachers read and remove sessions (and their answers) in their own classes. No direct inserts.
drop policy if exists "teacher reads class sessions" on public.cm_sessions;
create policy "teacher reads class sessions" on public.cm_sessions
  for select to authenticated using (
    exists (select 1 from public.cm_classes c where c.id = class_id and c.teacher_id = (select auth.uid()))
  );
drop policy if exists "teacher deletes class sessions" on public.cm_sessions;
create policy "teacher deletes class sessions" on public.cm_sessions
  for delete to authenticated using (
    exists (select 1 from public.cm_classes c where c.id = class_id and c.teacher_id = (select auth.uid()))
  );
drop policy if exists "teacher reads class answers" on public.cm_answers;
create policy "teacher reads class answers" on public.cm_answers
  for select to authenticated using (
    exists (
      select 1 from public.cm_sessions s join public.cm_classes c on c.id = s.class_id
      where s.id = session_id and c.teacher_id = (select auth.uid())
    )
  );

-- Create a class with a fresh, unambiguous 6-character code (no 0/O/1/I).
create or replace function public.cm_create_class(p_name text)
returns public.cm_classes
language plpgsql
security invoker
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code text;
  result public.cm_classes;
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  for attempt in 1..20 loop
    new_code := '';
    for i in 1..6 loop
      new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into public.cm_classes (name, code) values (btrim(p_name), new_code) returning * into result;
      return result;
    exception when unique_violation then
      -- code collision: try again
    end;
  end loop;
  raise exception 'could not allocate a class code';
end;
$$;
revoke all on function public.cm_create_class(text) from public, anon;
grant execute on function public.cm_create_class(text) to authenticated;

-- Look up a class name by code (so students see which class they're joining).
create or replace function public.cm_class_name(p_code text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select name from public.cm_classes where code = upper(btrim(p_code));
$$;
revoke all on function public.cm_class_name(text) from public;
grant execute on function public.cm_class_name(text) to anon, authenticated;

-- Submit a finished round. Summary metrics are computed here, never trusted from the client.
-- p_answers: [{"q": "q01", "c": true, "p": 0.8}, ...]
create or replace function public.cm_submit_session(p_answers jsonb, p_code text default null, p_nickname text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class uuid;
  v_nick text := nullif(btrim(coalesce(p_nickname, '')), '');
  v_session uuid;
  v_n integer;
  v_ip text;
  v_count integer;
begin
  if jsonb_typeof(p_answers) <> 'array' then
    raise exception 'answers must be an array' using errcode = '22023';
  end if;
  v_n := jsonb_array_length(p_answers);
  if v_n < 5 or v_n > 60 then
    raise exception 'a round has 5 to 60 answers' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_answers) e
    where jsonb_typeof(e->'q') <> 'string' or char_length(e->>'q') not between 1 and 40
       or jsonb_typeof(e->'c') <> 'boolean'
       or jsonb_typeof(e->'p') <> 'number' or (e->>'p')::real not between 0.5 and 1
  ) then
    raise exception 'invalid answer format' using errcode = '22023';
  end if;
  if (select count(distinct e->>'q') from jsonb_array_elements(p_answers) e) <> v_n then
    raise exception 'duplicate questions' using errcode = '22023';
  end if;

  if p_code is not null then
    select id into v_class from public.cm_classes where code = upper(btrim(p_code));
    if v_class is null then
      raise exception 'class not found' using errcode = 'P0002';
    end if;
    if v_nick is null or char_length(v_nick) > 24 then
      raise exception 'nickname must be 1 to 24 characters' using errcode = '22023';
    end if;
  else
    v_nick := null;
  end if;

  -- 60 rounds per day per network, keyed by a one-way hash of the client IP (the IP itself is never stored).
  v_ip := coalesce(
    split_part(coalesce(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', ''), ',', 1),
    'unknown'
  );
  insert into public.cm_rate (ip_hash, day, count)
  values (encode(extensions.digest(v_ip || current_date::text, 'sha256'), 'hex'), current_date, 1)
  on conflict (ip_hash, day) do update set count = public.cm_rate.count + 1
  returning count into v_count;
  if v_count > 60 then
    raise exception 'too many rounds submitted today; try again tomorrow' using errcode = '54000';
  end if;

  with a as (
    select (e->>'c')::boolean as c, (e->>'p')::real as p from jsonb_array_elements(p_answers) e
  ),
  pairs as (
    select avg(case when x.p > y.p then 1.0 when x.p = y.p then 0.5 else 0.0 end) as auc
    from a x cross join a y where x.c and not y.c
  )
  insert into public.cm_sessions (class_id, nickname, n, accuracy, mean_conf, brier, auroc2)
  select v_class, v_nick, v_n,
         avg(case when c then 1.0 else 0.0 end),
         avg(p),
         avg(power(p - case when c then 1.0 else 0.0 end, 2)),
         (select auc from pairs)
  from a
  returning id into v_session;

  insert into public.cm_answers (session_id, question_id, correct, confidence)
  select v_session, e->>'q', (e->>'c')::boolean, (e->>'p')::real from jsonb_array_elements(p_answers) e;

  return v_session;
end;
$$;
revoke all on function public.cm_submit_session(jsonb, text, text) from public;
grant execute on function public.cm_submit_session(jsonb, text, text) to anon, authenticated;

-- Public aggregates per question (only questions with at least 5 answers).
create or replace function public.cm_question_stats()
returns table (question_id text, n bigint, accuracy double precision, mean_conf double precision)
language sql
stable
security definer
set search_path = ''
as $$
  select question_id, count(*), avg(case when correct then 1.0 else 0.0 end), avg(confidence)
  from public.cm_answers
  group by question_id
  having count(*) >= 5;
$$;
revoke all on function public.cm_question_stats() from public;
grant execute on function public.cm_question_stats() to anon, authenticated;

-- Pooled human calibration curve across everyone (aggregate only).
create or replace function public.cm_global_calibration()
returns table (confidence real, n bigint, accuracy double precision)
language sql
stable
security definer
set search_path = ''
as $$
  select confidence, count(*), avg(case when correct then 1.0 else 0.0 end)
  from public.cm_answers
  group by confidence
  having count(*) >= 5
  order by confidence;
$$;
revoke all on function public.cm_global_calibration() from public;
grant execute on function public.cm_global_calibration() to anon, authenticated;
