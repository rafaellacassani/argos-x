import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Argos X master workspace — only this workspace gets plan tags on chats
const ARGOS_WORKSPACE_ID = "41efdc6d-d4ba-4589-9761-7438a5911d57";

const PLAN_LABELS: Record<string, string> = {
  escala_semestral: "Escala Semestral",
  escala: "Escala",
  negocio: "Negócio",
  essencial: "Essencial",
  gratuito: "Grátis",
  semente: "Semente",
};

function planLabel(planName: string | null | undefined): string {
  if (!planName) return "Lead novo";
  return PLAN_LABELS[planName] || planName.charAt(0).toUpperCase() + planName.slice(1);
}

function last10(s: string | null | undefined): string {
  if (!s) return "";
  const d = s.replace(/[^0-9]/g, "");
  return d.length >= 10 ? d.slice(-10) : d;
}

export interface ChatPlanTag {
  label: string;     // e.g. "Escala", "Lead novo"
  isClient: boolean; // true => is a paying/registered Argos X client
  status?: string;   // subscription_status (active, trialing, past_due, ...)
}

/**
 * For the Argos X workspace only: maps each chat phone (last 10 digits)
 * to the subscriber's plan label, or "Lead novo" when no Argos account
 * is found for that number.
 */
export function useArgosClientPlanTags(
  workspaceId: string | null | undefined,
  phones: string[]
) {
  const [map, setMap] = useState<Record<string, ChatPlanTag>>({});

  // Only active in Argos X workspace
  const enabled = workspaceId === ARGOS_WORKSPACE_ID;

  // Stable key from sorted unique 10-digit phones
  const uniqueKey = enabled
    ? Array.from(new Set(phones.map(last10).filter((p) => p.length >= 10)))
        .sort()
        .join(",")
    : "";

  useEffect(() => {
    if (!enabled || !uniqueKey) {
      setMap({});
      return;
    }
    let cancelled = false;

    (async () => {
      const digits = uniqueKey.split(",");
      try {
        // Build OR filter — chunk to avoid massive query strings
        const chunkSize = 60;
        const result: Record<string, ChatPlanTag> = {};

        for (let i = 0; i < digits.length; i += chunkSize) {
          const chunk = digits.slice(i, i + chunkSize);
          const orClauses = chunk
            .flatMap((d) => [`phone.ilike.%${d}`, `personal_whatsapp.ilike.%${d}`])
            .join(",");

          const { data: profiles } = await supabase
            .from("user_profiles")
            .select("user_id, phone, personal_whatsapp")
            .or(orClauses)
            .limit(500);

          if (!profiles || profiles.length === 0) continue;

          const userIds = Array.from(new Set(profiles.map((p: any) => p.user_id)));

          const { data: members } = await supabase
            .from("workspace_members")
            .select("user_id, workspace_id")
            .in("user_id", userIds)
            .not("accepted_at", "is", null);

          if (!members || members.length === 0) continue;

          const wsIds = Array.from(new Set(members.map((m: any) => m.workspace_id)));

          const { data: ws } = await supabase
            .from("workspaces")
            .select("id, plan_name, plan_type, subscription_status, archived_at")
            .in("id", wsIds);

          if (!ws) continue;

          // Pick best workspace per user (prefer active+highest plan)
          const planRank: Record<string, number> = {
            escala_semestral: 100,
            escala: 90,
            negocio: 80,
            essencial: 70,
            gratuito: 10,
            semente: 5,
          };
          const statusRank: Record<string, number> = {
            active: 100,
            trialing: 80,
            past_due: 50,
            blocked: 30,
            canceled: 10,
            archived: 5,
          };

          const wsById: Record<string, any> = {};
          ws.forEach((w: any) => (wsById[w.id] = w));

          const userBest: Record<string, any> = {};
          for (const m of members as any[]) {
            const w = wsById[m.workspace_id];
            if (!w || w.archived_at) continue;
            // Skip the Argos master workspace itself
            if (w.id === ARGOS_WORKSPACE_ID) continue;
            const score =
              (planRank[w.plan_name] || 0) * 1000 +
              (statusRank[w.subscription_status] || 0);
            if (!userBest[m.user_id] || userBest[m.user_id]._score < score) {
              userBest[m.user_id] = { ...w, _score: score };
            }
          }

          for (const p of profiles as any[]) {
            const best = userBest[p.user_id];
            if (!best) continue;
            const tag: ChatPlanTag = {
              label: planLabel(best.plan_name),
              isClient: true,
              status: best.subscription_status,
            };
            // Index by 10-digit suffix of both phone fields
            for (const f of [p.phone, p.personal_whatsapp]) {
              const k = last10(f);
              if (k.length >= 10 && !result[k]) result[k] = tag;
            }
          }
        }

        if (!cancelled) setMap(result);
      } catch (err) {
        console.warn("[useArgosClientPlanTags] failed:", err);
        if (!cancelled) setMap({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, uniqueKey]);

  function getTag(phone: string | null | undefined): ChatPlanTag {
    if (!enabled) return { label: "", isClient: false };
    const k = last10(phone);
    if (k && map[k]) return map[k];
    return { label: "Lead novo", isClient: false };
  }

  return { enabled, getTag };
}
