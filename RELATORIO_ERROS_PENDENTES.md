# 🔴 RELATÓRIO DE ERROS PENDENTES - ZENITE

**Data:** 2025-12-11  
**Status:** PROBLEMAS NÃO RESOLVIDOS  
**Próxima IA:** Leia TUDO antes de agir

---

## ⚠️ AVISO IMPORTANTE

A IA anterior (eu) afirmou que os erros foram corrigidos, mas o usuário confirma que **NÃO FORAM**. 

Possíveis causas:
1. Correções aplicadas no código mas não refletidas no runtime
2. Funções SQL no Supabase têm assinaturas diferentes do esperado
3. Cache persistente (improvável após limpeza manual)
4. Erros de lógica não identificados

---

## 📋 ERROS REPORTADOS PELO USUÁRIO


### 2. ACCEPT/REJECT FRIEND REQUEST - "without parameters"
**Status:** ❌ NÃO RESOLVIDO

**Erro:**
```
Could not find the function public.accept_friend_request without parameters
Could not find the function public.reject_friend_request without parameters
```

**O que foi tentado:**
- Verificação de que o código passa `{ friendship_id: requestId }`
- Correção do mapeamento de `r.request_id` para `r.friendship_id` em `_loadPendingRequests`

**Possível causa raiz:**
- O `requestId` está chegando como `undefined` na função
- O mapeamento `r.friendship_id` pode não estar correto se a função SQL retorna outro nome
- **VERIFICAR** o que `get_pending_requests()` realmente retorna no Supabase

**Arquivos:**
- `js/modules/social.js` linhas 1190-1210 (accept)
- `js/modules/social.js` linhas 1212-1232 (reject)
- `js/modules/social.js` linhas 940-960 (_loadPendingRequests)

**DEBUG NECESSÁRIO:**
```javascript
// Adicionar antes de chamar accept/reject:
console.log('requestId recebido:', requestId, typeof requestId);
```

---

### 3. ERROS DE RPC - Parâmetros incorretos
**Status:** ⚠️ CORREÇÕES APLICADAS MAS NÃO VERIFICADAS

**Funções corrigidas:**
| Função | Correção Aplicada | Verificar no Supabase |
|--------|-------------------|----------------------|
| `get_username_cooldown_days` | Removido `user_id` | Confirmar que não aceita parâmetros |
| `get_friend_conversation` | `friend_uuid, msg_limit` | Confirmar nomes exatos |
| `send_friend_message` | `receiver, message_content` | Confirmar nomes exatos |
| `is_username_available` | `username_to_check` | Confirmar nome exato |
| `check_username_available` | `username_to_check` | Confirmar nome exato |

**AÇÃO NECESSÁRIA:**
Ir no Supabase Dashboard > Database > Functions e verificar a assinatura EXATA de cada função.

---

### 4. char.powers NULL
**Status:** ⚠️ CORREÇÕES APLICADAS

**Erro:**
```
Cannot read properties of null (reading 'powers')
```

**O que foi tentado:**
- Adição de `x-show="char?.powers"` nos textareas
- Fallback no x-for: `(char?.powers?.techniques || [])`

**Possível causa:**
- O `x-if` não está impedindo a avaliação do `x-model`
- Alpine avalia bindings antes do x-if processar

**Solução alternativa não tentada:**
- Usar `x-model` condicional: `:x-model="char?.powers?.passive"`
- Ou criar computed property que retorna objeto vazio se char for null

---

### 5. x-for :key undefined
**Status:** ⚠️ CORREÇÕES APLICADAS

**O que foi tentado:**
- Adição de fallbacks `|| idx` em vários x-for

**Pode ter faltado:**
- Verificar TODOS os x-for no arquivo (há muitos)
- Alguns podem não ter sido corrigidos

---

### 6. NETLINK - Campanha não encontrada
**Status:** ✅ NÃO É BUG (comportamento esperado)

Quando o código de convite não existe, retorna null. Isso é correto.
A mensagem de log foi melhorada para clareza.

---

## 📂 ESTRUTURA DO PROJETO

```
Zenite/
├── js/
│   ├── app.js              # Entry point, importa módulos
│   ├── modules/
│   │   ├── cloud.js        # Auth, Supabase, login/signup
│   │   ├── social.js       # Amigos, achievements, stats
│   │   ├── netlink.js      # Campanhas multiplayer
│   │   ├── ui.js           # UI, dice tray, modais
│   │   └── router.js       # Roteamento hash-based
├── supabase/
│   └── fix_database_issues.sql  # Definições das funções SQL
├── index.html              # Todo o HTML + Alpine bindings
└── sw.js                   # Service Worker (cache)
```

---

## 🗄️ FUNÇÕES SQL CONHECIDAS (do fix_database_issues.sql)

```sql
-- Sem parâmetros (usa auth.uid() interno)
get_username_cooldown_days()
get_friends_full()
get_pending_requests()
get_friend_requests()
leave_all_campaigns()
delete_all_my_campaigns()
get_user_stats(target_user_id uuid DEFAULT NULL)
get_user_achievements(target_user_id uuid DEFAULT NULL)

-- Com parâmetros
check_username_available(username_to_check text)
is_username_available(username_to_check text)
change_username(new_username text)
accept_friend_request(friendship_id uuid)
reject_friend_request(friendship_id uuid)
remove_friend(friendship_id uuid)
send_friend_request(friend_username text)
send_friend_message(receiver uuid, message_content text)
get_friend_conversation(friend_uuid uuid, msg_limit integer DEFAULT 50)
sync_user_stats(stats_data jsonb)
save_achievement(achievement_id_param text, ...)
leave_campaign(campaign_uuid uuid)
send_campaign_invite(campaign_uuid uuid, friend_uuid uuid)
```

**⚠️ IMPORTANTE:** O arquivo SQL pode estar desatualizado em relação ao que realmente existe no Supabase. SEMPRE verificar no Dashboard.

---

## 🔍 COMO DEBUGAR

### 1. Verificar funções SQL no Supabase
```
Supabase Dashboard > Database > Functions
Clicar em cada função e ver os parâmetros
```

### 2. Adicionar logs no JS
```javascript
// Em social.js, antes de cada RPC:
console.log('[DEBUG] Chamando RPC com:', { parametros });
```

### 3. Verificar o que pending requests retorna
```javascript
// No console do navegador:
const { data } = await supabase.rpc('get_pending_requests');
console.log('Estrutura:', data[0]); // Ver campos disponíveis
```

### 4. Verificar Alpine state
```javascript
// No console, com DevTools aberto:
Alpine.$data(document.querySelector('[x-data]'))
```

---

## 🎯 PRIORIDADE DE CORREÇÃO

1. **ALTA:** Accept/Reject friend request - Afeta funcionalidade core
3. **MÉDIA:** Erros de char.powers null - Causa erros no console
4. **BAIXA:** Mensagens de log confusas

---

## 📝 NOTAS PARA PRÓXIMA IA

1. **NÃO confie** que o arquivo SQL local está sincronizado com o Supabase
2. **SEMPRE** peça ao usuário para verificar no Dashboard do Supabase
3. **ADICIONE LOGS** antes de afirmar que algo está corrigido
4. O usuário está usando **Alpine.js** - cuidado com ordem de avaliação de diretivas
5. O projeto tem **Service Worker** - mesmo com limpeza, pode haver issues
6. O usuário testa em **localhost** e **Vercel** - mesmo Supabase, diferentes ambientes

---

## 🔧 ALTERAÇÕES FEITAS NESTA SESSÃO

### js/modules/social.js
- Linha 951: `r.request_id || r.id` → `r.friendship_id || r.id`
- Linha 1303: Parâmetros de `get_friend_conversation`
- Linha 1409: Parâmetros de `send_friend_message`
- Linha 1696: Parâmetros de `is_username_available`
- Linha 1879: Removido parâmetro de `get_username_cooldown_days`

### js/modules/ui.js
- Linhas 816-881: Reescrita completa de `startDragTray()`

### js/modules/netlink.js
- Linhas 301-311: Separação de erro vs campanha não encontrada

### index.html
- Linha 452: `:required="authMode === 'register'"`
- Linha 1950: Fallback em x-for techniques
- Várias linhas: Fallbacks em :key de x-for
- Várias linhas: x-show guards em char.powers

### sw.js
- Linha 11: Versão atualizada para `v2.3.0-all-fixes`

---

**FIM DO RELATÓRIO**

Se você é a próxima IA lendo isto: seja mais cuidadoso que eu fui. Verifique TUDO antes de afirmar que está corrigido.
