-- ═══════════════════════════════════════════════════════════════════════════════
-- ZENITE OS - FUNÇÕES SQL COMPLETAS PARA SUPABASE
-- ═══════════════════════════════════════════════════════════════════════════════
-- Versão: 2.3.x
-- Data: Dezembro 2024
-- 
-- INSTRUÇÕES:
-- 1. Execute este arquivo no SQL Editor do Supabase
-- 2. Verifique se todas as funções foram criadas com sucesso
-- 3. Teste as funções principais antes de usar em produção
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 1: ALTERAÇÕES NAS TABELAS EXISTENTES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Adicionar campos faltantes em user_stats
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS friends_count integer DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS max_level integer DEFAULT 1;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS longest_history integer DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS night_owl boolean DEFAULT false;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS early_bird boolean DEFAULT false;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS hacker_mode boolean DEFAULT false;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS konami_activated boolean DEFAULT false;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS system_failure boolean DEFAULT false;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 2: ÍNDICES PARA PERFORMANCE
-- ═══════════════════════════════════════════════════════════════════════════════

-- Índices para friendships
CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);
CREATE INDEX IF NOT EXISTS idx_friendships_composite ON friendships(user_id, friend_id, status);

-- Índices para campaigns
CREATE INDEX IF NOT EXISTS idx_campaign_members_campaign ON campaign_members(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_members_user ON campaign_members(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_gm ON campaigns(gm_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_invite_code ON campaigns(invite_code);

-- Índices para mensagens
CREATE INDEX IF NOT EXISTS idx_friend_messages_sender ON friend_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_friend_messages_receiver ON friend_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_friend_messages_unread ON friend_messages(receiver_id, is_read) WHERE is_read = FALSE;

-- Índice único para achievements
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_achievements_unique ON user_achievements(user_id, achievement_id);

-- Índices para logs
CREATE INDEX IF NOT EXISTS idx_dice_logs_campaign ON dice_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_logs_campaign ON campaign_logs(campaign_id);

-- Índice para profiles
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 3: FUNÇÕES DE USERNAME
-- ═══════════════════════════════════════════════════════════════════════════════

-- Verificar disponibilidade de username
CREATE OR REPLACE FUNCTION check_username_available(
    check_username TEXT, 
    current_user_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    IF check_username IS NULL OR LENGTH(TRIM(check_username)) < 2 THEN
        RETURN FALSE;
    END IF;
    
    RETURN NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE LOWER(username) = LOWER(TRIM(check_username))
        AND id != COALESCE(current_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Alias para compatibilidade
CREATE OR REPLACE FUNCTION is_username_available(
    new_username TEXT,
    current_user_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN check_username_available(new_username, current_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Obter dias restantes de cooldown para alterar username
CREATE OR REPLACE FUNCTION get_username_cooldown_days(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    last_change TIMESTAMPTZ;
    days_since INTEGER;
BEGIN
    SELECT username_changed_at INTO last_change
    FROM profiles WHERE id = p_user_id;
    
    IF last_change IS NULL THEN
        RETURN 0;
    END IF;
    
    days_since := EXTRACT(DAY FROM (NOW() - last_change))::INTEGER;
    RETURN GREATEST(0, 14 - days_since);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Alterar username com validação e cooldown
CREATE OR REPLACE FUNCTION change_username(new_username TEXT)
RETURNS jsonb AS $$
DECLARE
    last_change TIMESTAMPTZ;
    days_since INTEGER;
    normalized_username TEXT;
BEGIN
    -- Normaliza username
    normalized_username := LOWER(TRIM(new_username));
    
    -- Validação de formato
    IF LENGTH(normalized_username) < 2 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Username deve ter pelo menos 2 caracteres');
    END IF;
    
    IF LENGTH(normalized_username) > 20 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Username deve ter no máximo 20 caracteres');
    END IF;
    
    IF normalized_username !~ '^[a-z0-9_]+$' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Username deve conter apenas letras, números e _');
    END IF;
    
    -- Verifica cooldown de 14 dias
    SELECT username_changed_at INTO last_change
    FROM profiles WHERE id = auth.uid();
    
    IF last_change IS NOT NULL THEN
        days_since := EXTRACT(DAY FROM (NOW() - last_change))::INTEGER;
        IF days_since < 14 THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', format('Aguarde %s dias para alterar novamente', 14 - days_since)
            );
        END IF;
    END IF;
    
    -- Verifica disponibilidade
    IF EXISTS (
        SELECT 1 FROM profiles 
        WHERE LOWER(username) = normalized_username
        AND id != auth.uid()
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Username já está em uso');
    END IF;
    
    -- Atualiza username
    UPDATE profiles 
    SET username = normalized_username,
        username_changed_at = NOW(),
        updated_at = NOW()
    WHERE id = auth.uid();
    
    RETURN jsonb_build_object('success', true, 'username', normalized_username);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 4: FUNÇÕES DE AMIZADE
-- ═══════════════════════════════════════════════════════════════════════════════

-- Obter lista completa de amigos com todos os dados
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
        COALESCE(p.display_name, p.username, 'Usuário') AS display_name,
        p.avatar_url,
        p.bio,
        FALSE AS is_online, -- Presença pode ser implementada separadamente
        p.updated_at AS last_seen,
        f.created_at AS friendship_date,
        COALESCE((
            SELECT COUNT(*) FROM friend_messages fm
            WHERE fm.sender_id = CASE WHEN f.user_id = auth.uid() THEN f.friend_id ELSE f.user_id END
            AND fm.receiver_id = auth.uid()
            AND fm.is_read = FALSE
        ), 0) AS unread_messages,
        COALESCE((
            SELECT COUNT(*) FROM user_achievements ua
            WHERE ua.user_id = CASE WHEN f.user_id = auth.uid() THEN f.friend_id ELSE f.user_id END
        ), 0) AS achievements_count
    FROM friendships f
    JOIN profiles p ON p.id = CASE WHEN f.user_id = auth.uid() THEN f.friend_id ELSE f.user_id END
    WHERE (f.user_id = auth.uid() OR f.friend_id = auth.uid())
    AND f.status = 'accepted'
    ORDER BY p.username;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Obter pedidos de amizade pendentes
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
        COALESCE(p.display_name, p.username, 'Usuário') AS display_name,
        p.avatar_url,
        p.bio,
        f.created_at AS sent_at
    FROM friendships f
    JOIN profiles p ON p.id = f.user_id
    WHERE f.friend_id = auth.uid()
    AND f.status = 'pending'
    ORDER BY f.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enviar pedido de amizade
CREATE OR REPLACE FUNCTION send_friend_request(
    sender_id UUID,
    target_username TEXT
) RETURNS jsonb AS $$
DECLARE
    target_user_id UUID;
    existing_friendship UUID;
BEGIN
    -- Busca o usuário alvo pelo username
    SELECT id INTO target_user_id
    FROM profiles
    WHERE LOWER(username) = LOWER(TRIM(target_username));
    
    IF target_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Usuário não encontrado');
    END IF;
    
    -- Não pode adicionar a si mesmo
    IF target_user_id = sender_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Você não pode adicionar a si mesmo');
    END IF;
    
    -- Verifica se já existe amizade ou pedido
    SELECT id INTO existing_friendship
    FROM friendships
    WHERE (user_id = sender_id AND friend_id = target_user_id)
       OR (user_id = target_user_id AND friend_id = sender_id);
    
    IF existing_friendship IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Já existe um pedido ou amizade com este usuário');
    END IF;
    
    -- Cria o pedido de amizade
    INSERT INTO friendships (user_id, friend_id, status)
    VALUES (sender_id, target_user_id, 'pending');
    
    RETURN jsonb_build_object('success', true, 'message', 'Pedido de amizade enviado');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aceitar pedido de amizade
CREATE OR REPLACE FUNCTION accept_friend_request(request_id UUID)
RETURNS jsonb AS $$
BEGIN
    UPDATE friendships
    SET status = 'accepted',
        updated_at = NOW()
    WHERE id = request_id
    AND friend_id = auth.uid()
    AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Pedido não encontrado');
    END IF;
    
    RETURN jsonb_build_object('success', true, 'message', 'Amizade aceita');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rejeitar pedido de amizade
CREATE OR REPLACE FUNCTION reject_friend_request(request_id UUID)
RETURNS jsonb AS $$
BEGIN
    DELETE FROM friendships
    WHERE id = request_id
    AND friend_id = auth.uid()
    AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Pedido não encontrado');
    END IF;
    
    RETURN jsonb_build_object('success', true, 'message', 'Pedido rejeitado');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remover amigo
CREATE OR REPLACE FUNCTION remove_friend(p_friend_id UUID)
RETURNS jsonb AS $$
BEGIN
    DELETE FROM friendships
    WHERE status = 'accepted'
    AND ((user_id = auth.uid() AND friend_id = p_friend_id)
         OR (user_id = p_friend_id AND friend_id = auth.uid()));
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Amizade não encontrada');
    END IF;
    
    RETURN jsonb_build_object('success', true, 'message', 'Amigo removido');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 5: FUNÇÕES DE MENSAGENS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Enviar mensagem para amigo
CREATE OR REPLACE FUNCTION send_friend_message(
    p_receiver_id UUID,
    p_content TEXT
) RETURNS jsonb AS $$
DECLARE
    v_message_id UUID;
BEGIN
    -- Valida conteúdo
    IF p_content IS NULL OR LENGTH(TRIM(p_content)) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Mensagem não pode ser vazia');
    END IF;
    
    IF LENGTH(p_content) > 2000 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Mensagem muito longa (máx 2000 caracteres)');
    END IF;
    
    -- Verifica se são amigos
    IF NOT EXISTS (
        SELECT 1 FROM friendships
        WHERE status = 'accepted'
        AND ((user_id = auth.uid() AND friend_id = p_receiver_id)
             OR (user_id = p_receiver_id AND friend_id = auth.uid()))
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Vocês não são amigos');
    END IF;
    
    -- Insere mensagem
    INSERT INTO friend_messages (sender_id, receiver_id, content)
    VALUES (auth.uid(), p_receiver_id, TRIM(p_content))
    RETURNING id INTO v_message_id;
    
    RETURN jsonb_build_object(
        'success', true, 
        'message_id', v_message_id,
        'created_at', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Obter conversa com amigo
CREATE OR REPLACE FUNCTION get_friend_conversation(
    p_friend_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
) RETURNS TABLE (
    id UUID,
    sender_id UUID,
    content TEXT,
    is_read BOOLEAN,
    created_at TIMESTAMPTZ,
    is_mine BOOLEAN
) AS $$
BEGIN
    -- Marca mensagens recebidas como lidas
    UPDATE friend_messages
    SET is_read = TRUE
    WHERE sender_id = p_friend_id
    AND receiver_id = auth.uid()
    AND is_read = FALSE;
    
    -- Retorna mensagens ordenadas
    RETURN QUERY
    SELECT 
        fm.id,
        fm.sender_id,
        fm.content,
        fm.is_read,
        fm.created_at,
        (fm.sender_id = auth.uid()) AS is_mine
    FROM friend_messages fm
    WHERE (fm.sender_id = auth.uid() AND fm.receiver_id = p_friend_id)
       OR (fm.sender_id = p_friend_id AND fm.receiver_id = auth.uid())
    ORDER BY fm.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Contar mensagens não lidas
CREATE OR REPLACE FUNCTION get_unread_message_count()
RETURNS TABLE (
    friend_id UUID,
    unread_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fm.sender_id AS friend_id,
        COUNT(*) AS unread_count
    FROM friend_messages fm
    WHERE fm.receiver_id = auth.uid()
    AND fm.is_read = FALSE
    GROUP BY fm.sender_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 6: FUNÇÕES DE CAMPANHA
-- ═══════════════════════════════════════════════════════════════════════════════

-- Enviar convite de campanha para amigo
CREATE OR REPLACE FUNCTION send_campaign_invite(
    p_campaign_id UUID,
    p_friend_id UUID
) RETURNS jsonb AS $$
DECLARE
    v_campaign RECORD;
    v_member_count INTEGER;
BEGIN
    -- Busca campanha
    SELECT * INTO v_campaign
    FROM campaigns
    WHERE id = p_campaign_id;
    
    IF v_campaign IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Campanha não encontrada');
    END IF;
    
    -- Verifica se é o GM
    IF v_campaign.gm_id != auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Apenas o Mestre pode enviar convites');
    END IF;
    
    -- Verifica se são amigos
    IF NOT EXISTS (
        SELECT 1 FROM friendships
        WHERE status = 'accepted'
        AND ((user_id = auth.uid() AND friend_id = p_friend_id)
             OR (user_id = p_friend_id AND friend_id = auth.uid()))
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Vocês não são amigos');
    END IF;
    
    -- Verifica se já é membro
    IF EXISTS (
        SELECT 1 FROM campaign_members
        WHERE campaign_id = p_campaign_id
        AND user_id = p_friend_id
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Usuário já é membro da campanha');
    END IF;
    
    -- Verifica limite de membros (8)
    SELECT COUNT(*) INTO v_member_count
    FROM campaign_members
    WHERE campaign_id = p_campaign_id;
    
    IF v_member_count >= 8 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Campanha está cheia (máximo 8 jogadores)');
    END IF;
    
    -- Adiciona como membro
    INSERT INTO campaign_members (campaign_id, user_id, role, status)
    VALUES (p_campaign_id, p_friend_id, 'player', 'active');
    
    RETURN jsonb_build_object('success', true, 'message', 'Convite enviado com sucesso');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sair de uma campanha
CREATE OR REPLACE FUNCTION leave_campaign(p_campaign_id UUID)
RETURNS jsonb AS $$
DECLARE
    v_campaign RECORD;
BEGIN
    -- Busca campanha
    SELECT * INTO v_campaign
    FROM campaigns
    WHERE id = p_campaign_id;
    
    IF v_campaign IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Campanha não encontrada');
    END IF;
    
    -- GM não pode sair, apenas deletar
    IF v_campaign.gm_id = auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'O Mestre não pode sair. Delete a campanha se necessário.');
    END IF;
    
    -- Remove membro
    DELETE FROM campaign_members
    WHERE campaign_id = p_campaign_id
    AND user_id = auth.uid();
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Você não é membro desta campanha');
    END IF;
    
    RETURN jsonb_build_object('success', true, 'message', 'Você saiu da campanha');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sair de todas as campanhas (exceto onde é GM)
CREATE OR REPLACE FUNCTION leave_all_campaigns()
RETURNS jsonb AS $$
DECLARE
    v_count INTEGER;
BEGIN
    WITH deleted AS (
        DELETE FROM campaign_members
        WHERE user_id = auth.uid()
        AND campaign_id NOT IN (
            SELECT id FROM campaigns WHERE gm_id = auth.uid()
        )
        RETURNING id
    )
    SELECT COUNT(*) INTO v_count FROM deleted;
    
    RETURN jsonb_build_object('success', true, 'left_count', v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Deletar todas as campanhas onde é GM
CREATE OR REPLACE FUNCTION delete_all_my_campaigns()
RETURNS jsonb AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Primeiro remove todos os membros
    DELETE FROM campaign_members
    WHERE campaign_id IN (
        SELECT id FROM campaigns WHERE gm_id = auth.uid()
    );
    
    -- Depois deleta as campanhas
    WITH deleted AS (
        DELETE FROM campaigns
        WHERE gm_id = auth.uid()
        RETURNING id
    )
    SELECT COUNT(*) INTO v_count FROM deleted;
    
    RETURN jsonb_build_object('success', true, 'deleted_count', v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 7: FUNÇÕES DE AUTENTICAÇÃO
-- ═══════════════════════════════════════════════════════════════════════════════

-- Verificar provedor OAuth de um email
CREATE OR REPLACE FUNCTION check_email_oauth_provider(email_to_check TEXT)
RETURNS TEXT AS $$
DECLARE
    v_provider TEXT;
BEGIN
    -- Busca o provedor do usuário pelo email
    SELECT 
        CASE 
            WHEN raw_app_meta_data->>'provider' IS NOT NULL 
            THEN raw_app_meta_data->>'provider'
            ELSE 'email'
        END INTO v_provider
    FROM auth.users
    WHERE email = LOWER(TRIM(email_to_check))
    LIMIT 1;
    
    RETURN COALESCE(v_provider, 'none');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 8: FUNÇÕES DE ACHIEVEMENTS E STATS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Salvar achievement desbloqueado
CREATE OR REPLACE FUNCTION save_achievement(
    p_achievement_id TEXT,
    p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO user_achievements (user_id, achievement_id, metadata)
    VALUES (auth.uid(), p_achievement_id, p_metadata)
    ON CONFLICT (user_id, achievement_id) DO NOTHING
    RETURNING id INTO v_id;
    
    IF v_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Achievement já desbloqueado');
    END IF;
    
    RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Obter achievements do usuário
CREATE OR REPLACE FUNCTION get_user_achievements(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
    achievement_id TEXT,
    unlocked_at TIMESTAMPTZ,
    metadata jsonb
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ua.achievement_id,
        ua.unlocked_at,
        ua.metadata
    FROM user_achievements ua
    WHERE ua.user_id = COALESCE(p_user_id, auth.uid())
    ORDER BY ua.unlocked_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sincronizar stats do usuário
CREATE OR REPLACE FUNCTION sync_user_stats(
    p_total_rolls INTEGER DEFAULT 0,
    p_critical_rolls INTEGER DEFAULT 0,
    p_fumble_rolls INTEGER DEFAULT 0,
    p_characters_created INTEGER DEFAULT 0,
    p_messages_sent INTEGER DEFAULT 0,
    p_friends_count INTEGER DEFAULT 0,
    p_max_level INTEGER DEFAULT 1,
    p_night_owl BOOLEAN DEFAULT FALSE,
    p_early_bird BOOLEAN DEFAULT FALSE,
    p_hacker_mode BOOLEAN DEFAULT FALSE,
    p_konami_activated BOOLEAN DEFAULT FALSE,
    p_system_failure BOOLEAN DEFAULT FALSE
) RETURNS jsonb AS $$
BEGIN
    INSERT INTO user_stats (
        user_id, total_rolls, critical_rolls, fumble_rolls,
        characters_created, messages_sent, friends_count,
        max_level, night_owl, early_bird, hacker_mode,
        konami_activated, system_failure, updated_at
    ) VALUES (
        auth.uid(), p_total_rolls, p_critical_rolls, p_fumble_rolls,
        p_characters_created, p_messages_sent, p_friends_count,
        p_max_level, p_night_owl, p_early_bird, p_hacker_mode,
        p_konami_activated, p_system_failure, NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        total_rolls = GREATEST(user_stats.total_rolls, EXCLUDED.total_rolls),
        critical_rolls = GREATEST(user_stats.critical_rolls, EXCLUDED.critical_rolls),
        fumble_rolls = GREATEST(user_stats.fumble_rolls, EXCLUDED.fumble_rolls),
        characters_created = GREATEST(user_stats.characters_created, EXCLUDED.characters_created),
        messages_sent = GREATEST(user_stats.messages_sent, EXCLUDED.messages_sent),
        friends_count = EXCLUDED.friends_count,
        max_level = GREATEST(user_stats.max_level, EXCLUDED.max_level),
        night_owl = user_stats.night_owl OR EXCLUDED.night_owl,
        early_bird = user_stats.early_bird OR EXCLUDED.early_bird,
        hacker_mode = user_stats.hacker_mode OR EXCLUDED.hacker_mode,
        konami_activated = user_stats.konami_activated OR EXCLUDED.konami_activated,
        system_failure = user_stats.system_failure OR EXCLUDED.system_failure,
        updated_at = NOW();
    
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Obter stats do usuário
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID DEFAULT NULL)
RETURNS jsonb AS $$
DECLARE
    v_stats RECORD;
BEGIN
    SELECT * INTO v_stats
    FROM user_stats
    WHERE user_id = COALESCE(p_user_id, auth.uid());
    
    IF v_stats IS NULL THEN
        RETURN jsonb_build_object(
            'total_rolls', 0,
            'critical_rolls', 0,
            'fumble_rolls', 0,
            'characters_created', 0,
            'messages_sent', 0,
            'friends_count', 0,
            'max_level', 1
        );
    END IF;
    
    RETURN jsonb_build_object(
        'total_rolls', v_stats.total_rolls,
        'critical_rolls', v_stats.critical_rolls,
        'fumble_rolls', v_stats.fumble_rolls,
        'characters_created', v_stats.characters_created,
        'campaigns_joined', v_stats.campaigns_joined,
        'campaigns_mastered', v_stats.campaigns_mastered,
        'messages_sent', v_stats.messages_sent,
        'play_time_minutes', v_stats.play_time_minutes,
        'friends_count', v_stats.friends_count,
        'max_level', v_stats.max_level,
        'night_owl', v_stats.night_owl,
        'early_bird', v_stats.early_bird,
        'hacker_mode', v_stats.hacker_mode,
        'konami_activated', v_stats.konami_activated,
        'system_failure', v_stats.system_failure
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 9: ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Habilitar RLS em todas as tabelas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dice_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

-- Políticas para profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
CREATE POLICY "Users can view all profiles" ON profiles
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Políticas para friendships
DROP POLICY IF EXISTS "Users can view own friendships" ON friendships;
CREATE POLICY "Users can view own friendships" ON friendships
    FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "Users can insert friendships" ON friendships;
CREATE POLICY "Users can insert friendships" ON friendships
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own friendships" ON friendships;
CREATE POLICY "Users can update own friendships" ON friendships
    FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "Users can delete own friendships" ON friendships;
CREATE POLICY "Users can delete own friendships" ON friendships
    FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Políticas para friend_messages
DROP POLICY IF EXISTS "Users can view own messages" ON friend_messages;
CREATE POLICY "Users can view own messages" ON friend_messages
    FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can send messages" ON friend_messages;
CREATE POLICY "Users can send messages" ON friend_messages
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can update received messages" ON friend_messages;
CREATE POLICY "Users can update received messages" ON friend_messages
    FOR UPDATE USING (auth.uid() = receiver_id);

-- Políticas para campaigns
DROP POLICY IF EXISTS "Anyone can view public campaigns" ON campaigns;
CREATE POLICY "Anyone can view public campaigns" ON campaigns
    FOR SELECT USING (
        is_public = true 
        OR gm_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM campaign_members 
            WHERE campaign_id = campaigns.id 
            AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "GM can manage campaigns" ON campaigns;
CREATE POLICY "GM can manage campaigns" ON campaigns
    FOR ALL USING (gm_id = auth.uid());

-- Políticas para campaign_members
DROP POLICY IF EXISTS "Members can view campaign members" ON campaign_members;
CREATE POLICY "Members can view campaign members" ON campaign_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM campaigns 
            WHERE id = campaign_members.campaign_id 
            AND (gm_id = auth.uid() OR EXISTS (
                SELECT 1 FROM campaign_members cm 
                WHERE cm.campaign_id = campaigns.id 
                AND cm.user_id = auth.uid()
            ))
        )
    );

DROP POLICY IF EXISTS "GM can manage members" ON campaign_members;
CREATE POLICY "GM can manage members" ON campaign_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM campaigns 
            WHERE id = campaign_members.campaign_id 
            AND gm_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Members can update own data" ON campaign_members;
CREATE POLICY "Members can update own data" ON campaign_members
    FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Members can delete self" ON campaign_members;
CREATE POLICY "Members can delete self" ON campaign_members
    FOR DELETE USING (user_id = auth.uid());

-- Políticas para user_achievements
DROP POLICY IF EXISTS "Users can view own achievements" ON user_achievements;
CREATE POLICY "Users can view own achievements" ON user_achievements
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own achievements" ON user_achievements;
CREATE POLICY "Users can insert own achievements" ON user_achievements
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Políticas para user_stats
DROP POLICY IF EXISTS "Users can view own stats" ON user_stats;
CREATE POLICY "Users can view own stats" ON user_stats
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own stats" ON user_stats;
CREATE POLICY "Users can manage own stats" ON user_stats
    FOR ALL USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 10: TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Trigger para criar perfil automaticamente ao criar usuário
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, username, display_name, created_at, updated_at)
    VALUES (
        NEW.id,
        COALESCE(
            NEW.raw_user_meta_data->>'username',
            SPLIT_PART(NEW.email, '@', 1)
        ),
        COALESCE(
            NEW.raw_user_meta_data->>'display_name',
            NEW.raw_user_meta_data->>'username',
            SPLIT_PART(NEW.email, '@', 1)
        ),
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO NOTHING;
    
    -- Cria entrada de stats
    INSERT INTO user_stats (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cria o trigger se não existir
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplica trigger em tabelas relevantes
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_campaigns_updated_at ON campaigns;
CREATE TRIGGER update_campaigns_updated_at
    BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_friendships_updated_at ON friendships;
CREATE TRIGGER update_friendships_updated_at
    BEFORE UPDATE ON friendships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════════════════
-- FIM DO ARQUIVO
-- ═══════════════════════════════════════════════════════════════════════════════

-- Verificação final
DO $$
BEGIN
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
    RAISE NOTICE 'ZENITE OS - SQL Functions instaladas com sucesso!';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
    RAISE NOTICE 'Funções criadas:';
    RAISE NOTICE '  - check_username_available, is_username_available';
    RAISE NOTICE '  - get_username_cooldown_days, change_username';
    RAISE NOTICE '  - get_friends_full, get_pending_requests';
    RAISE NOTICE '  - send_friend_request, accept_friend_request, reject_friend_request';
    RAISE NOTICE '  - send_friend_message, get_friend_conversation';
    RAISE NOTICE '  - send_campaign_invite, leave_campaign, leave_all_campaigns';
    RAISE NOTICE '  - save_achievement, get_user_achievements';
    RAISE NOTICE '  - sync_user_stats, get_user_stats';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
END $$;
