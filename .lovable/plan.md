

## Integração Meta Pixel para rastreamento de conversão no cadastro

### Como funciona

O Meta Pixel é um snippet JavaScript que você adiciona ao site. Ele dispara eventos que o Meta Ads usa para medir conversões. No seu caso:

1. O Pixel carrega em todas as páginas (PageView automático)
2. Quando alguém completa o cadastro com sucesso, disparamos o evento `CompleteRegistration`
3. No Meta Ads Manager, você configura a campanha para otimizar por esse evento

### O que precisa ser feito

**Pré-requisito**: Você precisa do **ID do Pixel** do Meta. Ele fica em Meta Business Suite → Events Manager → Data Sources. É um número público (ex: `123456789012345`), então pode ficar no código sem problema.

### Implementação

**Arquivo 1: `index.html`**
- Adicionar o script base do Meta Pixel no `<head>`, com o ID do pixel
- Chamar `fbq('init', 'SEU_PIXEL_ID')` e `fbq('track', 'PageView')`

**Arquivo 2: `src/pages/Cadastro.tsx`**
- Após o cadastro bem-sucedido (linha 80, antes do `navigate`), disparar:
  ```js
  window.fbq?.('track', 'CompleteRegistration', {
    content_name: 'Argos X Trial',
    currency: 'BRL',
    value: 0
  });
  ```

**Arquivo 3: `src/pages/CadastroSucesso.tsx`** (opcional, reforço)
- Disparar o mesmo evento no `useEffect` de montagem como fallback

### Configuração no Meta Ads

Após o deploy, você precisará:
1. Ir no **Events Manager** do Meta e copiar o ID do Pixel
2. Me passar o ID para eu colocar no código
3. Criar a campanha no Meta Ads com destino para `https://argos-x.lovable.app/cadastro`
4. Na configuração de conversão, selecionar o evento `CompleteRegistration`

### Próximo passo

Me passe o **ID do seu Meta Pixel** para eu implementar. É um número que fica no Events Manager do Meta Business Suite.

