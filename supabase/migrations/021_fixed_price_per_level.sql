-- A fixed monthly price belongs to a level, not to the whole cycle.
alter table public.levels
  add column if not exists fixed_price numeric(12, 2);

-- Preserve existing prices while moving from cycle to level pricing.
update public.levels as level
set fixed_price = cycle.fixed_price
from public.cycles as cycle
where level.cycle_id = cycle.id
  and coalesce(cycle.has_fixed_price, false)
  and level.fixed_price is null;

alter table public.levels
  add constraint levels_fixed_price_non_negative
  check (fixed_price is null or fixed_price >= 0) not valid;

alter table public.levels
  validate constraint levels_fixed_price_non_negative;
