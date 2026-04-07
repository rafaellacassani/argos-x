
CREATE OR REPLACE FUNCTION public.clone_workspace(
  _source_workspace_id UUID,
  _new_name TEXT,
  _new_slug TEXT,
  _owner_user_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _new_ws_id UUID;
  _source_ws RECORD;
  _funnel_map JSONB := '{}';
  _stage_map JSONB := '{}';
  _tag_map JSONB := '{}';
  _r RECORD;
  _new_id UUID;
BEGIN
  SELECT * INTO _source_ws FROM workspaces WHERE id = _source_workspace_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Source workspace not found'; END IF;

  INSERT INTO workspaces (name, slug, created_by, plan_type, subscription_status, plan_name, lead_limit, extra_leads, whatsapp_limit, user_limit, ai_interactions_limit, onboarding_completed, payment_provider)
  VALUES (_new_name, _new_slug, _owner_user_id, _source_ws.plan_type, _source_ws.subscription_status, _source_ws.plan_name, _source_ws.lead_limit, _source_ws.extra_leads, _source_ws.whatsapp_limit, _source_ws.user_limit, _source_ws.ai_interactions_limit, true, _source_ws.payment_provider)
  RETURNING id INTO _new_ws_id;

  INSERT INTO workspace_members (workspace_id, user_id, role, accepted_at) VALUES (_new_ws_id, _owner_user_id, 'admin', now());

  FOR _r IN SELECT * FROM funnels WHERE workspace_id = _source_workspace_id LOOP
    _new_id := gen_random_uuid();
    INSERT INTO funnels (id, workspace_id, name, description, is_default, created_at, updated_at)
    VALUES (_new_id, _new_ws_id, _r.name, _r.description, _r.is_default, _r.created_at, _r.updated_at);
    _funnel_map := _funnel_map || jsonb_build_object(_r.id::text, _new_id::text);
  END LOOP;

  FOR _r IN SELECT * FROM funnel_stages WHERE workspace_id = _source_workspace_id ORDER BY position LOOP
    _new_id := gen_random_uuid();
    INSERT INTO funnel_stages (id, workspace_id, funnel_id, name, color, position, is_win_stage, is_loss_stage, created_at, updated_at)
    VALUES (_new_id, _new_ws_id, (_funnel_map->>(_r.funnel_id::text))::uuid, _r.name, _r.color, _r.position, _r.is_win_stage, _r.is_loss_stage, _r.created_at, _r.updated_at);
    _stage_map := _stage_map || jsonb_build_object(_r.id::text, _new_id::text);
  END LOOP;

  FOR _r IN SELECT * FROM lead_tags WHERE workspace_id = _source_workspace_id LOOP
    _new_id := gen_random_uuid();
    INSERT INTO lead_tags (id, workspace_id, name, color, created_at)
    VALUES (_new_id, _new_ws_id, _r.name, _r.color, _r.created_at);
    _tag_map := _tag_map || jsonb_build_object(_r.id::text, _new_id::text);
  END LOOP;

  INSERT INTO leads (id, workspace_id, name, phone, email, avatar_url, company, value, status, stage_id, source, responsible_user, notes, is_ignored, is_opted_out, ai_score, ai_score_label, ai_scored_at, position, created_at, updated_at)
  SELECT gen_random_uuid(), _new_ws_id, name, phone, email, avatar_url, company, value, status,
    COALESCE((_stage_map->>(stage_id::text))::uuid, stage_id), source, responsible_user, notes, is_ignored, is_opted_out,
    ai_score, ai_score_label, ai_scored_at, position, created_at, updated_at
  FROM leads WHERE workspace_id = _source_workspace_id;

  INSERT INTO lead_tag_assignments (workspace_id, lead_id, tag_id, created_at)
  SELECT _new_ws_id, new_l.id, (_tag_map->>(lta.tag_id::text))::uuid, lta.created_at
  FROM lead_tag_assignments lta
  JOIN leads old_l ON old_l.id = lta.lead_id AND old_l.workspace_id = _source_workspace_id
  JOIN leads new_l ON new_l.phone = old_l.phone AND new_l.workspace_id = _new_ws_id
  WHERE lta.workspace_id = _source_workspace_id AND _tag_map ? (lta.tag_id::text);

  INSERT INTO clients (workspace_id, razao_social, nome_fantasia, cnpj, pais, endereco, numero, bairro, municipio, estado, cep, socio_nome, socio_cpf, socio_email, socio_telefone, stakeholder_nome, stakeholder_email, financeiro_email, pacote, valor_negociado, valor_extenso, data_inicio_pagamento, negociacoes_personalizadas, status, stage, closer, bdr, created_at, updated_at, created_by)
  SELECT _new_ws_id, razao_social, nome_fantasia, cnpj, pais, endereco, numero, bairro, municipio, estado, cep, socio_nome, socio_cpf, socio_email, socio_telefone, stakeholder_nome, stakeholder_email, financeiro_email, pacote, valor_negociado, valor_extenso, data_inicio_pagamento, negociacoes_personalizadas, status, stage, closer, bdr, created_at, updated_at, created_by
  FROM clients WHERE workspace_id = _source_workspace_id;

  INSERT INTO notification_preferences (workspace_id, user_profile_id, no_response_enabled, no_response_minutes, daily_report_enabled, daily_report_time, manager_report_enabled, manager_report_frequency, manager_report_time, manager_report_day_of_week, new_lead_alert_enabled, created_at, updated_at)
  SELECT _new_ws_id, user_profile_id, no_response_enabled, no_response_minutes, daily_report_enabled, daily_report_time, manager_report_enabled, manager_report_frequency, manager_report_time, manager_report_day_of_week, new_lead_alert_enabled, created_at, updated_at
  FROM notification_preferences WHERE workspace_id = _source_workspace_id;

  INSERT INTO lead_custom_field_definitions (workspace_id, field_key, field_label, field_type, options, is_active, position, created_at)
  SELECT _new_ws_id, field_key, field_label, field_type, options, is_active, position, created_at
  FROM lead_custom_field_definitions WHERE workspace_id = _source_workspace_id;

  RETURN _new_ws_id;
END;
$$;

SELECT clone_workspace(
  '41efdc6d-d4ba-4589-9761-7438a5911d57'::uuid,
  'ECX Company'::text,
  'ecx-company'::text,
  '5aae3fe5-64aa-46e8-863e-eb56bbd10c15'::uuid
);
