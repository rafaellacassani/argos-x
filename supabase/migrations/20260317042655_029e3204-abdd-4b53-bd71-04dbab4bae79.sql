
-- Add scopes array column to api_keys for granular v1 permissions
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS scopes text[] NOT NULL DEFAULT '{}';

-- Add revoked_at for soft revocation tracking
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS revoked_at timestamptz DEFAULT NULL;

-- Create index on key_prefix for fast prefix-based lookup (avoid full table scan)
CREATE INDEX IF NOT EXISTS idx_api_keys_key_prefix ON public.api_keys (key_prefix);

-- Create index on key_hash for hash lookup
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON public.api_keys (key_hash);
