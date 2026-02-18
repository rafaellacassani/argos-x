
-- Fix security definer view - make it SECURITY INVOKER so RLS applies
ALTER VIEW public.meta_conversation_summary SET (security_invoker = on);
