import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface EvolutionInstance {
  instanceName: string;
  name?: string;
  instanceId?: string;
  id?: string;
  status?: string;
  owner?: string;
  ownerJid?: string;
  profileName?: string;
  profilePicUrl?: string;
  connectionStatus?: "open" | "close" | "connecting";
}

export interface ConnectionState {
  instance: {
    instanceName: string;
    state: "open" | "close" | "connecting";
  };
}

export interface QRCodeResponse {
  pairingCode?: string;
  code?: string;
  base64?: string;
  count?: number;
}

export interface EvolutionChat {
  id: string;
  remoteJid: string;
  name?: string;
  pushName?: string;
  profilePicUrl?: string;
  unreadCount?: number;
  lastMsgTimestamp?: number;
  lastMessage?: string;
}

export interface EvolutionMessage {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  pushName?: string;
  message?: {
    conversation?: string;
    extendedTextMessage?: {
      text?: string;
    };
    imageMessage?: {
      caption?: string;
    };
    videoMessage?: {
      caption?: string;
    };
    documentMessage?: {
      fileName?: string;
    };
    audioMessage?: object;
  };
  messageType?: string;
  messageTimestamp?: number;
  status?: string;
}

export interface CreateInstanceResponse {
  instance: {
    instanceName: string;
    instanceId: string;
    status: string;
  };
  hash?: {
    apikey: string;
  };
  qrcode?: QRCodeResponse;
}

export function useEvolutionAPI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createInstance = useCallback(async (instanceName: string): Promise<CreateInstanceResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("evolution-api/create-instance", {
        body: { instanceName },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao criar conexão";
      setError(message);
      console.error("[useEvolutionAPI] createInstance error:", err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getQRCode = useCallback(async (instanceName: string): Promise<QRCodeResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(`evolution-api/connect/${instanceName}`, {
        method: "GET",
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao obter QR Code";
      setError(message);
      console.error("[useEvolutionAPI] getQRCode error:", err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getConnectionState = useCallback(async (instanceName: string): Promise<ConnectionState | null> => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke(`evolution-api/connection-state/${instanceName}`, {
        method: "GET",
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return data;
    } catch (err) {
      console.error("[useEvolutionAPI] getConnectionState error:", err);
      return null;
    }
  }, []);

  const listInstances = useCallback(async (): Promise<EvolutionInstance[]> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("evolution-api/fetch-instances", {
        method: "GET",
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Map API response to our interface
      const instances = Array.isArray(data) ? data.map((item: Record<string, unknown>) => ({
        instanceName: item.name as string,
        instanceId: item.id as string,
        profileName: item.profileName as string,
        profilePicUrl: item.profilePicUrl as string,
        ownerJid: item.ownerJid as string,
        connectionStatus: item.connectionStatus as "open" | "close" | "connecting",
      })) : [];
      return instances;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao listar conexões";
      setError(message);
      console.error("[useEvolutionAPI] listInstances error:", err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteInstance = useCallback(async (instanceName: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(`evolution-api/delete/${instanceName}`, {
        method: "DELETE",
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao deletar conexão";
      setError(message);
      console.error("[useEvolutionAPI] deleteInstance error:", err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logoutInstance = useCallback(async (instanceName: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(`evolution-api/logout/${instanceName}`, {
        method: "POST",
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao desconectar";
      setError(message);
      console.error("[useEvolutionAPI] logoutInstance error:", err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchChats = useCallback(async (instanceName: string): Promise<EvolutionChat[]> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(`evolution-api/chats/${instanceName}`, {
        method: "POST",
        body: {},
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Map API response to our interface
      const chats = Array.isArray(data) ? data.map((item: Record<string, unknown>) => ({
        id: item.id as string,
        remoteJid: item.remoteJid as string || item.id as string,
        name: item.name as string,
        pushName: item.pushName as string,
        profilePicUrl: item.profilePicUrl as string,
        unreadCount: item.unreadCount as number,
        lastMsgTimestamp: item.lastMsgTimestamp as number,
      })) : [];
      return chats;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao buscar conversas";
      setError(message);
      console.error("[useEvolutionAPI] fetchChats error:", err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMessages = useCallback(async (instanceName: string, remoteJid: string, limit = 50): Promise<EvolutionMessage[]> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(`evolution-api/messages/${instanceName}`, {
        method: "POST",
        body: { remoteJid, limit },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Return messages array
      const messages = Array.isArray(data?.messages) ? data.messages : Array.isArray(data) ? data : [];
      return messages;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao buscar mensagens";
      setError(message);
      console.error("[useEvolutionAPI] fetchMessages error:", err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    createInstance,
    getQRCode,
    getConnectionState,
    listInstances,
    deleteInstance,
    logoutInstance,
    fetchChats,
    fetchMessages,
  };
}
