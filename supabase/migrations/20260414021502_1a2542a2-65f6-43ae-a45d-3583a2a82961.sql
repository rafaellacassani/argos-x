
CREATE TABLE public.churn_survey_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  response_number INTEGER NOT NULL,
  response_text TEXT NOT NULL,
  raw_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.churn_survey_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage churn_survey_responses"
  ON public.churn_survey_responses
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_churn_survey_workspace ON public.churn_survey_responses(workspace_id);
CREATE INDEX idx_churn_survey_response ON public.churn_survey_responses(response_number);
