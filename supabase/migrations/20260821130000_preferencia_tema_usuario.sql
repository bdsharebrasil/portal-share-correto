ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS tema_preferido text NOT NULL DEFAULT 'dark';

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_tema_preferido_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_tema_preferido_check
  CHECK (tema_preferido IN ('light', 'dark'));
