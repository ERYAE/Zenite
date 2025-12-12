-- Copyright © 2025 Zenite - Todos os direitos reservados
-- Projeto desenvolvido com assistência de IA

-- ═══════════════════════════════════════════════════════════════════════════════
-- CORREÇÃO: MENSAGENS DE CHAT INVERTIDAS (P0 - CRÍTICO)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Execute este script no SQL Editor do Supabase Dashboard
-- https://supabase.com/dashboard/project/YOUR_PROJECT/sql
-- ═══════════════════════════════════════════════════════════════════════════════

-- PROBLEMA:
-- A função get_friend_conversation não retornava o campo 'is_mine', causando
-- mensagens invertidas (minhas mensagens apareciam como do amigo e vice-versa)

-- SOLUÇÃO:
-- Adicionar campo calculado 'is_mine' baseado em (sender_id = auth.uid())

-- Remover função antiga
DROP FUNCTION IF EXISTS public.get_friend_conversation(uuid, integer) CASCADE;

-- Criar função corrigida
CREATE FUNCTION public.get_friend_conversation(friend_uuid uuid, msg_limit integer DEFAULT 50)
RETURNS TABLE(
  msg_id uuid,
  id uuid,
  sender_id uuid,
  content text,
  is_read boolean,
  is_mine boolean,
  created_at timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id as msg_id,
    id,
    sender_id, 
    content, 
    is_read,
    (sender_id = auth.uid()) as is_mine,
    created_at
  FROM public.friend_messages
  WHERE (sender_id = auth.uid() AND receiver_id = friend_uuid)
     OR (sender_id = friend_uuid AND receiver_id = auth.uid())
  ORDER BY created_at DESC
  LIMIT msg_limit;
$$;

-- Verificação
-- SELECT * FROM get_friend_conversation('UUID_DO_AMIGO', 10);
-- O campo 'is_mine' deve ser TRUE para suas mensagens e FALSE para as do amigo
