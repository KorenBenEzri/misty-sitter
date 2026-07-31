-- Food Pack Redesign: two-pack model with thawing support

-- 1. Add thaw_until column
ALTER TABLE public.food_packs ADD COLUMN thaw_until timestamptz;

-- 2. Update status CHECK constraint: replace 'defrosting' with 'thawing'
ALTER TABLE public.food_packs DROP CONSTRAINT food_packs_status_check;
ALTER TABLE public.food_packs ADD CONSTRAINT food_packs_status_check 
  CHECK (status IN ('defrosting', 'thawing', 'ready', 'expired', 'replaced'));

-- 3. Update default expires_at to 66 hours (2 days 18 hours)  
ALTER TABLE public.food_packs ALTER COLUMN expires_at SET DEFAULT (now() + interval '2 days 18 hours');

-- 4. Migrate any existing 'defrosting' packs to 'thawing'
UPDATE public.food_packs SET status = 'thawing' WHERE status = 'defrosting';
