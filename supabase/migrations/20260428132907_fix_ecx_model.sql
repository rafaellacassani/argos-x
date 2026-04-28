-- Fix invalid model openai/gpt-5.5 (does not exist in Lovable AI Gateway) for ECX Company agents
UPDATE public.ai_agents
SET model = 'openai/gpt-5.2', updated_at = now()
WHERE workspace_id = '6a8540c9-6eb5-42ce-8d20-960002d85bac'
  AND model = 'openai/gpt-5.5';
