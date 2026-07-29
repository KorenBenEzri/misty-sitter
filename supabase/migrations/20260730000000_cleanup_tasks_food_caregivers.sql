-- Remove dry food task (delete completions first for FK safety, then the task)
DELETE FROM public.task_completions
  WHERE task_id IN (SELECT id FROM public.tasks WHERE name = 'האכלת מיסטי (אוכל יבש)');
DELETE FROM public.tasks WHERE name = 'האכלת מיסטי (אוכל יבש)';

-- Add fountain cleaning task (bi-weekly)
INSERT INTO public.tasks (name, description, icon, sort_order)
VALUES ('ניקוי מזרקה', 'לנקות את מזרקת המים - פעם בשבועיים', '⛲', 8);

-- Update water task description to mention bowls specifically
UPDATE public.tasks SET description = 'להחליף מים בכל הקערות' WHERE name = 'מים טריים';

-- Update food_packs default expiry to 3.5 days (84 hours)
ALTER TABLE public.food_packs ALTER COLUMN expires_at SET DEFAULT (now() + interval '3 days 12 hours');

-- Remove all Guest caregivers
DELETE FROM public.caregivers WHERE name LIKE 'Guest %';
