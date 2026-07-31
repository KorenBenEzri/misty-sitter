-- Remove food pack feature entirely
DROP TABLE IF EXISTS public.food_packs CASCADE;
DELETE FROM public.tasks WHERE name = 'בדיקת חבילת אוכל';
