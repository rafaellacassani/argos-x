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
  lastMessage?: {
    key?: {
      remoteJid?: string;
      fromMe?: boolean;
      id?: string;
    };
    message?: Record<string, unknown>;
    messageTimestamp?: number;
  };
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
      url?: string;
      directPath?: string;
      mimetype?: string;
      jpegThumbnail?: string;
      width?: number;
      height?: number;
    };
    videoMessage?: {
      caption?: string;
      url?: string;
      directPath?: string;
      mimetype?: string;
      jpegThumbnail?: string;
      seconds?: number;
      width?: number;
      height?: number;
    };
    documentMessage?: {
      fileName?: string;
      url?: string;
      directPath?: string;
      mimetype?: string;
      jpegThumbnail?: string;
    };
    audioMessage?: {
      url?: string;
      directPath?: string;
      mimetype?: string;
      seconds?: number;
      ptt?: boolean;
    };
    interactiveMessage?: {
      body?: {
        text?: string;
      };
      footer?: {
        text?: string;
      };
    };
    stickerMessage?: {
      url?: string;
      mimetype?: string;
    };
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
      // 1. Buscar instâncias registradas no banco de dados local (CRM)
      const { data: localInstances, error: dbError } = await supabase
        .from('whatsapp_instances')
        .select('*');

      if (dbError) {
        console.error("[useEvolutionAPI] Error fetching local instances:", dbError);
      }

      // Se não há instâncias locais, retornar vazio (ignora Evolution API)
      if (!localInstances || localInstances.length === 0) {
        console.log("[useEvolutionAPI] No local instances found");
        return [];
      }

      const localInstanceNames = localInstances.map(inst => inst.instance_name);
      console.log("[useEvolutionAPI] Local instance names:", localInstanceNames);

      // 2. Buscar dados atualizados da Evolution API
      const { data, error: fnError } = await supabase.functions.invoke("evolution-api/fetch-instances", {
        method: "GET",
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // 3. Mapear e filtrar apenas as instâncias que estão no banco local
      const allInstances = Array.isArray(data) ? data.map((item: Record<string, unknown>) => ({
        instanceName: item.name as string,
        instanceId: item.id as string,
        profileName: item.profileName as string,
        profilePicUrl: item.profilePicUrl as string,
        ownerJid: item.ownerJid as string,
        connectionStatus: item.connectionStatus as "open" | "close" | "connecting",
      })) : [];

      // Filtrar para mostrar apenas instâncias do CRM
      const filteredInstances = allInstances.filter(inst => 
        localInstanceNames.includes(inst.instanceName)
      );

      console.log("[useEvolutionAPI] Filtered instances:", filteredInstances.map(i => i.instanceName));
      return filteredInstances;
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
      // 1. Deletar na Evolution API
      const { data, error: fnError } = await supabase.functions.invoke(`evolution-api/delete/${instanceName}`, {
        method: "DELETE",
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // 2. Remover do banco de dados local
      const { error: dbError } = await supabase
        .from('whatsapp_instances')
        .delete()
        .eq('instance_name', instanceName);

      if (dbError) {
        console.error("[useEvolutionAPI] Error deleting from local DB:", dbError);
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

      // Map API response to our interface - include lastMessage for fromMe detection
      const chats = Array.isArray(data) ? data.map((item: Record<string, unknown>) => ({
        id: item.id as string,
        remoteJid: item.remoteJid as string || item.id as string,
        name: item.name as string,
        pushName: item.pushName as string,
        profilePicUrl: item.profilePicUrl as string,
        unreadCount: item.unreadCount as number,
        lastMsgTimestamp: item.lastMsgTimestamp as number,
        lastMessage: item.lastMessage as EvolutionChat['lastMessage'],
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

      // Handle different response structures from Evolution API
      // The API returns: { messages: { records: [...], total, pages, currentPage } }
      let messages: EvolutionMessage[] = [];
      
      if (data?.messages?.records && Array.isArray(data.messages.records)) {
        messages = data.messages.records;
      } else if (Array.isArray(data?.messages)) {
        messages = data.messages;
      } else if (Array.isArray(data)) {
        messages = data;
      }

      console.log(`[useEvolutionAPI] fetchMessages: Found ${messages.length} messages for ${remoteJid}`);
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

  const downloadMedia = useCallback(async (instanceName: string, messageId: string, convertToMp4 = false): Promise<{ base64?: string; mimetype?: string } | null> => {
    try {
      console.log(`[useEvolutionAPI] downloadMedia: ${instanceName}, messageId: ${messageId}`);
      
      const { data, error: fnError } = await supabase.functions.invoke(`evolution-api/media/${instanceName}`, {
        method: "POST",
        body: { messageId, convertToMp4 },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return data;
    } catch (err) {
      console.error("[useEvolutionAPI] downloadMedia error:", err);
      return null;
    }
  }, []);

  const sendText = useCallback(async (instanceName: string, number: string, text: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      console.log(`[useEvolutionAPI] sendText to ${number}`);
      
      const { data, error: fnError } = await supabase.functions.invoke(`evolution-api/send-text/${instanceName}`, {
        method: "POST",
        body: { number, text },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao enviar mensagem";
      setError(message);
      console.error("[useEvolutionAPI] sendText error:", err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const sendMedia = useCallback(async (
    instanceName: string, 
    number: string, 
    mediatype: "image" | "video" | "document", 
    media: string, 
    caption?: string,
    fileName?: string
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      console.log(`[useEvolutionAPI] sendMedia (${mediatype}) to ${number}`);
      
      const { data, error: fnError } = await supabase.functions.invoke(`evolution-api/send-media/${instanceName}`, {
        method: "POST",
        body: { number, mediatype, media, caption, fileName },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao enviar mídia";
      setError(message);
      console.error("[useEvolutionAPI] sendMedia error:", err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const sendAudio = useCallback(async (instanceName: string, number: string, audio: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      console.log(`[useEvolutionAPI] sendAudio to ${number}`);
      
      const { data, error: fnError } = await supabase.functions.invoke(`evolution-api/send-audio/${instanceName}`, {
        method: "POST",
        body: { number, audio },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao enviar áudio";
      setError(message);
      console.error("[useEvolutionAPI] sendAudio error:", err);
      return false;
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
    downloadMedia,
    sendText,
    sendMedia,
    sendAudio,
  };
}
