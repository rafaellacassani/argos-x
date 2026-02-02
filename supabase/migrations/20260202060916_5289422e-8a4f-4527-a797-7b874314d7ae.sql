-- Create function to increment agent execution count
CREATE OR REPLACE FUNCTION public.increment_agent_executions(agent_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- This function is a placeholder since we track executions in the agent_executions table
  -- The actual count can be derived from COUNT(*) on agent_executions
  -- But we can add a cached counter later for performance if needed
  NULL;
END;
$$;