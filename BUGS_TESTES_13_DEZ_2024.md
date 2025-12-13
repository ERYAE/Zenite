# 🐛 Relatório de Bugs e Problemas - Zenite OS
**Data:** 13 de Dezembro de 2024  
**Testador:** Cascade AI  
**Contas usadas:**
- `msxlft@gmail.com` (12341234)
- `yibicil166@kudimi.com` (43214321)

---

## 🔴 BUGS CRÍTICOS

### 1. Botão de Chat Flutuante - Posicionamento Errado
**Arquivo:** `index.html` (linhas ~2920-3065)  
**Descrição:** O botão FAB de chat está posicionado no **canto ESQUERDO** da tela quando deveria estar no **canto DIREITO** no dashboard.  
**Comportamento esperado:** Dashboard = canto inferior direito; Ficha = canto inferior esquerdo.  
**Comportamento atual:** Aparece no canto esquerdo em ambos, e está parcialmente cortado/invisível.  
**Screenshot:** `test-05-chat-button.png`

### 2. Botão de Chat Flutuante - Formato Errado
**Arquivo:** `index.html` (linhas ~2920-3065)  
**Descrição:** O botão é **circular** quando deveria ser uma **pílula** (pill shape / rounded rectangle).  
**Comportamento esperado:** Botão em formato de pílula com ícone e possivelmente texto.  
**Comportamento atual:** Botão circular rosa (w-14 h-14 rounded-full).

### 3. Chat Flutuante - Não Abre Conversa
**Arquivo:** `js/app.js` ou `js/modules/social.js`  
**Descrição:** Ao clicar em um amigo no painel de chat flutuante, a conversa **não abre**.  
**Passos para reproduzir:**
1. Clicar no botão de chat flutuante
2. Clicar em um amigo na lista
3. Nada acontece - o painel fecha mas o chat não abre
**Comportamento esperado:** Abrir modal de chat com o amigo selecionado.

### 4. Chat Flutuante - Só Aparece com Modal de Amigos Aberto
**Arquivo:** `index.html`  
**Descrição:** O botão de chat flutuante **só aparece visível** quando o modal de amigos está aberto (por trás do modal).  
**Comportamento esperado:** Botão sempre visível no dashboard/sheet quando há amigos.

---

## 🟠 BUGS MÉDIOS

### 5. Painel de Notificações - Posicionamento Parcial
**Arquivo:** `index.html` (linhas ~789-837)  
**Descrição:** O painel de notificações abre no canto direito, mas ainda tem problemas de layout:
- Está sobrepondo parcialmente o conteúdo da página
- Deveria ter uma seta/triangle apontando para o botão
- O z-index pode estar conflitando com outros elementos
**Screenshot:** `test-02-notifications-panel.png`

### 6. Modal de Migração - Aparece Repetidamente
**Arquivo:** `js/modules/cloud.js` ou `js/modules/preferences.js`  
**Descrição:** O modal "EVOLUÇÃO DO SISTEMA" aparece para a conta `yibicil166@kudimi.com` mesmo após ter sido fechado anteriormente.  
**Comportamento esperado:** Uma vez fechado, não deveria aparecer novamente (flag `migration_seen` no banco).  
**Screenshot:** `test-09-migration-modal.png`

### 7. Modo Performance - Não Tem Efeito Visível
**Arquivo:** `index.html` e/ou `js/app.js`  
**Descrição:** Ao ativar/desativar o "MODO PERFORMANCE (PC ANTIGO)", não há mudança visual perceptível na aplicação.  
**Comportamento esperado:** Deveria desativar animações, efeitos de blur, transições pesadas, etc.  
**Comportamento atual:** Apenas mostra toast "Modo Performance ativado/desativado" mas nada muda visualmente.  
**Screenshot:** `test-08-performance-mode.png`

### 8. Chat no Modal de Amigos - Duplicado/Redundante
**Arquivo:** `index.html` (modal de amigos)  
**Descrição:** O modal de amigos tem botões "Chat" para cada amigo, mas agora existe um botão de chat flutuante separado. Isso é redundante.  
**Ação sugerida:** Remover os botões "Chat" do modal de amigos já que existe o chat flutuante.

---

## 🟡 BUGS MENORES / MELHORIAS

### 9. Changelog - Funciona Mas Pode Melhorar
**Arquivo:** `js/modules/changelog.js` e `index.html`  
**Descrição:** O changelog está funcionando e mostrando o conteúdo corretamente. O usuário mencionou que "não está aparecendo o que deveria", mas nos testes o conteúdo apareceu (SOCIAL OVERHAUL, CLOUDCHECK, SISTEMA BASE).  
**Possível problema:** Talvez haja atualizações no vetor `CHANGELOG` que não estão sendo refletidas no modal HTML, ou vice-versa.  
**Verificar:** Sincronização entre `js/modules/changelog.js` e o HTML do modal.  
**Screenshot:** `test-03-changelog.png`

### 10. Badge de Notificações - Contador
**Descrição:** O badge de notificações mostra "2" mesmo após marcar como lidas. Pode haver problema na atualização do estado `notificationUnreadCount`.

### 11. Formulário de Login Visível no Dashboard
**Descrição:** Após login, ainda é possível ver resquícios do formulário de login por trás do dashboard (visível no snapshot). Pode ser problema de z-index ou de hide/show.

---

## 📋 ARQUIVOS PRINCIPAIS AFETADOS

| Arquivo | Problema |
|---------|----------|
| `index.html` | Chat flutuante (posição, formato), painel notificações, chat modal amigos |
| `js/app.js` | Variáveis chatPanelOpen, notificationUnreadCount, modo performance |
| `js/modules/social.js` | Função de abrir chat do painel flutuante |
| `js/modules/cloud.js` | Modal de migração repetindo |
| `js/modules/preferences.js` | Flag migration_seen não persistindo |
| `js/modules/changelog.js` | Possível dessincronização com HTML |
| `css/` ou inline styles | Modo performance não aplica mudanças |

---

## 🔧 CORREÇÕES SUGERIDAS

### Chat Flutuante (Prioridade Alta)
```html
<!-- Mudar de circular para pílula -->
<!-- DE: -->
<button class="fixed z-[9998] w-14 h-14 rounded-full bg-pink-500...">

<!-- PARA: -->
<button class="fixed z-[9998] px-4 py-3 rounded-full bg-pink-500 flex items-center gap-2...">
  <i class="fa-solid fa-comments"></i>
  <span>Chat</span>
</button>
```

### Posicionamento Chat (Prioridade Alta)
```javascript
// Verificar condição currentView
:class="currentView === 'sheet' ? 'bottom-6 left-6' : 'bottom-6 right-6'"
// Pode estar invertido ou currentView não está sendo atualizado corretamente
```

### Modo Performance (Prioridade Média)
```javascript
// Adicionar classe ao body quando ativado
document.body.classList.toggle('performance-mode', settings.performanceMode);

// CSS
.performance-mode * {
  animation: none !important;
  transition: none !important;
  backdrop-filter: none !important;
}
```

---

## 🚀 SOBRE MIGRAÇÃO PARA REACT/TYPESCRIPT

O usuário perguntou sobre converter para React + TypeScript. **Recomendação:**

1. **Não migrar agora** - Primeiro corrigir todos os bugs documentados
2. **Preparar a base:**
   - Separar lógica de negócio da UI
   - Criar services layer para Supabase
   - Adicionar JSDoc types (preparação para TS)
3. **Migração gradual:**
   - Usar Vite + React
   - Migrar componente por componente
   - Manter Supabase client
   - Usar TailwindCSS (já existe)
   - Adicionar shadcn/ui para componentes

**Arquitetura sugerida para React:**
```
src/
├── components/
│   ├── ui/           # shadcn components
│   ├── layout/       # Header, Sidebar, etc
│   ├── dashboard/    # Dashboard components
│   ├── sheet/        # Character sheet
│   ├── chat/         # Chat components
│   └── notifications/
├── hooks/            # Custom hooks
├── services/         # Supabase services
├── stores/           # Zustand/Jotai stores
├── types/            # TypeScript types
└── utils/            # Utility functions
```

---

## 📸 SCREENSHOTS CAPTURADOS

1. `test-01-dashboard.png` - Dashboard inicial
2. `test-02-notifications-panel.png` - Painel de notificações
3. `test-03-changelog.png` - Modal de changelog
4. `test-04-friends-modal.png` - Modal de amigos
5. `test-05-chat-button.png` - Botão de chat (problema posição)
6. `test-06-chat-panel.png` - Painel de chat aberto
7. `test-07-settings.png` - Configurações
8. `test-08-performance-mode.png` - Modo performance
9. `test-09-migration-modal.png` - Modal de migração

---

## ✅ O QUE ESTÁ FUNCIONANDO

- Login/Logout
- Changelog (conteúdo aparece)
- Lista de amigos carrega corretamente
- Notificações aparecem e são salvas no histórico
- Temas/cores funcionam
- Sistema de achievements
- Campanhas (criação, listagem)
- Sincronização com Supabase
