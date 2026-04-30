-- Add trainer_phones array column (keeping legacy trainer_phone for backward compatibility)
ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS trainer_phones text[] NOT NULL DEFAULT '{}';

-- Backfill from legacy single-phone column when present
UPDATE public.ai_agents
SET trainer_phones = ARRAY[regexp_replace(trainer_phone, '\D', '', 'g')]
WHERE trainer_phone IS NOT NULL
  AND length(trim(trainer_phone)) > 0
  AND (trainer_phones IS NULL OR array_length(trainer_phones, 1) IS NULL);

-- Index to speed up "is this phone a trainer?" lookups in webhooks
CREATE INDEX IF NOT EXISTS idx_ai_agents_trainer_phones
  ON public.ai_agents USING GIN (trainer_phones);

COMMENT ON COLUMN public.ai_agents.trainer_phones IS
  'Lista de telefones (somente dígitos) que sempre podem conversar com a IA, ignorando pausa, bloqueio do workspace, limites do plano e janela de 24h.';