-- ═══════════════════════════════════════════════════════════════════════════
-- TRIGGER PARA NOVOS USUÁRIOS
-- 
-- ⚠️ EXECUTE ESTE ARQUIVO DIRETAMENTE NO DASHBOARD DO SUPABASE:
-- 1. Vá para https://supabase.com/dashboard
-- 2. Selecione seu projeto
-- 3. Vá em "SQL Editor" (menu lateral)
-- 4. Cole este código e clique em "Run"
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
        -- Username: tenta pegar dos metadados ou gera do email
        COALESCE(
            NEW.raw_user_meta_data->>'username', 
            LOWER(REGEXP_REPLACE(SPLIT_PART(NEW.email, '@', 1), '[^a-z0-9_]', '', 'g'))
        ),
        -- Display Name: usa display_name, username ou 'Usuário'
        COALESCE(
            NEW.raw_user_meta_data->>'display_name', 
            NEW.raw_user_meta_data->>'username', 
            'Usuário'
        ),
        COALESCE(NEW.raw_user_meta_data->>'bio', ''),
        NEW.raw_user_meta_data->>'avatar_url',
        COALESCE((NEW.raw_user_meta_data->>'is_public')::boolean, true),
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        username = COALESCE(EXCLUDED.username, profiles.username),
        display_name = COALESCE(EXCLUDED.display_name, profiles.display_name, profiles.username, 'Usuário'),
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cria o trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
