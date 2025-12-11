-- ═══════════════════════════════════════════════════════════════════════════════
-- FIX: RLS para dice_logs (permitir INSERT de membros da campanha)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Remove policies antigas
DROP POLICY IF EXISTS "dice_logs_select" ON public.dice_logs;
DROP POLICY IF EXISTS "dice_logs_insert" ON public.dice_logs;
DROP POLICY IF EXISTS "dice_logs_delete" ON public.dice_logs;

-- Garante RLS habilitado
ALTER TABLE public.dice_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: Membros da campanha podem ver
CREATE POLICY "dice_logs_select" 
ON public.dice_logs
FOR SELECT 
USING (
  public.is_campaign_member(campaign_id)
  OR public.is_campaign_gm(campaign_id)
);

-- INSERT: Membros da campanha podem inserir
CREATE POLICY "dice_logs_insert" 
ON public.dice_logs
FOR INSERT 
WITH CHECK (
  public.is_campaign_member(campaign_id)
  OR public.is_campaign_gm(campaign_id)
);

-- DELETE: Apenas GM pode deletar logs
CREATE POLICY "dice_logs_delete" 
ON public.dice_logs
FOR DELETE 
USING (
  public.is_campaign_gm(campaign_id)
);
