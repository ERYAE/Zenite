-- ═══════════════════════════════════════════════════════════════════════════
-- ZENITE OS - MIGRAÇÃO: PERSISTÊNCIA E CORREÇÕES
-- Data: 2025-06-13
-- ═══════════════════════════════════════════════════════════════════════════
-- 
-- PROBLEMAS RESOLVIDOS:
-- 1. Persistência de migração/changelog no Supabase (não mais localStorage)
-- 2. Robustez de achievements (sincronização bidirecional)
-- 3. Tema vazando para login após logout
-- 4. Códigos de campanha não funcionando
-- 5. Indicador de typing no chat
--
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ADICIONAR CAMPOS DE PERSISTÊNCIA NA TABELA PROFILES
-- ─────────────────────────────────────────────────────────────────────────────

-- Adiciona campos para persistir flags de UI no banco
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS changelog_version_seen INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS migration_seen BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS theme_color TEXT DEFAULT 'cyan',
ADD COLUMN IF NOT EXISTS crt_mode BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS sound_enabled BOOLEAN DEFAULT TRUE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. FUNÇÃO PARA SALVAR PREFERÊNCIAS DO USUÁRIO
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.save_user_preferences(
    p_changelog_version INTEGER DEFAULT NULL,
    p_migration_seen BOOLEAN DEFAULT NULL,
    p_theme_color TEXT DEFAULT NULL,
    p_crt_mode BOOLEAN DEFAULT NULL,
    p_sound_enabled BOOLEAN DEFAULT NULL,
    p_has_seen_welcome BOOLEAN DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.profiles
    SET 
        changelog_version_seen = COALESCE(p_changelog_version, changelog_version_seen),
        migration_seen = COALESCE(p_migration_seen, migration_seen),
        theme_color = COALESCE(p_theme_color, theme_color),
        crt_mode = COALESCE(p_crt_mode, crt_mode),
        sound_enabled = COALESCE(p_sound_enabled, sound_enabled),
        has_seen_welcome = COALESCE(p_has_seen_welcome, has_seen_welcome),
        updated_at = NOW()
    WHERE id = auth.uid();
    
    RETURN FOUND;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. FUNÇÃO PARA CARREGAR PREFERÊNCIAS DO USUÁRIO
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_user_preferences()
RETURNS TABLE (
    changelog_version_seen INTEGER,
    migration_seen BOOLEAN,
    theme_color TEXT,
    crt_mode BOOLEAN,
    sound_enabled BOOLEAN,
    has_seen_welcome BOOLEAN,
    username TEXT,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.changelog_version_seen,
        p.migration_seen,
        p.theme_color,
        p.crt_mode,
        p.sound_enabled,
        p.has_seen_welcome,
        p.username,
        p.display_name,
        p.avatar_url,
        p.bio
    FROM public.profiles p
    WHERE p.id = auth.uid();
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. MELHORAR FUNÇÃO DE ACHIEVEMENTS (ROBUSTEZ)
-- ─────────────────────────────────────────────────────────────────────────────

-- Função para salvar achievement com upsert (evita duplicatas)
CREATE OR REPLACE FUNCTION public.unlock_achievement(
    p_achievement_id TEXT,
    p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    -- Verifica se já existe
    SELECT EXISTS(
        SELECT 1 FROM public.user_achievements 
        WHERE user_id = auth.uid() AND achievement_id = p_achievement_id
    ) INTO v_exists;
    
    -- Se não existe, insere
    IF NOT v_exists THEN
        INSERT INTO public.user_achievements (user_id, achievement_id, metadata)
        VALUES (auth.uid(), p_achievement_id, p_metadata);
        RETURN TRUE; -- Novo achievement desbloqueado
    END IF;
    
    RETURN FALSE; -- Já estava desbloqueado
END;
$$;

-- Função para obter todos os achievements do usuário
CREATE OR REPLACE FUNCTION public.get_user_achievements()
RETURNS TABLE (
    achievement_id TEXT,
    unlocked_at TIMESTAMPTZ,
    metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ua.achievement_id,
        ua.unlocked_at,
        ua.metadata
    FROM public.user_achievements ua
    WHERE ua.user_id = auth.uid()
    ORDER BY ua.unlocked_at DESC;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. CORRIGIR BUSCA DE CAMPANHA POR CÓDIGO (case-insensitive)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.find_campaign_by_code(p_code TEXT)
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
    gm_id UUID,
    invite_code VARCHAR,
    atmosphere TEXT,
    settings JSONB,
    image_url TEXT,
    created_at TIMESTAMPTZ,
    gm_username TEXT,
    gm_display_name TEXT,
    member_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.description,
        c.gm_id,
        c.invite_code,
        c.atmosphere,
        c.settings,
        c.image_url,
        c.created_at,
        p.username AS gm_username,
        p.display_name AS gm_display_name,
        (SELECT COUNT(*) FROM public.campaign_members cm WHERE cm.campaign_id = c.id) AS member_count
    FROM public.campaigns c
    LEFT JOIN public.profiles p ON p.id = c.gm_id
    WHERE UPPER(c.invite_code) = UPPER(p_code)
       OR UPPER(c.code) = UPPER(p_code);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. SISTEMA DE TYPING INDICATOR (Indicador "Escrevendo...")
-- ─────────────────────────────────────────────────────────────────────────────

-- Tabela temporária para status de typing (TTL de 5 segundos via aplicação)
CREATE TABLE IF NOT EXISTS public.typing_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, friend_id)
);

-- RLS para typing_status
ALTER TABLE public.typing_status ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "Users can see typing status for their conversations" ON public.typing_status;
CREATE POLICY "Users can see typing status for their conversations" ON public.typing_status
    FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "Users can insert their own typing status" ON public.typing_status;
CREATE POLICY "Users can insert their own typing status" ON public.typing_status
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own typing status" ON public.typing_status;
CREATE POLICY "Users can update their own typing status" ON public.typing_status
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own typing status" ON public.typing_status;
CREATE POLICY "Users can delete their own typing status" ON public.typing_status
    FOR DELETE USING (auth.uid() = user_id);

-- Função para atualizar status de typing (upsert)
CREATE OR REPLACE FUNCTION public.set_typing_status(p_friend_id UUID, p_is_typing BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_is_typing THEN
        -- Upsert: insere ou atualiza timestamp
        INSERT INTO public.typing_status (user_id, friend_id, started_at)
        VALUES (auth.uid(), p_friend_id, NOW())
        ON CONFLICT (user_id, friend_id) 
        DO UPDATE SET started_at = NOW();
    ELSE
        -- Remove status de typing
        DELETE FROM public.typing_status 
        WHERE user_id = auth.uid() AND friend_id = p_friend_id;
    END IF;
END;
$$;

-- Função para verificar se amigo está digitando
CREATE OR REPLACE FUNCTION public.is_friend_typing(p_friend_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_started_at TIMESTAMPTZ;
BEGIN
    SELECT started_at INTO v_started_at
    FROM public.typing_status
    WHERE user_id = p_friend_id AND friend_id = auth.uid();
    
    -- Considera "digitando" se o status foi atualizado nos últimos 5 segundos
    IF v_started_at IS NOT NULL AND v_started_at > NOW() - INTERVAL '5 seconds' THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$;

-- Habilita Realtime para typing_status
ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_status;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. ÍNDICES PARA PERFORMANCE
-- ─────────────────────────────────────────────────────────────────────────────

-- Índice para busca de campanha por código (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_campaigns_invite_code_upper 
ON public.campaigns (UPPER(invite_code));

CREATE INDEX IF NOT EXISTS idx_campaigns_code_upper 
ON public.campaigns (UPPER(code));

-- Índice para typing_status
CREATE INDEX IF NOT EXISTS idx_typing_status_friend 
ON public.typing_status (friend_id, started_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. LIMPEZA AUTOMÁTICA DE TYPING STATUS (Job de limpeza)
-- ─────────────────────────────────────────────────────────────────────────────

-- Função para limpar typing status antigos (mais de 10 segundos)
CREATE OR REPLACE FUNCTION public.cleanup_typing_status()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM public.typing_status
    WHERE started_at < NOW() - INTERVAL '10 seconds';
    
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. GRANT PERMISSIONS
-- ─────────────────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.save_user_preferences TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_preferences TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_achievement TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_achievements TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_campaign_by_code TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_typing_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_friend_typing TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_typing_status TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- FIM DA MIGRAÇÃO
-- ═══════════════════════════════════════════════════════════════════════════
