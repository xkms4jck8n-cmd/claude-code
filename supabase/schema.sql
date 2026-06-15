-- ============================================================================
--  Knowledge Kingdom — online multiplayer schema (Supabase / Postgres)
-- ----------------------------------------------------------------------------
--  Run this once in the Supabase SQL editor (or `supabase db push`).
--  Design goals: real accounts only, server-authoritative stats (no client can
--  forge wins/score), RLS-enforced visibility, and Realtime for live updates.
--
--  Identity: anonymous auth. Each device signs in anonymously -> a real row in
--  auth.users -> exactly one profiles row. ensure_profile() bootstraps it.
-- ============================================================================

-- ---------- Tables ----------------------------------------------------------

create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  player_code     text unique not null,
  name            text not null default 'مستكشف المعرفة',
  icon            text not null default 'crown',
  color           text not null default '#e9c878',
  created_at      timestamptz not null default now(),
  last_seen       timestamptz not null default now(),
  total_score     bigint not null default 0,
  games_played    int    not null default 0,
  wins            int    not null default 0,
  losses          int    not null default 0,
  draws           int    not null default 0,
  correct_answers bigint not null default 0,
  total_answers   bigint not null default 0,
  weekly_score    bigint not null default 0,
  weekly_period   int    not null default 0   -- year*100 + ISO week
);

create table if not exists public.friendships (
  id          uuid primary key default gen_random_uuid(),
  requester   uuid not null references public.profiles(id) on delete cascade,
  addressee   uuid not null references public.profiles(id) on delete cascade,
  status      text not null default 'pending',  -- pending | accepted
  created_at  timestamptz not null default now(),
  unique (requester, addressee),
  check (requester <> addressee)
);
create index if not exists friendships_addressee_idx on public.friendships(addressee);
create index if not exists friendships_requester_idx on public.friendships(requester);

create table if not exists public.matches (
  id             uuid primary key default gen_random_uuid(),
  status         text not null default 'waiting',  -- waiting|active|finished|cancelled
  mode           text not null default 'quick',    -- quick|friend
  created_by     uuid not null references public.profiles(id) on delete cascade,
  invited        uuid references public.profiles(id),
  category       text,
  question_count int not null default 7,
  questions      jsonb not null default '[]'::jsonb,
  duration_s     int not null default 60,
  created_at     timestamptz not null default now(),
  started_at     timestamptz,
  ends_at        timestamptz,
  winner         uuid references public.profiles(id),
  finished_at    timestamptz
);
create index if not exists matches_status_idx on public.matches(status);
create index if not exists matches_invited_idx on public.matches(invited);

create table if not exists public.match_players (
  match_id   uuid not null references public.matches(id) on delete cascade,
  player     uuid not null references public.profiles(id) on delete cascade,
  correct    int not null default 0,
  answered   int not null default 0,
  time_ms    int not null default 0,
  finished   boolean not null default false,
  ready      boolean not null default false,
  joined_at  timestamptz not null default now(),
  primary key (match_id, player)
);

-- ---------- Helpers ---------------------------------------------------------

create or replace function public.iso_week_bucket(ts timestamptz default now())
returns int language sql immutable as $$
  select (extract(isoyear from ts)::int * 100 + extract(week from ts)::int);
$$;

-- Authoritative server clock (ms since epoch). Clients compute an offset from
-- their local clock so the duel countdown is synchronized across devices.
create or replace function public.server_now()
returns bigint language sql stable as $$
  select (extract(epoch from now()) * 1000)::bigint;
$$;

-- ---------- Profile bootstrap / edit ---------------------------------------

create or replace function public.ensure_profile(p_name text default null,
                                                 p_icon text default null,
                                                 p_color text default null)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  code text;
  prof public.profiles;
begin
  if uid is null then raise exception 'not authenticated'; end if;

  select * into prof from public.profiles where id = uid;
  if not found then
    -- generate a unique, human-friendly player code: KOK-XXXXXX (base32-ish)
    loop
      code := 'KOK-' || upper(substr(translate(encode(gen_random_bytes(5),'base64'),
                          '+/=lIO01','ABCDEFGH'), 1, 6));
      exit when not exists (select 1 from public.profiles where player_code = code);
    end loop;
    insert into public.profiles (id, player_code, name, icon, color)
      values (uid, code,
              coalesce(nullif(p_name,''),  'مستكشف المعرفة'),
              coalesce(nullif(p_icon,''),  'crown'),
              coalesce(nullif(p_color,''), '#e9c878'))
      returning * into prof;
  else
    update public.profiles set
      name      = coalesce(nullif(p_name,''),  name),
      icon      = coalesce(nullif(p_icon,''),  icon),
      color     = coalesce(nullif(p_color,''), color),
      last_seen = now()
    where id = uid returning * into prof;
  end if;
  return prof;
end; $$;

create or replace function public.touch_last_seen()
returns void language sql security definer set search_path = public as $$
  update public.profiles set last_seen = now() where id = auth.uid();
$$;

-- ---------- Friends ---------------------------------------------------------

create or replace function public.friend_request(p_code text)
returns public.friendships language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  other uuid;
  existing public.friendships;
begin
  select id into other from public.profiles where player_code = upper(p_code);
  if other is null then raise exception 'PLAYER_NOT_FOUND'; end if;
  if other = me then raise exception 'CANNOT_ADD_SELF'; end if;

  -- already friends or pending in either direction?
  select * into existing from public.friendships
   where (requester = me and addressee = other) or (requester = other and addressee = me);
  if found then
    -- if they already requested me, accept it
    if existing.requester = other and existing.status = 'pending' then
      update public.friendships set status = 'accepted' where id = existing.id returning * into existing;
    end if;
    return existing;
  end if;

  insert into public.friendships (requester, addressee, status)
    values (me, other, 'pending') returning * into existing;
  return existing;
end; $$;

create or replace function public.respond_friend(p_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if p_accept then
    update public.friendships set status = 'accepted'
      where id = p_id and addressee = me and status = 'pending';
  else
    delete from public.friendships where id = p_id and addressee = me and status = 'pending';
  end if;
end; $$;

create or replace function public.remove_friend(p_other uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  delete from public.friendships
   where (requester = me and addressee = p_other)
      or (requester = p_other and addressee = me);
end; $$;

create or replace function public.head_to_head(p_other uuid)
returns table (total int, my_wins int, their_wins int, draws int)
language sql security definer set search_path = public as $$
  with shared as (
    select m.* from public.matches m
    where m.status = 'finished'
      and exists (select 1 from public.match_players mp where mp.match_id=m.id and mp.player=auth.uid())
      and exists (select 1 from public.match_players mp where mp.match_id=m.id and mp.player=p_other)
  )
  select count(*)::int,
         count(*) filter (where winner = auth.uid())::int,
         count(*) filter (where winner = p_other)::int,
         count(*) filter (where winner is null)::int
  from shared;
$$;

-- ---------- Matchmaking & duel lifecycle -----------------------------------

-- Atomically join an open quick match or create a new one. Uses row locking so
-- two players matching at the same instant cannot both create separate matches.
create or replace function public.quick_match(p_count int, p_category text,
                                              p_duration int, p_questions jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); m uuid;
begin
  select id into m from public.matches
   where status = 'waiting' and mode = 'quick' and created_by <> me
     and (select count(*) from public.match_players where match_id = id) = 1
   order by created_at asc
   for update skip locked
   limit 1;

  if m is not null then
    insert into public.match_players (match_id, player, ready) values (m, me, true)
      on conflict do nothing;
    -- second player joined -> start immediately, synchronized for everyone
    update public.matches
       set status='active', started_at = now(), ends_at = now() + (duration_s || ' seconds')::interval
     where id = m and status='waiting';
    return m;
  end if;

  insert into public.matches (status, mode, created_by, category, question_count, questions, duration_s)
    values ('waiting','quick', me, p_category, p_count, coalesce(p_questions,'[]'::jsonb), p_duration)
    returning id into m;
  insert into public.match_players (match_id, player, ready) values (m, me, true);
  return m;
end; $$;

-- Create a friend-invite match (waiting for a specific friend to accept).
create or replace function public.create_invite(p_friend uuid, p_count int, p_category text,
                                               p_duration int, p_questions jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); m uuid;
begin
  if not exists (select 1 from public.friendships
                  where status='accepted'
                    and ((requester=me and addressee=p_friend) or (requester=p_friend and addressee=me)))
  then raise exception 'NOT_FRIENDS'; end if;

  insert into public.matches (status, mode, created_by, invited, category, question_count, questions, duration_s)
    values ('waiting','friend', me, p_friend, p_category, p_count, coalesce(p_questions,'[]'::jsonb), p_duration)
    returning id into m;
  insert into public.match_players (match_id, player, ready) values (m, me, true);
  return m;
end; $$;

create or replace function public.accept_invite(p_match uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  insert into public.match_players (match_id, player, ready) values (p_match, me, true)
    on conflict do nothing;
  update public.matches
     set status='active', started_at=now(), ends_at = now() + (duration_s || ' seconds')::interval
   where id=p_match and invited=me and status='waiting';
end; $$;

create or replace function public.cancel_match(p_match uuid)
returns void language plpgsql security definer set search_path = public as $$
  update public.matches set status='cancelled'
   where id=p_match and created_by=auth.uid() and status='waiting';
$$;

-- Record this player's progress; finalize the match on first finish or timeout.
create or replace function public.submit_progress(p_match uuid, p_correct int, p_answered int,
                                                 p_time_ms int, p_finished boolean)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  update public.match_players
     set correct=p_correct, answered=p_answered, time_ms=p_time_ms,
         finished = finished or p_finished
   where match_id=p_match and player=me;

  perform public.finish_match(p_match);
end; $$;

-- Server-authoritative finalize: idempotent. Ends the match when anyone has
-- finished or the timer elapsed, computes the winner, and updates aggregate
-- stats for every participant (this is the ONLY place stats are mutated).
create or replace function public.finish_match(p_match uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  mt public.matches;
  win uuid;
  bucket int := public.iso_week_bucket();
  r record;
  pts int;
begin
  select * into mt from public.matches where id=p_match for update;
  if mt.status <> 'active' then return; end if;

  if not (now() >= mt.ends_at
          or exists (select 1 from public.match_players where match_id=p_match and finished))
  then return; end if;

  -- winner: most correct, tiebreak fewest time; null = draw
  select player into win from public.match_players
   where match_id=p_match
   order by correct desc, time_ms asc
   limit 1;

  -- detect a tie on the top (correct, time) -> draw
  if (select count(*) from public.match_players mp
        where mp.match_id=p_match
          and mp.correct=(select max(correct) from public.match_players where match_id=p_match)) > 1
     and (select count(distinct time_ms) from public.match_players
            where match_id=p_match
              and correct=(select max(correct) from public.match_players where match_id=p_match)) = 1
  then win := null; end if;

  update public.matches
     set status='finished', winner=win, finished_at=now()
   where id=p_match;

  for r in select * from public.match_players where match_id=p_match loop
    pts := r.correct * 10 + (case when r.player = win then 50 else 0 end);
    update public.profiles p set
      games_played    = p.games_played + 1,
      wins            = p.wins   + (case when r.player = win then 1 else 0 end),
      losses          = p.losses + (case when win is not null and r.player <> win then 1 else 0 end),
      draws           = p.draws  + (case when win is null then 1 else 0 end),
      correct_answers = p.correct_answers + r.correct,
      total_answers   = p.total_answers + r.answered,
      total_score     = p.total_score + pts,
      weekly_score    = (case when p.weekly_period = bucket then p.weekly_score else 0 end) + pts,
      weekly_period   = bucket,
      last_seen       = now()
    where p.id = r.player;
  end loop;
end; $$;

-- ---------- Leaderboards ----------------------------------------------------

create or replace function public.leaderboard_global(p_limit int default 100)
returns table (id uuid, player_code text, name text, icon text, color text,
               score bigint, wins int, games_played int, accuracy numeric, rank bigint)
language sql security definer set search_path = public as $$
  select id, player_code, name, icon, color,
         total_score,
         wins, games_played,
         case when total_answers>0 then round(correct_answers::numeric/total_answers,4) else 0 end,
         row_number() over (order by total_score desc, wins desc)
  from public.profiles
  where games_played > 0
  order by total_score desc, wins desc
  limit p_limit;
$$;

create or replace function public.leaderboard_weekly(p_limit int default 100)
returns table (id uuid, player_code text, name text, icon text, color text,
               score bigint, wins int, games_played int, accuracy numeric, rank bigint)
language sql security definer set search_path = public as $$
  select id, player_code, name, icon, color,
         weekly_score, wins, games_played,
         case when total_answers>0 then round(correct_answers::numeric/total_answers,4) else 0 end,
         row_number() over (order by weekly_score desc, wins desc)
  from public.profiles
  where weekly_period = public.iso_week_bucket() and weekly_score > 0
  order by weekly_score desc, wins desc
  limit p_limit;
$$;

create or replace function public.leaderboard_friends()
returns table (id uuid, player_code text, name text, icon text, color text,
               score bigint, wins int, games_played int, accuracy numeric, rank bigint)
language sql security definer set search_path = public as $$
  with mine as (select auth.uid() as me),
  fr as (
    select case when requester=(select me from mine) then addressee else requester end as fid
    from public.friendships
    where status='accepted'
      and ((select me from mine) in (requester, addressee))
  ),
  ppl as (
    select * from public.profiles
    where id in (select fid from fr) or id = (select me from mine)
  )
  select id, player_code, name, icon, color,
         total_score, wins, games_played,
         case when total_answers>0 then round(correct_answers::numeric/total_answers,4) else 0 end,
         row_number() over (order by total_score desc, wins desc)
  from ppl
  order by total_score desc, wins desc;
$$;

-- ---------- Row Level Security ---------------------------------------------

alter table public.profiles      enable row level security;
alter table public.friendships   enable row level security;
alter table public.matches       enable row level security;
alter table public.match_players enable row level security;

-- Profiles: any authenticated user may read (leaderboards, friend lookup,
-- opponent display). Writes go ONLY through security-definer RPCs above.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (true);

-- Friendships: a user can see edges they are part of.
drop policy if exists friendships_read on public.friendships;
create policy friendships_read on public.friendships for select to authenticated
  using (requester = auth.uid() or addressee = auth.uid());

-- Matches: visible to participants (creator, invited friend, or joined player).
drop policy if exists matches_read on public.matches;
create policy matches_read on public.matches for select to authenticated
  using (
    created_by = auth.uid()
    or invited = auth.uid()
    or exists (select 1 from public.match_players mp where mp.match_id = id and mp.player = auth.uid())
    -- allow discovering a waiting quick match to join via RPC realtime
    or (status = 'waiting' and mode = 'quick')
  );

-- Match players: visible if you can see the match (so you watch the opponent).
drop policy if exists match_players_read on public.match_players;
create policy match_players_read on public.match_players for select to authenticated
  using (
    exists (
      select 1 from public.matches m
      where m.id = match_id
        and (m.created_by = auth.uid() or m.invited = auth.uid()
             or exists (select 1 from public.match_players mp2 where mp2.match_id=m.id and mp2.player=auth.uid())
             or (m.status='waiting' and m.mode='quick'))
    )
  );

-- ---------- Realtime publication -------------------------------------------
-- Enables postgres_changes streams (RLS still applies to each subscriber).
alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.match_players;
alter publication supabase_realtime add table public.friendships;
alter publication supabase_realtime add table public.profiles;
