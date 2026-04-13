
-- Create a Google Calendar token entry for ECX Company workspace
-- using the same Google account (rafaella@grupoecx.com) that is already connected on Argos X
INSERT INTO google_calendar_tokens (user_id, workspace_id, access_token, refresh_token, token_expiry, google_email, google_calendar_id, sync_enabled)
SELECT 
  user_id,
  '6a8540c9-6eb5-42ce-8d20-960002d85bac'::uuid,  -- ECX Company workspace
  access_token,
  refresh_token,
  token_expiry,
  google_email,
  google_calendar_id,
  sync_enabled
FROM google_calendar_tokens
WHERE id = 'aa64ff41-799f-470b-a6b1-b6b5053fc376'
ON CONFLICT DO NOTHING;
