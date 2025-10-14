-- Rename column time_of_day to time in audios table
-- Safe to run multiple times: checks existence before renaming
DO $$
BEGIN
  -- Only rename if old column exists and new column does not
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'audios' AND column_name = 'time_of_day'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'audios' AND column_name = 'time'
  ) THEN
    ALTER TABLE public.audios RENAME COLUMN time_of_day TO "time";
  END IF;
END $$;

-- Optional: ensure enum/text type remains the same (no-op if already correct)
-- If there are dependent views/triggers, they should continue to work as Postgres updates references on RENAME


