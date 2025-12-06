-- ═══════════════════════════════════════════════════════════════════════════
-- FRIENDS CHAT SYSTEM (Whisper/Cochicho)
-- Sistema de mensagens privadas entre amigos
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. TABELA DE MENSAGENS PRIVADAS
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.friend_messages (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    sender_id uuid NOT NULL,
    receiver_id uuid NOT NULL,
    content text NOT NULL,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    
    CONSTRAINT friend_messages_pkey PRIMARY KEY (id),
    CONSTRAINT friend_messages_sender_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT friend_messages_receiver_fkey FOREIGN KEY (receiver_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT friend_messages_not_self CHECK (sender_id != receiver_id)
);

-- 2. ÍNDICES PARA PERFORMANCE
-- ─────────────────────────────────────────────────────────────────────────

-- Índice para buscar mensagens entre dois usuários
CREATE INDEX IF NOT EXISTS idx_friend_messages_conversation 
ON public.friend_messages(LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id), created_at DESC);

-- Índice para mensagens não lidas
CREATE INDEX IF NOT EXISTS idx_friend_messages_unread 
ON public.friend_messages(receiver_id, is_read) WHERE is_read = false;

-- Índice para ordenação por data
CREATE INDEX IF NOT EXISTS idx_friend_messages_created 
ON public.friend_messages(created_at DESC);


-- 3. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.friend_messages ENABLE ROW LEVEL SECURITY;

-- Usuários só podem ver suas próprias mensagens
DROP POLICY IF EXISTS "Users can view their messages" ON public.friend_messages;
CREATE POLICY "Users can view their messages"
ON public.friend_messages FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Usuários só podem enviar mensagens
DROP POLICY IF EXISTS "Users can send messages" ON public.friend_messages;
CREATE POLICY "Users can send messages"
ON public.friend_messages FOR INSERT
WITH CHECK (auth.uid() = sender_id);

-- Usuários podem marcar mensagens como lidas
DROP POLICY IF EXISTS "Users can update read status" ON public.friend_messages;
CREATE POLICY "Users can update read status"
ON public.friend_messages FOR UPDATE
USING (auth.uid() = receiver_id)
WITH CHECK (auth.uid() = receiver_id);


-- 4. FUNÇÃO: ENVIAR MENSAGEM (COM VALIDAÇÃO DE AMIZADE)
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION send_friend_message(
    p_receiver_id uuid,
    p_content text
)
RETURNS jsonb AS $$
DECLARE
    v_sender_id uuid := auth.uid();
    v_is_friend boolean;
    v_message_id uuid;
BEGIN
    -- Valida conteúdo
    IF p_content IS NULL OR trim(p_content) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'empty_content');
    END IF;
    
    IF length(p_content) > 2000 THEN
        RETURN jsonb_build_object('success', false, 'error', 'content_too_long');
    END IF;
    
    -- Verifica se são amigos
    SELECT EXISTS(
        SELECT 1 FROM public.friendships
        WHERE status = 'accepted'
        AND (
            (user_id = v_sender_id AND friend_id = p_receiver_id) OR
            (user_id = p_receiver_id AND friend_id = v_sender_id)
        )
    ) INTO v_is_friend;
    
    IF NOT v_is_friend THEN
        RETURN jsonb_build_object('success', false, 'error', 'not_friends');
    END IF;
    
    -- Insere mensagem
    INSERT INTO public.friend_messages (sender_id, receiver_id, content)
    VALUES (v_sender_id, p_receiver_id, trim(p_content))
    RETURNING id INTO v_message_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'message_id', v_message_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. FUNÇÃO: BUSCAR CONVERSA COM AMIGO
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_friend_conversation(
    p_friend_id uuid,
    p_limit integer DEFAULT 50,
    p_offset integer DEFAULT 0
)
RETURNS TABLE (
    id uuid,
    sender_id uuid,
    receiver_id uuid,
    content text,
    is_read boolean,
    created_at timestamptz,
    is_mine boolean
) AS $$
DECLARE
    v_user_id uuid := auth.uid();
BEGIN
    -- Marca mensagens como lidas
    UPDATE public.friend_messages
    SET is_read = true
    WHERE receiver_id = v_user_id 
    AND sender_id = p_friend_id 
    AND is_read = false;
    
    -- Retorna conversa
    RETURN QUERY
    SELECT 
        m.id,
        m.sender_id,
        m.receiver_id,
        m.content,
        m.is_read,
        m.created_at,
        (m.sender_id = v_user_id) as is_mine
    FROM public.friend_messages m
    WHERE (m.sender_id = v_user_id AND m.receiver_id = p_friend_id)
       OR (m.sender_id = p_friend_id AND m.receiver_id = v_user_id)
    ORDER BY m.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. FUNÇÃO: CONTAR MENSAGENS NÃO LIDAS
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_unread_message_counts()
RETURNS TABLE (
    friend_id uuid,
    unread_count bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.sender_id as friend_id,
        COUNT(*) as unread_count
    FROM public.friend_messages m
    WHERE m.receiver_id = auth.uid()
    AND m.is_read = false
    GROUP BY m.sender_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7. FUNÇÃO OTIMIZADA: BUSCAR AMIGOS COM DADOS COMPLETOS
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_friends_full()
RETURNS TABLE (
    friendship_id uuid,
    friend_id uuid,
    username text,
    display_name text,
    avatar_url text,
    bio text,
    is_online boolean,
    last_seen timestamptz,
    friendship_date timestamptz,
    unread_messages bigint,
    achievements_count bigint
) AS $$
DECLARE
    v_user_id uuid := auth.uid();
BEGIN
    RETURN QUERY
    SELECT 
        f.id as friendship_id,
        CASE WHEN f.user_id = v_user_id THEN f.friend_id ELSE f.user_id END as friend_id,
        p.username,
        COALESCE(p.display_name, p.username) as display_name,
        p.avatar_url,
        p.bio,
        false as is_online, -- Placeholder, atualizar via presence
        p.updated_at as last_seen,
        f.created_at as friendship_date,
        COALESCE(um.unread_count, 0) as unread_messages,
        COALESCE(ac.achievement_count, 0) as achievements_count
    FROM public.friendships f
    INNER JOIN public.profiles p ON p.id = (
        CASE WHEN f.user_id = v_user_id THEN f.friend_id ELSE f.user_id END
    )
    LEFT JOIN (
        SELECT sender_id, COUNT(*) as unread_count
        FROM public.friend_messages
        WHERE receiver_id = v_user_id AND is_read = false
        GROUP BY sender_id
    ) um ON um.sender_id = (CASE WHEN f.user_id = v_user_id THEN f.friend_id ELSE f.user_id END)
    LEFT JOIN (
        SELECT user_id, COUNT(*) as achievement_count
        FROM public.user_achievements
        GROUP BY user_id
    ) ac ON ac.user_id = (CASE WHEN f.user_id = v_user_id THEN f.friend_id ELSE f.user_id END)
    WHERE (f.user_id = v_user_id OR f.friend_id = v_user_id)
    AND f.status = 'accepted'
    ORDER BY um.unread_count DESC NULLS LAST, f.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 8. FUNÇÃO: BUSCAR PEDIDOS PENDENTES COM DADOS
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_pending_requests()
RETURNS TABLE (
    request_id uuid,
    sender_id uuid,
    username text,
    display_name text,
    avatar_url text,
    bio text,
    sent_at timestamptz
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.id as request_id,
        f.user_id as sender_id,
        p.username,
        COALESCE(p.display_name, p.username) as display_name,
        p.avatar_url,
        p.bio,
        f.created_at as sent_at
    FROM public.friendships f
    INNER JOIN public.profiles p ON p.id = f.user_id
    WHERE f.friend_id = auth.uid()
    AND f.status = 'pending'
    ORDER BY f.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 9. GRANTS
-- ─────────────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION send_friend_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_friend_conversation(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_message_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION get_friends_full() TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_requests() TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- FIM DO SISTEMA DE CHAT
-- ═══════════════════════════════════════════════════════════════════════════
