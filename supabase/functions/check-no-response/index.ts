import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const app = new Hono().basePath("/check-no-response");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/manager\/?$/, "") || "";
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
}

interface NotificationSettings {
  user_id: string;
  notify_no_response: boolean;
  no_response_minutes: number;
}

interface UserRole {
  user_id: string;
  role: "admin" | "manager" | "seller";
}

// Send WhatsApp message via Evolution API
async function sendWhatsAppMessage(instanceName: string, phone: string, message: string) {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
    console.error("[check-no-response] Evolution API not configured");
    return false;
  }

  try {
    // Clean phone number
    const cleanPhone = phone.replace(/\D/g, "");
    
    const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number: cleanPhone,
        text: message,
        delay: 0,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[check-no-response] Failed to send message: ${error}`);
      return false;
    }

    console.log(`[check-no-response] Message sent to ${cleanPhone}`);
    return true;
  } catch (error) {
    console.error("[check-no-response] Error sending message:", error);
    return false;
  }
}

app.options("*", (c) => new Response(null, { headers: corsHeaders }));

// Main check endpoint - should be called by cron or authenticated user
app.post("/", async (c) => {
  try {
    // Auth: Accept service role key or authenticated user
    const authHeader = c.req.header("authorization") || "";
    const apiKey = c.req.header("apikey") || "";
    const isServiceRole = apiKey === SUPABASE_SERVICE_ROLE_KEY;
    
    if (!isServiceRole) {
      if (!authHeader.startsWith("Bearer ")) {
        return c.json({ error: "Unauthorized" }, 401, corsHeaders);
      }
      const authClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || "", {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data, error } = await authClient.auth.getClaims(token);
      if (error || !data?.claims) {
        return c.json({ error: "Unauthorized" }, 401, corsHeaders);
      }
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log("[check-no-response] Starting check...");

    // 1. Get all users with notification settings enabled
    const { data: settings, error: settingsError } = await supabase
      .from("notification_settings")
      .select("user_id, notify_no_response, no_response_minutes")
      .eq("notify_no_response", true);

    if (settingsError) {
      console.error("[check-no-response] Error fetching settings:", settingsError);
      throw settingsError;
    }

    if (!settings || settings.length === 0) {
      console.log("[check-no-response] No users with notifications enabled");
      return c.json({ message: "No notifications enabled" }, 200, corsHeaders);
    }

    // 2. Get user profiles and roles
    const userIds = settings.map((s) => s.user_id);
    
    const [profilesResult, rolesResult] = await Promise.all([
      supabase.from("user_profiles").select("*").in("user_id", userIds),
      supabase.from("user_roles").select("*").in("user_id", userIds),
    ]);

    if (profilesResult.error) throw profilesResult.error;
    if (rolesResult.error) throw rolesResult.error;

    const profiles = (profilesResult.data || []) as UserProfile[];
    const roles = (rolesResult.data || []) as UserRole[];

    // 3. Get first connected WhatsApp instance
    const { data: instances } = await supabase
      .from("whatsapp_instances")
      .select("instance_name")
      .limit(1);

    if (!instances || instances.length === 0) {
      console.log("[check-no-response] No WhatsApp instance configured");
      return c.json({ message: "No WhatsApp instance" }, 200, corsHeaders);
    }

    const instanceName = instances[0].instance_name;

    // 4. Get all user profiles for mapping responsible_user to names
    const { data: allProfiles } = await supabase
      .from("user_profiles")
      .select("id, full_name");
    
    const profileMap = new Map<string, string>();
    (allProfiles || []).forEach((p: { id: string; full_name: string }) => {
      profileMap.set(p.id, p.full_name);
    });

    // 5. For each user, check their leads
    let notificationsSent = 0;

    for (const setting of settings) {
      const profile = profiles.find((p) => p.user_id === setting.user_id);
      const userRoles = roles.filter((r) => r.user_id === setting.user_id).map((r) => r.role);

      if (!profile?.phone) {
        console.log(`[check-no-response] User ${setting.user_id} has no phone`);
        continue;
      }

      const isAdmin = userRoles.includes("admin");
      const isSeller = userRoles.includes("seller");
      const minutesThreshold = setting.no_response_minutes || 10;

      // Calculate cutoff time
      const cutoffTime = new Date(Date.now() - minutesThreshold * 60 * 1000).toISOString();

      // Query for leads waiting response
      let leadsQuery = supabase
        .from("leads")
        .select("id, name, phone, updated_at, responsible_user")
        .lt("updated_at", cutoffTime)
        .eq("status", "active");

      // Sellers only see their own leads
      if (isSeller && !isAdmin) {
        const profileId = profile.id;
        leadsQuery = leadsQuery.eq("responsible_user", profileId);
      }

      const { data: leads, error: leadsError } = await leadsQuery.limit(10);

      if (leadsError) {
        console.error(`[check-no-response] Error fetching leads for ${profile.full_name}:`, leadsError);
        continue;
      }

      if (!leads || leads.length === 0) {
        continue;
      }

      // Build notification message based on role
      let message = "";

      if (isAdmin) {
        // Admin receives: lead name, phone, and responsible seller
        const leadsList = leads.slice(0, 5).map((l) => {
          const responsibleName = l.responsible_user 
            ? profileMap.get(l.responsible_user) || "Não atribuído"
            : "Não atribuído";
          const cleanPhone = l.phone?.replace(/\D/g, "") || "";
          return `• *${l.name}*\n  📱 ${l.phone || "Sem telefone"}\n  👤 Responsável: ${responsibleName}`;
        }).join("\n\n");
        
        const moreCount = leads.length > 5 ? `\n\n... e mais ${leads.length - 5} leads` : "";

        message = `🔔 *ALERTA ADMIN - Clientes aguardando resposta*\n\nOlá ${profile.full_name}!\n\nOs seguintes clientes estão esperando há mais de ${minutesThreshold} minutos:\n\n${leadsList}${moreCount}\n\n⏰ Acesse o CRM para acompanhar.`;
      } else {
        // Seller receives: lead name and phone
        const leadsList = leads.slice(0, 5).map((l) => {
          return `• *${l.name}*\n  📱 ${l.phone || "Sem telefone"}`;
        }).join("\n\n");
        
        const moreCount = leads.length > 5 ? `\n\n... e mais ${leads.length - 5} leads` : "";

        message = `🔔 *ALERTA - Clientes aguardando resposta*\n\nOlá ${profile.full_name}!\n\nOs seguintes clientes estão esperando há mais de ${minutesThreshold} minutos:\n\n${leadsList}${moreCount}\n\n⏰ Acesse o CRM para responder.`;
      }

      // Send notification
      const sent = await sendWhatsAppMessage(instanceName, profile.phone, message);
      if (sent) {
        notificationsSent++;
      }
    }

    console.log(`[check-no-response] Sent ${notificationsSent} notifications`);

    return c.json(
      { message: "Check completed", notifications_sent: notificationsSent },
      200,
      corsHeaders
    );
  } catch (error) {
    console.error("[check-no-response] Error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
      corsHeaders
    );
  }
});

Deno.serve(app.fetch);
