-- ═══════════════════════════════════════════════════════════════════════════
-- ZENITE USERNAME SYSTEM - Sistema completo de usernames com cooldown de 14 dias
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Garante que a coluna username_changed_at existe na tabela profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS username_changed_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Garante que username é único (case insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_idx 
ON profiles (LOWER(username));

-- 3. Função para verificar disponibilidade do username
CREATE OR REPLACE FUNCTION check_username_available(check_username TEXT, current_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    normalized_username TEXT;
    existing_count INTEGER;
BEGIN
    -- Normaliza o username (lowercase, trim)
    normalized_username := LOWER(TRIM(check_username));
    
    -- Verifica se tem pelo menos 2 caracteres
    IF LENGTH(normalized_username) < 2 THEN
        RETURN FALSE;
    END IF;
    
    -- Verifica se tem no máximo 20 caracteres
    IF LENGTH(normalized_username) > 20 THEN
        RETURN FALSE;
    END IF;
    
    -- Verifica caracteres válidos (apenas letras, números, underscore)
    IF normalized_username !~ '^[a-z0-9_]+$' THEN
        RETURN FALSE;
    END IF;
    
    -- Conta quantos usuários têm esse username (excluindo o próprio usuário)
    IF current_user_id IS NOT NULL THEN
        SELECT COUNT(*) INTO existing_count
        FROM profiles
        WHERE LOWER(username) = normalized_username
        AND id != current_user_id;
    ELSE
        SELECT COUNT(*) INTO existing_count
        FROM profiles
        WHERE LOWER(username) = normalized_username;
    END IF;
    
    RETURN existing_count = 0;
END;
$$;

-- 4. Função para obter dias restantes até poder trocar username
CREATE OR REPLACE FUNCTION get_username_cooldown_days(user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    last_change TIMESTAMPTZ;
    cooldown_end TIMESTAMPTZ;
    days_remaining INTEGER;
BEGIN
    -- Busca a última alteração de username
    SELECT username_changed_at INTO last_change
    FROM profiles
    WHERE id = user_id;
    
    -- Se nunca alterou, pode alterar agora
    IF last_change IS NULL THEN
        RETURN 0;
    END IF;
    
    -- Calcula quando o cooldown termina (14 dias após última alteração)
    cooldown_end := last_change + INTERVAL '14 days';
    
    -- Se já passou do cooldown, retorna 0
    IF NOW() >= cooldown_end THEN
        RETURN 0;
    END IF;
    
    -- Calcula dias restantes
    days_remaining := CEIL(EXTRACT(EPOCH FROM (cooldown_end - NOW())) / 86400);
    
    RETURN days_remaining;
END;
$$;

-- 5. Função para alterar username (com validações)
CREATE OR REPLACE FUNCTION change_username(new_username TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_id UUID;
    normalized_username TEXT;
    cooldown_days INTEGER;
    is_available BOOLEAN;
BEGIN
    -- Pega o ID do usuário atual
    user_id := auth.uid();
    
    IF user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado');
    END IF;
    
    -- Normaliza o username
    normalized_username := LOWER(TRIM(new_username));
    
    -- Verifica cooldown
    cooldown_days := get_username_cooldown_days(user_id);
    IF cooldown_days > 0 THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Aguarde ' || cooldown_days || ' dias para alterar novamente',
            'cooldown_days', cooldown_days
        );
    END IF;
    
    -- Verifica disponibilidade
    is_available := check_username_available(new_username, user_id);
    IF NOT is_available THEN
        RETURN jsonb_build_object('success', false, 'error', 'Username inválido ou já em uso');
    END IF;
    
    -- Atualiza o username
    UPDATE profiles
    SET 
        username = normalized_username,
        username_changed_at = NOW(),
        updated_at = NOW()
    WHERE id = user_id;
    
    RETURN jsonb_build_object(
        'success', true, 
        'username', normalized_username,
        'message', 'Username alterado com sucesso!'
    );
END;
$$;

-- 6. Grants para acesso anônimo/autenticado
GRANT EXECUTE ON FUNCTION check_username_available(TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_username_cooldown_days(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION change_username(TEXT) TO authenticated;
