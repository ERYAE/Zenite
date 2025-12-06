-- ═══════════════════════════════════════════════════════════════════════════
-- ZENITE OS - CORREÇÕES V2
-- Execute este arquivo no SQL Editor do Supabase
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- 0. FUNÇÃO AUXILIAR PARA VERIFICAR MEMBRO (SECURITY DEFINER - BYPASSA RLS)
-- ═══════════════════════════════════════════════════════════════════════════

-- Remove funções antigas para evitar conflito de assinaturas (CASCADE remove dependências)
DROP FUNCTION IF EXISTS is_campaign_member(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS is_campaign_member(uuid) CASCADE;
DROP FUNCTION IF EXISTS is_campaign_gm(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS is_campaign_gm(uuid) CASCADE;

-- Função com apenas 1 parâmetro (usa auth.uid() internamente)
CREATE FUNCTION is_campaign_member(p_campaign_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.campaign_members 
        WHERE campaign_id = p_campaign_id 
        AND user_id = auth.uid() 
        AND status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE FUNCTION is_campaign_gm(p_campaign_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.campaigns 
        WHERE id = p_campaign_id 
        AND gm_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION is_campaign_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_campaign_gm(uuid) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. CORRIGIR RLS PARA CAMPAIGN_MEMBERS (SEM RECURSÃO!)
-- ═══════════════════════════════════════════════════════════════════════════

-- Habilitar RLS se não estiver habilitado
ALTER TABLE public.campaign_members ENABLE ROW LEVEL SECURITY;

-- Remover TODAS as políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Users can view campaign members" ON public.campaign_members;
DROP POLICY IF EXISTS "Users can join campaigns" ON public.campaign_members;
DROP POLICY IF EXISTS "GMs can manage members" ON public.campaign_members;
DROP POLICY IF EXISTS "Users can leave campaigns" ON public.campaign_members;
DROP POLICY IF EXISTS "GMs can invite members" ON public.campaign_members;
DROP POLICY IF EXISTS "campaign_members_select" ON public.campaign_members;
DROP POLICY IF EXISTS "campaign_members_insert" ON public.campaign_members;
DROP POLICY IF EXISTS "campaign_members_update" ON public.campaign_members;
DROP POLICY IF EXISTS "campaign_members_delete" ON public.campaign_members;

-- POLÍTICA SELECT: Pode ver se é o próprio registro OU se é GM da campanha
-- NOTA: Não referencia campaign_members para evitar recursão!
CREATE POLICY "campaign_members_select"
ON public.campaign_members FOR SELECT
USING (
    -- É o próprio membro
    auth.uid() = user_id 
    -- OU é GM da campanha (verifica apenas na tabela campaigns)
    OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.gm_id = auth.uid())
);

-- POLÍTICA INSERT: Pode inserir para si mesmo OU se for GM
CREATE POLICY "campaign_members_insert"
ON public.campaign_members FOR INSERT
WITH CHECK (
    auth.uid() = user_id 
    OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.gm_id = auth.uid())
);

-- POLÍTICA UPDATE: Apenas GMs podem atualizar
CREATE POLICY "campaign_members_update"
ON public.campaign_members FOR UPDATE
USING (
    EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.gm_id = auth.uid())
);

-- POLÍTICA DELETE: Pode deletar a si mesmo OU se for GM
CREATE POLICY "campaign_members_delete"
ON public.campaign_members FOR DELETE
USING (
    auth.uid() = user_id 
    OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.gm_id = auth.uid())
);


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. FUNÇÃO SEGURA PARA ENVIAR CONVITE DE CAMPANHA
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION send_campaign_invite(
    p_campaign_id uuid,
    p_friend_id uuid
)
RETURNS jsonb AS $$
DECLARE
    v_gm_id uuid;
    v_is_friend boolean;
    v_already_member boolean;
BEGIN
    -- Verifica se o usuário é GM da campanha
    SELECT gm_id INTO v_gm_id FROM public.campaigns WHERE id = p_campaign_id;
    
    IF v_gm_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'campaign_not_found');
    END IF;
    
    IF v_gm_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'not_gm');
    END IF;
    
    -- Verifica se são amigos
    SELECT EXISTS(
        SELECT 1 FROM public.friendships
        WHERE status = 'accepted'
        AND (
            (user_id = auth.uid() AND friend_id = p_friend_id) OR
            (user_id = p_friend_id AND friend_id = auth.uid())
        )
    ) INTO v_is_friend;
    
    IF NOT v_is_friend THEN
        RETURN jsonb_build_object('success', false, 'error', 'not_friends');
    END IF;
    
    -- Verifica se já é membro
    SELECT EXISTS(
        SELECT 1 FROM public.campaign_members
        WHERE campaign_id = p_campaign_id AND user_id = p_friend_id
    ) INTO v_already_member;
    
    IF v_already_member THEN
        RETURN jsonb_build_object('success', false, 'error', 'already_member');
    END IF;
    
    -- Insere como membro convidado
    INSERT INTO public.campaign_members (campaign_id, user_id, role, status)
    VALUES (p_campaign_id, p_friend_id, 'player', 'invited');
    
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION send_campaign_invite(uuid, uuid) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. FUNÇÃO PARA SAIR DE CAMPANHA
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION leave_campaign(p_campaign_id uuid)
RETURNS jsonb AS $$
BEGIN
    DELETE FROM public.campaign_members
    WHERE campaign_id = p_campaign_id AND user_id = auth.uid();
    
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION leave_campaign(uuid) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. FUNÇÃO PARA DELETAR TODAS AS CAMPANHAS DO GM
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION delete_all_my_campaigns()
RETURNS jsonb AS $$
DECLARE
    v_count integer;
BEGIN
    -- Remove todos os membros das campanhas do usuário
    DELETE FROM public.campaign_members
    WHERE campaign_id IN (SELECT id FROM public.campaigns WHERE gm_id = auth.uid());
    
    -- Remove os logs
    DELETE FROM public.campaign_logs
    WHERE campaign_id IN (SELECT id FROM public.campaigns WHERE gm_id = auth.uid());
    
    -- Remove as campanhas
    DELETE FROM public.campaigns WHERE gm_id = auth.uid();
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN jsonb_build_object('success', true, 'deleted_count', v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION delete_all_my_campaigns() TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 5. FUNÇÃO PARA SAIR DE TODAS AS CAMPANHAS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION leave_all_campaigns()
RETURNS jsonb AS $$
DECLARE
    v_count integer;
BEGIN
    DELETE FROM public.campaign_members
    WHERE user_id = auth.uid()
    AND campaign_id NOT IN (SELECT id FROM public.campaigns WHERE gm_id = auth.uid());
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN jsonb_build_object('success', true, 'left_count', v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION leave_all_campaigns() TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 6. CORRIGIR RLS PARA CAMPAIGN_LOGS (CHAT DA CAMPANHA) - SEM RECURSÃO!
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.campaign_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view logs" ON public.campaign_logs;
DROP POLICY IF EXISTS "Members can send logs" ON public.campaign_logs;
DROP POLICY IF EXISTS "campaign_logs_select" ON public.campaign_logs;
DROP POLICY IF EXISTS "campaign_logs_insert" ON public.campaign_logs;

-- POLÍTICA SELECT: Usa funções SECURITY DEFINER para evitar recursão
CREATE POLICY "campaign_logs_select"
ON public.campaign_logs FOR SELECT
USING (
    is_campaign_gm(campaign_id) OR is_campaign_member(campaign_id)
);

-- POLÍTICA INSERT: Pode enviar se é membro ou GM
CREATE POLICY "campaign_logs_insert"
ON public.campaign_logs FOR INSERT
WITH CHECK (
    auth.uid() = user_id
    AND (is_campaign_gm(campaign_id) OR is_campaign_member(campaign_id))
);


-- ═══════════════════════════════════════════════════════════════════════════
-- 7. CORRIGIR RLS PARA DICE_LOGS - SEM RECURSÃO!
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.dice_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dice_logs_select" ON public.dice_logs;
DROP POLICY IF EXISTS "dice_logs_insert" ON public.dice_logs;
DROP POLICY IF EXISTS "Members can view dice" ON public.dice_logs;
DROP POLICY IF EXISTS "Members can roll dice" ON public.dice_logs;

-- POLÍTICA SELECT: Usa funções SECURITY DEFINER para evitar recursão
CREATE POLICY "dice_logs_select"
ON public.dice_logs FOR SELECT
USING (
    is_campaign_gm(campaign_id) OR is_campaign_member(campaign_id)
);

-- POLÍTICA INSERT: Pode inserir se é membro ou GM
CREATE POLICY "dice_logs_insert"
ON public.dice_logs FOR INSERT
WITH CHECK (
    auth.uid() = user_id
    AND (is_campaign_gm(campaign_id) OR is_campaign_member(campaign_id))
);


-- ═══════════════════════════════════════════════════════════════════════════
-- 8. CRIAR ÍNDICE ÚNICO PARA EVITAR ACHIEVEMENTS DUPLICADOS
-- ═══════════════════════════════════════════════════════════════════════════

-- Primeiro remove duplicatas existentes
DELETE FROM public.user_achievements a
USING public.user_achievements b
WHERE a.id > b.id 
AND a.user_id = b.user_id 
AND a.achievement_id = b.achievement_id;

-- Cria índice único
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_achievements_unique 
ON public.user_achievements(user_id, achievement_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- 8. HABILITAR REALTIME PARA TABELAS NECESSÁRIAS
-- ═══════════════════════════════════════════════════════════════════════════

-- Habilita realtime para tabelas (ignora se já existir)
DO $$
BEGIN
    -- friend_messages
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_messages;
    EXCEPTION WHEN duplicate_object THEN
        NULL; -- Já existe, ignora
    END;
    
    -- campaign_logs
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_logs;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
    
    -- friendships
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
    
    -- dice_logs
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.dice_logs;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 9. CORRIGIR PERFIS COM username E display_name VAZIO OU INCORRETO
-- ═══════════════════════════════════════════════════════════════════════════

-- PASSO 1: Primeiro corrige o username onde está NULL/vazio
UPDATE public.profiles p
SET username = LOWER(
    REGEXP_REPLACE(
        SPLIT_PART(u.email, '@', 1), 
        '[^a-z0-9_]', 
        '', 
        'g'
    )
)
FROM auth.users u
WHERE p.id = u.id
AND (p.username IS NULL OR p.username = '' OR trim(p.username) = '');

-- PASSO 2: Depois corrige display_name usando o username (que agora está correto)
UPDATE public.profiles
SET display_name = COALESCE(username, 'Usuário')
WHERE display_name IS NULL OR display_name = '' OR trim(display_name) = '';

-- PASSO 3: Corrige display_name que está igual a parte do email (muito curto ou estranho)
-- Se display_name tem menos de 2 chars ou é igual ao username que veio do email, use o username
UPDATE public.profiles
SET display_name = username
WHERE length(display_name) < 2 OR display_name = SPLIT_PART(display_name, '@', 1);


-- ═══════════════════════════════════════════════════════════════════════════
-- 10. TRIGGER PARA NOVOS USUÁRIOS
-- ⚠️ SEPARADO EM ARQUIVO PRÓPRIO: supabase/trigger_new_user.sql
-- Execute esse arquivo DIRETAMENTE no Dashboard do Supabase (SQL Editor web)
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- FIM DAS CORREÇÕES (fixes_v2.sql)
-- ═══════════════════════════════════════════════════════════════════════════
