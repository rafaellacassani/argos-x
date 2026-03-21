-- Fix Michele's orphan workspace: mark it as canceled so cadence stops
UPDATE public.workspaces 
SET plan_type = 'canceled', 
    subscription_status = 'canceled',
    blocked_at = now()
WHERE id = 'cd8ce611-2eb3-466b-b687-a6b2bb1ef9e2';

-- Move Michele's internal CRM lead from "Trial ativo" to "Cliente ativo"
UPDATE public.leads 
SET stage_id = '7030e322-ac11-4dfa-b128-c9b09c5efbb4'
WHERE id = 'a8259c6e-ceec-4da2-b41f-613f85ee930c'
AND workspace_id = '41efdc6d-d4ba-4589-9761-7438a5911d57';

-- Remove Trial tag
DELETE FROM public.lead_tag_assignments 
WHERE lead_id = 'a8259c6e-ceec-4da2-b41f-613f85ee930c'
AND tag_id = 'a57de997-9b5c-467d-ad1e-8b50e0d07958';

-- Add Cliente Ativo tag
INSERT INTO public.lead_tag_assignments (workspace_id, lead_id, tag_id)
VALUES ('41efdc6d-d4ba-4589-9761-7438a5911d57', 'a8259c6e-ceec-4da2-b41f-613f85ee930c', '62750bf4-b139-4462-b646-100e1c69723b')
ON CONFLICT DO NOTHING;

-- Add Essencial plan tag
INSERT INTO public.lead_tag_assignments (workspace_id, lead_id, tag_id)
VALUES ('41efdc6d-d4ba-4589-9761-7438a5911d57', 'a8259c6e-ceec-4da2-b41f-613f85ee930c', 'e399514f-7df6-46ab-b6a9-e19eaf8b257f')
ON CONFLICT DO NOTHING;