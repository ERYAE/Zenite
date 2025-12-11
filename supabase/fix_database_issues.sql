-- Copyright © 2025 Zenite - Todos os direitos reservados
-- Projeto desenvolvido com assistência de IA

-- ═══════════════════════════════════════════════════════════════════════════════
-- ZENITE OS - Correções de Segurança e Performance do Banco de Dados
-- ═══════════════════════════════════════════════════════════════════════════════
-- Execute este script no SQL Editor do Supabase Dashboard
-- https://supabase.com/dashboard/project/YOUR_PROJECT/sql
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 0: LIMPEZA COMPLETA DE FUNÇÕES (evita conflitos de assinatura)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Remove TODAS as versões de cada função para garantir que não há conflitos

DO $$
DECLARE
    func_names text[] := ARRAY[
        'is_campaign_member', 'is_campaign_gm', 'is_username_available', 
        'check_username_available', 'handle_new_user', 'change_username',
        'get_username_cooldown_days', 'update_updated_at_column', 
        'update_friendships_updated_at', 'send_friend_request',
        'accept_friend_request', 'reject_friend_request', 'remove_friend',
        'get_friends_full', 'get_pending_requests', 'get_friend_requests',
        'get_user_friends', 'send_friend_message', 'get_friend_conversation',
        'get_unread_message_count', 'get_unread_message_counts',
        'send_campaign_invite', 'leave_campaign', 'leave_all_campaigns',
        'delete_all_my_campaigns', 'get_user_stats', 'sync_user_stats',
        'save_achievement', 'get_user_achievements', 'check_email_oauth_provider'
    ];
    func_name text;
    func_oid oid;
BEGIN
    FOREACH func_name IN ARRAY func_names LOOP
        FOR func_oid IN 
            SELECT oid FROM pg_proc 
            WHERE proname = func_name 
            AND pronamespace = 'public'::regnamespace
        LOOP
            EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', func_oid::regprocedure);
        END LOOP;
    END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 1: CRIAR FUNÇÕES COM SEARCH_PATH FIXO (SEGURANÇA)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Agora que todas as versões antigas foram removidas, criamos as novas

-- 1.1 is_campaign_member
CREATE FUNCTION public.is_campaign_member(campaign_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.campaign_members 
    WHERE campaign_id = campaign_uuid 
    AND user_id = auth.uid()
    AND status = 'active'
  );
$$;

-- 1.2 is_campaign_gm
CREATE FUNCTION public.is_campaign_gm(campaign_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.campaigns 
    WHERE id = campaign_uuid 
    AND gm_id = auth.uid()
  );
$$;

-- 1.3 is_username_available
CREATE FUNCTION public.is_username_available(username_to_check text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE lower(username) = lower(username_to_check)
  );
$$;

-- 1.4 check_username_available
CREATE FUNCTION public.check_username_available(username_to_check text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_username_available(username_to_check::text);
$$;

-- 1.5 handle_new_user (trigger)
CREATE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, bio, is_public)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', NULL),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NULL),
    COALESCE(NEW.raw_user_meta_data->>'bio', NULL),
    COALESCE((NEW.raw_user_meta_data->>'is_public')::boolean, false)
  )
  ON CONFLICT (id) DO NOTHING;
  
  INSERT INTO public.user_stats (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- 1.6 change_username
CREATE FUNCTION public.change_username(new_username text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cooldown_days integer := 14;
  last_change timestamp with time zone;
  days_remaining integer;
BEGIN
  -- Verifica cooldown
  SELECT username_changed_at INTO last_change
  FROM public.profiles WHERE id = auth.uid();
  
  IF last_change IS NOT NULL THEN
    days_remaining := cooldown_days - EXTRACT(DAY FROM (now() - last_change));
    IF days_remaining > 0 THEN
      RETURN json_build_object('success', false, 'error', 'cooldown', 'days_remaining', days_remaining);
    END IF;
  END IF;
  
  -- Verifica disponibilidade
  IF NOT public.is_username_available(new_username) THEN
    RETURN json_build_object('success', false, 'error', 'taken');
  END IF;
  
  -- Atualiza
  UPDATE public.profiles 
  SET username = new_username, username_changed_at = now()
  WHERE id = auth.uid();
  
  RETURN json_build_object('success', true);
END;
$$;

-- 1.7 get_username_cooldown_days
CREATE FUNCTION public.get_username_cooldown_days()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(0, 14 - EXTRACT(DAY FROM (now() - username_changed_at))::integer)
  FROM public.profiles WHERE id = auth.uid();
$$;

-- 1.8 update_updated_at_column (trigger genérico)
CREATE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 1.9 update_friendships_updated_at
CREATE FUNCTION public.update_friendships_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 2: FUNÇÕES DE AMIZADE COM SEARCH_PATH
-- ═══════════════════════════════════════════════════════════════════════════════

-- 2.1 send_friend_request
CREATE FUNCTION public.send_friend_request(friend_username text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_id uuid;
BEGIN
  SELECT id INTO target_id FROM public.profiles WHERE lower(username) = lower(friend_username);
  
  IF target_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'user_not_found');
  END IF;
  
  IF target_id = auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'cannot_add_self');
  END IF;
  
  -- Verifica se já existe
  IF EXISTS (SELECT 1 FROM public.friendships WHERE 
    (user_id = auth.uid() AND friend_id = target_id) OR
    (user_id = target_id AND friend_id = auth.uid())) THEN
    RETURN json_build_object('success', false, 'error', 'already_exists');
  END IF;
  
  INSERT INTO public.friendships (user_id, friend_id, status)
  VALUES (auth.uid(), target_id, 'pending');
  
  RETURN json_build_object('success', true, 'friend_id', target_id);
END;
$$;

-- 2.2 accept_friend_request
CREATE FUNCTION public.accept_friend_request(friendship_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.friendships 
  SET status = 'accepted', updated_at = now()
  WHERE id = friendship_id AND friend_id = auth.uid() AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'not_found');
  END IF;
  
  RETURN json_build_object('success', true);
END;
$$;

-- 2.3 reject_friend_request
CREATE FUNCTION public.reject_friend_request(friendship_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.friendships 
  WHERE id = friendship_id AND friend_id = auth.uid() AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'not_found');
  END IF;
  
  RETURN json_build_object('success', true);
END;
$$;

-- 2.4 remove_friend
CREATE FUNCTION public.remove_friend(friendship_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.friendships 
  WHERE id = friendship_id AND (user_id = auth.uid() OR friend_id = auth.uid());
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'not_found');
  END IF;
  
  RETURN json_build_object('success', true);
END;
$$;

-- 2.5 get_friends_full
CREATE FUNCTION public.get_friends_full()
RETURNS TABLE(
  friendship_id uuid,
  friend_id uuid,
  username text,
  display_name text,
  avatar_url text,
  is_public boolean,
  status text,
  created_at timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    f.id as friendship_id,
    CASE WHEN f.user_id = auth.uid() THEN f.friend_id ELSE f.user_id END as friend_id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.is_public,
    f.status,
    f.created_at
  FROM public.friendships f
  JOIN public.profiles p ON p.id = CASE WHEN f.user_id = auth.uid() THEN f.friend_id ELSE f.user_id END
  WHERE (f.user_id = auth.uid() OR f.friend_id = auth.uid()) AND f.status = 'accepted';
$$;

-- 2.6 get_pending_requests
CREATE FUNCTION public.get_pending_requests()
RETURNS TABLE(
  friendship_id uuid,
  sender_id uuid,
  username text,
  display_name text,
  avatar_url text,
  created_at timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    f.id as friendship_id,
    f.user_id as sender_id,
    p.username,
    p.display_name,
    p.avatar_url,
    f.created_at
  FROM public.friendships f
  JOIN public.profiles p ON p.id = f.user_id
  WHERE f.friend_id = auth.uid() AND f.status = 'pending';
$$;

-- 2.7 get_friend_requests (alias)
CREATE FUNCTION public.get_friend_requests()
RETURNS TABLE(
  friendship_id uuid,
  sender_id uuid,
  username text,
  display_name text,
  avatar_url text,
  created_at timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.get_pending_requests();
$$;

-- 2.8 get_user_friends
CREATE FUNCTION public.get_user_friends(target_user_id uuid)
RETURNS TABLE(
  friend_id uuid,
  username text,
  display_name text,
  avatar_url text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE WHEN f.user_id = target_user_id THEN f.friend_id ELSE f.user_id END as friend_id,
    p.username,
    p.display_name,
    p.avatar_url
  FROM public.friendships f
  JOIN public.profiles p ON p.id = CASE WHEN f.user_id = target_user_id THEN f.friend_id ELSE f.user_id END
  WHERE (f.user_id = target_user_id OR f.friend_id = target_user_id) 
    AND f.status = 'accepted'
    AND p.is_public = true;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 3: FUNÇÕES DE MENSAGENS COM SEARCH_PATH
-- ═══════════════════════════════════════════════════════════════════════════════

-- 3.1 send_friend_message
CREATE FUNCTION public.send_friend_message(receiver uuid, message_content text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_message_id uuid;
BEGIN
  -- Verifica se são amigos
  IF NOT EXISTS (
    SELECT 1 FROM public.friendships 
    WHERE status = 'accepted' AND (
      (user_id = auth.uid() AND friend_id = receiver) OR
      (user_id = receiver AND friend_id = auth.uid())
    )
  ) THEN
    RETURN json_build_object('success', false, 'error', 'not_friends');
  END IF;
  
  INSERT INTO public.friend_messages (sender_id, receiver_id, content)
  VALUES (auth.uid(), receiver, message_content)
  RETURNING id INTO new_message_id;
  
  RETURN json_build_object('success', true, 'message_id', new_message_id);
END;
$$;

-- 3.2 get_friend_conversation
CREATE FUNCTION public.get_friend_conversation(friend_uuid uuid, msg_limit integer DEFAULT 50)
RETURNS TABLE(
  id uuid,
  sender_id uuid,
  content text,
  is_read boolean,
  created_at timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, sender_id, content, is_read, created_at
  FROM public.friend_messages
  WHERE (sender_id = auth.uid() AND receiver_id = friend_uuid)
     OR (sender_id = friend_uuid AND receiver_id = auth.uid())
  ORDER BY created_at DESC
  LIMIT msg_limit;
$$;

-- 3.3 get_unread_message_count
CREATE FUNCTION public.get_unread_message_count()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer FROM public.friend_messages 
  WHERE receiver_id = auth.uid() AND is_read = false;
$$;

-- 3.4 get_unread_message_counts (por amigo)
CREATE FUNCTION public.get_unread_message_counts()
RETURNS TABLE(sender_id uuid, unread_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sender_id, COUNT(*) as unread_count
  FROM public.friend_messages 
  WHERE receiver_id = auth.uid() AND is_read = false
  GROUP BY sender_id;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 4: FUNÇÕES DE CAMPANHA COM SEARCH_PATH
-- ═══════════════════════════════════════════════════════════════════════════════

-- 4.1 send_campaign_invite
CREATE FUNCTION public.send_campaign_invite(campaign_uuid uuid, friend_uuid uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verifica se é GM
  IF NOT public.is_campaign_gm(campaign_uuid) THEN
    RETURN json_build_object('success', false, 'error', 'not_gm');
  END IF;
  
  -- Verifica se são amigos
  IF NOT EXISTS (
    SELECT 1 FROM public.friendships 
    WHERE status = 'accepted' AND (
      (user_id = auth.uid() AND friend_id = friend_uuid) OR
      (user_id = friend_uuid AND friend_id = auth.uid())
    )
  ) THEN
    RETURN json_build_object('success', false, 'error', 'not_friends');
  END IF;
  
  -- Verifica se já é membro
  IF EXISTS (SELECT 1 FROM public.campaign_members WHERE campaign_id = campaign_uuid AND user_id = friend_uuid) THEN
    RETURN json_build_object('success', false, 'error', 'already_member');
  END IF;
  
  INSERT INTO public.campaign_members (campaign_id, user_id, role, status)
  VALUES (campaign_uuid, friend_uuid, 'player', 'pending');
  
  RETURN json_build_object('success', true);
END;
$$;

-- 4.2 leave_campaign
CREATE FUNCTION public.leave_campaign(campaign_uuid uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.campaign_members 
  WHERE campaign_id = campaign_uuid AND user_id = auth.uid();
  
  RETURN json_build_object('success', true);
END;
$$;

-- 4.3 leave_all_campaigns
CREATE FUNCTION public.leave_all_campaigns()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.campaign_members WHERE user_id = auth.uid();
  RETURN json_build_object('success', true);
END;
$$;

-- 4.4 delete_all_my_campaigns
CREATE FUNCTION public.delete_all_my_campaigns()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Deleta membros das campanhas
  DELETE FROM public.campaign_members 
  WHERE campaign_id IN (SELECT id FROM public.campaigns WHERE gm_id = auth.uid());
  
  -- Deleta logs
  DELETE FROM public.campaign_logs 
  WHERE campaign_id IN (SELECT id FROM public.campaigns WHERE gm_id = auth.uid());
  
  -- Deleta dice logs
  DELETE FROM public.dice_logs 
  WHERE campaign_id IN (SELECT id FROM public.campaigns WHERE gm_id = auth.uid());
  
  -- Deleta campanhas
  DELETE FROM public.campaigns WHERE gm_id = auth.uid();
  
  RETURN json_build_object('success', true);
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 5: FUNÇÕES DE STATS E ACHIEVEMENTS COM SEARCH_PATH
-- ═══════════════════════════════════════════════════════════════════════════════

-- 5.1 get_user_stats
CREATE FUNCTION public.get_user_stats(target_user_id uuid DEFAULT NULL)
RETURNS TABLE(
  total_rolls integer,
  critical_rolls integer,
  fumble_rolls integer,
  characters_created integer,
  campaigns_joined integer,
  campaigns_mastered integer,
  friends_count integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    total_rolls, critical_rolls, fumble_rolls, 
    characters_created, campaigns_joined, campaigns_mastered, friends_count
  FROM public.user_stats 
  WHERE user_id = COALESCE(target_user_id, auth.uid());
$$;

-- 5.2 sync_user_stats
CREATE FUNCTION public.sync_user_stats(stats_data jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_stats (user_id, total_rolls, critical_rolls, fumble_rolls, characters_created)
  VALUES (
    auth.uid(),
    COALESCE((stats_data->>'total_rolls')::integer, 0),
    COALESCE((stats_data->>'critical_rolls')::integer, 0),
    COALESCE((stats_data->>'fumble_rolls')::integer, 0),
    COALESCE((stats_data->>'characters_created')::integer, 0)
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_rolls = EXCLUDED.total_rolls,
    critical_rolls = EXCLUDED.critical_rolls,
    fumble_rolls = EXCLUDED.fumble_rolls,
    characters_created = EXCLUDED.characters_created,
    updated_at = now();
  
  RETURN json_build_object('success', true);
END;
$$;

-- 5.3 save_achievement
CREATE FUNCTION public.save_achievement(achievement_id_param text, metadata_param jsonb DEFAULT '{}'::jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_achievements (user_id, achievement_id, metadata)
  VALUES (auth.uid(), achievement_id_param, metadata_param)
  ON CONFLICT DO NOTHING;
  
  RETURN json_build_object('success', true);
END;
$$;

-- 5.4 get_user_achievements
CREATE FUNCTION public.get_user_achievements(target_user_id uuid DEFAULT NULL)
RETURNS TABLE(achievement_id text, unlocked_at timestamp with time zone, metadata jsonb)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT achievement_id, unlocked_at, metadata
  FROM public.user_achievements 
  WHERE user_id = COALESCE(target_user_id, auth.uid());
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 6: FUNÇÃO DE VERIFICAÇÃO DE EMAIL/OAUTH
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE FUNCTION public.check_email_oauth_provider(email_to_check text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_record record;
BEGIN
  SELECT id, raw_app_meta_data->>'provider' as provider
  INTO user_record
  FROM auth.users
  WHERE email = email_to_check
  LIMIT 1;
  
  IF user_record IS NULL THEN
    RETURN json_build_object('exists', false);
  END IF;
  
  RETURN json_build_object('exists', true, 'provider', user_record.provider);
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 7: REMOVER ÍNDICES DUPLICADOS (PERFORMANCE)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Mantém os índices com nomes mais descritivos, remove os duplicados
DROP INDEX IF EXISTS public.idx_logs_campaign;
DROP INDEX IF EXISTS public.idx_members_campaign;
DROP INDEX IF EXISTS public.idx_members_user;
DROP INDEX IF EXISTS public.idx_campaigns_invite;
DROP INDEX IF EXISTS public.idx_dice_campaign;
DROP INDEX IF EXISTS public.idx_friendships_friend;
DROP INDEX IF EXISTS public.idx_friendships_user;
-- NOTA: user_achievements_unique é constraint, não remover via DROP INDEX
DROP INDEX IF EXISTS public.idx_user_achievements_unique;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 8: OTIMIZAR RLS POLICIES (PERFORMANCE)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Problema: auth.uid() sendo re-avaliado para cada linha
-- Solução: Usar (select auth.uid()) para avaliar uma vez só

-- 8.0 Limpeza geral de políticas para evitar duplicidade
DO $pol$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='campaigns' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.campaigns', r.policyname);
  END LOOP;
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='campaign_members' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.campaign_members', r.policyname);
  END LOOP;
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='campaign_logs' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.campaign_logs', r.policyname);
  END LOOP;
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='dice_logs' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.dice_logs', r.policyname);
  END LOOP;
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='friendships' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.friendships', r.policyname);
  END LOOP;
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='friend_messages' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.friend_messages', r.policyname);
  END LOOP;
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='user_achievements' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_achievements', r.policyname);
  END LOOP;
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='profiles' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', r.policyname);
  END LOOP;
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='user_stats' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_stats', r.policyname);
  END LOOP;
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='campaigns' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.campaigns', r.policyname);
  END LOOP;
END
$pol$;

-- 8.1 campaign_members policies (SEM RECURSÃO - não faz subquery em campaigns)
CREATE POLICY "campaign_members_select" ON public.campaign_members
  FOR SELECT USING (user_id = (select auth.uid()));

CREATE POLICY "campaign_members_insert" ON public.campaign_members
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "campaign_members_update" ON public.campaign_members
  FOR UPDATE USING (user_id = (select auth.uid()));

CREATE POLICY "campaign_members_delete" ON public.campaign_members
  FOR DELETE USING (user_id = (select auth.uid()));

-- 8.2 campaign_logs policies (uma por operação, sem duplicidade)
CREATE POLICY "campaign_logs_select" ON public.campaign_logs
  FOR SELECT USING (
    public.is_campaign_member(campaign_id) OR
    campaign_id IN (SELECT id FROM public.campaigns WHERE gm_id = (select auth.uid()))
  );

CREATE POLICY "campaign_logs_insert" ON public.campaign_logs
  FOR INSERT WITH CHECK (
    user_id = (select auth.uid()) AND
    (public.is_campaign_member(campaign_id) OR
     campaign_id IN (SELECT id FROM public.campaigns WHERE gm_id = (select auth.uid())))
  );

-- 8.3 dice_logs policies (uma por operação, sem duplicidade)
CREATE POLICY "dice_logs_select" ON public.dice_logs
  FOR SELECT USING (
    public.is_campaign_member(campaign_id) OR
    campaign_id IN (SELECT id FROM public.campaigns WHERE gm_id = (select auth.uid()))
  );

CREATE POLICY "dice_logs_insert" ON public.dice_logs
  FOR INSERT WITH CHECK (
    user_id = (select auth.uid()) AND
    (public.is_campaign_member(campaign_id) OR
     campaign_id IN (SELECT id FROM public.campaigns WHERE gm_id = (select auth.uid())))
  );

-- 8.4 profiles policies (mínimas e únicas)
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (id = (select auth.uid()));

CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (id = (select auth.uid()));

-- 8.5 friendships policies (únicas)
CREATE POLICY "friendships_select" ON public.friendships
  FOR SELECT USING (user_id = (select auth.uid()) OR friend_id = (select auth.uid()));

CREATE POLICY "friendships_insert" ON public.friendships
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "friendships_update" ON public.friendships
  FOR UPDATE USING (user_id = (select auth.uid()) OR friend_id = (select auth.uid()));

CREATE POLICY "friendships_delete" ON public.friendships
  FOR DELETE USING (user_id = (select auth.uid()) OR friend_id = (select auth.uid()));

-- 8.6 friend_messages policies (únicas)
CREATE POLICY "friend_messages_select" ON public.friend_messages
  FOR SELECT USING (sender_id = (select auth.uid()) OR receiver_id = (select auth.uid()));

CREATE POLICY "friend_messages_insert" ON public.friend_messages
  FOR INSERT WITH CHECK (sender_id = (select auth.uid()));

CREATE POLICY "friend_messages_update" ON public.friend_messages
  FOR UPDATE USING (receiver_id = (select auth.uid()));

-- 8.7 campaigns policies (SEM RECURSÃO - usa função helper)
CREATE POLICY "campaigns_select" ON public.campaigns
  FOR SELECT USING (
    is_public = true
    OR gm_id = (select auth.uid())
    OR public.is_campaign_member(id)
  );

CREATE POLICY "campaigns_insert" ON public.campaigns
  FOR INSERT WITH CHECK (gm_id = (select auth.uid()));

CREATE POLICY "campaigns_update" ON public.campaigns
  FOR UPDATE USING (gm_id = (select auth.uid()));

CREATE POLICY "campaigns_delete" ON public.campaigns
  FOR DELETE USING (gm_id = (select auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 9: REMOVER POLÍTICAS DUPLICADAS
-- ═══════════════════════════════════════════════════════════════════════════════

-- profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;

CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (true); -- Todos podem ver perfis

-- user_achievements - consolidar
DROP POLICY IF EXISTS "Users can view own achievements" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "achievements_own" ON public.user_achievements;

CREATE POLICY "user_achievements_select" ON public.user_achievements
  FOR SELECT USING (user_id = (select auth.uid()));

CREATE POLICY "user_achievements_insert" ON public.user_achievements
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

-- user_stats - consolidar
DROP POLICY IF EXISTS "Users can manage own stats" ON public.user_stats;
DROP POLICY IF EXISTS "Users can view own stats" ON public.user_stats;
DROP POLICY IF EXISTS "stats_own" ON public.user_stats;

CREATE POLICY "user_stats_all" ON public.user_stats
  FOR ALL USING (user_id = (select auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 10: RECRIAR TRIGGERS QUE FORAM REMOVIDOS PELO CASCADE
-- ═══════════════════════════════════════════════════════════════════════════════

-- Trigger para criar perfil quando usuário se registra
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger para atualizar updated_at em profiles
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para atualizar updated_at em campaigns
DROP TRIGGER IF EXISTS update_campaigns_updated_at ON public.campaigns;
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para atualizar updated_at em friendships
DROP TRIGGER IF EXISTS update_friendships_updated_at_trigger ON public.friendships;
CREATE TRIGGER update_friendships_updated_at_trigger
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.update_friendships_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════════
-- CONCLUSÃO
-- ═══════════════════════════════════════════════════════════════════════════════
-- Após executar este script:
-- 1. Todas as funções terão search_path fixo (segurança)
-- 2. Índices duplicados serão removidos (performance)
-- 3. RLS policies serão otimizadas com (select auth.uid()) (performance)
-- 4. Políticas duplicadas serão consolidadas (performance)
-- 5. Triggers recriados corretamente
-- ═══════════════════════════════════════════════════════════════════════════════

SELECT 'Script executado com sucesso! Verifique o Linter do Supabase para confirmar.' as status;
