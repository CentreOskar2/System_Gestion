-- Subject tariffs are only applicable to cycles that do not have one fixed
-- monthly price. Remove obsolete configuration rows for fixed-price cycles.
delete from public.tariffs as tariff
using public.levels as level, public.cycles as cycle
where tariff.level_id = level.id
  and level.cycle_id = cycle.id
  and coalesce(cycle.has_fixed_price, false);

-- Protect the rule even when tariffs are written outside the React interface.
create or replace function public.reject_tariff_for_fixed_price_cycle()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from public.levels as level
    join public.cycles as cycle on cycle.id = level.cycle_id
    where level.id = new.level_id
      and coalesce(cycle.has_fixed_price, false)
  ) then
    raise exception 'Subject tariffs are not allowed for a fixed-price cycle';
  end if;

  return new;
end;
$$;

drop trigger if exists tariffs_reject_fixed_price_cycle on public.tariffs;
create trigger tariffs_reject_fixed_price_cycle
  before insert or update of level_id on public.tariffs
  for each row
  execute function public.reject_tariff_for_fixed_price_cycle();

-- A fixed price must not be overridden by a retained subject tariff.
create or replace function public.clear_tariffs_when_cycle_becomes_fixed_price()
returns trigger
language plpgsql
as $$
begin
  if coalesce(new.has_fixed_price, false) then
    delete from public.tariffs as tariff
    using public.levels as level
    where tariff.level_id = level.id
      and level.cycle_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists cycles_clear_tariffs_when_fixed_price on public.cycles;
create trigger cycles_clear_tariffs_when_fixed_price
  after insert or update of has_fixed_price on public.cycles
  for each row
  execute function public.clear_tariffs_when_cycle_becomes_fixed_price();
