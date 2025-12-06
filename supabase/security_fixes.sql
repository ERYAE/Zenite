-- ═══════════════════════════════════════════════════════════════════════════
-- ZENITE SECURITY & PERFORMANCE FIXES
-- ═══════════════════════════════════════════════════════════════════════════
-- Este arquivo corrige os problemas identificados pelo Supabase Linter

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. FIX: Function Search Path Mutable (SECURITY)
-- ═══════════════════════════════════════════════════════════════════════════
-- Adiciona search_path fixo para prevenir SQL injection

-- Drop existing functions first
DROP FUNCTION IF EXISTS public.get_username_cooldown_days(uuid);
DROP FUNCTION IF EXISTS public.check_username_available(text);
DROP FUNCTION IF EXISTS public.generate_unique_username(text);
DROP FUNCTION IF EXISTS public.change_username(text);

-- Fix get_username_cooldown_days
CREATE FUNCTION public.get_username_cooldown_days(user_id_param uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    days_remaining integer;
BEGIN
    SELECT GREATEST(0, 14 - EXTRACT(DAY FROM (NOW() - username_changed_at))::integer)
    INTO days_remaining
    FROM public.profiles
    WHERE id = user_id_param;
    
    RETURN COALESCE(days_remaining, 0);
END;
$$;

-- Fix check_username_available
CREATE FUNCTION public.check_username_available(username_param text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    username_exists boolean;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM public.profiles 
        WHERE LOWER(username) = LOWER(username_param)
    ) INTO username_exists;
    
    RETURN NOT username_exists;
END;
$$;

-- Fix generate_unique_username
CREATE FUNCTION public.generate_unique_username(base_username text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    final_username text;
    counter integer := 1;
    max_attempts integer := 100;
BEGIN
    final_username := LOWER(REGEXP_REPLACE(base_username, '[^a-z0-9_]', '', 'g'));
    final_username := SUBSTRING(final_username FROM 1 FOR 20);
    
    WHILE NOT public.check_username_available(final_username) AND counter < max_attempts LOOP
        final_username := SUBSTRING(base_username FROM 1 FOR 15) || counter::text;
        counter := counter + 1;
    END LOOP;
    
    RETURN final_username;
END;
$$;

-- Fix change_username
CREATE FUNCTION public.change_username(new_username text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    user_id_val uuid;
    days_since_change integer;
    result jsonb;
BEGIN
    user_id_val := auth.uid();
    
    IF user_id_val IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Check cooldown
    SELECT COALESCE(EXTRACT(DAY FROM (NOW() - username_changed_at))::integer, 999)
    INTO days_since_change
    FROM public.profiles
    WHERE id = user_id_val;
    
    IF days_since_change < 14 THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Username can only be changed once every 14 days',
            'days_remaining', 14 - days_since_change
        );
    END IF;
    
    -- Check availability
    IF NOT public.check_username_available(new_username) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Username already taken');
    END IF;
    
    -- Update username
    UPDATE public.profiles
    SET username = LOWER(new_username),
        username_changed_at = NOW()
    WHERE id = user_id_val;
    
    RETURN jsonb_build_object('success', true, 'username', LOWER(new_username));
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. FIX: Auth RLS Initialization Plan (PERFORMANCE)
-- ═══════════════════════════════════════════════════════════════════════════
-- Otimiza RLS policies para não reavaliar auth.uid() para cada linha

-- Drop ALL existing policies on profiles (including duplicates)
DROP POLICY IF EXISTS "Profiles are viewable by owner or if public" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "Service role can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "members_select" ON public.campaign_members;
DROP POLICY IF EXISTS "members_insert" ON public.campaign_members;
DROP POLICY IF EXISTS "members_update" ON public.campaign_members;
DROP POLICY IF EXISTS "members_delete" ON public.campaign_members;
DROP POLICY IF EXISTS "campaigns_select" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns_insert" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns_update" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns_delete" ON public.campaigns;

-- Recreate with optimized (select auth.uid()) - SINGLE POLICY PER ACTION
CREATE POLICY "profiles_select"
ON public.profiles FOR SELECT
USING (id = (SELECT auth.uid()) OR is_public = true);

CREATE POLICY "profiles_update"
ON public.profiles FOR UPDATE
USING (id = (SELECT auth.uid()));

CREATE POLICY "profiles_insert"
ON public.profiles FOR INSERT
WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "members_select"
ON public.campaign_members FOR SELECT
USING (
    user_id = (SELECT auth.uid()) OR
    campaign_id IN (
        SELECT id FROM public.campaigns WHERE gm_id = (SELECT auth.uid())
    )
);

CREATE POLICY "members_insert"
ON public.campaign_members FOR INSERT
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "members_update"
ON public.campaign_members FOR UPDATE
USING (
    user_id = (SELECT auth.uid()) OR
    campaign_id IN (
        SELECT id FROM public.campaigns WHERE gm_id = (SELECT auth.uid())
    )
);

CREATE POLICY "members_delete"
ON public.campaign_members FOR DELETE
USING (
    user_id = (SELECT auth.uid()) OR
    campaign_id IN (
        SELECT id FROM public.campaigns WHERE gm_id = (SELECT auth.uid())
    )
);

CREATE POLICY "campaigns_select"
ON public.campaigns FOR SELECT
USING (
    gm_id = (SELECT auth.uid()) OR
    id IN (
        SELECT campaign_id FROM public.campaign_members WHERE user_id = (SELECT auth.uid())
    ) OR
    is_public = true
);

CREATE POLICY "campaigns_insert"
ON public.campaigns FOR INSERT
WITH CHECK (gm_id = (SELECT auth.uid()));

CREATE POLICY "campaigns_update"
ON public.campaigns FOR UPDATE
USING (gm_id = (SELECT auth.uid()));

CREATE POLICY "campaigns_delete"
ON public.campaigns FOR DELETE
USING (gm_id = (SELECT auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. FIX: Duplicate Index (PERFORMANCE)
-- ═══════════════════════════════════════════════════════════════════════════
-- Remove índice duplicado em profiles.username

DROP INDEX IF EXISTS public.idx_profiles_username_unique;
-- Mantém apenas profiles_username_lower_idx

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. FIX: Unindexed Foreign Key (PERFORMANCE)
-- ═══════════════════════════════════════════════════════════════════════════
-- Adiciona índice para campaign_logs.user_id

CREATE INDEX IF NOT EXISTS idx_campaign_logs_user_id 
ON public.campaign_logs(user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. OPTIONAL: Remove Unused Indexes (INFO level)
-- ═══════════════════════════════════════════════════════════════════════════
-- Descomente se quiser remover índices não utilizados
-- ATENÇÃO: Só faça isso se tiver certeza que não serão usados

-- DROP INDEX IF EXISTS public.idx_dice_created;
-- DROP INDEX IF EXISTS public.idx_logs_created;
-- DROP INDEX IF EXISTS public.idx_campaigns_code; -- CUIDADO: Este pode ser usado!
-- DROP INDEX IF EXISTS public.idx_achievements_user;
-- DROP INDEX IF EXISTS public.idx_profiles_username;
-- DROP INDEX IF EXISTS public.idx_profiles_public;
-- DROP INDEX IF EXISTS public.idx_campaigns_public;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. GRANT PERMISSIONS
-- ═══════════════════════════════════════════════════════════════════════════
-- Garante que as funções podem ser executadas

GRANT EXECUTE ON FUNCTION public.get_username_cooldown_days(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_username_available(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_unique_username(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_username(text) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES
-- ═══════════════════════════════════════════════════════════════════════════
-- Execute estas queries para verificar se tudo está correto

-- Verificar search_path das funções
SELECT 
    routine_name,
    routine_type,
    security_type,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
    'get_username_cooldown_days',
    'check_username_available',
    'generate_unique_username',
    'change_username'
);

-- Verificar policies otimizadas
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'campaigns', 'campaign_members')
ORDER BY tablename, policyname;

-- Verificar índices
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'campaign_logs', 'campaigns')
ORDER BY tablename, indexname;
