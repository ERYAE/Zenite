-- ═══════════════════════════════════════════════════════════════════════════
-- ZENITE OS - CORREÇÕES V3 COMPLETAS
-- Execute este arquivo no SQL Editor do Supabase (Dashboard Web)
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. FUNÇÕES AUXILIARES (SECURITY DEFINER)
-- ═══════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS is_campaign_member(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS is_campaign_member(uuid) CASCADE;
DROP FUNCTION IF EXISTS is_campaign_gm(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS is_campaign_gm(uuid) CASCADE;

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
-- 2. RLS PARA CAMPAIGN_MEMBERS
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.campaign_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view campaign members" ON public.campaign_members;
DROP POLICY IF EXISTS "Users can join campaigns" ON public.campaign_members;
DROP POLICY IF EXISTS "GMs can manage members" ON public.campaign_members;
DROP POLICY IF EXISTS "Users can leave campaigns" ON public.campaign_members;
DROP POLICY IF EXISTS "GMs can invite members" ON public.campaign_members;
DROP POLICY IF EXISTS "campaign_members_select" ON public.campaign_members;
DROP POLICY IF EXISTS "campaign_members_insert" ON public.campaign_members;
DROP POLICY IF EXISTS "campaign_members_update" ON public.campaign_members;
DROP POLICY IF EXISTS "campaign_members_delete" ON public.campaign_members;

CREATE POLICY "campaign_members_select"
ON public.campaign_members FOR SELECT
USING (
    auth.uid() = user_id 
    OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.gm_id = auth.uid())
);

CREATE POLICY "campaign_members_insert"
ON public.campaign_members FOR INSERT
WITH CHECK (
    auth.uid() = user_id 
    OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.gm_id = auth.uid())
);

CREATE POLICY "campaign_members_update"
ON public.campaign_members FOR UPDATE
USING (
    EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.gm_id = auth.uid())
);

CREATE POLICY "campaign_members_delete"
ON public.campaign_members FOR DELETE
USING (
    auth.uid() = user_id 
    OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.gm_id = auth.uid())
);


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. RLS PARA CAMPAIGN_LOGS
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.campaign_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view logs" ON public.campaign_logs;
DROP POLICY IF EXISTS "Members can send logs" ON public.campaign_logs;
DROP POLICY IF EXISTS "campaign_logs_select" ON public.campaign_logs;
DROP POLICY IF EXISTS "campaign_logs_insert" ON public.campaign_logs;

CREATE POLICY "campaign_logs_select"
ON public.campaign_logs FOR SELECT
USING (
    is_campaign_gm(campaign_id) OR is_campaign_member(campaign_id)
);

CREATE POLICY "campaign_logs_insert"
ON public.campaign_logs FOR INSERT
WITH CHECK (
    auth.uid() = user_id
    AND (is_campaign_gm(campaign_id) OR is_campaign_member(campaign_id))
);


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. RLS PARA DICE_LOGS
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.dice_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dice_logs_select" ON public.dice_logs;
DROP POLICY IF EXISTS "dice_logs_insert" ON public.dice_logs;
DROP POLICY IF EXISTS "Members can view dice" ON public.dice_logs;
DROP POLICY IF EXISTS "Members can roll dice" ON public.dice_logs;

CREATE POLICY "dice_logs_select"
ON public.dice_logs FOR SELECT
USING (
    is_campaign_gm(campaign_id) OR is_campaign_member(campaign_id)
);

CREATE POLICY "dice_logs_insert"
ON public.dice_logs FOR INSERT
WITH CHECK (
    auth.uid() = user_id
    AND (is_campaign_gm(campaign_id) OR is_campaign_member(campaign_id))
);


-- ═══════════════════════════════════════════════════════════════════════════
-- 5. FUNÇÃO: ENVIAR CONVITE DE CAMPANHA
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
    SELECT gm_id INTO v_gm_id FROM public.campaigns WHERE id = p_campaign_id;
    
    IF v_gm_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'campaign_not_found');
    END IF;
    
    IF v_gm_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'not_gm');
    END IF;
    
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
    
    SELECT EXISTS(
        SELECT 1 FROM public.campaign_members
        WHERE campaign_id = p_campaign_id AND user_id = p_friend_id
    ) INTO v_already_member;
    
    IF v_already_member THEN
        RETURN jsonb_build_object('success', false, 'error', 'already_member');
    END IF;
    
    INSERT INTO public.campaign_members (campaign_id, user_id, role, status)
    VALUES (p_campaign_id, p_friend_id, 'player', 'invited');
    
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION send_campaign_invite(uuid, uuid) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 6. FUNÇÃO: SAIR DE CAMPANHA
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
-- 7. FUNÇÃO: SAIR DE TODAS AS CAMPANHAS
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
-- 8. FUNÇÃO: DELETAR TODAS AS CAMPANHAS DO GM
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION delete_all_my_campaigns()
RETURNS jsonb AS $$
DECLARE
    v_count integer;
BEGIN
    DELETE FROM public.campaign_members
    WHERE campaign_id IN (SELECT id FROM public.campaigns WHERE gm_id = auth.uid());
    
    DELETE FROM public.campaign_logs
    WHERE campaign_id IN (SELECT id FROM public.campaigns WHERE gm_id = auth.uid());
    
    DELETE FROM public.dice_logs
    WHERE campaign_id IN (SELECT id FROM public.campaigns WHERE gm_id = auth.uid());
    
    DELETE FROM public.campaigns WHERE gm_id = auth.uid();
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN jsonb_build_object('success', true, 'deleted_count', v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION delete_all_my_campaigns() TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 9. FUNÇÃO: BUSCAR CONVERSA COM AMIGO (CORRIGIDA)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_friend_conversation(
    p_friend_id uuid,
    p_limit integer DEFAULT 50,
    p_offset integer DEFAULT 0
)
RETURNS TABLE (
    msg_id uuid,
    msg_sender_id uuid,
    msg_receiver_id uuid,
    content text,
    is_read boolean,
    created_at timestamptz,
    is_mine boolean
) AS $$
DECLARE
    v_user_id uuid := auth.uid();
BEGIN
    UPDATE public.friend_messages fm
    SET is_read = true
    WHERE fm.receiver_id = v_user_id 
    AND fm.sender_id = p_friend_id 
    AND fm.is_read = false;
    
    RETURN QUERY
    SELECT 
        m.id AS msg_id,
        m.sender_id AS msg_sender_id,
        m.receiver_id AS msg_receiver_id,
        m.content,
        m.is_read,
        m.created_at,
        (m.sender_id = v_user_id) AS is_mine
    FROM public.friend_messages m
    WHERE (m.sender_id = v_user_id AND m.receiver_id = p_friend_id)
       OR (m.sender_id = p_friend_id AND m.receiver_id = v_user_id)
    ORDER BY m.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_friend_conversation(uuid, integer, integer) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 10. HABILITAR REALTIME
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_messages;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_logs;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.dice_logs;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_members;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 11. CORRIGIR PERFIS
-- ═══════════════════════════════════════════════════════════════════════════

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

UPDATE public.profiles
SET display_name = COALESCE(username, 'Usuário')
WHERE display_name IS NULL OR display_name = '' OR trim(display_name) = '';

UPDATE public.profiles
SET display_name = username
WHERE length(display_name) < 2;


-- ═══════════════════════════════════════════════════════════════════════════
-- FIM DAS CORREÇÕES
-- ═══════════════════════════════════════════════════════════════════════════
