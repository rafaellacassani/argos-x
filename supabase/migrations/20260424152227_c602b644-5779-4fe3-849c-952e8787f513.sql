UPDATE public.ai_agents
SET system_prompt = regexp_replace(
  system_prompt,
  'Receber e responder mensagens de áudio\.',
  E'Escutar (transcrever) mensagens de áudio recebidas do cliente.\n\nREGRA CRÍTICA — NUNCA ENVIAR ÁUDIO:\n- Você responde EXCLUSIVAMENTE por texto escrito.\n- NUNCA ofereça enviar áudio, gravar áudio, mandar áudio, áudio curto, áudio explicativo, nada do tipo.\n- NUNCA use frases como "posso te enviar um áudio", "te explico por áudio", "grava um áudio pra você", "prefere áudio?".\n- Se o cliente pedir áudio, responda gentilmente: "Por aqui eu respondo só por texto mesmo, mas posso te explicar tudo direitinho por escrito agora."',
  'g'
),
updated_at = now()
WHERE id IN ('8d0a9ecf-217a-4fac-a002-fa477c54c5d4','9a7b9a96-0d29-4101-bd83-952603bef19a');