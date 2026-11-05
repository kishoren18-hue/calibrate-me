-- Row-level security and function tests. Each block asserts with RAISE.
\set ON_ERROR_STOP on
set client_min_messages = warning;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'teacher@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'other@example.com');

-- helper: act as a role/user
create or replace function pg_temp.act(r text, uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid, ''), false);
  execute format('set role %I', r);
end $$;

-- Calibrate Me
select pg_temp.act('authenticated', '11111111-1111-1111-1111-111111111111');
create temp table if not exists t_class as select * from public.cm_create_class('Period 3 Biology');
grant select on t_class to anon, authenticated;
do $$ declare c record; begin
  select * into c from t_class;
  if c.code !~ '^[A-HJ-NP-Z2-9]{6}$' then raise exception 'bad code %', c.code; end if;
end $$;

reset role;
select pg_temp.act('anon', null);
do $$ declare code text; nm text; sid uuid; begin
  select t.code into code from t_class t;
  nm := public.cm_class_name(lower(code));
  if nm is distinct from 'Period 3 Biology' then raise exception 'class lookup failed: %', nm; end if;
  if public.cm_class_name('ZZZZZZ') is not null then raise exception 'unknown code should be null'; end if;

  sid := public.cm_submit_session(
    '[{"q":"q01","c":true,"p":0.9},{"q":"q02","c":true,"p":0.8},{"q":"q03","c":false,"p":0.9},{"q":"q04","c":false,"p":0.6},{"q":"q05","c":true,"p":0.7}]'::jsonb,
    code, ' Ana ');
  if sid is null then raise exception 'no session id'; end if;
  -- solo (anonymous)
  perform public.cm_submit_session('[{"q":"q01","c":false,"p":0.99},{"q":"q02","c":true,"p":0.5},{"q":"q03","c":true,"p":0.6},{"q":"q04","c":true,"p":0.7},{"q":"q05","c":false,"p":0.8}]'::jsonb);
  -- anon cannot read sessions directly
  if (select count(*) from public.cm_sessions) <> 0 then raise exception 'anon can read sessions'; end if;
  if (select count(*) from public.cm_classes) <> 0 then raise exception 'anon can read classes'; end if;
end $$;

-- invalid submissions are rejected
do $$ begin
  begin perform public.cm_submit_session('[{"q":"q01","c":true,"p":0.9}]'::jsonb); raise exception 'too-short accepted';
  exception when sqlstate '22023' then null; end;
  begin perform public.cm_submit_session('[{"q":"q01","c":true,"p":1.5},{"q":"q02","c":true,"p":0.8},{"q":"q03","c":true,"p":0.8},{"q":"q04","c":true,"p":0.8},{"q":"q05","c":true,"p":0.8}]'::jsonb); raise exception 'bad p accepted';
  exception when sqlstate '22023' then null; end;
  begin perform public.cm_submit_session('[{"q":"q01","c":true,"p":0.9},{"q":"q01","c":true,"p":0.8},{"q":"q03","c":true,"p":0.8},{"q":"q04","c":true,"p":0.8},{"q":"q05","c":true,"p":0.8}]'::jsonb); raise exception 'dupes accepted';
  exception when sqlstate '22023' then null; end;
  begin perform public.cm_submit_session('[{"q":"q01","c":true,"p":0.9},{"q":"q02","c":true,"p":0.8},{"q":"q03","c":true,"p":0.8},{"q":"q04","c":true,"p":0.8},{"q":"q05","c":true,"p":0.8}]'::jsonb, 'ZZZZZZ', 'x'); raise exception 'bad code accepted';
  exception when sqlstate 'P0002' then null; end;
  begin insert into public.cm_sessions (n, accuracy, mean_conf, brier) values (5, 1, 1, 0); raise exception 'direct insert allowed';
  exception when insufficient_privilege then null; end;
end $$;

-- teacher sees only their class session, with server-computed metrics
reset role;
select pg_temp.act('authenticated', '11111111-1111-1111-1111-111111111111');
do $$ declare s record; begin
  if (select count(*) from public.cm_sessions) <> 1 then raise exception 'teacher should see exactly 1 session'; end if;
  select * into s from public.cm_sessions;
  if s.nickname <> 'Ana' then raise exception 'nickname not trimmed: %', s.nickname; end if;
  if abs(s.accuracy - 0.6) > 1e-6 then raise exception 'accuracy %', s.accuracy; end if;
  -- auroc2: pos {0.9,0.8,0.7} vs neg {0.9,0.6}: pairs = (0.5+1)+(0+1)+(0+1) = 3.5 / 6
  if abs(s.auroc2 - 3.5/6) > 1e-6 then raise exception 'auroc2 %', s.auroc2; end if;
  if (select count(*) from public.cm_answers) <> 5 then raise exception 'teacher answers'; end if;
end $$;

-- another signed-in user sees nothing and cannot delete the class
reset role;
select pg_temp.act('authenticated', '22222222-2222-2222-2222-222222222222');
do $$ begin
  if (select count(*) from public.cm_classes) <> 0 then raise exception 'other user sees class'; end if;
  if (select count(*) from public.cm_sessions) <> 0 then raise exception 'other user sees sessions'; end if;
  delete from public.cm_classes;
end $$;
reset role;
do $$ begin if (select count(*) from public.cm_classes) <> 1 then raise exception 'class was deleted by non-owner'; end if; end $$;

-- public aggregates need >= 5 answers per question: q01..q05 have 2 each, so nothing yet
select pg_temp.act('anon', null);
do $$ begin if (select count(*) from public.cm_question_stats()) <> 0 then raise exception 'aggregate leaked small n'; end if; end $$;
reset role;

-- anon cannot create classes
select pg_temp.act('anon', null);
do $$ begin
  begin perform public.cm_create_class('x'); raise exception 'anon created class';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- rate limit: 60 per day per IP hash
select set_config('request.headers', '{"x-forwarded-for": "203.0.113.9, 10.0.0.1"}', false);
select pg_temp.act('anon', null);
do $$ declare i int; begin
  for i in 1..60 loop
    perform public.cm_submit_session('[{"q":"q01","c":true,"p":0.9},{"q":"q02","c":true,"p":0.8},{"q":"q03","c":true,"p":0.8},{"q":"q04","c":true,"p":0.8},{"q":"q05","c":true,"p":0.8}]'::jsonb);
  end loop;
  begin
    perform public.cm_submit_session('[{"q":"q01","c":true,"p":0.9},{"q":"q02","c":true,"p":0.8},{"q":"q03","c":true,"p":0.8},{"q":"q04","c":true,"p":0.8},{"q":"q05","c":true,"p":0.8}]'::jsonb);
    raise exception '61st submission accepted';
  exception when sqlstate '54000' then null; end;
  if (select count(*) from public.cm_question_stats()) <> 5 then raise exception 'aggregates should now exist'; end if;
end $$;
reset role;
do $$ begin if exists (select 1 from public.cm_rate where ip_hash like '%203.0.113%') then raise exception 'raw IP stored'; end if; end $$;

-- deleting the class removes its sessions and answers
delete from public.cm_classes;
do $$ begin if (select count(*) from public.cm_sessions where class_id is not null) <> 0 then raise exception 'cascade failed'; end if; end $$;

select 'ALL RLS TESTS PASSED' as result;
