# ⚠️ INSTRUÇÕES - EXECUTE OS SQLs NO SUPABASE

## 📋 Scripts SQL

Execute os scripts na ordem abaixo no SQL Editor do Supabase.

### 1️⃣ Sistema de Amigos Otimizado
**Arquivo:** `friendships_optimization.sql`

Contém:
- Índices para performance
- Constraints para integridade
- Funções `get_user_friends()` e `get_friend_requests()`
- Função `send_friend_request()`

### 2️⃣ Sistema de Chat entre Amigos (NOVO!)
**Arquivo:** `friends_chat_system.sql`

Contém:
- Tabela `friend_messages` para chat privado
- Índices otimizados para conversas
- Row Level Security (RLS)
- Funções:
  - `send_friend_message()` - Envia mensagem com validação de amizade
  - `get_friend_conversation()` - Busca mensagens de uma conversa
  - `get_unread_message_counts()` - Conta mensagens não lidas
  - `get_friends_full()` - Busca amigos com dados completos
  - `get_pending_requests()` - Busca pedidos pendentes

---

## 🚀 Como Executar

1. Acesse [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecione seu projeto
3. Vá em **SQL Editor** > **New Query**
4. Cole o conteúdo do arquivo SQL
5. Clique em **Run**
6. Repita para o próximo arquivo

---

## ⚠️ Importante

- Execute na **ordem indicada**
- Execute **apenas uma vez** cada arquivo
- Se der erro de "already exists", o script já foi executado antes

---

## ✅ Verificação

Após executar, teste:
1. Abra o modal de Amigos
2. Clique em "Chat" em um amigo
3. Envie uma mensagem
4. Se funcionar, está tudo certo!

---

**Problemas?** Verifique os logs do console (F12).
