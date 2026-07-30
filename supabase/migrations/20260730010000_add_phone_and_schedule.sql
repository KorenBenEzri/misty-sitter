-- Add phone number to caregivers
ALTER TABLE public.caregivers ADD COLUMN phone_number text;

-- Add update policy for caregivers (currently only select+insert exist)
CREATE POLICY "Public update caregivers" ON public.caregivers FOR UPDATE USING (true);

-- Scheduled visits calendar table
CREATE TABLE public.scheduled_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id uuid NOT NULL REFERENCES public.caregivers(id) ON DELETE CASCADE,
  scheduled_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(caregiver_id, scheduled_date)
);

ALTER TABLE public.scheduled_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read scheduled_visits" ON public.scheduled_visits FOR SELECT USING (true);
CREATE POLICY "Public insert scheduled_visits" ON public.scheduled_visits FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete scheduled_visits" ON public.scheduled_visits FOR DELETE USING (true);
