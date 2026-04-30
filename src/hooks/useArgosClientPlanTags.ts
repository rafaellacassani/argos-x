import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

// Argos X master workspace — only this workspace gets plan tags on chats
const ARGOS_WORKSPACE_ID = "41efdc6d-d4ba-4589-9761-7438a5911d57";

// Cache TTL: 5 min. The directory of Argos clients changes slowly.
const CACHE_TTL_MS = 5 * 60 * 1000;
let cachedMap: Record<string, ChatPlanTag> | null = null;
let cachedAt = 0;
let inflight: Promise<Record<string, ChatPlanTag>> | null = null;

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

async function buildArgosClientMap(): Promise<Record<string, ChatPlanTag>> {
  // Fetch ALL user profiles (Argos has ~500, very cheap, no ILIKE/full-scan).
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("user_id, phone, personal_whatsapp")
    .or("phone.not.is.null,personal_whatsapp.not.is.null")
    .limit(5000);

  if (!profiles || profiles.length === 0) return {};

  const userIds = Array.from(new Set(profiles.map((p: any) => p.user_id).filter(Boolean)));
  if (userIds.length === 0) return {};

  const { data: members } = await supabase
    .from("workspace_members")
    .select("user_id, workspace_id")
    .in("user_id", userIds)
    .not("accepted_at", "is", null);

  if (!members || members.length === 0) return {};

  const wsIds = Array.from(new Set(members.map((m: any) => m.workspace_id)));

  const { data: ws } = await supabase
    .from("workspaces")
    .select("id, plan_name, subscription_status, archived_at")
    .in("id", wsIds);

  if (!ws) return {};

  const planRank: Record<string, number> = {
    escala_semestral: 100, escala: 90, negocio: 80, essencial: 70, gratuito: 10, semente: 5,
  };
  const statusRank: Record<string, number> = {
    active: 100, trialing: 80, past_due: 50, blocked: 30, canceled: 10, archived: 5,
  };

  const wsById: Record<string, any> = {};
  ws.forEach((w: any) => (wsById[w.id] = w));

  const userBest: Record<string, any> = {};
  for (const m of members as any[]) {
    const w = wsById[m.workspace_id];
    if (!w || w.archived_at) continue;
    if (w.id === ARGOS_WORKSPACE_ID) continue;
    const score = (planRank[w.plan_name] || 0) * 1000 + (statusRank[w.subscription_status] || 0);
    if (!userBest[m.user_id] || userBest[m.user_id]._score < score) {
      userBest[m.user_id] = { ...w, _score: score };
    }
  }

  const result: Record<string, ChatPlanTag> = {};
  for (const p of profiles as any[]) {
    const best = userBest[p.user_id];
    if (!best) continue;
    const tag: ChatPlanTag = {
      label: planLabel(best.plan_name),
      isClient: true,
      status: best.subscription_status,
    };
    for (const f of [p.phone, p.personal_whatsapp]) {
      const k = last10(f);
      if (k.length >= 10 && !result[k]) result[k] = tag;
    }
  }
  return result;
}

/**
 * For the Argos X workspace only: maps each chat phone (last 10 digits)
 * to the subscriber's plan label, or "Lead novo" when no Argos account
 * is found for that number.
 */
export function useArgosClientPlanTags(
  workspaceId: string | null | undefined,
  _phones: string[]
) {
  const [map, setMap] = useState<Record<string, ChatPlanTag>>(() => cachedMap || {});
  const enabled = workspaceId === ARGOS_WORKSPACE_ID;
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) {
      setMap({});
      return () => { mountedRef.current = false; };
    }

    const now = Date.now();
    if (cachedMap && now - cachedAt < CACHE_TTL_MS) {
      setMap(cachedMap);
      return () => { mountedRef.current = false; };
    }

    if (!inflight) {
      inflight = buildArgosClientMap()
        .then((m) => {
          cachedMap = m;
          cachedAt = Date.now();
          return m;
        })
        .catch((err) => {
          console.warn("[useArgosClientPlanTags] failed:", err);
          return {};
        })
        .finally(() => {
          // Reset inflight after a tick so retries are possible
          setTimeout(() => { inflight = null; }, 0);
        });
    }

    inflight.then((m) => {
      if (mountedRef.current) setMap(m);
    });

    return () => { mountedRef.current = false; };
  }, [enabled]);

  function getTag(phone: string | null | undefined): ChatPlanTag {
    if (!enabled) return { label: "", isClient: false };
    const k = last10(phone);
    if (k && map[k]) return map[k];
    return { label: "Lead novo", isClient: false };
  }

  return { enabled, getTag };
}
