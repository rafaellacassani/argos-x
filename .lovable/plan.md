

## Corrigir: Cliente não consegue criar conexão WhatsApp ("already in use")

### Problema
O usuário `marubalves@gmail.com` (workspace "Realize", ID `054d8f7b...`) tenta criar uma conexão WhatsApp e recebe "Edge Function returned a non-2xx status code". 

A causa é que a instância `054d8f7b-limpa-nome` já existe na Evolution API (de uma tentativa anterior), mas **não** existe na tabela local `whatsapp_instances`. Quando o sistema tenta `POST /instance/create`, a Evolution API retorna **403 "This name is already in use"**, e o código atual propaga o erro sem tratamento.

### Correção

**Arquivo**: `supabase/functions/evolution-api/index.ts` (endpoint `/create-instance`, linhas ~204-215)

Quando o `create` falhar com 403 (nome já em uso), fazer fallback para `connect` (buscar QR code da instância existente) em vez de retornar erro:

```ts
app.post("/create-instance", async (c) => {
  try {
    const { instanceName } = await c.req.json();
    if (!instanceName || typeof instanceName !== "string" || instanceName.length > 100 || !/^[a-zA-Z0-9_-]+$/.test(instanceName)) {
      return c.json({ error: "Invalid instanceName" }, 400, corsHeaders);
    }
    
    let result;
    try {
      result = await evolutionRequest("/instance/create", "POST", { instanceName, qrcode: true, integration: "WHATSAPP-BAILEYS" });
    } catch (createError: any) {
      // If instance already exists in Evolution API, try to connect instead
      if (createError.message?.includes("already in use") || createError.message?.includes("403")) {
        console.log(`[evolution-api] Instance ${instanceName} already exists, connecting instead`);
        result = await evolutionRequest(`/instance/connect/${instanceName}`);
      } else {
        throw createError;
      }
    }
    
    return c.json(result, 200, corsHeaders);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Failed to create instance" }, 500, corsHeaders);
  }
});
```

### O que NÃO será alterado
- Nenhum componente frontend
- Nenhuma tabela do banco
- Nenhuma lógica de agentes, calendário, áudio, imagens

### Resultado
- **Antes**: erro 500 quando a instância já existe na Evolution API
- **Depois**: reconecta automaticamente e retorna QR code normalmente

