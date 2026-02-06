
# Corrigir Chat Travando quando Evolution API está Offline

## Problema
A tela de Chat fica presa em "Carregando conexões..." porque a chamada `listInstances()` da Evolution API dá timeout (servidor offline em `76.13.224.22:8080`). Isso bloqueia **todo** o Chat, inclusive as conversas Meta que funcionam independentemente.

## Solução
Adicionar tratamento de erro (`try/catch`) na chamada à Evolution API dentro do `loadInstances`, para que:
- Se a Evolution API falhar, o Chat continue funcionando com as páginas Meta disponíveis
- Um toast discreto informe que o WhatsApp está indisponível
- O loading seja liberado normalmente

## Mudança Técnica

### Arquivo: `src/pages/Chats.tsx` (linhas ~403-433)

Envolver a chamada `listInstances()` + `getConnectionState()` em um try/catch separado, para que falhas na Evolution API não impeçam o carregamento das conversas Meta.

Lógica atual:
```text
loadInstances()
  -> listInstances()          <-- se falhar, trava tudo
  -> getConnectionState()
  -> setInstances()
  -> setLoadingInstances(false)
```

Nova lógica:
```text
loadInstances()
  -> try { listInstances() }
  -> catch { setInstances([]) + toast warning }
  -> setLoadingInstances(false)   <-- sempre executa
```

### Resultado
- Se Evolution API estiver offline: Chat abre normalmente mostrando apenas conversas Meta
- Se nenhuma conexão existir (nem Evolution, nem Meta): mostra tela "Nenhuma conexão ativa"
- Se ambas estiverem ativas: funciona como antes, mostrando tudo unificado
