-- Food Pack Redesign: two-pack model with thawing support

-- 1. Add thaw_until column
ALTER TABLE public.food_packs ADD COLUMN thaw_until timestamptz;

-- 2. Drop old CHECK constraint FIRST (so we can migrate data)
ALTER TABLE public.food_packs DROP CONSTRAINT food_packs_status_check;

-- 3. Migrate any existing 'defrosting' packs to 'thawing'
UPDATE public.food_packs SET status = 'thawing' WHERE status = 'defrosting';

-- 4. Add new CHECK constraint with 'thawing' instead of 'defrosting'
ALTER TABLE public.food_packs ADD CONSTRAINT food_packs_status_check 
  CHECK (status IN ('thawing', 'ready', 'expired', 'replaced'));

-- 5. Update default expires_at to 78 hours (12h thaw + 66h ready)
ALTER TABLE public.food_packs ALTER COLUMN expires_at SET DEFAULT (now() + interval '3 days 6 hours');
