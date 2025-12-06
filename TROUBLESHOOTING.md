# 🔧 TROUBLESHOOTING - Zenite OS

## 🔴 PROBLEMA: Botões do Header Não Funcionam

### Diagnóstico:
Os botões de "Novo Agente", "Perfil", "Achievements", "Amigos", "Configurações" e "Histórico" não estão abrindo os modais.

### Causa Raiz:
As funções existem nos módulos (`ui.js`, `social.js`) e estão sendo mescladas no objeto principal do Alpine via spread operator, MAS o Alpine pode não estar conseguindo acessá-las devido a:

1. **Erro de JavaScript não capturado** - Verifique o console do navegador (F12)
2. **Contexto Alpine incorreto** - As funções podem não estar no escopo correto
3. **Módulos não carregados** - Algum import pode ter falhado

### Como Verificar:

1. **Abra o Console do Navegador** (F12 → Console)
2. **Procure por erros em vermelho**
3. **Teste manualmente:**
   ```javascript
   // No console, digite:
   Alpine.store('zeniteSystem').openWizard()
   Alpine.store('zeniteSystem').openProfileModal()
   ```

### Solução Temporária:

Se os modais não abrirem, adicione logs de debug:

```javascript
// No console do navegador:
console.log('Testing functions:');
console.log('openWizard:', typeof Alpine.store('zeniteSystem').openWizard);
console.log('openProfileModal:', typeof Alpine.store('zeniteSystem').openProfileModal);
console.log('openAchievementsModal:', typeof Alpine.store('zeniteSystem').openAchievementsModal);
```

### Correção Definitiva:

Se as funções não existirem, o problema é que os módulos não estão sendo mesclados corretamente. Verifique:

1. **`js/app.js` linha 193-197:**
   ```javascript
   ...rpgLogic,
   ...cloudLogic,
   ...uiLogic,
   ...netlinkLogic,
   ...socialLogic,
   ```

2. **Imports no topo do arquivo:**
   ```javascript
   import { uiLogic } from './modules/ui.js';
   import { socialLogic } from './modules/social.js';
   ```

3. **Funções exportadas em `ui.js`:**
   - `openWizard()` ✅
   - `toggleSetting()` ✅
   - `applyLowPerfMode()` ✅

4. **Funções exportadas em `social.js`:**
   - `openProfileModal()` ✅
   - `openAchievementsModal()` ✅
   - `openFriendsModal()` ✅

---

## 🗄️ PROBLEMAS DO SUPABASE CORRIGIDOS

Execute o arquivo `supabase/security_fixes.sql` no SQL Editor do Supabase para corrigir:

### ✅ Segurança:
- **Function Search Path Mutable** - Adicionado `SET search_path = public, pg_temp` em 4 funções
- **Auth Leaked Password Protection** - Ative manualmente no Dashboard do Supabase:
  - Settings → Auth → Password → Enable "Leaked Password Protection"

### ✅ Performance:
- **Auth RLS Initialization Plan** - Otimizado 10 policies usando `(select auth.uid())`
- **Duplicate Index** - Removido `idx_profiles_username_unique` (duplicado)
- **Unindexed Foreign Key** - Adicionado índice em `campaign_logs.user_id`
- **Multiple Permissive Policies** - Consolidadas policies duplicadas

### ⚠️ Opcional (INFO level):
- **Unused Indexes** - Comentados no SQL, descomente se quiser remover

---

## 🐛 ERROS COMUNS

### 1. "Cannot read property 'openWizard' of undefined"
**Causa:** Alpine não inicializou corretamente  
**Solução:** Recarregue a página (Ctrl+F5)

### 2. "wizardOpen is not defined"
**Causa:** Variável não existe no estado do Alpine  
**Solução:** Verifique `js/app.js` linha 74 - deve ter `wizardOpen: false`

### 3. "configModal is not defined"
**Causa:** Variável não existe no estado do Alpine  
**Solução:** Verifique `js/app.js` linha 79 - deve ter `configModal: false`

### 4. Modais abrem mas não fecham
**Causa:** `@click.self` ou `@keydown.escape` não funcionando  
**Solução:** Verifique se o modal tem `x-show` e não `x-if`

### 5. "playerLastRoll is not defined"
**Causa:** Variável adicionada recentemente não está no estado  
**Solução:** Limpe o cache do navegador (Ctrl+Shift+Delete)

---

## 🔍 DEBUG CHECKLIST

Antes de reportar um bug, verifique:

- [ ] Console do navegador sem erros (F12)
- [ ] Vite dev server rodando sem erros
- [ ] Imports corretos em `app.js`
- [ ] Módulos exportando funções corretamente
- [ ] Alpine inicializado (verifique `window.Alpine`)
- [ ] LocalStorage não corrompido (limpe se necessário)
- [ ] Supabase conectado (verifique `window.supabase`)

---

## 🚀 COMO TESTAR

### Teste 1: Wizard
```javascript
// Console:
Alpine.store('zeniteSystem').openWizard()
// Deve abrir o modal de criação de personagem
```

### Teste 2: Perfil
```javascript
// Console:
Alpine.store('zeniteSystem').openProfileModal()
// Deve abrir o modal de perfil
```

### Teste 3: Configurações
```javascript
// Console:
Alpine.store('zeniteSystem').configModal = true
// Deve abrir o modal de configurações
```

### Teste 4: Histórico
```javascript
// Console:
Alpine.store('zeniteSystem').historyModal = true
// Deve abrir o modal de histórico
```

---

## 📝 LOGS ÚTEIS

Adicione estes logs temporários para debug:

```javascript
// No início de app.js, após os imports:
console.log('[DEBUG] Modules loaded:', {
    rpgLogic: !!rpgLogic,
    cloudLogic: !!cloudLogic,
    uiLogic: !!uiLogic,
    netlinkLogic: !!netlinkLogic,
    socialLogic: !!socialLogic
});

console.log('[DEBUG] Functions:', {
    openWizard: typeof uiLogic.openWizard,
    openProfileModal: typeof socialLogic.openProfileModal,
    toggleSetting: typeof uiLogic.toggleSetting
});
```

---

## 🆘 ÚLTIMA OPÇÃO: Hard Reset

Se nada funcionar:

1. **Limpe TUDO:**
   ```javascript
   localStorage.clear();
   sessionStorage.clear();
   ```

2. **Recarregue com cache limpo:**
   - Chrome: Ctrl+Shift+Delete → Limpar tudo
   - Firefox: Ctrl+Shift+Delete → Limpar tudo

3. **Reinicie o servidor:**
   ```bash
   npm run dev
   ```

4. **Acesse em modo anônimo:**
   - Chrome: Ctrl+Shift+N
   - Firefox: Ctrl+Shift+P

---

**Última atualização:** 2025-12-06  
**Status:** 🟡 Investigando problema dos botões
