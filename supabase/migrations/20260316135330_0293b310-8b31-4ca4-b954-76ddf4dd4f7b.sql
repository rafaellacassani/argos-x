-- Create cadence_messages table for multi-message support per day
CREATE TABLE public.cadence_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid NOT NULL REFERENCES public.reactivation_cadence_config(id) ON DELETE CASCADE,
  cadence_day integer NOT NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  message_type text NOT NULL DEFAULT 'text',
  content text,
  audio_url text,
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.cadence_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage cadence_messages"
  ON public.cadence_messages FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add welcome_message_template to reactivation_cadence_config
ALTER TABLE public.reactivation_cadence_config
  ADD COLUMN IF NOT EXISTS welcome_message_template text;

-- Create storage bucket for cadence audio files
INSERT INTO storage.buckets (id, name, public)
VALUES ('cadence-audio', 'cadence-audio', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: only admins can upload
CREATE POLICY "Admins can upload cadence audio"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cadence-audio' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete cadence audio"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'cadence-audio' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public can read cadence audio"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'cadence-audio');