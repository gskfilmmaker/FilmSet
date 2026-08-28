-- ============================================================================
-- Background/Extras, Stand-ins, Vehicles, and Transport runs — Phase 13-15
-- of the industry-standard-call-sheet gap analysis. Every reference call
-- sheet checked against had these; none were modeled here. All four are
-- scoped to a single shoot day, matching how they're actually listed on a
-- real call sheet, and follow the same join-through-shoot_days RLS pattern
-- as shoot_day_cast_call_times / shoot_day_crew_call_times (0007).
-- ============================================================================
create table if not exists public.background_extras (
  id text primary key,
  shoot_day_id text not null references public.shoot_days(id) on delete cascade,
  description text not null,
  headcount integer not null default 0,
  call_time text,
  instructions text
);
create index if not exists background_extras_shoot_day_idx on public.background_extras (shoot_day_id);

create table if not exists public.stand_ins (
  id text primary key,
  shoot_day_id text not null references public.shoot_days(id) on delete cascade,
  name text not null,
  stands_in_for_cast_member_id text references public.cast_members(id) on delete set null,
  phone text,
  call_time text
);
create index if not exists stand_ins_shoot_day_idx on public.stand_ins (shoot_day_id);

create table if not exists public.production_vehicles (
  id text primary key,
  shoot_day_id text not null references public.shoot_days(id) on delete cascade,
  type text not null,
  description text not null,
  driver_name text,
  driver_phone text,
  notes text
);
create index if not exists production_vehicles_shoot_day_idx on public.production_vehicles (shoot_day_id);

create table if not exists public.transport_runs (
  id text primary key,
  shoot_day_id text not null references public.shoot_days(id) on delete cascade,
  driver_name text,
  pickup_time text,
  pickup_location text,
  dropoff_location text,
  passengers text,
  notes text
);
create index if not exists transport_runs_shoot_day_idx on public.transport_runs (shoot_day_id);

alter table public.background_extras enable row level security;
alter table public.stand_ins enable row level security;
alter table public.production_vehicles enable row level security;
alter table public.transport_runs enable row level security;

create policy "members access background_extras" on public.background_extras for all
  to authenticated
  using (exists (select 1 from public.shoot_days d where d.id = background_extras.shoot_day_id and public.is_production_member(d.production_id)))
  with check (exists (select 1 from public.shoot_days d where d.id = background_extras.shoot_day_id and public.is_production_member(d.production_id)));

create policy "members access stand_ins" on public.stand_ins for all
  to authenticated
  using (exists (select 1 from public.shoot_days d where d.id = stand_ins.shoot_day_id and public.is_production_member(d.production_id)))
  with check (
    exists (
      select 1 from public.shoot_days d
      where d.id = stand_ins.shoot_day_id
        and public.is_production_member(d.production_id)
        and (
          stand_ins.stands_in_for_cast_member_id is null
          or exists (
            select 1 from public.cast_members cm
            where cm.id = stand_ins.stands_in_for_cast_member_id and cm.production_id = d.production_id
          )
        )
    )
  );

create policy "members access production_vehicles" on public.production_vehicles for all
  to authenticated
  using (exists (select 1 from public.shoot_days d where d.id = production_vehicles.shoot_day_id and public.is_production_member(d.production_id)))
  with check (exists (select 1 from public.shoot_days d where d.id = production_vehicles.shoot_day_id and public.is_production_member(d.production_id)));

create policy "members access transport_runs" on public.transport_runs for all
  to authenticated
  using (exists (select 1 from public.shoot_days d where d.id = transport_runs.shoot_day_id and public.is_production_member(d.production_id)))
  with check (exists (select 1 from public.shoot_days d where d.id = transport_runs.shoot_day_id and public.is_production_member(d.production_id)));

grant select, insert, update, delete on public.background_extras to authenticated;
grant select, insert, update, delete on public.stand_ins to authenticated;
grant select, insert, update, delete on public.production_vehicles to authenticated;
grant select, insert, update, delete on public.transport_runs to authenticated;
