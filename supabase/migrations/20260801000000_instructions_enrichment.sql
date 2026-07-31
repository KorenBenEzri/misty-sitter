-- Enrich instructions with task linkage, transcription, storage path, and steps

ALTER TABLE public.instructions
  ADD COLUMN task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  ADD COLUMN transcript text,
  ADD COLUMN video_path text,
  ADD COLUMN steps text[];
