-- Update task names to Hebrew
update public.tasks set name = 'האכלת מיסטי (אוכל רטוב)', description = 'מנה אחת של אוכל רטוב בקערה' where name = 'Feed Misty (wet food)';
update public.tasks set name = 'האכלת מיסטי (אוכל יבש)', description = 'למלא את קערת האוכל היבש אם צריך' where name = 'Feed Misty (dry food)';
update public.tasks set name = 'מים טריים', description = 'להחליף מים בכל הקערות' where name = 'Fresh water';
update public.tasks set name = 'ניקוי ארגז חול', description = 'לנקות את ארגז החול' where name = 'Clean litter box';
update public.tasks set name = 'זמן משחק', description = 'לפחות 10 דקות של משחק' where name = 'Playtime';
update public.tasks set name = 'בדיקת חבילת אוכל', description = 'לבדוק מצב הפשרה של האוכל הטבעי' where name = 'Check food pack';
update public.tasks set name = 'חיבוקים ובדיקה', description = 'לוודא שהיא נראית שמחה ובריאה' where name = 'Cuddles & check-up';
