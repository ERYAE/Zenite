-- ═══════════════════════════════════════════════════════════════════════════
-- ZENITE: Configurações do Supabase
-- Execute este SQL no Dashboard do Supabase > SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- PROFILES: Adicionar colunas necessárias
-- ═══════════════════════════════════════════════════════════════════════════

-- Coluna para controlar se usuário já viu o welcome modal
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_seen_welcome BOOLEAN DEFAULT false;

-- Índice para busca por username (case insensitive)
CREATE INDEX IF NOT EXISTS idx_profiles_username_lower ON profiles(lower(username));

-- ═══════════════════════════════════════════════════════════════════════════
-- CAMPAIGNS: Campanhas públicas/abertas
-- ═══════════════════════════════════════════════════════════════════════════

-- Coluna is_public para campanhas abertas
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- Índice para busca de campanhas públicas
CREATE INDEX IF NOT EXISTS idx_campaigns_public ON campaigns(is_public) WHERE is_public = true;

-- ═══════════════════════════════════════════════════════════════════════════
-- REALTIME: Habilitar nas tabelas (ignore erros "already member")
-- ═══════════════════════════════════════════════════════════════════════════

-- Descomente as linhas abaixo se as tabelas não estiverem no realtime:
-- ALTER PUBLICATION supabase_realtime ADD TABLE campaign_members;
-- ALTER PUBLICATION supabase_realtime ADD TABLE campaigns;
-- ALTER PUBLICATION supabase_realtime ADD TABLE campaign_logs;
-- ALTER PUBLICATION supabase_realtime ADD TABLE dice_logs;

-- Verificar tabelas no realtime
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS (Row Level Security) - Políticas
-- ═══════════════════════════════════════════════════════════════════════════

-- Política para visualizar campanhas públicas
DROP POLICY IF EXISTS "Public campaigns are viewable by everyone" ON campaigns;
CREATE POLICY "Public campaigns are viewable by everyone" ON campaigns
  FOR SELECT USING (
    is_public = true 
    OR gm_id = auth.uid() 
    OR id IN (SELECT campaign_id FROM campaign_members WHERE user_id = auth.uid())
  );

-- Política para buscar perfis por username (para sistema de amigos)
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
CREATE POLICY "Profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

-- Política para atualizar próprio perfil
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
