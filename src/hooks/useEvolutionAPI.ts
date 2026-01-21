import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface EvolutionInstance {
  instanceName: string;
  instanceId?: string;
  status?: string;
  owner?: string;
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

      // The API returns an array of instances
      return Array.isArray(data) ? data : [];
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

  return {
    loading,
    error,
    createInstance,
    getQRCode,
    getConnectionState,
    listInstances,
    deleteInstance,
    logoutInstance,
  };
}
