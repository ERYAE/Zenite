-- ═══════════════════════════════════════════════════════════════════════════
-- ZENITE OS - CORREÇÕES V2
-- Execute este arquivo no SQL Editor do Supabase
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. CORRIGIR RLS PARA CAMPAIGN_MEMBERS (CONVITE PARA CAMPANHA)
-- ═══════════════════════════════════════════════════════════════════════════

-- Habilitar RLS se não estiver habilitado
ALTER TABLE public.campaign_members ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas conflitantes
DROP POLICY IF EXISTS "Users can view campaign members" ON public.campaign_members;
DROP POLICY IF EXISTS "Users can join campaigns" ON public.campaign_members;
DROP POLICY IF EXISTS "GMs can manage members" ON public.campaign_members;
DROP POLICY IF EXISTS "Users can leave campaigns" ON public.campaign_members;
DROP POLICY IF EXISTS "GMs can invite members" ON public.campaign_members;

-- POLÍTICA: Qualquer membro pode VER membros da campanha
CREATE POLICY "Users can view campaign members"
ON public.campaign_members FOR SELECT
USING (
    -- É membro da campanha OU é GM da campanha
    auth.uid() IN (
        SELECT user_id FROM public.campaign_members WHERE campaign_id = campaign_members.campaign_id
        UNION
        SELECT gm_id FROM public.campaigns WHERE id = campaign_members.campaign_id
    )
);

-- POLÍTICA: Usuários podem entrar em campanhas (para si mesmos)
CREATE POLICY "Users can join campaigns"
ON public.campaign_members FOR INSERT
WITH CHECK (
    -- Pode inserir para si mesmo OU se for GM da campanha
    auth.uid() = user_id 
    OR auth.uid() IN (SELECT gm_id FROM public.campaigns WHERE id = campaign_id)
);

-- POLÍTICA: GMs podem atualizar membros de suas campanhas
CREATE POLICY "GMs can manage members"
ON public.campaign_members FOR UPDATE
USING (
    auth.uid() IN (SELECT gm_id FROM public.campaigns WHERE id = campaign_id)
);

-- POLÍTICA: Usuários podem sair de campanhas (deletar a si mesmos)
CREATE POLICY "Users can leave campaigns"
ON public.campaign_members FOR DELETE
USING (
    auth.uid() = user_id 
    OR auth.uid() IN (SELECT gm_id FROM public.campaigns WHERE id = campaign_id)
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
-- 6. CORRIGIR RLS PARA CAMPAIGN_LOGS (CHAT DA CAMPANHA)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.campaign_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view logs" ON public.campaign_logs;
DROP POLICY IF EXISTS "Members can send logs" ON public.campaign_logs;

-- POLÍTICA: Membros podem VER logs da campanha
CREATE POLICY "Members can view logs"
ON public.campaign_logs FOR SELECT
USING (
    auth.uid() IN (
        SELECT user_id FROM public.campaign_members WHERE campaign_id = campaign_logs.campaign_id
        UNION
        SELECT gm_id FROM public.campaigns WHERE id = campaign_logs.campaign_id
    )
);

-- POLÍTICA: Membros podem ENVIAR logs (mensagens)
CREATE POLICY "Members can send logs"
ON public.campaign_logs FOR INSERT
WITH CHECK (
    auth.uid() = user_id
    AND auth.uid() IN (
        SELECT user_id FROM public.campaign_members WHERE campaign_id = campaign_logs.campaign_id
        UNION
        SELECT gm_id FROM public.campaigns WHERE id = campaign_logs.campaign_id
    )
);


-- ═══════════════════════════════════════════════════════════════════════════
-- 7. CRIAR ÍNDICE ÚNICO PARA EVITAR ACHIEVEMENTS DUPLICADOS
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

-- Habilita realtime para mensagens de amigos
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_messages;

-- Habilita realtime para logs de campanha
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_logs;

-- Habilita realtime para friendships
ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;


-- ═══════════════════════════════════════════════════════════════════════════
-- 9. CORRIGIR PERFIS COM display_name VAZIO OU INCORRETO
-- ═══════════════════════════════════════════════════════════════════════════

-- Atualiza display_name onde está NULL ou vazio para usar o username
UPDATE public.profiles
SET display_name = COALESCE(username, 'Usuário')
WHERE display_name IS NULL OR display_name = '' OR trim(display_name) = '';

-- Atualiza username onde está NULL para usar parte do email (do auth.users)
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


-- ═══════════════════════════════════════════════════════════════════════════
-- 10. TRIGGER PARA SINCRONIZAR auth.users.user_metadata COM profiles
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        username,
        display_name,
        bio,
        avatar_url,
        is_public,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', LOWER(REGEXP_REPLACE(SPLIT_PART(NEW.email, '@', 1), '[^a-z0-9_]', '', 'g'))),
        COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'username', 'Usuário'),
        COALESCE(NEW.raw_user_meta_data->>'bio', ''),
        NEW.raw_user_meta_data->>'avatar_url',
        COALESCE((NEW.raw_user_meta_data->>'is_public')::boolean, true),
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        username = COALESCE(EXCLUDED.username, profiles.username),
        display_name = COALESCE(EXCLUDED.display_name, profiles.display_name, profiles.username, 'Usuário'),
        updated_at = NOW()
    WHERE profiles.username IS NULL OR profiles.display_name IS NULL;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recria o trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ═══════════════════════════════════════════════════════════════════════════
-- FIM DAS CORREÇÕES
-- ═══════════════════════════════════════════════════════════════════════════
