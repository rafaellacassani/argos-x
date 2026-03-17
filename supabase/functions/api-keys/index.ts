import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Token format: argx_<prefix>_<random> ──
function generateApiKey(): string {
  // Generate 8-char hex prefix for fast DB lookup
  const prefixBytes = new Uint8Array(4);
  crypto.getRandomValues(prefixBytes);
  const prefix = Array.from(prefixBytes).map(b => b.toString(16).padStart(2, "0")).join("");

  // Generate 32-char random token
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
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: membership } = await supabase
      .from("workspace_members")
      .select("workspace_id, role")
      .eq("user_id", user.id)
      .not("accepted_at", "is", null)
      .limit(1)
      .single();

    if (!membership || membership.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const workspaceId = membership.workspace_id;

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

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

      return new Response(JSON.stringify({ keys }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CREATE
    if (action === "create") {
      const { name, permissions, scopes, expires_at } = body;

      if (!name) {
        return new Response(JSON.stringify({ error: "name required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate scopes
      const requestedScopes: string[] = scopes || [];
      const invalidScopes = requestedScopes.filter(s => !VALID_SCOPES.includes(s));
      if (invalidScopes.length > 0) {
        return new Response(JSON.stringify({ error: `Invalid scopes: ${invalidScopes.join(", ")}`, valid_scopes: VALID_SCOPES }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const rawKey = generateApiKey();
      const keyHash = await hashWithPepper(rawKey);
      // prefix stored as "argx_HEXHEX" (first two segments)
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
          scopes: requestedScopes,
          expires_at: expires_at || null,
          created_by: profile?.id || null,
        })
        .select("id, name, key_prefix, permissions, scopes, is_active, expires_at, created_at")
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({
          key: newKey,
          raw_key: rawKey,
          warning: "Save this key now. It will not be shown again.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // UPDATE
    if (action === "update") {
      const { id, ...updates } = body;
      delete updates.action;

      if (!id) {
        return new Response(JSON.stringify({ error: "id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const allowedFields: Record<string, unknown> = {};
      if ("name" in updates) allowedFields.name = updates.name;
      if ("permissions" in updates) allowedFields.permissions = updates.permissions;
      if ("scopes" in updates) {
        const newScopes = updates.scopes as string[];
        const invalid = newScopes.filter((s: string) => !VALID_SCOPES.includes(s));
        if (invalid.length > 0) {
          return new Response(JSON.stringify({ error: `Invalid scopes: ${invalid.join(", ")}` }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        allowedFields.scopes = newScopes;
      }
      if ("is_active" in updates) allowedFields.is_active = updates.is_active;
      if ("expires_at" in updates) allowedFields.expires_at = updates.expires_at;

      const { data, error } = await supabase
        .from("api_keys")
        .update(allowedFields)
        .eq("id", id)
        .eq("workspace_id", workspaceId)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ key: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE (soft revoke)
    if (action === "delete") {
      const { id } = body;

      if (!id) {
        return new Response(JSON.stringify({ error: "id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabase
        .from("api_keys")
        .update({ is_active: false, revoked_at: new Date().toISOString() })
        .eq("id", id)
        .eq("workspace_id", workspaceId);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, revoked: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("api-keys error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
