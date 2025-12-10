# 🐛 ZENITE OS - Documento de Bugs e Problemas

> **Versão:** 2.3.x  
> **Data de Análise:** Dezembro 2024  
> **Última Atualização:** Dezembro 2024  
> **Objetivo:** Documentação detalhada de todos os problemas conhecidos e potenciais para correção futura

---

## ✅ CORREÇÕES APLICADAS

As seguintes correções foram implementadas:

| # | Problema | Status | Arquivo(s) Modificado(s) |
|---|----------|--------|--------------------------|
| 1 | Música Safari/iOS | ✅ CORRIGIDO | `netlink.js` - Adicionada detecção de Safari/iOS, `playsinline`, tracking de interação do usuário |
| 2 | Achievements repetidos | ✅ CORRIGIDO | `social.js` - Debounce de 500ms, persistência de 24h no localStorage |
| 3 | Modal de Migração | ✅ CORRIGIDO | `index.html` - Botão alterado para "Em Breve" desabilitado |
| 4 | Erro ao sair da campanha | ✅ CORRIGIDO | `netlink.js` - Try-catch separado para não mostrar erro após sucesso |
| 5 | Display Name sem salvar | ✅ CORRIGIDO | `social.js` + `index.html` - Função `saveProfile()` e botão "Salvar" |
| 6 | Sincronização de fichas | ✅ MELHORADO | `cloud.js` - Timeout de 30s, retry com backoff exponencial (3 tentativas) |
| 7 | Sistema de amigos | ✅ MELHORADO | `social.js` - Fallbacks robustos, prevenção de chamadas simultâneas |
| 8 | Menu de Perfil lento | ✅ OTIMIZADO | `index.html` - Removidos efeitos pesados (backdrop-blur, holographic, scanlines) |
| 9 | Toast de achievements cortado | ✅ CORRIGIDO | `social.js` - Posicionamento responsivo com padding lateral |
| 10 | Cropper não abre no Wizard | ✅ CORRIGIDO | `index.html` - z-index aumentado de 10000 para 12000 (wizard usa 11000) |

---

## ⚠️ FUNÇÕES SQL NECESSÁRIAS (NÃO INCLUÍDAS NO SCHEMA)

O código JavaScript depende das seguintes funções SQL que **NÃO estão no schema fornecido**:

| Função | Arquivo | Uso |
|--------|---------|-----|
| `get_friends_full()` | `social.js` | Retorna lista de amigos com todos os dados do perfil |
| `get_pending_requests()` | `social.js` | Retorna pedidos de amizade pendentes |
| `send_friend_request(sender_id, target_username)` | `social.js` | Envia pedido de amizade |
| `get_friend_conversation(p_friend_id, p_limit, p_offset)` | `social.js` | Carrega mensagens do chat |
| `send_friend_message(p_receiver_id, p_content)` | `social.js` | Envia mensagem para amigo |
| `send_campaign_invite(p_campaign_id, p_friend_id)` | `social.js` | Envia convite de campanha |
| `change_username(new_username)` | `social.js`, `ui.js` | Altera username com validação |
| `is_username_available(new_username, current_user_id)` | `social.js` | Verifica disponibilidade |
| `check_username_available(check_username, current_user_id)` | `social.js`, `cloud.js` | Verifica disponibilidade (registro) |
| `get_username_cooldown_days(user_id)` | `social.js` | Retorna dias restantes de cooldown |
| `check_email_oauth_provider(email_to_check)` | `cloud.js` | Verifica provedor OAuth |
| `leave_campaign(p_campaign_id)` | `social.js` | Sai de uma campanha |
| `leave_all_campaigns()` | `social.js` | Sai de todas as campanhas |
| `delete_all_my_campaigns()` | `social.js` | Deleta campanhas onde é GM |

**IMPORTANTE:** Se essas funções não existirem no banco, o código usará fallbacks (queries diretas) onde disponíveis, mas algumas funcionalidades podem falhar.

---

## 📋 Índice

1. [Problemas de Áudio/Música](#1-problemas-de-áudiomúsica)
2. [Sistema de Achievements](#2-sistema-de-achievements)
3. [Changelog](#3-changelog)
4. [Modal de Migração](#4-modal-de-migração)
5. [Campanha - Erro ao Sair](#5-campanha---erro-ao-sair)
6. [Problemas Visuais e Margens](#6-problemas-visuais-e-margens)
7. [Menu de Perfil](#7-menu-de-perfil)
8. [Display Name](#8-display-name)
9. [Sincronização de Fichas na Nuvem](#9-sincronização-de-fichas-na-nuvem)
10. [Sistema de Amigos](#10-sistema-de-amigos)
11. [Ícone CloudCheck](#11-ícone-cloudcheck)
12. [Problemas Potenciais Identificados](#12-problemas-potenciais-identificados)

---

## 1. Problemas de Áudio/Música

### 🔴 Prioridade: ALTA

### Descrição
A música ambiente da campanha não reproduz corretamente em dispositivos iOS (iPhone/iPad) e/ou navegador Safari.

### Localização do Código
- **Arquivo:** `js/modules/netlink.js`
- **Funções afetadas:** 
  - `playMusicLocally()` (linha ~2665)
  - `resumeMusicLocally()` (linha ~2714)
  - `stopMusicLocally()` (linha ~2695)

### Análise Técnica
O sistema atual utiliza um `<iframe>` do YouTube para reprodução de música:
```javascript
const newSrc = `https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}&enablejsapi=1`;
```

**Problemas identificados:**
1. **Autoplay bloqueado em iOS/Safari:** O Safari e iOS bloqueiam autoplay de mídia sem interação do usuário
2. **postMessage pode falhar:** A comunicação via `postMessage` com o iframe do YouTube pode não funcionar em Safari devido a políticas de segurança
3. **Falta de fallback:** Não há detecção de falha de reprodução específica para iOS/Safari

### Causa Raiz Provável
- Safari requer interação do usuário para iniciar qualquer mídia com áudio
- O parâmetro `autoplay=1` é ignorado em iOS/Safari sem gesto do usuário
- A API postMessage para controle do iframe pode ser bloqueada por ITP (Intelligent Tracking Prevention)

### Sugestões de Correção
1. Detectar Safari/iOS e exigir clique explícito para iniciar música
2. Usar a YouTube IFrame Player API oficial com eventos de erro
3. Adicionar um botão de "Ativar Som" específico para Safari
4. Implementar fallback com Web Audio API para browsers compatíveis

---

## 2. Sistema de Achievements

### 🔴 Prioridade: ALTA

### Descrição
Os achievements aparecem repetidamente mesmo quando o usuário já os desbloqueou anteriormente.

### Localização do Código
- **Arquivo:** `js/modules/social.js`
- **Função:** `checkAchievements()` (linha ~435)
- **Função:** `showAchievementUnlock()` (linha ~486)
- **Função:** `showAchievementToast()` (linha ~501)

### Análise Técnica
O sistema tenta usar uma flag de sessão para evitar duplicados:
```javascript
if (!window._achievementsShownThisSession) {
    window._achievementsShownThisSession = new Set();
}
```

**Problemas identificados:**
1. **Verificação por sessão apenas:** A flag `_achievementsShownThisSession` é resetada a cada refresh da página
2. **Carregamento assíncrono:** O `initSocial()` carrega achievements do localStorage, mas `checkAchievements()` pode ser chamado antes da carga completa
3. **Verificação redundante:** O método `checkAchievements()` é chamado em múltiplos pontos (ao salvar stats, após rolagens, etc.)
4. **Race condition:** Se `achievementsLoaded` não estiver true, o check retorna cedo, mas depois é chamado novamente

### Causa Raiz Provável
- Conflito entre o estado salvo no localStorage e o estado em memória
- O prefixo por usuário (`_userPrefix`) pode mudar durante a sessão causando perda de dados
- Falta de debounce nas chamadas de `checkAchievements()`

### Sugestões de Correção
1. Adicionar debounce no `checkAchievements()` para evitar chamadas múltiplas
2. Salvar último achievement mostrado com timestamp no localStorage
3. Verificar se achievement foi mostrado nas últimas 24h antes de exibir novamente
4. Aguardar `achievementsLoaded === true` em todas as chamadas

---

## 3. Changelog

### 🟡 Prioridade: MÉDIA

### Descrição
O modal de changelog apresenta problemas de exibição ou funcionalidade.

### Localização do Código
- **Arquivo:** `js/modules/changelog.js`
- **Funções:** `getLatestUpdate()`, `hasNewUpdate()`, `markUpdateSeen()`
- **Dados:** Array `CHANGELOG`

### Análise Técnica
```javascript
export function hasNewUpdate() {
    const lastSeenUpdate = localStorage.getItem('zenite_last_seen_update');
    const latest = CHANGELOG[0];
    return latest && lastSeenUpdate !== latest.title;
}
```

**Problemas potenciais:**
1. **Comparação por título:** Se o título mudar ligeiramente, será considerado novo
2. **Sem versionamento:** Não há versão numérica, apenas comparação de string
3. **localStorage não prefixado por usuário:** Diferentes usuários no mesmo browser podem conflitar

### Sugestões de Correção
1. Usar ID ou versão numérica ao invés de título
2. Prefixar key do localStorage com ID do usuário
3. Adicionar campo `version` em cada entrada do changelog

---

## 4. Modal de Migração

### 🟡 Prioridade: MÉDIA

### Descrição
O painel de migração que direciona para o "Zenite novo" (Project Prospectus) deveria mostrar "Em Breve" ao invés de ter um botão ativo.

### Localização do Código
- **Arquivo:** `index.html` (linhas 51-99)
- **Estado:** `migrationModalOpen`
- **Trigger:** `js/modules/cloud.js` linhas 609 e 753

### Código Atual
```html
<button @click="window.location.href='https://zenitev2.vercel.app'" 
        class="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600...">
    ACESSAR A NOVA VERSÃO
</button>
```

### Ação Necessária
Substituir o botão por texto "Em Breve" e remover a funcionalidade de redirecionamento temporariamente.

### Sugestão de Código
```html
<div class="w-full py-4 bg-gradient-to-r from-gray-600 to-gray-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-3 opacity-60 cursor-not-allowed">
    <i class="fa-solid fa-clock"></i>
    EM BREVE
</div>
```

---

## 5. Campanha - Erro ao Sair

### 🟡 Prioridade: MÉDIA

### Descrição
Ao sair da campanha, a operação aparenta suceder mas exibe mensagem "Erro ao sair da campanha" de qualquer forma.

### Localização do Código
- **Arquivo:** `js/modules/netlink.js`
- **Função:** `leaveCampaignAsMember()` (linha ~565)

### Análise Técnica
```javascript
async leaveCampaignAsMember() {
    // ... código de remoção ...
    
    playSFX('success');
    this.notify('Você saiu da campanha.', 'success');
    
    // Volta para a lista
    await this.leaveCampaign();  // <-- Esta chamada pode lançar erro silencioso
    
} catch (e) {
    console.error('[NETLINK] Erro ao sair da campanha:', e);
    this.notify('Erro ao sair da campanha.', 'error');
}
```

**Problemas identificados:**
1. **Duas notificações:** Uma de sucesso e depois potencialmente uma de erro
2. **leaveCampaign() pode falhar:** A função chamada após o sucesso pode lançar erro
3. **Catch genérico:** Qualquer erro em `leaveCampaign()` dispara a mensagem de erro

### Causa Raiz Provável
- A função `leaveCampaign()` (linha ~2214) pode falhar em operações como `disconnectRealtime()` ou `stopMusicLocally()` mas a remoção do membro já ocorreu com sucesso
- O erro ocorre DEPOIS da saída bem-sucedida

### Sugestões de Correção
1. Envolver a chamada `await this.leaveCampaign()` em try-catch separado
2. Não exibir erro se a remoção do membro foi bem-sucedida
3. Mover a notificação de sucesso para depois de todas as operações

---

## 6. Problemas Visuais e Margens

### 🟡 Prioridade: MÉDIA

### Descrição
Algumas margens parecem incorretas, com botões e imagens levemente cortadas em certas partes do site.

### Áreas Potencialmente Afetadas

#### 6.1 Modal de Migração
- **Arquivo:** `index.html` (linha 60)
- **Classe:** `overflow-hidden` pode cortar conteúdo em telas menores

#### 6.2 Cards de Personagem
- **Problema:** Fotos podem estar cortadas devido a `object-cover` sem aspect-ratio consistente
- **Verificar:** Dashboard cards, ficha de personagem

#### 6.3 Botões com Ícones
- **Problema:** Padding insuficiente em alguns botões
- **Verificar:** Botões de ação na toolbar, botões de modais

#### 6.4 Mobile
- **Problema:** `compact-mode` pode causar cortes
- **Arquivo:** `js/modules/ui.js` linha 33
```javascript
document.documentElement.style.setProperty('--compact-scale', '0.9');
```

### Áreas para Investigar
1. **Achievement Toast:** Posicionamento `top-20 left-1/2` pode cortar em telas estreitas
2. **Modal de Perfil:** Altura máxima pode cortar conteúdo
3. **Chat de Campanha:** Mensagens longas podem ter overflow incorreto
4. **Menu Dropdown do Usuário:** Pode sair da tela em resoluções baixas

### Sugestões de Correção
1. Usar `overflow-visible` ou `overflow-auto` onde apropriado
2. Adicionar `min-height` e `max-height` consistentes
3. Testar em múltiplas resoluções (320px, 768px, 1024px, 1440px)
4. Verificar `padding` em todos os containers

---

## 7. Menu de Perfil

### 🟠 Prioridade: MÉDIA-ALTA

### Descrição
O menu de perfil está com baixa performance e poluição visual excessiva.

### Localização do Código
- **Arquivo:** `index.html` - seção do profile modal
- **Estado:** `profileModalOpen`
- **CSS:** `css/style.css`, `css/output.css`

### Problemas Identificados

#### 7.1 Performance
- **Causa:** Excesso de animações e efeitos simultâneos
- **Elementos pesados:** Gradientes animados, blur/backdrop-filter, múltiplos box-shadows

#### 7.2 Poluição Visual
- **Causa:** Muitos elementos competindo por atenção
- **Problemas:**
  - Ícones demais
  - Cores muito saturadas
  - Falta de hierarquia visual clara
  - Informações não essenciais ocupando espaço

### Sugestões de Correção
1. **Performance:**
   - Remover `will-change` desnecessários
   - Reduzir uso de `backdrop-blur`
   - Simplificar animações (usar só `opacity` e `transform`)
   - Lazy load de seções do perfil

2. **Visual:**
   - Reduzir número de elementos visíveis
   - Usar accordion/tabs para agrupar informações
   - Cores mais sutis, menos gradientes
   - Espaçamento maior entre seções

---

## 8. Display Name

### 🔴 Prioridade: ALTA

### Descrição
O display name não funciona corretamente e falta botão "Salvar" para confirmar alterações.

### Localização do Código
- **Arquivo:** `js/modules/social.js`
- **Variáveis relacionadas:**
  - `displayName` (usado em vários locais como fallback)
- **Arquivo:** `js/modules/cloud.js`
  - `display_name` no registro (linhas 471, 501, 1075-1077, 1140)

### Análise Técnica
O `display_name` é usado como fallback em vários lugares:
```javascript
displayName: f.display_name || f.username || 'Usuário',
```

**Problemas identificados:**
1. **Não há função dedicada `saveDisplayName()`** - Grep não encontrou essa função
2. **Alteração inline sem confirmação:** Se existir um input, ele pode estar salvando automaticamente
3. **Falta de UI explícita:** Não há botão "Salvar" visível para o usuário
4. **Sincronização:** Alterações locais podem não sincronizar com o banco

### Verificar no index.html
- Buscar por input de display name
- Verificar se há `@change` ou `@blur` salvando automaticamente
- Verificar binding com estado

### Sugestões de Correção
1. Criar função `saveDisplayName()` em `social.js` ou `cloud.js`
2. Adicionar botão "Salvar" explícito ao lado do input
3. Validar display name (comprimento, caracteres)
4. Sincronizar com Supabase após salvar

---

## 9. Sincronização de Fichas na Nuvem

### 🔴 Prioridade: ALTA

### Descrição
O sync com a nuvem das fichas originais (não da campanha) está com problemas.

### Localização do Código
- **Arquivo:** `js/modules/cloud.js`
- **Funções principais:**
  - `syncCloud()` (linha ~214)
  - `fetchCloud()` (linha ~144)
  - `forceSyncCloud()` (linha ~282)

### Análise Técnica

#### 9.1 Estrutura de Sync
```javascript
async syncCloud(silent = false) {
    if (!this.user || this.isGuest || !this.supabase) return;
    if (this.isSyncing) {
        console.log('[CLOUD] Sincronização já em andamento, ignorando...');
        return;
    }
    // ...
}
```

**Problemas potenciais:**
1. **Guard de `isSyncing`:** Se uma sync anterior travou, nenhuma nova sync ocorrerá
2. **Sem retry automático:** Falhas de rede não são retentadas
3. **Payload grande:** Limite de 900KB pode ser atingido silenciosamente
4. **Conflito de dados:** Não há merge inteligente, apenas overwrite

#### 9.2 Fluxo de Dados
```
Local (this.chars) → payload JSON → Supabase profiles.data
```

**Problemas:**
1. **Perda de dados:** Se dois dispositivos editarem ao mesmo tempo, um sobrescreve o outro
2. **Sem timestamps de personagem:** Não há como saber qual versão é mais recente
3. **fetchCloud sobrescreve local:** A função `fetchCloud` substitui completamente `this.chars`

### Sugestões de Correção
1. Adicionar `lastModified` timestamp em cada personagem
2. Implementar merge inteligente comparando timestamps
3. Adicionar retry com backoff exponencial
4. Resetar `isSyncing` após timeout (30 segundos)
5. Mostrar conflitos para o usuário resolver

---

## 10. Sistema de Amigos

### 🔴 Prioridade: ALTA

### Descrição
O sistema de amigos apresenta grandes problemas de funcionalidade.

### Localização do Código
- **Arquivo:** `js/modules/social.js`
- **Funções principais:**
  - `loadFriends()` (linha ~597)
  - `loadFriendsFallback()` (linha ~669)
  - `sendFriendRequest()` (linha ~807)
  - `setupFriendsRealtime()` (linha ~728)

### Problemas Identificados

#### 10.1 Carregamento de Amigos
```javascript
async loadFriends(forceRefresh = false) {
    if (!this.supabase || !this.user) return;
    if (this.friendsLoaded && !forceRefresh) return;
    // ...
}
```
**Problema:** Se `friendsLoaded` for true mas dados estiverem vazios, não recarrega

#### 10.2 Funções SQL Dependentes
O sistema depende de funções PostgreSQL customizadas:
- `get_friends_full()`
- `get_pending_requests()`
- `send_friend_request()`

**Problema:** Se essas funções não existirem no banco, o fallback pode não funcionar corretamente

#### 10.3 Realtime
```javascript
.on('postgres_changes', 
    { 
        event: '*',
        schema: 'public', 
        table: 'friendships'
    },
    // ...
)
```
**Problema:** Ouvir TODAS as mudanças é ineficiente e pode causar performance issues

#### 10.4 Chat entre Amigos
- Mensagens podem não carregar se `get_friend_conversation` não existir
- Fallback manual pode ter problemas de ordenação

### Sugestões de Correção
1. Verificar existência das funções SQL antes de chamar
2. Melhorar fallbacks para serem mais robustos
3. Adicionar logs detalhados para debug
4. Implementar cache local de amigos
5. Usar filtros mais específicos no realtime

---

## 11. Ícone CloudCheck

### 🟢 Prioridade: BAIXA

### Descrição
O ícone específico "cloudcheck" não existe.

### Localização do Código
- **Arquivo:** `index.html` (linhas 4022-4838 aproximadamente)
- **Uso:** Seção de CloudCheck nas configurações

### Análise Técnica
O sistema usa emoji 🛡️ e ícones FontAwesome como fallback:
```html
<div class="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center text-2xl">
    🛡️
</div>
```

E também:
```html
<i class="fa-solid fa-shield-check text-purple-400 text-lg"></i>
```

### Status
- **Não é um bug crítico** - O sistema usa alternativas visuais
- Se houver referência a um ícone `cloudcheck` customizado que não existe, é preciso criar ou substituir

### Sugestões
1. Se necessário ícone customizado, criar SVG
2. Ou usar consistentemente `fa-shield-check` do FontAwesome

---

## 12. Problemas Potenciais Identificados

### Análise adicional do código revelou os seguintes problemas potenciais:

#### 12.1 Memory Leaks - Realtime Channels
**Arquivo:** `js/modules/netlink.js`, `js/modules/social.js`
- Canais realtime podem não ser desconectados corretamente em todos os cenários
- `disconnectRealtime()` pode falhar silenciosamente

#### 12.2 Race Conditions no Router
**Arquivo:** `js/modules/router.js`
- Navegação rápida pode causar estados inconsistentes
- `enterCampaign` pode ser chamado múltiplas vezes

#### 12.3 LocalStorage Overflow
**Arquivo:** `js/modules/cloud.js`
- Erro `QuotaExceededError` é capturado mas não tratado adequadamente
- Muitas fichas com fotos base64 podem estourar o limite

#### 12.4 Validação de Inputs
**Geral**
- Alguns inputs podem aceitar strings muito longas
- Falta sanitização em alguns campos de texto

#### 12.5 Erro Silencioso em Carregamento
**Arquivo:** `js/modules/cloud.js`
```javascript
} catch (e) {
    console.error('Local Load Error:', e);
    this.notify('Erro ao carregar dados locais.', 'error');
}
```
- O sistema continua mesmo com dados corrompidos

#### 12.6 Sessão Expirada
**Arquivo:** `js/modules/cloud.js`
- Tratamento de JWT expirado existe mas pode não cobrir todos os casos
- Usuário pode ficar em estado "fantasma" (logado localmente mas não no servidor)

#### 12.7 Mobile Responsiveness
- Warning de mobile existe mas o site pode ter problemas em resoluções específicas
- Touch events podem não funcionar corretamente em alguns modais

#### 12.8 Acessibilidade
- Falta de atributos `aria-*` em muitos elementos interativos
- Contraste de cores pode não atender WCAG
- Navegação por teclado pode estar incompleta

---

## 📊 Resumo de Prioridades

| Prioridade | Quantidade | Bugs |
|------------|------------|------|
| 🔴 ALTA | 5 | Música Safari, Achievements, Display Name, Sync Fichas, Sistema Amigos |
| 🟠 MÉDIA-ALTA | 1 | Menu de Perfil |
| 🟡 MÉDIA | 4 | Changelog, Modal Migração, Erro ao Sair, Problemas Visuais |
| 🟢 BAIXA | 1 | Ícone CloudCheck |

---

## 🔧 Recomendações de Ordem de Correção

1. **Primeiro:** Achievements (afeta experiência constantemente)
2. **Segundo:** Sincronização de Fichas (risco de perda de dados)
3. **Terceiro:** Sistema de Amigos (funcionalidade core quebrada)
4. **Quarto:** Música Safari/iOS (afeta campanhas)
5. **Quinto:** Display Name + Salvar (UX básico)
6. **Sexto:** Erro ao Sair (mensagem confusa)
7. **Sétimo:** Modal de Migração (mudança simples)
8. **Oitavo:** Menu de Perfil (performance e visual)
9. **Nono:** Problemas Visuais (polimento)
10. **Décimo:** Changelog e CloudCheck (baixo impacto)

---

## 📝 Notas para a Próxima IA

1. **Testar em Safari:** Necessário dispositivo real ou BrowserStack
2. **Testar com múltiplos usuários:** Sistema de amigos precisa de dois usuários
3. **Verificar banco Supabase:** Confirmar existência das funções SQL
4. **Backup antes de alterações:** O sistema tem dados de usuários reais
5. **Modo Guest:** Testar também funcionalidades offline
6. **Console do browser:** Muitos erros são logados lá

---

## 🗄️ Análise do Schema SQL do Supabase

### ✅ Tabelas Compatíveis com o Código

| Tabela | Status | Uso no Código |
|--------|--------|---------------|
| `profiles` | ✅ OK | Armazena dados do usuário, settings, username, display_name, bio, avatar |
| `campaigns` | ✅ OK | Campanhas de RPG com GM, código de convite, configurações |
| `campaign_members` | ✅ OK | Membros das campanhas com dados do personagem |
| `campaign_logs` | ✅ OK | Log de mensagens e eventos da campanha |
| `dice_logs` | ✅ OK | Histórico de rolagens de dados |
| `friendships` | ✅ OK | Relações de amizade com status (pending/accepted) |
| `friend_messages` | ✅ OK | Mensagens entre amigos |
| `user_achievements` | ⚠️ NÃO USADO | Código usa localStorage, não esta tabela |
| `user_stats` | ⚠️ NÃO USADO | Código usa localStorage para stats |
| `characters` | ⚠️ PARCIAL | Existe mas código usa `campaign_members.char_data` |

### ⚠️ Observações Importantes

1. **`dice_logs.user_id` referencia `profiles.id`** - OK, mas diferente das outras tabelas que referenciam `auth.users(id)`

2. **Falta de índices no schema** - Para performance, adicionar:
   ```sql
   CREATE INDEX idx_friendships_user_id ON friendships(user_id);
   CREATE INDEX idx_friendships_friend_id ON friendships(friend_id);
   CREATE INDEX idx_campaign_members_campaign ON campaign_members(campaign_id);
   CREATE INDEX idx_campaign_members_user ON campaign_members(user_id);
   ```

3. **Row Level Security (RLS)** - O schema não mostra políticas RLS. Verificar se estão configuradas para:
   - `profiles`: usuário só edita próprio perfil
   - `friendships`: usuário só vê próprias amizades
   - `campaigns`: GM pode editar, membros só leem
   - `friend_messages`: só remetente/destinatário veem

4. **Campos nullable** - Alguns campos importantes podem ser null:
   - `profiles.username` - pode causar problemas de display
   - `profiles.display_name` - fallback para username existe no código

5. **`characters` vs `campaign_members.char_data`** - Existe redundância:
   - Tabela `characters` existe mas não é usada no código principal
   - Dados do personagem ficam em `campaign_members.char_data` (jsonb)

### 📋 Funções SQL Recomendadas

Para funcionalidade completa, implementar as seguintes funções no Supabase:

```sql
-- Verificar disponibilidade de username
CREATE OR REPLACE FUNCTION check_username_available(check_username TEXT, current_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE LOWER(username) = LOWER(check_username) 
        AND id != COALESCE(current_user_id, '00000000-0000-0000-0000-000000000000')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Obter lista de amigos completa
CREATE OR REPLACE FUNCTION get_friends_full()
RETURNS TABLE (
    friendship_id UUID,
    friend_id UUID,
    username TEXT,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    is_online BOOLEAN,
    last_seen TIMESTAMPTZ,
    friendship_date TIMESTAMPTZ,
    unread_messages BIGINT,
    achievements_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.id AS friendship_id,
        CASE WHEN f.user_id = auth.uid() THEN f.friend_id ELSE f.user_id END AS friend_id,
        p.username,
        p.display_name,
        p.avatar_url,
        p.bio,
        FALSE AS is_online, -- Implementar presença separadamente
        p.updated_at AS last_seen,
        f.created_at AS friendship_date,
        0::BIGINT AS unread_messages, -- Calcular separadamente se necessário
        0::BIGINT AS achievements_count
    FROM friendships f
    JOIN profiles p ON p.id = CASE WHEN f.user_id = auth.uid() THEN f.friend_id ELSE f.user_id END
    WHERE (f.user_id = auth.uid() OR f.friend_id = auth.uid())
    AND f.status = 'accepted';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Obter pedidos pendentes
CREATE OR REPLACE FUNCTION get_pending_requests()
RETURNS TABLE (
    request_id UUID,
    sender_id UUID,
    username TEXT,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    sent_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.id AS request_id,
        f.user_id AS sender_id,
        p.username,
        p.display_name,
        p.avatar_url,
        p.bio,
        f.created_at AS sent_at
    FROM friendships f
    JOIN profiles p ON p.id = f.user_id
    WHERE f.friend_id = auth.uid()
    AND f.status = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

*Documento gerado para auxiliar na continuidade do desenvolvimento do ZENITE OS.*
