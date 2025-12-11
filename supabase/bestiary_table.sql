-- ═══════════════════════════════════════════════════════════════════════════════
-- TABELA BESTIARY (NPCs DO MESTRE)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Migra o bestiário do localStorage para o Supabase
-- Evita perda de dados ao trocar de navegador/computador

-- 1. Criar tabela bestiary
CREATE TABLE IF NOT EXISTS public.bestiary (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
    name text NOT NULL,
    type text DEFAULT 'neutral' CHECK (type IN ('enemy', 'ally', 'neutral')),
    pv jsonb DEFAULT '{"current": 10, "max": 10}'::jsonb,
    pf jsonb DEFAULT '{"current": 10, "max": 10}'::jsonb,
    pdf jsonb DEFAULT '{"current": 10, "max": 10}'::jsonb,
    defesa integer DEFAULT 10,
    tags text[] DEFAULT '{}',
    notes text DEFAULT '',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 2. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_bestiary_user_id ON public.bestiary(user_id);
CREATE INDEX IF NOT EXISTS idx_bestiary_campaign_id ON public.bestiary(campaign_id);
CREATE INDEX IF NOT EXISTS idx_bestiary_name ON public.bestiary USING gin(to_tsvector('portuguese', name));
CREATE INDEX IF NOT EXISTS idx_bestiary_tags ON public.bestiary USING gin(tags);

-- 3. RLS (Row Level Security)
ALTER TABLE public.bestiary ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso:
-- - Usuários podem ver/editar seus próprios NPCs
-- - GMs podem ver/editar NPCs de suas campanhas
CREATE POLICY "Users can view own bestiary" ON public.bestiary
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bestiary" ON public.bestiary
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bestiary" ON public.bestiary
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bestiary" ON public.bestiary
    FOR DELETE USING (auth.uid() = user_id);

-- GMs podem gerenciar NPCs de campanhas que administram
CREATE POLICY "GMs can manage campaign bestiary" ON public.bestiary
    FOR ALL USING (
        campaign_id IN (
            SELECT id FROM public.campaigns 
            WHERE gm_id = auth.uid()
        )
    );

-- 4. Trigger para updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_bestiary_updated_at
    BEFORE UPDATE ON public.bestiary
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 5. Funções RPC para operações comuns

-- 5.1 Buscar bestiário do usuário (ou campanha específica)
CREATE OR REPLACE FUNCTION public.get_user_bestiary(p_campaign_id uuid DEFAULT NULL)
RETURNS TABLE(
    id uuid,
    campaign_id uuid,
    name text,
    type text,
    pv jsonb,
    pf jsonb,
    pdf jsonb,
    defesa integer,
    tags text[],
    notes text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id, campaign_id, name, type, pv, pf, pdf, defesa, tags, notes, created_at, updated_at
    FROM public.bestiary
    WHERE user_id = auth.uid()
      AND (p_campaign_id IS NULL OR campaign_id = p_campaign_id)
    ORDER BY created_at DESC;
$$;

-- 5.2 Salvar NPC (insert ou update)
CREATE OR REPLACE FUNCTION public.save_bestiary_npc(
    p_id uuid DEFAULT NULL,
    p_campaign_id uuid DEFAULT NULL,
    p_name text,
    p_type text DEFAULT 'neutral',
    p_pv jsonb DEFAULT '{"current": 10, "max": 10}'::jsonb,
    p_pf jsonb DEFAULT '{"current": 10, "max": 10}'::jsonb,
    p_pdf jsonb DEFAULT '{"current": 10, "max": 10}'::jsonb,
    p_defesa integer DEFAULT 10,
    p_tags text[] DEFAULT '{}',
    p_notes text DEFAULT ''
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    npc_id uuid;
BEGIN
    -- Validar tipo
    IF p_type NOT IN ('enemy', 'ally', 'neutral') THEN
        RETURN json_build_object('success', false, 'error', 'invalid_type');
    END IF;
    
    -- Update ou Insert
    IF p_id IS NOT NULL THEN
        -- Update existente
        UPDATE public.bestiary
        SET 
            name = p_name,
            type = p_type,
            pv = p_pv,
            pf = p_pf,
            pdf = p_pdf,
            defesa = p_defesa,
            tags = p_tags,
            notes = p_notes,
            updated_at = now()
        WHERE id = p_id AND user_id = auth.uid()
        RETURNING id INTO npc_id;
        
        IF NOT FOUND THEN
            RETURN json_build_object('success', false, 'error', 'not_found');
        END IF;
    ELSE
        -- Insert novo
        INSERT INTO public.bestiary (user_id, campaign_id, name, type, pv, pf, pdf, defesa, tags, notes)
        VALUES (auth.uid(), p_campaign_id, p_name, p_type, p_pv, p_pf, p_pdf, p_defesa, p_tags, p_notes)
        RETURNING id INTO npc_id;
    END IF;
    
    RETURN json_build_object('success', true, 'id', npc_id);
END;
$$;

-- 5.3 Deletar NPC
CREATE OR REPLACE FUNCTION public.delete_bestiary_npc(p_npc_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.bestiary
    WHERE id = p_npc_id AND user_id = auth.uid();
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'not_found');
    END IF;
    
    RETURN json_build_object('success', true);
END;
$$;

-- 5.4 Duplicar NPC
CREATE OR REPLACE FUNCTION public.duplicate_bestiary_npc(p_npc_id uuid, p_new_name text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_id uuid;
    original_name text;
BEGIN
    -- Buscar original
    SELECT name INTO original_name
    FROM public.bestiary
    WHERE id = p_npc_id AND user_id = auth.uid();
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'not_found');
    END IF;
    
    -- Inserir cópia
    INSERT INTO public.bestiary (user_id, campaign_id, name, type, pv, pf, pdf, defesa, tags, notes)
    SELECT 
        auth.uid(),
        campaign_id,
        COALESCE(p_new_name, name || ' (Cópia)'),
        type,
        pv,
        pf,
        pdf,
        defesa,
        tags,
        notes
    FROM public.bestiary
    WHERE id = p_npc_id AND user_id = auth.uid()
    RETURNING id INTO new_id;
    
    RETURN json_build_object('success', true, 'id', new_id);
END;
$$;

-- 6. Grant permissions
GRANT ALL ON public.bestiary TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_bestiary TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_bestiary_npc TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_bestiary_npc TO authenticated;
GRANT EXECUTE ON FUNCTION public.duplicate_bestiary_npc TO authenticated;

-- 7. Comentários para documentação
COMMENT ON TABLE public.bestiary IS 'Bestiário de NPCs do mestre. Migra do localStorage para nuvem.';
COMMENT ON COLUMN public.bestiary.user_id IS 'Dono do NPC (usuário que criou)';
COMMENT ON COLUMN public.bestiary.campaign_id IS 'Campanha associada (opcional - NPCs globais se NULL)';
COMMENT ON COLUMN public.bestiary.type IS 'Tipo: enemy, ally, neutral';
COMMENT ON COLUMN public.bestiary.pv IS 'Pontos de Vida: {current, max}';
COMMENT ON COLUMN public.bestiary.pf IS 'Pontos de Fôlego: {current, max}';
COMMENT ON COLUMN public.bestiary.pdf IS 'Pontos de Defesa/Sanidade: {current, max}';
COMMENT ON COLUMN public.bestiary.defesa IS 'Valor de defesa do NPC';
COMMENT ON COLUMN public.bestiary.tags IS 'Tags para categorização (boss, undead, etc)';

-- ═══════════════════════════════════════════════════════════════════════════════
-- FIM DA MIGRAÇÃO BESTIARY
-- ═══════════════════════════════════════════════════════════════════════════════
