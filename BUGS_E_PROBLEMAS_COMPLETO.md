# 🐛 ZENITE - Relatório Completo de Bugs e Problemas

> **Data:** 11/12/2025  
> **Versão:** 2.0 - Análise Profunda 110%  
> **Objetivo:** Documentar ABSOLUTAMENTE TUDO para criar um sistema PERFEITO  
> **Análise:** Código completo do projeto (400KB+ de JS, ~12000+ linhas)  
> **Metodologia:** Engenheiro Sênior + Arquiteto + UX Designer + QA Lead + Usuário

---

## 🎯 FILOSOFIA DESTE DOCUMENTO

> **"Se imagine um humano querendo jogar RPG de mesa e tem um site PERFEITO para mexer, onde TUDO é confiável, TODAS as fichas funcionam, TODAS as funções funcionam, você pode convidar seus amigos para campanha e etc."**

Este documento NÃO é apenas uma lista de bugs. É um **mapa completo** para transformar o Zenite em um software de **classe mundial** - como se Google, Apple e Microsoft tivessem colaborado neste projeto.

---

## 📊 VISÃO GERAL DO PROJETO

### Estrutura de Arquivos JS
| Arquivo | Tamanho | Linhas | Complexidade | Descrição |
|---------|---------|--------|--------------|-----------|
| `netlink.js` | 135KB | ~3400 | 🔴 CRÍTICA | Sistema de campanhas - **URGENTE: DIVIDIR EM MÓDULOS** |
| `social.js` | 91KB | ~2300 | 🟠 ALTA | Amigos, chat, achievements |
| `cloud.js` | 64KB | ~1700 | 🟠 ALTA | Supabase, sync, auth |
| `ui.js` | 61KB | ~1500 | 🟡 MÉDIA | Interface, modais, cropper |
| `router.js` | 24KB | ~600 | 🟡 MÉDIA | Navegação SPA |
| `audio.js` | 23KB | ~600 | 🟢 BAIXA | Música e SFX |
| `app.js` | ~45KB | ~1150 | 🟠 ALTA | Estado principal Alpine |
| `changelog.js` | 8KB | ~200 | 🟢 BAIXA | Sistema de changelog |
| `rpg.js` | 7KB | ~180 | 🟢 BAIXA | Lógica de RPG/dados |
| `security.js` | 7KB | ~180 | 🟢 BAIXA | Rate limiting, validação |
| `utils.js` | 8KB | ~200 | 🟢 BAIXA | Funções utilitárias |
| `config.js` | 1KB | ~30 | 🟢 BAIXA | Configurações |
| `logger.js` | 6KB | ~160 | 🟢 BAIXA | Sistema de logs |

**Total:** ~400KB de JavaScript puro | **Problema:** Arquivos muito grandes = difícil manutenção

---

# 🔴 SEÇÃO 1: ERROS CRÍTICOS (BLOQUEADORES)

## 1.1 Null Safety em `char.powers`
**Severidade:** 🔴 CRÍTICA | **Frequência:** Alta | **Prioridade:** P0

**Erro:**
```
Uncaught TypeError: Cannot read properties of null (reading 'powers')
    at [Alpine] char.powers.passive
    at [Alpine] char.powers.active
    at [Alpine] char.powers['lvl'+lvl]
```

**Análise 5 Whys:**
1. Por que ocorre? → `char.powers` acessado quando `char` é `null`
2. Por que `char` é null? → `handleLogoClick()` seta `this.char = null`
3. Por que Alpine avalia? → `x-model` avaliado ANTES do `x-if`
4. Por que isso? → Alpine processa bindings síncronamente
5. Por que não previsto? → Falta de padrão defensivo

**Arquivos:** `ui.js:775-788`, `index.html:2010,2014,2047`

**Solução:**
```javascript
handleLogoClick() {
    if (this.logoClickCount === 1) {
        this.currentView = 'dashboard';
        this.activeTab = 'profile';
        this.selectedCharId = null;
        this.$nextTick(() => { this.char = null; });
        
        if (this.activeCampaign && this.currentView === 'campaign') {
            this.leaveCampaign();
        }
    }
}
```

---

## 1.2 Mensagem "Saiu da Campanha" Incorreta
**Severidade:** 🟡 MÉDIA | **Prioridade:** P1

**Problema:** Clique na logo quando está na ficha exibe "saiu da campanha" mesmo sem estar na campanha.

**Causa:** Verificação incompleta
```javascript
// ERRADO
if (this.activeCampaign) { this.leaveCampaign(); }

// CORRETO
if (this.activeCampaign && this.currentView === 'campaign') { this.leaveCampaign(); }
```

**Arquivo:** `ui.js` → `handleLogoClick()`

---

## 1.3 Mensagens de Chat Invertidas
**Severidade:** 🔴 CRÍTICA | **Prioridade:** P0

**Problema:** Mensagens aparecem invertidas (minhas aparecem como do amigo e vice-versa).

**Análise do Código:**
```javascript
// social.js - Verificar se RPC retorna is_mine corretamente
loadChatMessages: isMine: m.is_mine,
loadChatMessagesFallback: isMine: m.sender_id === this.user.id,
optimisticMessage: isMine: true,
setupChatRealtime: isMine: false (para recebidas)
```

**Possíveis Causas:**
1. RPC `get_chat_messages` retornando `is_mine` invertido
2. Fallback com dados incorretos
3. Race condition entre optimistic update e realtime

**Arquivos:** `social.js`, Supabase RPC `get_chat_messages`

---

# 🟠 SEÇÃO 2: SISTEMAS SOCIAIS

## 2.1 Sistema de Convites de Campanha
**Severidade:** 🟠 ALTA | **Prioridade:** P1

**Problemas:**
| # | Problema | Impacto |
|---|----------|---------|
| 1 | Sem notificação visual ao convidado | Usuário não sabe que foi convidado |
| 2 | Sem feedback ao GM sobre status | GM não sabe se aceito/recusado |
| 3 | Realtime broadcast falha silenciosamente | Convites perdidos |
| 4 | Sem reenvio de convites expirados | Convites ficam pendentes eternamente |
| 5 | Sem confirmação de recebimento | Não há garantia de entrega |

**Código Problemático (netlink.js ~3179):**
```javascript
async inviteFriendToCampaign(friendUserId) {
    // Cria convite...
    if (this.realtimeChannel) {
        this.realtimeChannel.send({...}); // Sem await, sem catch!
    }
}
```

**Solução Completa:**
1. Sistema de notificações persistentes no banco
2. Badge/contador de convites pendentes
3. Retry automático com exponential backoff
4. Feedback bidirecional (GM ↔ Player)
5. Expiração automática após 7 dias

---

## 2.2 Sistema de Amigos
**Severidade:** 🟡 MÉDIA | **Prioridade:** P2

**Problemas:**
1. `loadFriends()` sem debounce → chamadas múltiplas
2. Sem paginação → performance ruim com muitos amigos
3. Realtime duplica entradas
4. Pedidos sem notificação consistente
5. Sem indicador de amigo online/offline
6. Sem bloqueio de usuários

**Arquivo:** `social.js`

---

## 2.3 Sistema de Chat
**Severidade:** 🟡 MÉDIA | **Prioridade:** P2

**Problemas:**
| # | Problema | Solução |
|---|----------|---------|
| 1 | Rate limiting (20/min) muito restritivo | Aumentar para 30/min |
| 2 | Contador não lidas dessincroniza | Recalcular no load |
| 3 | Scroll automático falha | Force scroll após render |
| 4 | Sem indicador "digitando..." | Implementar via realtime |
| 5 | Emojis só via modal | Suporte inline |
| 6 | Sem preview de links | Implementar unfurl |
| 7 | Sem formatação (bold, italic) | Markdown básico |

**Arquivo:** `social.js`

---

# 🟡 SEÇÃO 3: PROBLEMAS DE UX/EXPERIÊNCIA

## 3.1 Limite de Rolagem de Dados
**Requisito:** Alterar de 60s para **15 segundos**  
**Arquivos:** `netlink.js`, `security.js`

## 3.2 Tempo de Chat
**Requisito:** Aumentar de 20/min para **30/min**  
**Arquivo:** `security.js`

## 3.3 Modo Performance Não Funciona
**Severidade:** 🟡 MÉDIA | **Prioridade:** P2

**Problema:** Toggle não faz diferença perceptível.

**Causas Prováveis:**
1. Caminho CSS errado (`./css/` vs `/css/`)
2. CSS não sobrescreve corretamente (falta `!important`)
3. Animações JS não verificam flag
4. Web Fonts ainda carregam
5. Imagens não são otimizadas

**Solução Completa:**
```javascript
applyLowPerfMode() {
    if (this.settings.lowPerfMode) {
        document.body.classList.add('low-perf');
        
        // 1. CSS inline para performance imediata
        const style = document.createElement('style');
        style.id = 'low-perf-inline';
        style.textContent = `
            .low-perf * { 
                animation: none !important;
                transition: none !important;
            }
            .low-perf .backdrop-blur { backdrop-filter: none !important; }
        `;
        document.head.appendChild(style);
        
        // 2. Desabilita partículas/efeitos
        this.particlesEnabled = false;
        
        // 3. Reduz frequência de realtime
        if (this.realtimeChannel) {
            this.realtimeChannel.throttle = 1000;
        }
    }
}
```

**Arquivos:** `css/low-performance.css`, `ui.js`

---

## 3.4 Feedback Visual Mobile
**Problema:** Banner aparece mas site não é otimizado para toque.

**Melhorias Necessárias:**
1. Touch targets mínimo 44x44px
2. Swipe gestures para navegação
3. Pull to refresh
4. Vibração em ações
5. Keyboard avoidance

---

## 3.5 Loading States Inconsistentes
**Problema:** Algumas ações não mostram loading.

**Ações que PRECISAM de loading:**
- Login/Register
- Sync to cloud
- Load campaign
- Send message
- Roll dice (para campanha)
- Save character
- Upload image

---

## 3.6 Erros Não São Amigáveis
**Problema:** Erros técnicos aparecem para o usuário.

**Exemplo:**
```
// RUIM
"PGRST116: no rows found"

// BOM  
"Personagem não encontrado. Ele pode ter sido deletado."
```

**Solução:** Criar `translateError()` global para TODOS os erros.

---

# 🔊 SEÇÃO 4: ÁUDIO/MÚSICA

## 4.1 Música Não Toca Consistentemente
**Severidade:** 🟡 MÉDIA | **Prioridade:** P2

**Causas:**
1. Política de autoplay do navegador
2. AudioContext suspenso
3. AdBlockers bloqueando
4. Estado não persistido

**Solução Robusta:**
```javascript
// 1. Detectar estado do AudioContext
async initAudio() {
    if (!audioCtx) return;
    
    if (audioCtx.state === 'suspended') {
        // Mostrar indicador visual
        this.audioBlocked = true;
        
        // Tentar resumir em qualquer clique
        document.addEventListener('click', async () => {
            await audioCtx.resume();
            this.audioBlocked = false;
        }, { once: true });
    }
}

// 2. Detectar AdBlocker
async detectAdBlocker() {
    try {
        await fetch('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js', {
            method: 'HEAD',
            mode: 'no-cors'
        });
        return false;
    } catch {
        return true;
    }
}
```

## 4.2 Memory Leak em Sons
**Problema:** Osciladores não são limpos corretamente.

**Solução:**
```javascript
// Pool de nós de áudio reutilizáveis
const audioNodePool = {
    oscillators: [],
    getOscillator() {
        return this.oscillators.pop() || audioCtx.createOscillator();
    },
    returnOscillator(osc) {
        osc.disconnect();
        this.oscillators.push(osc);
    }
};
```

---

# 🗄️ SEÇÃO 5: DADOS E PERSISTÊNCIA

## 5.1 Sincronização Cloud vs Local
**Severidade:** 🟠 ALTA | **Prioridade:** P1

**Problema:** Last-write-wins sem merge.

**Cenário de Conflito:**
1. Tab A: Edita nome para "João"
2. Tab B: Edita HP para 50
3. Tab B salva → HP=50
4. Tab A salva → Nome="João", HP volta ao original

**Solução:** Implementar merge por campo com timestamps:
```javascript
async smartSync(localData, cloudData) {
    const merged = {};
    
    for (const key of Object.keys(localData)) {
        const localTimestamp = localData[key]._lastModified || 0;
        const cloudTimestamp = cloudData[key]?._lastModified || 0;
        
        merged[key] = localTimestamp > cloudTimestamp 
            ? localData[key] 
            : cloudData[key];
    }
    
    return merged;
}
```

---

## 5.2 Wizard Não Salva Rascunho
**Severidade:** 🟡 MÉDIA | **Prioridade:** P2

**Solução:**
```javascript
// Auto-save a cada mudança
wizardAutoSave: debounce(function() {
    const draft = {
        step: this.wizardStep,
        data: this.wizardData,
        points: this.wizardPoints,
        timestamp: Date.now()
    };
    localStorage.setItem('zenite_wizard_draft', JSON.stringify(draft));
}, 1000),

// Restaurar no init
restoreWizardDraft() {
    const saved = localStorage.getItem('zenite_wizard_draft');
    if (saved) {
        const draft = JSON.parse(saved);
        // Só restaura se for recente (< 24h)
        if (Date.now() - draft.timestamp < 86400000) {
            this.wizardData = draft.data;
            this.wizardStep = draft.step;
            this.wizardPoints = draft.points;
        }
    }
}
```

---

## 5.3 Bestiário Apenas Local
**Severidade:** 🟡 MÉDIA | **Prioridade:** P2

**Problema:** Mestre perde bestiário ao trocar de PC.

**Solução:** Migrar para Supabase com tabela `bestiary`:
```sql
CREATE TABLE bestiary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'enemy',
    stats JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5.4 Race Condition na Navegação
**Severidade:** 🟠 ALTA | **Prioridade:** P1

**Problema:** Cliques rápidos causam estados inconsistentes.

**Solução:**
```javascript
// Sistema de fila de navegação
navigationQueue = [];
isNavigating = false;

async navigate(route, param) {
    // Adiciona à fila
    this.navigationQueue.push({ route, param });
    
    // Processa se não estiver navegando
    if (!this.isNavigating) {
        await this.processNavigationQueue();
    }
}

async processNavigationQueue() {
    this.isNavigating = true;
    
    while (this.navigationQueue.length > 0) {
        const { route, param } = this.navigationQueue.shift();
        await this._executeNavigation(route, param);
    }
    
    this.isNavigating = false;
}
```

---

# 🔔 SEÇÃO 6: SISTEMA DE NOTIFICAÇÕES

## 6.1 Notificações Não Funcionam
**Severidade:** 🔴 CRÍTICA | **Prioridade:** P0

**Problema:** Sistema não notifica NADA:
- ❌ Novas mensagens de chat
- ❌ Convites de amigo
- ❌ Convites de campanha
- ❌ Atualizações do sistema

**Solução Completa:**

### 6.1.1 Arquitetura de Notificações
```javascript
// Sistema centralizado de notificações
const NotificationCenter = {
    queue: [],
    maxVisible: 5,
    
    // Tipos de notificação
    types: {
        message: { icon: 'fa-envelope', sound: 'notification', priority: 1 },
        invite: { icon: 'fa-user-plus', sound: 'success', priority: 2 },
        campaign: { icon: 'fa-users', sound: 'success', priority: 2 },
        dice: { icon: 'fa-dice', sound: 'dice', priority: 0 },
        system: { icon: 'fa-bell', sound: 'click', priority: 1 }
    },
    
    show(type, message, options = {}) {
        const config = this.types[type] || this.types.system;
        const notification = {
            id: Date.now(),
            type,
            message,
            icon: config.icon,
            priority: config.priority,
            timestamp: new Date(),
            read: false,
            action: options.action,
            actionLabel: options.actionLabel,
            persistent: options.persistent || false
        };
        
        this.queue.push(notification);
        this._render();
        
        if (config.sound && this.soundEnabled) {
            playSFX(config.sound);
        }
        
        if (!options.persistent) {
            setTimeout(() => this.dismiss(notification.id), 5000);
        }
        
        return notification.id;
    },
    
    dismiss(id) {
        this.queue = this.queue.filter(n => n.id !== id);
        this._render();
    }
};
```

### 6.1.2 Integração com Realtime
```javascript
// Em social.js - Setup de listeners
setupNotificationListeners() {
    // Novas mensagens
    this.supabase
        .channel('notifications')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'friend_messages',
            filter: `receiver_id=eq.${this.user.id}`
        }, (payload) => {
            if (this.activeChatFriendId !== payload.new.sender_id) {
                NotificationCenter.show('message', 'Nova mensagem!', {
                    action: () => this.openChat(payload.new.sender_id)
                });
            }
        })
        .subscribe();
}
```

---

# ⚡ SEÇÃO 7: PERFORMANCE E OTIMIZAÇÃO

## 7.1 Código Precisa Divisão
**Problema:** Arquivos gigantes são impossíveis de manter.

**Proposta de Reestruturação:**
```
js/modules/
├── netlink/
│   ├── campaign.js      (CRUD de campanhas)
│   ├── members.js       (Gerenciamento de membros)
│   ├── dice.js          (Sistema de dados)
│   ├── chat.js          (Chat da campanha)
│   ├── bestiary.js      (Bestiário)
│   └── index.js         (Re-exports)
├── social/
│   ├── friends.js       (Sistema de amigos)
│   ├── chat.js          (Chat privado)
│   ├── achievements.js  (Conquistas)
│   └── index.js
├── cloud/
│   ├── auth.js          (Autenticação)
│   ├── sync.js          (Sincronização)
│   ├── storage.js       (Upload de arquivos)
│   └── index.js
└── ...
```

---

## 7.2 Possíveis Memory Leaks
**Pontos de Atenção:**
1. Event listeners não removidos
2. Subscriptions do Supabase não limpas
3. Intervalos/Timeouts não clearados
4. Referências circulares em closures

**Solução:** Implementar cleanup em todos os componentes:
```javascript
// Em cada módulo
cleanup() {
    // Remove listeners
    this.listeners.forEach(l => l.remove());
    
    // Unsubscribe do realtime
    if (this.realtimeChannel) {
        this.supabase.removeChannel(this.realtimeChannel);
    }
    
    // Clear intervals
    this.intervals.forEach(i => clearInterval(i));
}
```

---

## 7.3 Bundle Size
**Problema Potencial:** Muitas dependências externas.

**Análise:**
| Dependência | Tamanho | Necessário? |
|-------------|---------|-------------|
| Supabase | ~50KB | ✅ Sim |
| Chart.js | ~200KB | 🟡 Lazy load |
| Cropper.js | ~80KB | 🟡 Lazy load |
| Alpine.js | ~40KB | ✅ Sim |
| Font Awesome | ~100KB | 🟡 Subset |

**Solução:** Lazy loading de módulos pesados:
```javascript
// Só carrega Chart.js quando necessário
async showChart() {
    if (!window.Chart) {
        await import('https://cdn.jsdelivr.net/npm/chart.js');
    }
    // Usa Chart...
}
```

---

# 🔒 SEÇÃO 8: SEGURANÇA

## 8.1 Rate Limiting
**Status:** ✅ Implementado mas precisa ajustes

| Operação | Atual | Recomendado |
|----------|-------|-------------|
| Dice Roll | 10/60s | **10/15s** |
| Chat | 20/60s | **30/60s** |
| API Call | 10/60s | 40/60s |
| Invite | 5/60s | 10/60s |

## 8.2 Input Validation
**Verificar:**
- [ ] XSS em mensagens de chat
- [ ] SQL Injection (via Supabase RLS)
- [ ] CSRF em ações sensíveis
- [ ] Sanitização de nomes de personagem
- [ ] Limites de tamanho de upload

## 8.3 RLS (Row Level Security)
**Verificar no Supabase:**
- [ ] Usuários só veem próprios dados
- [ ] Membros só veem campanhas que participam
- [ ] GM tem permissões especiais na campanha
- [ ] Mensagens só entre amigos

---

# 🗑️ SEÇÃO 9: LIMPEZA DE DADOS

## 9.1 CASCADE DELETE
**Verificar no Supabase:**
```sql
-- Ao deletar campanha:
-- ✅ campaign_members deletados?
-- ✅ dice_logs deletados?
-- ✅ campaign_logs deletados?

-- Ao deletar usuário:
-- ✅ profiles deletado?
-- ✅ friend_messages deletadas?
-- ✅ friendships deletadas?
-- ✅ campaign_members deletados?
```

## 9.2 Garbage Collection
**Implementar limpeza automática:**
```sql
-- Job semanal para limpar dados antigos
DELETE FROM dice_logs WHERE created_at < NOW() - INTERVAL '90 days';
DELETE FROM campaign_logs WHERE created_at < NOW() - INTERVAL '90 days';
DELETE FROM friend_messages WHERE created_at < NOW() - INTERVAL '180 days';
```

---

# 🧪 SEÇÃO 10: TESTES MENTAIS

## 10.1 Fluxo: Novo Usuário
```
1. Acessa site → Vê tela de login ✅
2. Clica "Criar conta" → Form de registro ✅
3. Preenche dados → Submete ✅
4. Recebe email de confirmação → ❓ (verificar)
5. Confirma email → Login automático ❓
6. Vê dashboard vazio → ✅
7. Clica "Novo Personagem" → Wizard ✅
8. Completa wizard → Personagem criado ✅
9. Edita ficha → Salva automaticamente ❓
10. Convida amigo → ❓ (sistema de convites)
```

## 10.2 Fluxo: Sessão de RPG
```
1. GM cria campanha → ✅
2. GM gera código de convite → ✅
3. Jogador entra com código → ✅
4. Jogador seleciona personagem → ✅
5. GM vê jogadores na campanha → ✅
6. Jogador rola dados → Todos veem ✅
7. Chat funciona em tempo real → ❓
8. GM edita ficha do jogador → ❓
9. Sessão dura 4 horas sem problemas → ❓
10. Jogador sai e volta → Estado preservado ❓
```

## 10.3 Fluxo: Reconexão
```
1. Usuário perde conexão → Detectar ✅
2. Mostrar indicador offline → ❓
3. Ações ficam em queue → ❓
4. Reconecta → Sync automático ❓
5. Conflitos resolvidos → ❓
```

---

# 📋 CHECKLISTS COMPLETOS

## Para Engenheiro Sênior 👨‍💻
- [ ] Null safety em TODAS as propriedades aninhadas
- [ ] Race condition protection em TODAS as operações async
- [ ] Memory leak prevention em event listeners
- [ ] Error boundaries em componentes críticos
- [ ] Logging estruturado para debugging
- [ ] Retry com exponential backoff
- [ ] Circuit breaker para APIs externas
- [ ] Debounce/Throttle em operações frequentes

## Para Arquiteto 🏛️
- [ ] Separação clara: UI | Business Logic | Data
- [ ] Padrões consistentes entre módulos
- [ ] Dependências bem definidas (sem circular)
- [ ] Estado global mínimo e previsível
- [ ] Facilidade de teste unitário
- [ ] Documentação de APIs internas
- [ ] Versionamento de schema do banco

## Para UX Designer 🎨
- [ ] Feedback visual em TODAS as ações
- [ ] Loading states consistentes
- [ ] Erros amigáveis
- [ ] Animações suaves (60fps)
- [ ] Acessibilidade (ARIA, contraste)
- [ ] Responsividade completa
- [ ] Touch targets adequados (44x44px)

## Para Usuário Comum 👤
- [ ] Navegação intuitiva
- [ ] Dados sempre salvos
- [ ] Notificações funcionam
- [ ] Chat em tempo real
- [ ] Convites chegam
- [ ] Música toca
- [ ] Sem erros na tela

## Para Usuário Avançado 🎮
- [ ] Atalhos de teclado
- [ ] Modo performance funciona
- [ ] Macros de dados
- [ ] Backup/Restore
- [ ] Temas customizáveis
- [ ] API pública (futuro)

---

# 💰 SEÇÃO 11: FREE TIER - VERCEL & SUPABASE

## 11.1 Limites do Supabase Free Tier

| Recurso | Limite Free | Status Atual | Ação |
|---------|-------------|--------------|------|
| **Database** | 500MB | ⚠️ Monitorar | Implementar garbage collection |
| **Storage** | 1GB | ✅ OK | Comprimir imagens antes de upload |
| **Bandwidth** | 2GB/mês | ⚠️ Monitorar | Cache agressivo no cliente |
| **Edge Functions** | 500K/mês | ✅ OK | Usar apenas quando necessário |
| **Realtime** | 200 conexões simultâneas | 🔴 CRÍTICO | Desconectar quando não usar |
| **API Requests** | Ilimitado | ✅ OK | Mas usar rate limiting |
| **Auth Users** | Ilimitado | ✅ OK | - |

### ⚠️ Otimizações OBRIGATÓRIAS para Free Tier

**1. Realtime - Desconectar Quando Não Usar:**
```javascript
// CRÍTICO: Máximo 200 conexões simultâneas
// Desconectar ao sair da campanha/chat
leaveCampaign() {
    if (this.realtimeChannel) {
        this.supabase.removeChannel(this.realtimeChannel);
        this.realtimeChannel = null;
    }
}

// Desconectar ao fechar chat
closeChatModal() {
    if (this.chatRealtimeChannel) {
        this.supabase.removeChannel(this.chatRealtimeChannel);
        this.chatRealtimeChannel = null;
    }
}
```

**2. Storage - Comprimir Imagens:**
```javascript
// Antes de upload, comprimir para WebP
async compressImage(file, maxWidth = 400, quality = 0.8) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = await createImageBitmap(file);
    
    const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
    canvas.width = img.width * ratio;
    canvas.height = img.height * ratio;
    
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    return new Promise(resolve => {
        canvas.toBlob(resolve, 'image/webp', quality);
    });
}
```

**3. Database - Garbage Collection:**
```sql
-- Executar semanalmente via cron job ou manualmente
-- Limpar logs antigos (>90 dias)
DELETE FROM dice_logs WHERE created_at < NOW() - INTERVAL '90 days';
DELETE FROM campaign_logs WHERE created_at < NOW() - INTERVAL '90 days';

-- Limpar mensagens antigas (>180 dias)
DELETE FROM friend_messages WHERE created_at < NOW() - INTERVAL '180 days';

-- Limpar convites expirados (>30 dias)
DELETE FROM campaign_members 
WHERE status = 'pending' AND created_at < NOW() - INTERVAL '30 days';
```

**4. Bandwidth - Cache no Cliente:**
```javascript
// Usar localStorage para cache de dados que mudam pouco
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

async getCachedData(key, fetcher) {
    const cached = localStorage.getItem(`cache_${key}`);
    if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL) {
            return data;
        }
    }
    
    const freshData = await fetcher();
    localStorage.setItem(`cache_${key}`, JSON.stringify({
        data: freshData,
        timestamp: Date.now()
    }));
    
    return freshData;
}
```

---

## 11.2 Limites do Vercel Free Tier

| Recurso | Limite Free | Status | Ação |
|---------|-------------|--------|------|
| **Bandwidth** | 100GB/mês | ✅ OK | Otimizar assets |
| **Serverless Executions** | 100GB-hrs | ✅ OK | Não usar serverless |
| **Builds** | 6000 min/mês | ✅ OK | - |
| **Edge Config Reads** | 1M/mês | ✅ OK | - |
| **Image Optimization** | 1000/mês | ⚠️ Limitar | Usar placeholders |

### Otimizações para Vercel

**1. Otimizar Bundle Size:**
- Lazy load Chart.js e Cropper.js
- Usar subset de Font Awesome
- Tree shaking em imports

**2. Cache Headers:**
```javascript
// vercel.json - já implementado
{
    "headers": [
        {
            "source": "/css/(.*)",
            "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000" }]
        },
        {
            "source": "/js/(.*)",
            "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000" }]
        }
    ]
}
```

---

# 🚀 SEÇÃO 12: PREPARAÇÃO PARA MIGRAÇÃO REACT + TYPESCRIPT

## 12.1 Contexto da Migração

O projeto atual usa:
- **Alpine.js** → Migrar para **React 18+**
- **JavaScript** → Migrar para **TypeScript**
- **CSS/Tailwind** → Manter **Tailwind CSS**
- **Supabase** → Manter **Supabase**
- **Vite** → Manter **Vite**

## 12.2 Preparação Agora (Facilitar Migração Futura)

### ✅ Boas Práticas para Código Atual

**1. Separar Lógica de UI:**
```javascript
// ❌ RUIM - Lógica misturada com UI
async loadFriends() {
    const { data } = await this.supabase.from('friendships')...
    this.friends = data.map(f => ({ ... }));
    this.friendsLoading = false;
}

// ✅ BOM - Lógica separada (fácil de migrar)
// services/friends.js
export async function fetchFriends(supabase, userId) {
    const { data, error } = await supabase.from('friendships')...
    if (error) throw error;
    return data.map(f => ({ ... }));
}

// No componente Alpine (agora) ou React (futuro)
async loadFriends() {
    this.friendsLoading = true;
    try {
        this.friends = await fetchFriends(this.supabase, this.user.id);
    } finally {
        this.friendsLoading = false;
    }
}
```

**2. Tipar Dados com JSDoc (Preparar para TypeScript):**
```javascript
/**
 * @typedef {Object} Character
 * @property {string} id
 * @property {string} name
 * @property {string} class
 * @property {number} level
 * @property {CharacterStats} stats
 * @property {CharacterPowers} powers
 */

/**
 * @typedef {Object} CharacterPowers
 * @property {string} passive
 * @property {string} active
 * @property {string} [lvl3]
 * @property {string} [lvl6]
 * @property {string} [lvl9]
 * @property {string} [lvl10]
 */

/**
 * @param {Character} char
 * @returns {number}
 */
function calculateTotalStats(char) {
    // ...
}
```

**3. Extrair Hooks Reutilizáveis:**
```javascript
// hooks/useSupabase.js - Mesmo padrão funcionará no React
export function createSupabaseHelpers(supabase) {
    return {
        async query(table, options = {}) {
            let query = supabase.from(table).select(options.select || '*');
            if (options.filter) query = query.match(options.filter);
            if (options.order) query = query.order(options.order.column, options.order);
            if (options.limit) query = query.limit(options.limit);
            return query;
        },
        
        async insert(table, data) {
            return supabase.from(table).insert(data).select().single();
        },
        
        async update(table, id, data) {
            return supabase.from(table).update(data).eq('id', id);
        },
        
        async delete(table, id) {
            return supabase.from(table).delete().eq('id', id);
        }
    };
}
```

## 12.3 Estrutura de Arquivos para Migração

### Estrutura Atual (Alpine.js)
```
js/
├── app.js
└── modules/
    ├── netlink.js (135KB - MUITO GRANDE)
    ├── social.js (91KB)
    ├── cloud.js (64KB)
    └── ...
```

### Estrutura Alvo (React + TypeScript)
```
src/
├── components/
│   ├── common/
│   │   ├── Button.tsx
│   │   ├── Modal.tsx
│   │   ├── Toast.tsx
│   │   └── ...
│   ├── character/
│   │   ├── CharacterCard.tsx
│   │   ├── CharacterSheet.tsx
│   │   ├── PowersTab.tsx
│   │   └── ...
│   ├── campaign/
│   │   ├── CampaignList.tsx
│   │   ├── CampaignPanel.tsx
│   │   ├── DiceTray.tsx
│   │   └── ...
│   └── social/
│       ├── FriendsList.tsx
│       ├── ChatModal.tsx
│       └── ...
├── hooks/
│   ├── useAuth.ts
│   ├── useCharacter.ts
│   ├── useCampaign.ts
│   ├── useRealtime.ts
│   └── ...
├── services/
│   ├── supabase.ts
│   ├── characters.ts
│   ├── campaigns.ts
│   ├── friends.ts
│   └── ...
├── types/
│   ├── character.ts
│   ├── campaign.ts
│   ├── user.ts
│   └── ...
├── store/
│   ├── authStore.ts
│   ├── characterStore.ts
│   └── ...
└── utils/
    ├── validation.ts
    ├── formatting.ts
    └── ...
```

## 12.4 Mapeamento de Migração

| Alpine.js Atual | React Equivalente |
|-----------------|-------------------|
| `x-data` | `useState` / Zustand store |
| `x-init` | `useEffect` |
| `x-show` | Conditional rendering `{show && <Component/>}` |
| `x-if` | Conditional rendering |
| `x-for` | `.map()` |
| `x-model` | `value` + `onChange` |
| `x-on:click` | `onClick` |
| `$watch` | `useEffect` com deps |
| `$nextTick` | `flushSync` ou `setTimeout` |
| `this.notify()` | Toast library (react-hot-toast) |

## 12.5 Checklist Pré-Migração

### Código
- [ ] Separar lógica de negócio de UI
- [ ] Adicionar JSDoc types em funções críticas
- [ ] Extrair funções puras para `/utils`
- [ ] Criar services para Supabase queries
- [ ] Remover código morto

### Dados
- [ ] Documentar schema do Supabase
- [ ] Criar types para todas as tabelas
- [ ] Verificar RLS policies
- [ ] Exportar SQL de criação de tabelas

### Testes
- [ ] Escrever testes para funções críticas
- [ ] Documentar fluxos de usuário
- [ ] Criar mocks para Supabase

### Assets
- [ ] Otimizar imagens
- [ ] Subset de fonts
- [ ] Documentar theme/design tokens

---

# ♿ SEÇÃO 13: ACESSIBILIDADE E INCLUSÃO (WCAG 2.1)

## 13.1 Auditoria de Acessibilidade

O Zenite deve ser jogável por todos. Auditoria inicial revela pontos críticos:

| Critério | Status | Ação Necessária |
|----------|--------|-----------------|
| **Contraste de Cores** | ⚠️ Alerta | Revisar textos cinza (`text-gray-500`) em fundos escuros. Mínimo 4.5:1. |
| **Navegação por Teclado** | 🔴 Crítico | Modais não prendem foco (trap focus). Elementos interativos sem `tabindex`. |
| **Leitores de Tela** | 🔴 Crítico | Ícones sem `aria-label`. Botões apenas com ícones são invisíveis para SR. |
| **Redução de Movimento** | ✅ OK | Respeita `prefers-reduced-motion` (verificar implementação em JS). |
| **Zoom/Escala** | ⚠️ Alerta | Layout quebra com zoom de 200%. `viewport` bloqueia zoom (`user-scalable=no`). |

### 13.2 Plano de Correção A11Y

**1. Correção de Viewport (Mobile):**
```html
<!-- Permitir zoom para acessibilidade -->
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<!-- Remover user-scalable=no, maximum-scale=1.0 -->
```

**2. Semântica e ARIA:**
```html
<!-- ❌ RUIM -->
<div @click="rollDice()">🎲</div>

<!-- ✅ BOM -->
<button 
    @click="rollDice()" 
    aria-label="Rolar dados" 
    class="focus:ring-2 focus:ring-cyan-500"
>
    <i class="fa-solid fa-dice" aria-hidden="true"></i>
</button>
```

**3. Focus Trap em Modais (Alpine.js):**
```html
<!-- Adicionar x-trap do Alpine -->
<div x-show="open" x-trap.noscroll="open" role="dialog" aria-modal="true">
    <!-- Conteúdo do modal -->
</div>
```

**4. Cores Acessíveis (Tailwind):**
- Substituir `text-gray-500` por `text-gray-400` em fundos `bg-gray-900`.
- Garantir que links tenham identificação além da cor (sublinhado ou ícone).

---

# 🛡️ SEÇÃO 14: SEGURANÇA AVANÇADA E COMPLIANCE

## 14.1 Proteção contra XSS e Injection

O módulo `security.js` já possui sanitização, mas precisamos de camadas extras.

**1. Content Security Policy (CSP):**
Adicionar via meta tag ou headers no Vercel:
```html
<meta http-equiv="Content-Security-Policy" content="
    default-src 'self'; 
    script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://*.supabase.co; 
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; 
    img-src 'self' data: blob: https://*.supabase.co https://*.user-content.com; 
    font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com; 
    connect-src 'self' https://*.supabase.co wss://*.supabase.co;
">
```
*Nota: `unsafe-eval` necessário para Alpine.js. `unsafe-inline` para styles dinâmicos.*

**2. Sanitização de Input Rigorosa:**
```javascript
// ui.js - Ao renderizar HTML de usuário (ex: bio, notas)
// Usar DOMPurify (adicionar biblioteca 15KB)
import DOMPurify from 'dompurify';

const safeHTML = DOMPurify.sanitize(userInput, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
    ALLOWED_ATTR: ['href']
});
```

## 14.2 Proteção de Dados (LGPD/GDPR)

**1. Botão "Exportar Meus Dados":**
- O usuário deve poder baixar um JSON com todos os seus dados.
- Rota no Supabase Edge Function ou JS Client que agrega: Profile, Characters, Campaigns.

**2. Botão "Excluir Conta":**
- Deve ser uma exclusão "Hard Delete" (CASCADE em tudo).
- Confirmar com senha ou digitação de "DELETAR".

---

# �️ SEÇÃO 15: ARQUITETURA DO FUTURO (NETLINK 3.0)

O arquivo `netlink.js` é o maior gargalo técnico (135KB). A refatoração é mandatória para a migração React.

## 15.1 Estrutura Modular Proposta

Quebrar o monolito `netlink.js` em microsserviços lógicos no frontend:

```
js/modules/netlink/
├── core.js          # Inicialização, estado global da campanha
├── realtime.js      # Gerenciamento de canais Supabase (join/leave/sync)
├── dice.js          # Lógica de rolagens, logs e sons
├── chat.js          # Chat da campanha (separado do social.js)
├── members.js       # Gestão de jogadores (kick, promote, invite)
└── synchronization.js # Sincronização de fichas (Player <-> Campaign)
```

## 15.2 Exemplo de Refatoração: `dice.js`

**Antes (Misturado em netlink.js):**
```javascript
// netlink.js
rollForCampaign(sides) {
    // validação
    // rate limit
    // lógica do dado
    // som
    // envio realtime
    // log local
}
```

**Depois (Módulo Isolado):**
```javascript
// modules/netlink/dice.js
import { playSFX } from '../audio.js';
import { rateLimiters } from '../security.js';

export class CampaignDiceSystem {
    constructor(campaignId, realtimeChannel) {
        this.campaignId = campaignId;
        this.channel = realtimeChannel;
    }

    async roll(sides, modifier = 0, reason = '') {
        if (!rateLimiters.diceRoll.isAllowed(this.campaignId)) {
            throw new Error('Rate limit exceeded');
        }

        const result = this._calculateRoll(sides, modifier);
        playSFX('dice');
        
        await this.channel.send({
            type: 'broadcast',
            event: 'dice_roll',
            payload: result
        });
        
        return result;
    }

    _calculateRoll(sides, modifier) {
        // Lógica pura de RNG
    }
}
```

## 15.3 Benefícios da Refatoração
1. **Testabilidade:** Fácil testar `CampaignDiceSystem` isolado.
2. **Manutenibilidade:** Arquivos menores (<300 linhas).
3. **Reutilização:** O mesmo sistema de dados pode ser usado fora de campanha.
4. **Migração:** Cada módulo vira um Hook/Contexto no React (`useCampaignDice`).

---

# �🎯 PRIORIZAÇÃO ATUALIZADA (COM NOVAS SEÇÕES)

## 🔴 P0 - CRÍTICO (Segurança e Estabilidade)
1. ✅ Null safety `char.powers`
2. 🔄 Mensagens chat invertidas
3. 🔄 Notificações
4. 🆕 **Navegação por teclado (Focus Trap)** - Acessibilidade crítica
5. 🆕 **Garbage Collection (Free Tier)** - Evitar travar banco

## 🟠 P1 - ALTO (Qualidade de Vida)
6. 🔄 Rate limiting ajustado
7. 🆕 **Compressão de Imagens**
8. 🆕 **Desconectar Realtime Ocioso**

---

*Documento v2.1 - Análise com Acessibilidade e Arquitetura Modular*


## 🔴 P0 - CRÍTICO (Corrigir HOJE)
1. ✅ Null safety em `char.powers`
2. 🔄 Mensagens de chat invertidas
3. 🔄 Sistema de notificações não funciona
4. ✅ Mensagem "saiu da campanha" incorreta

## 🟠 P1 - ALTO (Esta Semana)
5. Sistema de convites precisa refatoração
6. ✅ Rate limiting de dados (15s)
7. Música não toca consistentemente
8. Modo performance ineficaz
9. Race conditions na navegação

## 🟡 P2 - MÉDIO (Próximas 2 Semanas)
10. Wizard salvar rascunho
11. Bestiário na nuvem
12. Chat melhorias UX
13. Código divisão em módulos

## 🟢 P3 - BAIXO (Backlog)
14. Indicador "digitando..."
15. Paginação de amigos
16. Merge inteligente de sync
17. Testes automatizados
18. PWA offline support

---

# 📌 OBJETIVO FINAL

O Zenite deve ser um software que:

✅ **NUNCA** mostra erro técnico ao usuário  
✅ **SEMPRE** salva dados automaticamente  
✅ **SEMPRE** dá feedback visual em ações  
✅ **NUNCA** perde mensagens ou convites  
✅ **SEMPRE** funciona mesmo com conexão ruim  
✅ **SEMPRE** é rápido e responsivo  
✅ **SEMPRE** é bonito e agradável de usar  

> **"O melhor software é aquele que você nem percebe que está usando."**

---

*Documento v2.0 - Análise 110% Completa*  
*Última atualização: 11/12/2025*
