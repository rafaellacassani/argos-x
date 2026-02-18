

# Corrigir imagem e descrição ao compartilhar link no WhatsApp

## Problema
Ao compartilhar o link https://inboxia.gomktboost.com no WhatsApp, aparece o logo e descrição da Lovable porque as meta tags OpenGraph no `index.html` ainda apontam para a imagem padrão da Lovable.

## Solucao

1. **Criar uma imagem OG** (1200x630px recomendado) com a marca Inboxia/Mkt Boost e salvá-la em `public/og-image.png`
2. **Atualizar as meta tags** no `index.html`:
   - `og:image` -- apontar para a nova imagem usando a URL do domínio: `https://inboxia.gomktboost.com/og-image.png`
   - `twitter:image` -- mesma URL

## Observacao importante
- O WhatsApp faz cache das previews. Depois de atualizar e publicar, pode demorar um pouco para o WhatsApp mostrar a imagem nova. Voce pode forçar a limpeza do cache usando: https://developers.facebook.com/tools/debug/ e colando a URL do site.

## Detalhes tecnicos

Arquivo: `index.html` -- trocar as duas linhas de og:image e twitter:image para apontar para `/og-image.png` com URL absoluta do dominio.

Se nao houver uma imagem pronta da marca, posso gerar uma imagem simples com o logo Inboxia e o texto "Argos I By Mkt Boost" para usar como preview.
