-- ============================================================================
-- Per-person call time overrides for Cast and Crew — Phase 3 of the
-- production-office gap analysis. Until now every cast/crew member on a
-- shoot day's call sheet showed the same single "crew call" time; there was
-- nowhere to give one actor an earlier hair/makeup call, or stagger crew
-- calls by department. Absence of a row here means "use the day's crew
-- call" (shoot_days.call_time) — these only exist where someone actually
-- overrides the default.
-- ============================================================================
create table if not exists public.shoot_day_cast_call_times (
  shoot_day_id text not null references public.shoot_days(id) on delete cascade,
  cast_member_id text not null references public.cast_members(id) on delete cascade,
  call_time text not null,
  primary key (shoot_day_id, cast_member_id)
);

create table if not exists public.shoot_day_crew_call_times (
  shoot_day_id text not null references public.shoot_days(id) on delete cascade,
  crew_member_id text not null references public.crew_members(id) on delete cascade,
  call_time text not null,
  primary key (shoot_day_id, crew_member_id)
);

alter table public.shoot_day_cast_call_times enable row level security;
alter table public.shoot_day_crew_call_times enable row level security;

create policy "members access shoot_day_cast_call_times" on public.shoot_day_cast_call_times for all
  to authenticated
  using (
    exists (
      select 1 from public.shoot_days d
      where d.id = shoot_day_cast_call_times.shoot_day_id and public.is_production_member(d.production_id)
    )
  )
  with check (
    exists (
      select 1 from public.shoot_days d
      join public.cast_members cm on cm.id = shoot_day_cast_call_times.cast_member_id and cm.production_id = d.production_id
      where d.id = shoot_day_cast_call_times.shoot_day_id and public.is_production_member(d.production_id)
    )
  );

create policy "members access shoot_day_crew_call_times" on public.shoot_day_crew_call_times for all
  to authenticated
  using (
    exists (
      select 1 from public.shoot_days d
      where d.id = shoot_day_crew_call_times.shoot_day_id and public.is_production_member(d.production_id)
    )
  )
  with check (
    exists (
      select 1 from public.shoot_days d
      join public.crew_members cw on cw.id = shoot_day_crew_call_times.crew_member_id and cw.production_id = d.production_id
      where d.id = shoot_day_crew_call_times.shoot_day_id and public.is_production_member(d.production_id)
    )
  );

grant select, insert, update, delete on public.shoot_day_cast_call_times to authenticated;
grant select, insert, update, delete on public.shoot_day_crew_call_times to authenticated;
