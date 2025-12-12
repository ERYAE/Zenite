-- Copyright © 2025 Zenite - Todos os direitos reservados
-- Projeto desenvolvido com assistência de IA

-- ═══════════════════════════════════════════════════════════════════════════════
-- GARBAGE COLLECTION - FREE TIER OPTIMIZATION
-- ═══════════════════════════════════════════════════════════════════════════════
-- Execute este script MANUALMENTE a cada semana ou configure um cron job
-- https://supabase.com/dashboard/project/YOUR_PROJECT/sql
--
-- OBJETIVO: Manter o banco de dados abaixo de 500MB (limite do Free Tier)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. LIMPEZA DE LOGS ANTIGOS (>90 dias)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Limpar logs de dados de campanhas antigas
DELETE FROM public.dice_logs 
WHERE created_at < NOW() - INTERVAL '90 days';

-- Limpar logs de eventos de campanhas antigas
DELETE FROM public.campaign_logs 
WHERE created_at < NOW() - INTERVAL '90 days';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. LIMPEZA DE MENSAGENS ANTIGAS (>180 dias)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Limpar mensagens de chat entre amigos muito antigas
DELETE FROM public.friend_messages 
WHERE created_at < NOW() - INTERVAL '180 days';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. LIMPEZA DE CONVITES EXPIRADOS (>30 dias)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Limpar convites de campanha pendentes há mais de 30 dias
DELETE FROM public.campaign_members 
WHERE status = 'pending' 
  AND created_at < NOW() - INTERVAL '30 days';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. LIMPEZA DE PEDIDOS DE AMIZADE EXPIRADOS (>60 dias)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Limpar pedidos de amizade pendentes há mais de 60 dias
DELETE FROM public.friendships 
WHERE status = 'pending' 
  AND created_at < NOW() - INTERVAL '60 days';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. RELATÓRIO DE ESPAÇO LIBERADO
-- ═══════════════════════════════════════════════════════════════════════════════

-- Verificar tamanho das tabelas após limpeza
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. VACUUM (OPCIONAL - Recupera espaço físico)
-- ═══════════════════════════════════════════════════════════════════════════════
-- ATENÇÃO: VACUUM pode ser pesado. Execute fora de horário de pico.
-- Descomente as linhas abaixo se quiser executar:

-- VACUUM ANALYZE public.dice_logs;
-- VACUUM ANALYZE public.campaign_logs;
-- VACUUM ANALYZE public.friend_messages;
-- VACUUM ANALYZE public.campaign_members;
-- VACUUM ANALYZE public.friendships;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. FUNÇÃO PARA AUTOMAÇÃO (OPCIONAL)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Crie uma função que pode ser chamada via Edge Function ou cron job

CREATE OR REPLACE FUNCTION public.run_garbage_collection()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    deleted_dice_logs integer;
    deleted_campaign_logs integer;
    deleted_messages integer;
    deleted_invites integer;
    deleted_friend_requests integer;
BEGIN
    -- Limpar logs de dados
    DELETE FROM public.dice_logs 
    WHERE created_at < NOW() - INTERVAL '90 days';
    GET DIAGNOSTICS deleted_dice_logs = ROW_COUNT;
    
    -- Limpar logs de campanhas
    DELETE FROM public.campaign_logs 
    WHERE created_at < NOW() - INTERVAL '90 days';
    GET DIAGNOSTICS deleted_campaign_logs = ROW_COUNT;
    
    -- Limpar mensagens antigas
    DELETE FROM public.friend_messages 
    WHERE created_at < NOW() - INTERVAL '180 days';
    GET DIAGNOSTICS deleted_messages = ROW_COUNT;
    
    -- Limpar convites expirados
    DELETE FROM public.campaign_members 
    WHERE status = 'pending' 
      AND created_at < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS deleted_invites = ROW_COUNT;
    
    -- Limpar pedidos de amizade expirados
    DELETE FROM public.friendships 
    WHERE status = 'pending' 
      AND created_at < NOW() - INTERVAL '60 days';
    GET DIAGNOSTICS deleted_friend_requests = ROW_COUNT;
    
    -- Retornar relatório
    RETURN json_build_object(
        'success', true,
        'deleted_dice_logs', deleted_dice_logs,
        'deleted_campaign_logs', deleted_campaign_logs,
        'deleted_messages', deleted_messages,
        'deleted_invites', deleted_invites,
        'deleted_friend_requests', deleted_friend_requests,
        'timestamp', NOW()
    );
END;
$$;

-- Testar a função (descomente para executar):
-- SELECT public.run_garbage_collection();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. INSTRUÇÕES PARA AUTOMAÇÃO VIA EDGE FUNCTION
-- ═══════════════════════════════════════════════════════════════════════════════
-- 
-- Para automatizar, crie uma Edge Function no Supabase:
-- 
-- 1. Vá em: https://supabase.com/dashboard/project/YOUR_PROJECT/functions
-- 2. Crie uma nova função chamada "garbage-collection"
-- 3. Use o seguinte código:
--
-- import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
-- import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
-- 
-- serve(async (req) => {
--   const supabase = createClient(
--     Deno.env.get('SUPABASE_URL') ?? '',
--     Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
--   )
--   
--   const { data, error } = await supabase.rpc('run_garbage_collection')
--   
--   if (error) {
--     return new Response(JSON.stringify({ error: error.message }), {
--       status: 500,
--       headers: { 'Content-Type': 'application/json' }
--     })
--   }
--   
--   return new Response(JSON.stringify(data), {
--     headers: { 'Content-Type': 'application/json' }
--   })
-- })
--
-- 4. Configure um cron job para chamar essa função semanalmente
-- ═══════════════════════════════════════════════════════════════════════════════
