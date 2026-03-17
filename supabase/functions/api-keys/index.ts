import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Token format: argx_<prefix>_<random> ──
function generateApiKey(): string {
  const prefixBytes = new Uint8Array(4);
  crypto.getRandomValues(prefixBytes);
  const prefix = Array.from(prefixBytes).map(b => b.toString(16).padStart(2, "0")).join("");

  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return `argx_${prefix}_${token}`;
}

async function hashWithPepper(key: string): Promise<string> {
  const pepper = Deno.env.get("API_KEY_PEPPER") || "";
  const encoder = new TextEncoder();
  const data = encoder.encode(pepper + key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const VALID_SCOPES = [
  "leads:read", "leads:write",
  "agents:read", "agents:write", "agents:execute",
  "messages:read", "messages:write",
  "campaigns:read",
  "calendar:read", "calendar:write",
  "tags:read", "tags:write",
  "funnels:read", "funnels:write",
  "webhooks:read", "webhooks:write",
  "clients:read", "clients:write", "clients:delete",
];

/** Convert permissions object {leads:"read", agents:"write"} → scopes array ["leads:read","agents:read","agents:write"] */
function permissionsToScopes(permissions: Record<string, string>): string[] {
  const scopes: string[] = [];
  for (const [resource, level] of Object.entries(permissions)) {
    if (level === "read") {
      scopes.push(`${resource}:read`);
    } else if (level === "write") {
      // write implies read
      scopes.push(`${resource}:read`);
      scopes.push(`${resource}:write`);
    }
    // "denied" → nothing
  }
  // Special: if agents has write, also add agents:execute
  if (permissions.agents === "write") {
    scopes.push("agents:execute");
  }
  return [...new Set(scopes)].filter(s => VALID_SCOPES.includes(s));
}

async function getAuthAndWorkspace(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw { status: 401, message: "Unauthorized" };

  const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !user) throw { status: 401, message: "Unauthorized" };

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .not("accepted_at", "is", null)
    .limit(1)
    .single();

  if (!membership || membership.role !== "admin") throw { status: 403, message: "Forbidden: admin only" };

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  return { supabase, workspaceId: membership.workspace_id, profileId: profile?.id || null };
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { supabase, workspaceId, profileId } = await getAuthAndWorkspace(req);
    const body = await req.json();
    const { action } = body;

    // LIST
    if (action === "list") {
      const { data: keys, error } = await supabase
        .from("api_keys")
        .select("id, name, key_prefix, permissions, scopes, is_active, last_used_at, expires_at, revoked_at, created_by, created_at")
        .eq("workspace_id", workspaceId)
        .is("revoked_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return jsonResponse({ keys });
    }

    // CREATE
    if (action === "create") {
      const { name, permissions, scopes: explicitScopes, expires_at } = body;

      if (!name) return jsonResponse({ error: "name required" }, 400);

      // Derive scopes from permissions if not explicitly provided
      const resolvedScopes: string[] = (explicitScopes && explicitScopes.length > 0)
        ? explicitScopes
        : (permissions ? permissionsToScopes(permissions) : []);

      const invalidScopes = resolvedScopes.filter((s: string) => !VALID_SCOPES.includes(s));
      if (invalidScopes.length > 0) {
        return jsonResponse({ error: `Invalid scopes: ${invalidScopes.join(", ")}`, valid_scopes: VALID_SCOPES }, 400);
      }

      const rawKey = generateApiKey();
      const keyHash = await hashWithPepper(rawKey);
      const parts = rawKey.split("_");
      const keyPrefix = `${parts[0]}_${parts[1]}`;

      const { data: newKey, error } = await supabase
        .from("api_keys")
        .insert({
          workspace_id: workspaceId,
          name,
          key_hash: keyHash,
          key_prefix: keyPrefix,
          permissions: permissions || {},
          scopes: resolvedScopes,
          expires_at: expires_at || null,
          created_by: profileId,
        })
        .select("id, name, key_prefix, permissions, scopes, is_active, expires_at, created_at")
        .single();

      if (error) throw error;

      return jsonResponse({
        key: newKey,
        raw_key: rawKey,
        warning: "Save this key now. It will not be shown again.",
      });
    }

    // UPDATE
    if (action === "update") {
      const { id, ...updates } = body;
      delete updates.action;

      if (!id) return jsonResponse({ error: "id required" }, 400);

      const allowedFields: Record<string, unknown> = {};
      if ("name" in updates) allowedFields.name = updates.name;
      if ("is_active" in updates) allowedFields.is_active = updates.is_active;
      if ("expires_at" in updates) allowedFields.expires_at = updates.expires_at;

      if ("permissions" in updates) {
        allowedFields.permissions = updates.permissions;
        // Auto-derive scopes from permissions unless scopes explicitly provided
        if (!("scopes" in updates)) {
          allowedFields.scopes = permissionsToScopes(updates.permissions);
        }
      }

      if ("scopes" in updates) {
        const newScopes = updates.scopes as string[];
        const invalid = newScopes.filter((s: string) => !VALID_SCOPES.includes(s));
        if (invalid.length > 0) {
          return jsonResponse({ error: `Invalid scopes: ${invalid.join(", ")}` }, 400);
        }
        allowedFields.scopes = newScopes;
      }

      const { data, error } = await supabase
        .from("api_keys")
        .update(allowedFields)
        .eq("id", id)
        .eq("workspace_id", workspaceId)
        .select()
        .single();

      if (error) throw error;
      return jsonResponse({ key: data });
    }

    // DELETE (soft revoke)
    if (action === "delete") {
      const { id } = body;
      if (!id) return jsonResponse({ error: "id required" }, 400);

      const { error } = await supabase
        .from("api_keys")
        .update({ is_active: false, revoked_at: new Date().toISOString() })
        .eq("id", id)
        .eq("workspace_id", workspaceId);

      if (error) throw error;
      return jsonResponse({ success: true, revoked: true });
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (err: any) {
    if (err.status && err.message) {
      return jsonResponse({ error: err.message }, err.status);
    }
    console.error("api-keys error:", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
