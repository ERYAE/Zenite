-- CORREÇÃO: Função de chat com cálculo explícito de is_mine
CREATE OR REPLACE FUNCTION public.get_friend_conversation(friend_uuid uuid, msg_limit integer DEFAULT 50)
RETURNS TABLE(
  msg_id uuid,
  id uuid,
  sender_id uuid,
  content text,
  is_read boolean,
  is_mine boolean,
  created_at timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id as msg_id,
    id,
    sender_id, 
    content, 
    is_read,
    CASE 
        WHEN sender_id = auth.uid() THEN true 
        ELSE false 
    END as is_mine,
    created_at
  FROM public.friend_messages
  WHERE (sender_id = auth.uid() AND receiver_id = friend_uuid)
     OR (sender_id = friend_uuid AND receiver_id = auth.uid())
  ORDER BY created_at DESC
  LIMIT msg_limit;
$$;

-- GARANTIA: Trigger para criação de perfil com username correto
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, bio, is_public)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(md5(random()::text), 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'username'),
    COALESCE(NEW.raw_user_meta_data->>'bio', ''),
    COALESCE((NEW.raw_user_meta_data->>'is_public')::boolean, true)
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    display_name = EXCLUDED.display_name;
  
  INSERT INTO public.user_stats (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
