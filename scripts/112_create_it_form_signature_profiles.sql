-- Migration: Create IT form signature profiles table
-- Purpose: Allow Department Heads and Admins to store/update their reusable approval signatures

CREATE TABLE IF NOT EXISTS public.it_form_signature_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL,
  signature_data_url text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_it_form_signature_profiles_user_id
  ON public.it_form_signature_profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_it_form_signature_profiles_role
  ON public.it_form_signature_profiles(role);

COMMENT ON TABLE public.it_form_signature_profiles IS 'Reusable signatures for HOD/Admin approval workflows';
COMMENT ON COLUMN public.it_form_signature_profiles.signature_data_url IS 'Base64 PNG signature with embedded QCC IT APP hologram watermark';
