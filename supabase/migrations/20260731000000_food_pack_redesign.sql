-- Food Pack Redesign: two-pack model with thawing support

-- 1. Add thaw_until column
ALTER TABLE public.food_packs ADD COLUMN thaw_until timestamptz;

-- 2. Migrate any existing 'defrosting' packs to 'thawing' (before constraint change)
UPDATE public.food_packs SET status = 'thawing' WHERE status = 'defrosting';

-- 3. Update status CHECK constraint: replace 'defrosting' with 'thawing'
ALTER TABLE public.food_packs DROP CONSTRAINT food_packs_status_check;
ALTER TABLE public.food_packs ADD CONSTRAINT food_packs_status_check 
  CHECK (status IN ('thawing', 'ready', 'expired', 'replaced'));

-- 4. Update default expires_at to 78 hours (12h thaw + 66h ready = 3 days 6 hours)
ALTER TABLE public.food_packs ALTER COLUMN expires_at SET DEFAULT (now() + interval '3 days 6 hours');
