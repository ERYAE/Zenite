# Guia de Modularização do Zenite

## Status Atual
O `index.html` tem ~3000 linhas, o que dificulta manutenção. Este guia explica como modularizar sem quebrar o código.

## Estratégia Recomendada: Vite + HTML Includes

### 1. Instalar Vite
```bash
npm init -y
npm install vite vite-plugin-html-includes --save-dev
```

### 2. Estrutura de Pastas
```
zenite/
├── src/
│   ├── index.html          # HTML principal (inclui os partials)
│   ├── partials/
│   │   ├── modals/
│   │   │   ├── achievements.html
│   │   │   ├── friends.html
│   │   │   ├── profile.html
│   │   │   ├── music.html
│   │   │   ├── gifs.html
│   │   │   ├── macros.html
│   │   │   ├── config.html
│   │   │   └── ...
│   │   ├── views/
│   │   │   ├── dashboard.html
│   │   │   ├── sheet.html
│   │   │   ├── campaign.html
│   │   │   └── netlink.html
│   │   └── components/
│   │       ├── header.html
│   │       ├── sidebar.html
│   │       └── dice-tray.html
│   └── js/
│       └── ... (mover arquivos JS para cá)
├── vite.config.js
└── package.json
```

### 3. Exemplo de vite.config.js
```javascript
import { defineConfig } from 'vite';
import htmlIncludes from 'vite-plugin-html-includes';

export default defineConfig({
  plugins: [
    htmlIncludes({
      directory: 'src/partials'
    })
  ],
  root: 'src',
  build: {
    outDir: '../dist'
  }
});
```

### 4. Uso no HTML
```html
<!-- index.html -->
<!DOCTYPE html>
<html>
<head>...</head>
<body>
  <!-- Views -->
  @@include('views/dashboard.html')
  @@include('views/sheet.html')
  @@include('views/campaign.html')
  
  <!-- Modals -->
  @@include('modals/achievements.html')
  @@include('modals/friends.html')
  @@include('modals/profile.html')
  ...
</body>
</html>
```

## Alternativa: Web Components (Mais Avançado)

Para componentes reutilizáveis, considere Web Components:

```javascript
// components/modal-base.js
class ModalBase extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <div class="modal-backdrop" @click="close()">
        <div class="modal-content">
          <slot></slot>
        </div>
      </div>
    `;
  }
}
customElements.define('modal-base', ModalBase);
```

## Modularização do JS (Já Feita Parcialmente)

O JS já está bem modularizado em:
- `js/app.js` - Ponto de entrada
- `js/modules/audio.js` - Sistema de áudio
- `js/modules/cloud.js` - Sincronização com nuvem
- `js/modules/config.js` - Constantes e configurações
- `js/modules/netlink.js` - Sistema de campanhas
- `js/modules/social.js` - Amigos e achievements
- `js/modules/ui.js` - Lógica de UI

### Sugestões para JS:
1. Dividir `netlink.js` (1900+ linhas) em:
   - `netlink/campaigns.js` - CRUD de campanhas
   - `netlink/realtime.js` - Conexões realtime
   - `netlink/chat.js` - Sistema de chat
   - `netlink/music.js` - Música ambiente
   - `netlink/members.js` - Gerenciamento de membros

2. Extrair helpers:
   - `utils/formatting.js` - Formatação de datas, números
   - `utils/validation.js` - Validação de dados
   - `utils/storage.js` - localStorage helpers

## Próximos Passos

1. **Fase 1**: Configurar Vite e testar com um modal simples
2. **Fase 2**: Mover modais para partials um por vez
3. **Fase 3**: Mover views para partials
4. **Fase 4**: Dividir arquivos JS grandes
5. **Fase 5**: Adicionar testes automatizados

## Importante

- **Sempre faça backup** antes de mudanças estruturais
- **Teste cada partial** individualmente após extrair
- **Mantenha Alpine.js** funcional verificando que x-data está no escopo correto
- **Use git branches** para cada fase da modularização
