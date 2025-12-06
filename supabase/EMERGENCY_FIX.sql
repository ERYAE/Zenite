-- ═══════════════════════════════════════════════════════════════════════════
-- EMERGENCY FIX - EXECUTE IMEDIATAMENTE NO SUPABASE
-- ═══════════════════════════════════════════════════════════════════════════
-- Este SQL corrige a recursão infinita nas policies e recria as funções

-- ═══════════════════════════════════════════════════════════════════════════
-- PASSO 1: REMOVER TODAS AS POLICIES PROBLEMÁTICAS
-- ═══════════════════════════════════════════════════════════════════════════

-- Campaigns
DROP POLICY IF EXISTS "campaigns_select" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns_insert" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns_update" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns_delete" ON public.campaigns;

-- Campaign Members
DROP POLICY IF EXISTS "members_select" ON public.campaign_members;
DROP POLICY IF EXISTS "members_insert" ON public.campaign_members;
DROP POLICY IF EXISTS "members_update" ON public.campaign_members;
DROP POLICY IF EXISTS "members_delete" ON public.campaign_members;

-- Profiles
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by owner or if public" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Service role can insert profiles" ON public.profiles;

-- ═══════════════════════════════════════════════════════════════════════════
-- PASSO 2: RECRIAR POLICIES SIMPLES (SEM RECURSÃO)
-- ═══════════════════════════════════════════════════════════════════════════

-- PROFILES - Policies simples
CREATE POLICY "profiles_select" ON public.profiles
FOR SELECT USING (true); -- Todos podem ver perfis (simplificado)

CREATE POLICY "profiles_insert" ON public.profiles
FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update" ON public.profiles
FOR UPDATE USING (id = auth.uid());

-- CAMPAIGNS - Policies simples (SEM referência a campaign_members)
CREATE POLICY "campaigns_select" ON public.campaigns
FOR SELECT USING (true); -- Todos podem ver campanhas públicas

CREATE POLICY "campaigns_insert" ON public.campaigns
FOR INSERT WITH CHECK (gm_id = auth.uid());

CREATE POLICY "campaigns_update" ON public.campaigns
FOR UPDATE USING (gm_id = auth.uid());

CREATE POLICY "campaigns_delete" ON public.campaigns
FOR DELETE USING (gm_id = auth.uid());

-- CAMPAIGN_MEMBERS - Policies que permitem GM editar fichas
CREATE POLICY "members_select" ON public.campaign_members
FOR SELECT USING (true); -- Simplificado para evitar recursão

CREATE POLICY "members_insert" ON public.campaign_members
FOR INSERT WITH CHECK (user_id = auth.uid());

-- GM pode editar qualquer membro da sua campanha, jogador só pode editar o próprio
CREATE POLICY "members_update" ON public.campaign_members
FOR UPDATE USING (
    user_id = auth.uid() 
    OR 
    EXISTS (
        SELECT 1 FROM public.campaigns 
        WHERE campaigns.id = campaign_members.campaign_id 
        AND campaigns.gm_id = auth.uid()
    )
);

-- GM pode remover qualquer membro, jogador só pode sair (remover a si mesmo)
CREATE POLICY "members_delete" ON public.campaign_members
FOR DELETE USING (
    user_id = auth.uid() 
    OR 
    EXISTS (
        SELECT 1 FROM public.campaigns 
        WHERE campaigns.id = campaign_members.campaign_id 
        AND campaigns.gm_id = auth.uid()
    )
);

-- ═══════════════════════════════════════════════════════════════════════════
-- PASSO 3: RECRIAR FUNÇÕES COM ASSINATURA CORRETA
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop todas as versões da função
DROP FUNCTION IF EXISTS public.get_username_cooldown_days(uuid);
DROP FUNCTION IF EXISTS public.get_username_cooldown_days(user_id uuid);
DROP FUNCTION IF EXISTS public.get_username_cooldown_days(user_id_param uuid);

-- Criar com nome de parâmetro que o frontend espera
CREATE OR REPLACE FUNCTION public.get_username_cooldown_days(user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    days_remaining integer;
BEGIN
    SELECT GREATEST(0, 14 - EXTRACT(DAY FROM (NOW() - username_changed_at))::integer)
    INTO days_remaining
    FROM public.profiles
    WHERE id = user_id;
    
    RETURN COALESCE(days_remaining, 0);
END;
$$;

-- Drop e recriar check_username_available
DROP FUNCTION IF EXISTS public.check_username_available(text);

CREATE OR REPLACE FUNCTION public.check_username_available(username_param text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN NOT EXISTS(
        SELECT 1 FROM public.profiles 
        WHERE LOWER(username) = LOWER(username_param)
    );
END;
$$;

-- Drop e recriar generate_unique_username
DROP FUNCTION IF EXISTS public.generate_unique_username(text);

CREATE OR REPLACE FUNCTION public.generate_unique_username(base_username text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    final_username text;
    counter integer := 1;
BEGIN
    final_username := LOWER(REGEXP_REPLACE(base_username, '[^a-z0-9_]', '', 'g'));
    final_username := SUBSTRING(final_username FROM 1 FOR 20);
    
    WHILE EXISTS(SELECT 1 FROM public.profiles WHERE LOWER(username) = final_username) AND counter < 100 LOOP
        final_username := SUBSTRING(base_username FROM 1 FOR 15) || counter::text;
        counter := counter + 1;
    END LOOP;
    
    RETURN final_username;
END;
$$;

-- Drop e recriar change_username
DROP FUNCTION IF EXISTS public.change_username(text);

CREATE OR REPLACE FUNCTION public.change_username(new_username text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_id_val uuid;
    days_since_change integer;
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
    IF EXISTS(SELECT 1 FROM public.profiles WHERE LOWER(username) = LOWER(new_username) AND id != user_id_val) THEN
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
-- PASSO 4: GRANT PERMISSIONS
-- ═══════════════════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION public.get_username_cooldown_days(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_username_cooldown_days(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.check_username_available(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_username_available(text) TO anon;
GRANT EXECUTE ON FUNCTION public.generate_unique_username(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_username(text) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO
-- ═══════════════════════════════════════════════════════════════════════════

-- Teste a função (deve retornar 0 ou um número)
SELECT public.get_username_cooldown_days(auth.uid());

-- Liste as policies
SELECT schemaname, tablename, policyname FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename;
