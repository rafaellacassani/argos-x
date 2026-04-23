# 📱 Argos X — Publicação na Apple App Store

Tudo que pôde ser preparado dentro do Lovable já está pronto. A pasta nativa `ios/` só é criada no seu **Mac**, então abaixo está o passo a passo completo.

## ✅ Já preparado neste repositório

- `capacitor.config.ts` → `appId: br.com.argosx.app`, `appName: Argos X`, `webDir: dist`
- `package.json` → scripts `build:mobile`, `ios:open`, `ios:run`, `mobile:assets`
- `resources/icon.png` (1024×1024 opaco) e `resources/splash.png` (2732×2732) — fontes para gerar todos os tamanhos
- `ios-icons/AppIcon.appiconset/` — todos os PNGs do AppIcon + Contents.json (uso manual, opcional)
- `ios-info-plist-additions.xml` — permissões prontas para colar no Info.plist
- `@capacitor/core` e `@capacitor/ios` v8 já instalados

## 🖥 Passo a passo no seu Mac

**Pré-requisitos:** macOS + Xcode 15+, Node 20+, conta Apple Developer ($99/ano), CocoaPods (`sudo gem install cocoapods`).

```bash
# 1. Clonar o projeto do GitHub (use o botão "Export to GitHub" no Lovable)
git clone <seu-repo>
cd argos-x
npm install

# 2. Adicionar plataforma iOS (cria a pasta ios/)
npx cap add ios

# 3. Gerar TODOS os ícones e splashes automaticamente a partir de /resources
npx @capacitor/assets generate --ios

# 4. (IMPORTANTE) Remover o hot-reload server antes de buildar para a loja
#    Edite capacitor.config.ts e COMENTE o bloco `server: { url, cleartext }`.
#    Sem isso, o app submetido vai apontar pro preview do Lovable.

# 5. Build de produção e sync
npm run build:mobile

# 6. Abrir no Xcode
npx cap open ios
```

### No Xcode

1. Selecione o target **App** → aba **Signing & Capabilities** → marque seu Team (Apple Developer).
2. Aba **Info** → adicione as chaves de `ios-info-plist-additions.xml` (ou edite `ios/App/App/Info.plist` direto, colando o XML).
3. Aba **General** → confirme `Bundle Identifier = br.com.argosx.app`, `Display Name = Argos X`, version e build.
4. **Product → Destination → Any iOS Device (arm64)** → **Product → Archive**.
5. Janela Organizer → **Distribute App → App Store Connect → Upload**.
6. Em https://appstoreconnect.apple.com crie o app com bundle id `br.com.argosx.app`, preencha screenshots (6.7", 6.5", 5.5", iPad 12.9"), descrição, política de privacidade (já tem em `/privacy-policy`), e envie para revisão.

## 🔁 Atualizações futuras

Sempre que mudar código no Lovable e fizer pull no Mac:
```bash
git pull
npm install
npm run build:mobile   # build + cap sync
npx cap open ios       # archive + upload
```

## ⚠️ Pontos de atenção da revisão Apple

- **Ícone sem transparência** ✅ (já gerado com fundo `#0F172A`)
- **Permissões com texto em PT-BR claro** ✅ (no XML)
- **Política de privacidade pública** ✅ (`https://argosx.com.br/privacy-policy`)
- **Login de teste** — crie uma conta demo e informe usuário/senha no campo "Notas para o Avaliador"
- **Não apontar para preview Lovable** em produção (passo 4 acima)