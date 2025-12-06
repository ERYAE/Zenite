# 🚀 COMO TESTAR O ZENITE - GUIA RÁPIDO

## ⚡ ACESSO RÁPIDO

**Preview está rodando em:** http://localhost:4173

---

## 🔓 COMO LOGAR (3 Opções)

### Opção 1: MODO OFFLINE (Mais Rápido) ⭐
1. Abra http://localhost:4173
2. Clique em **"MODO OFFLINE (Sem Sincronização)"**
3. ✅ Pronto! Teste tudo sem login

### Opção 2: Criar Conta de Teste
1. Abra http://localhost:4173
2. Clique em "Criar Conta"
3. Email: `teste@teste.com`
4. Senha: `teste123456`
5. Username: `teste123`

### Opção 3: Limpar Cache e Tentar Novamente
```javascript
// Abra Console (F12) e cole:
localStorage.clear();
sessionStorage.clear();
location.reload();
```

---

## ✅ O QUE TESTAR

### 1. **Botões do Header**
Após logar (ou modo offline), teste:
- ✅ **NOVO AGENTE** - Abre wizard de criação
- ✅ **⚙️ Configurações** - Abre modal de config
- ✅ **🌐 NetLink** - Abre campanhas
- ✅ **Menu Usuário** (canto superior direito):
  - Meu Perfil
  - **Configurações da Conta** ⭐ NOVO
  - Achievements
  - Amigos

### 2. **Modo Low Performance**
1. Clique em ⚙️ Configurações
2. Ative **"MODO PERFORMANCE (PC ANTIGO)"**
3. Veja o indicador "MODO PERFORMANCE" no canto inferior direito
4. Todas as animações devem estar desabilitadas

### 3. **Configurações de Conta** ⭐ NOVO
1. Menu Usuário → "Configurações da Conta"
2. Veja seu email
3. Teste alterar senha:
   - Clique em "ALTERAR SENHA"
   - Digite nova senha (mínimo 8 caracteres)
   - Confirme
   - Clique em "SALVAR"

### 4. **Dados na Edição de Ficha** ⭐ NOVO
1. Crie um personagem (NOVO AGENTE)
2. Crie ou entre em uma campanha
3. Clique em **"EDITAR"** na sua ficha
4. Role dados no banner superior
5. ✅ **Resultado aparece com cores:**
   - Verde = Crítico
   - Vermelho = Fumble
   - Roxo = Normal

### 5. **Macros de Dados**
1. Na edição de ficha, clique no ícone de varinha mágica
2. Crie uma macro (ex: "Ataque" = "1d20+5")
3. Veja ela aparecer como botão rápido
4. Clique para rolar

---

## 🗄️ SQL DO SUPABASE

**Arquivo:** `supabase/security_fixes.sql`

**Execute no Supabase SQL Editor:**
1. Abra Supabase Dashboard
2. SQL Editor → New Query
3. Cole TODO o conteúdo do arquivo
4. Run

**Corrige:**
- ✅ Function search_path (segurança)
- ✅ RLS policies duplicadas (performance)
- ✅ Índices otimizados

---

## 🐛 SE ALGO NÃO FUNCIONAR

### Console do Navegador (F12)
1. Pressione F12
2. Vá em "Console"
3. Procure erros em vermelho
4. Copie e me envie

### Teste Manual das Funções
```javascript
// Cole no Console (F12):
console.log('Alpine:', window.Alpine);
console.log('System:', window.zeniteSystem);

// Teste abrir modais:
window.zeniteSystem.wizardOpen = true; // Wizard
window.zeniteSystem.configModal = true; // Config
window.zeniteSystem.accountSettingsOpen = true; // Account Settings
```

### Hard Reset
```javascript
// Console (F12):
localStorage.clear();
sessionStorage.clear();
indexedDB.deleteDatabase('zenite');
location.reload();
```

---

## 📊 FEATURES IMPLEMENTADAS

### ✅ Segurança
- Rate limiting (10 dados/min, 20 chat/min)
- XSS sanitization em chat
- SQL injection protection
- RLS policies otimizadas

### ✅ Performance
- Modo Low Performance para PCs antigos
- Índices otimizados
- Policies consolidadas

### ✅ UI/UX
- Display de dados na edição de ficha
- Configurações de conta completas
- Macros rápidas visíveis
- Indicador de modo performance

---

## 🎨 TEMAS DISPONÍVEIS

Configurações → Escolha sua cor:
- Ciano (padrão)
- Roxo, Dourado, Vermelho
- Verde, Laranja, Rosa, Lima
- Esmeralda, Violeta, Rosé, Âmbar
- Azul-Verde, Índigo

---

## 📁 ARQUIVOS IMPORTANTES

### Documentação:
- `README_TESTE.md` - Este arquivo
- `LOGIN_FIX.md` - Como resolver problemas de login
- `FINAL_INSTRUCTIONS.md` - Instruções completas
- `TROUBLESHOOTING.md` - Resolução de problemas
- `SECURITY_AUDIT.md` - Auditoria de segurança

### Código:
- `supabase/security_fixes.sql` - SQL corrigido ✅
- `js/modules/security.js` - Módulo de segurança
- `css/low-performance.css` - Estilos performance

---

## 🎯 CHECKLIST DE TESTE

- [ ] Consegui logar (ou entrar em modo offline)
- [ ] Botão "NOVO AGENTE" abre wizard
- [ ] Botão "Configurações" abre modal
- [ ] Menu usuário → "Configurações da Conta" funciona
- [ ] Modo Low Performance ativa e mostra indicador
- [ ] Dados aparecem na edição de ficha
- [ ] Macros aparecem como botões rápidos
- [ ] Console (F12) sem erros críticos

---

## 🆘 SUPORTE RÁPIDO

**Não consigo logar:**
→ Use "MODO OFFLINE"

**Botões não funcionam:**
→ Abra Console (F12) e me envie erros

**SQL dá erro:**
→ Execute `security_fixes.sql` completo

**Preview não abre:**
→ Verifique se está em http://localhost:4173

---

**Status:** ✅ **PRONTO PARA TESTE**  
**Versão:** 2.2.0  
**Build:** Production Ready

🚀 **COMECE AGORA:** http://localhost:4173
