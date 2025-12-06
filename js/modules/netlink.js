/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ZENITE NETLINK - Sistema de Campanhas Multiplayer
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Este módulo gerencia campanhas de RPG online, permitindo que mestres (GMs)
 * criem sessões e convidem jogadores para participar.
 * 
 * ARQUITETURA DO SUPABASE:
 * ────────────────────────
 * 
 * 1. campaigns - Tabela principal de campanhas
 *    - id: UUID da campanha
 *    - gm_id: UUID do mestre (referencia auth.users)
 *    - name: Nome da campanha
 *    - code: Código único para identificação
 *    - invite_code: Código de convite para jogadores
 *    - atmosphere: Tema visual ('neutral', 'dark', 'fantasy', etc.)
 *    - notes: Anotações privadas do mestre
 *    - settings: JSON com configurações (dice visibility, etc.)
 *    - image_url: Imagem de capa da campanha
 *    - description: Descrição pública
 *    - nickname: Apelido do GM nesta campanha
 * 
 * 2. campaign_members - Jogadores em cada campanha
 *    - campaign_id: Referência à campanha
 *    - user_id: UUID do jogador
 *    - character_id: ID do personagem vinculado (do sistema local)
 *    - char_data: CÓPIA do personagem (JSON) - editável pelo GM
 *    - role: 'player' ou 'gm'
 *    - status: 'active', 'pending', 'kicked'
 * 
 * 3. dice_logs - Histórico de rolagens da campanha
 *    - campaign_id: Referência à campanha
 *    - user_id: Quem rolou
 *    - username: Nome exibido
 *    - roll_data: JSON completo da rolagem
 *    - is_private: Se só o GM pode ver
 *    - is_critical/is_fumble: Flags para destaque
 *    - natural_result, modifier, total_result: Valores
 *    - formula: String formatada (ex: "D20+5")
 *    - reason: Motivo da rolagem
 * 
 * 4. campaign_logs - Log geral de eventos (chat, ações, etc.)
 *    - campaign_id: Referência à campanha
 *    - sender: Nome do remetente
 *    - content: Conteúdo da mensagem
 *    - type: 'roll', 'chat', 'action', 'system'
 *    - user_id: Quem enviou
 *    - metadata: JSON com dados extras
 * 
 * 5. characters - Personagens persistentes (opcional)
 *    - id: ID único do personagem
 *    - user_id: Dono do personagem
 *    - campaign_id: Se está vinculado a uma campanha
 *    - data: JSON completo do personagem
 * 
 * FLUXO DO SISTEMA:
 * ─────────────────
 * 
 * [GM] Criar Campanha → Gerar invite_code
 *        ↓
 * [GM] Compartilhar código com jogadores
 *        ↓
 * [Player] Entrar com código → Selecionar personagem
 *        ↓
 * [Sistema] Copiar char_data para campaign_members
 *        ↓
 * [Sessão] GM vê dados de todos | Players veem só os próprios
 *        ↓
 * [Dados] Sync em tempo real via Supabase Realtime
 * 
 * FEATURES DO PAINEL DO MESTRE:
 * ─────────────────────────────
 * - Visualizar/editar fichas dos jogadores (cópia)
 * - Bestiário privado (não visível para jogadores)
 * - Calculadora de combate
 * - Timer de sessão
 * - Menu de iniciativa com tracking
 * - Histórico de rolagens de todos
 * - Sistema de anotações
 * 
 * SUGESTÕES DE FEATURES FUTURAS:
 * ─────────────────────────────
 * - Sistema de mapas com fog of war
 * - Tokens movíveis em grid
 * - Compartilhamento de imagens
 * - Sistema de condições (buffs/debuffs)
 * - Música ambiente sincronizada
 * - Whisper (mensagem privada para jogador)
 * - NPCs pré-definidos para o GM
 * - Templates de encontros
 * - Integração com roll tables
 * - Exportar sessão como relatório
 * 
 * SEGURANÇA E BOAS PRÁTICAS:
 * ─────────────────────────────
 * 1. RLS (Row Level Security) - Todas as tabelas usam políticas RLS no Supabase:
 *    - campaigns: Apenas GM pode editar, todos autenticados podem ler
 *    - campaign_members: Usuário só vê/edita próprios registros
 *    - dice_logs: Inserção livre para membros, leitura por campanha
 *    - campaign_logs: Similar aos dice_logs
 * 
 * 2. Validação de entrada:
 *    - Códigos de convite são sanitizados (apenas alfanuméricos)
 *    - Limites de tamanho para mensagens (MAX_MESSAGE_LENGTH)
 *    - Limites de quantidade (MAX_PLAYERS, MAX_CAMPAIGNS)
 * 
 * 3. Dados sensíveis:
 *    - Notas do GM ficam na tabela campaigns (só GM acessa via RLS)
 *    - Bestiário e configurações ficam em localStorage (não sobem pro banco)
 *    - Webhook do Discord fica local (não exposto no banco)
 * 
 * 4. Otimizações para Free Tier (Supabase/Vercel):
 *    - Limite de 50 mensagens no log de chat carregado
 *    - Limite de 100 rolagens no histórico
 *    - Debounce no auto-save de notas (2 segundos)
 *    - Realtime subscriptions limitadas a 1 canal por campanha
 *    - Bestiário em localStorage (zero queries)
 *    - Configurações em localStorage (zero queries)
 * 
 * @author Zenite Team
 * @version 2.0.0 (NetLink Full Implementation)
 */

import { playSFX } from './audio.js';
import { router } from './router.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTES E CONFIGURAÇÕES
// ═══════════════════════════════════════════════════════════════════════════════

const NETLINK_CONFIG = {
    // Limites
    MAX_PLAYERS_PER_CAMPAIGN: 8,
    MAX_CAMPAIGNS_PER_USER: 5,
    INVITE_CODE_LENGTH: 6,
    
    // Realtime
    REALTIME_CHANNEL_PREFIX: 'campaign:',
    DICE_LOG_RETENTION_DAYS: 30,
    
    // Roles
    ROLES: {
        GM: 'gm',
        PLAYER: 'player'
    },
    
    // Status de membros
    MEMBER_STATUS: {
        ACTIVE: 'active',
        PENDING: 'pending',
        KICKED: 'kicked'
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// MÓDULO NETLINK
// ═══════════════════════════════════════════════════════════════════════════════

export const netlinkLogic = {
    
    // ─────────────────────────────────────────────────────────────────────────
    // ESTADO
    // ─────────────────────────────────────────────────────────────────────────
    
    // Campanhas onde o usuário é GM
    myCampaigns: [],
    
    // Campanhas onde o usuário é player
    joinedCampaigns: [],
    
    // Campanha atualmente ativa
    activeCampaign: null,
    
    // Canal de realtime ativo
    realtimeChannel: null,
    
    // Membros da campanha ativa
    campaignMembers: [],
    
    // Log de dados da sessão atual
    sessionDiceLog: [],
    
    // Iniciativa atual
    initiativeOrder: [],
    currentInitiativeIndex: 0,
    
    // UI State
    netlinkView: 'list', // 'list', 'campaign', 'gm-panel'
    musicPlaylistOpen: false,
    musicBtnRect: null,
    netlinkModal: false,
    
    // ─────────────────────────────────────────────────────────────────────────
    // GERENCIAMENTO DE CAMPANHAS
    // ─────────────────────────────────────────────────────────────────────────
    
    /**
     * Gera um código de convite único
     * Formato: 6 caracteres alfanuméricos (sem caracteres ambíguos)
     */
    generateInviteCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sem 0,O,1,I,L
        let code = '';
        const array = new Uint8Array(NETLINK_CONFIG.INVITE_CODE_LENGTH);
        crypto.getRandomValues(array);
        for (let i = 0; i < NETLINK_CONFIG.INVITE_CODE_LENGTH; i++) {
            code += chars[array[i] % chars.length];
        }
        return code;
    },
    
    /**
     * Cria uma nova campanha
     * @param {string} name - Nome da campanha
     * @param {string} description - Descrição (opcional)
     * @returns {Promise<Object>} Campanha criada
     */
    async createCampaign(name, description = '') {
        if (!this.supabase || !this.user) {
            this.notify('Você precisa estar logado para criar campanhas.', 'error');
            return null;
        }
        
        if (this.myCampaigns.length >= NETLINK_CONFIG.MAX_CAMPAIGNS_PER_USER) {
            this.notify(`Limite de ${NETLINK_CONFIG.MAX_CAMPAIGNS_PER_USER} campanhas atingido.`, 'error');
            return null;
        }
        
        try {
            const inviteCode = this.generateInviteCode();
            const campaignCode = `ZC_${Date.now().toString(36).toUpperCase()}`;
            
            const { data, error } = await this.supabase
                .from('campaigns')
                .insert([{
                    gm_id: this.user.id,
                    name: name.trim(),
                    code: campaignCode,
                    invite_code: inviteCode,
                    description: description.trim(),
                    settings: {
                        diceVisibility: 'all', // 'all', 'gm-only', 'individual'
                        allowPlayerNotes: true,
                        showInitiativeOrder: true
                    }
                }])
                .select()
                .single();
            
            if (error) throw error;
            
            // Adiciona o GM como membro
            await this.supabase
                .from('campaign_members')
                .insert([{
                    campaign_id: data.id,
                    user_id: this.user.id,
                    role: NETLINK_CONFIG.ROLES.GM,
                    status: NETLINK_CONFIG.MEMBER_STATUS.ACTIVE
                }]);
            
            this.myCampaigns.push(data);
            playSFX('success');
            this.notify('Campanha criada com sucesso!', 'success');
            
            return data;
        } catch (e) {
            console.error('[NETLINK] Erro ao criar campanha:', e);
            this.notify('Erro ao criar campanha.', 'error');
            return null;
        }
    },
    
    /**
     * Entra em uma campanha via código de convite
     * @param {string} inviteCode - Código de convite
     * @param {string} characterId - ID do personagem para vincular
     */
    async joinCampaign(inviteCode, characterId) {
        if (!this.supabase || !this.user) {
            this.notify('Você precisa estar logado para entrar em campanhas.', 'error');
            return false;
        }
        
        try {
            // Busca a campanha pelo código
            const { data: campaign, error: searchError } = await this.supabase
                .from('campaigns')
                .select('*')
                .eq('invite_code', inviteCode.toUpperCase())
                .single();
            
            if (searchError || !campaign) {
                this.notify('Código de convite inválido.', 'error');
                return false;
            }
            
            // Verifica se já é membro
            const { data: existingMember } = await this.supabase
                .from('campaign_members')
                .select('id')
                .eq('campaign_id', campaign.id)
                .eq('user_id', this.user.id)
                .single();
            
            if (existingMember) {
                this.notify('Você já está nesta campanha.', 'warn');
                return false;
            }
            
            // Verifica limite de jogadores
            const { count } = await this.supabase
                .from('campaign_members')
                .select('id', { count: 'exact' })
                .eq('campaign_id', campaign.id);
            
            if (count >= NETLINK_CONFIG.MAX_PLAYERS_PER_CAMPAIGN) {
                this.notify('Esta campanha está cheia.', 'error');
                return false;
            }
            
            // OBRIGATÓRIO: Precisa selecionar um personagem
            if (!characterId || !this.chars[characterId]) {
                this.notify('Você precisa selecionar um personagem para entrar.', 'error');
                return false;
            }
            
            // Copia os dados do personagem (cópia profunda)
            const charData = JSON.parse(JSON.stringify(this.chars[characterId]));
            
            // Adiciona como membro
            const { error: joinError } = await this.supabase
                .from('campaign_members')
                .insert([{
                    campaign_id: campaign.id,
                    user_id: this.user.id,
                    character_id: characterId,
                    char_data: charData,
                    role: NETLINK_CONFIG.ROLES.PLAYER,
                    status: NETLINK_CONFIG.MEMBER_STATUS.ACTIVE
                }]);
            
            if (joinError) throw joinError;
            
            this.joinedCampaigns.push(campaign);
            playSFX('success');
            this.notify(`Você entrou em "${campaign.name}" com ${charData.name || 'seu personagem'}!`, 'success');
            
            // Fecha o modal e entra na campanha
            this.netlinkModal = false;
            await this.enterCampaign(campaign);
            
            return true;
        } catch (e) {
            console.error('[NETLINK] Erro ao entrar na campanha:', e);
            this.notify('Erro ao entrar na campanha.', 'error');
            return false;
        }
    },
    
    /**
     * Sanitiza e normaliza código de convite
     * Remove caracteres inválidos, extrai código de URLs, etc.
     * @param {string} rawCode - Código bruto (pode ser URL ou código direto)
     * @returns {string|null} Código sanitizado ou null se inválido
     */
    sanitizeInviteCode(rawCode) {
        if (!rawCode || typeof rawCode !== 'string') return null;
        
        let code = rawCode.trim();
        
        // Se for uma URL, extrai o código do path
        if (code.includes('://') || code.includes('#/netlink/')) {
            const urlMatch = code.match(/(?:netlink\/|code=)([A-Z0-9]{4,8})/i);
            if (urlMatch) {
                code = urlMatch[1];
            }
        }
        
        // Remove caracteres especiais e espaços
        code = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        
        // Valida comprimento (códigos são 6 caracteres por padrão)
        if (code.length < 4 || code.length > 8) {
            return null;
        }
        
        return code;
    },
    
    /**
     * Entra em uma campanha diretamente pelo código (usado pelo router)
     * Fluxo inteligente:
     * 1. Se já é membro -> entra direto
     * 2. Se não é membro e tem personagens -> mostra modal de seleção
     * 3. Se não é membro e NÃO tem personagens -> redireciona para wizard
     * @param {string} code - Código de convite (pode ser URL ou código direto)
     */
    async joinByCode(code) {
        // Sanitiza o código de entrada
        const sanitizedCode = this.sanitizeInviteCode(code);
        
        if (!sanitizedCode) {
            this.notify('Código de convite inválido. Use 4-8 caracteres alfanuméricos.', 'error');
            return false;
        }
        
        console.log('[NETLINK] Tentando entrar com código:', sanitizedCode);
        
        // Evita re-entrar se já estiver na campanha com o mesmo código
        if (this.activeCampaign?.invite_code?.toUpperCase() === sanitizedCode) {
            console.log('[NETLINK] Já está na campanha:', sanitizedCode);
            return true;
        }
        
        if (!this.supabase || !this.user) {
            // Salva o código para entrar depois do login
            sessionStorage.setItem('zenite_pending_campaign', sanitizedCode);
            this.notify('Faça login para entrar na campanha.', 'warn');
            return false;
        }
        
        try {
            // Busca a campanha pelo código (case insensitive)
            const { data: campaign, error } = await this.supabase
                .from('campaigns')
                .select('*')
                .ilike('invite_code', sanitizedCode)
                .single();
            
            if (error || !campaign) {
                console.warn('[NETLINK] Campanha não encontrada para código:', sanitizedCode, error);
                this.notify('Código de convite inválido ou campanha não encontrada.', 'error');
                router.navigate('dashboard');
                return false;
            }
            
            console.log('[NETLINK] Campanha encontrada:', campaign.name);
            
            // Salva a campanha pendente para uso posterior
            this.pendingCampaign = campaign;
            this.pendingCampaignCode = sanitizedCode;
            
            // Verifica se já é membro
            const { data: member } = await this.supabase
                .from('campaign_members')
                .select('*')
                .eq('campaign_id', campaign.id)
                .eq('user_id', this.user.id)
                .single();
            
            if (member) {
                // Já é membro, entra direto
                console.log('[NETLINK] Usuário já é membro, entrando...');
                await this.enterCampaign(campaign);
                return true;
            }
            
            // Não é membro - verifica se tem personagens
            const charCount = Object.keys(this.chars || {}).length;
            
            if (charCount === 0) {
                // Não tem personagens - redireciona para wizard
                console.log('[NETLINK] Usuário sem personagens, redirecionando para wizard...');
                this.notify('Você precisa criar um personagem antes de entrar na campanha.', 'warn');
                
                // Salva o código para entrar depois de criar o personagem
                sessionStorage.setItem('zenite_pending_campaign', sanitizedCode);
                
                // Abre o wizard de criação
                this.currentView = 'dashboard';
                this.wizardOpen = true;
                this.wizardStep = 1;
                return true;
            }
            
            // Se já tem um personagem selecionado (veio do wizard), entra direto
            if (this.selectedCharForCampaign && this.chars[this.selectedCharForCampaign]) {
                console.log('[NETLINK] Personagem já selecionado, entrando direto...');
                this.characterSelectCampaign = campaign;
                await this.confirmCharacterSelection(this.selectedCharForCampaign);
                this.selectedCharForCampaign = null;
                return true;
            }
            
            // Se só tem 1 personagem, entra direto com ele
            if (charCount === 1) {
                const charId = Object.keys(this.chars)[0];
                console.log('[NETLINK] Apenas 1 personagem, entrando direto...');
                this.characterSelectCampaign = campaign;
                await this.confirmCharacterSelection(charId);
                return true;
            }
            
            // Tem múltiplos personagens - mostra modal de seleção
            console.log('[NETLINK] Mostrando modal de seleção de personagem...');
            this.characterSelectModalOpen = true;
            this.characterSelectCampaign = campaign;
            return true;
            
        } catch (e) {
            console.error('[NETLINK] Erro ao buscar campanha:', e);
            this.notify('Erro ao buscar campanha.', 'error');
            return false;
        }
    },
    
    /**
     * Confirma a seleção de personagem e entra na campanha
     * @param {string} charId - ID do personagem selecionado
     */
    async confirmCharacterSelection(charId) {
        if (!this.characterSelectCampaign || !charId) {
            this.notify('Selecione um personagem.', 'error');
            return;
        }
        
        const campaign = this.characterSelectCampaign;
        const char = this.chars[charId];
        
        if (!char) {
            this.notify('Personagem não encontrado.', 'error');
            return;
        }
        
        try {
            // Adiciona como membro da campanha
            const { error } = await this.supabase
                .from('campaign_members')
                .insert({
                    campaign_id: campaign.id,
                    user_id: this.user.id,
                    role: 'player',
                    char_data: char
                });
            
            if (error) throw error;
            
            // Fecha todos os modais relacionados
            this.characterSelectModalOpen = false;
            this.characterSelectCampaign = null;
            this.netlinkModal = false; // Garante que o modal do netlink está fechado
            
            // Limpa código pendente
            sessionStorage.removeItem('zenite_pending_campaign');
            
            playSFX('success');
            this.notify(`Você entrou na campanha "${campaign.name}"!`, 'success');
            
            // Entra na campanha
            await this.enterCampaign(campaign);
            
        } catch (e) {
            console.error('[NETLINK] Erro ao entrar na campanha:', e);
            this.notify('Erro ao entrar na campanha.', 'error');
        }
    },
    
    /**
     * Jogador sai da campanha (não é GM)
     * Remove o membro e seus dados da campanha
     */
    async leaveCampaignAsMember() {
        if (!this.supabase || !this.user || !this.activeCampaign) return;
        
        // Não pode sair se for o GM
        if (this.isGMOfActiveCampaign()) {
            this.notify('O Mestre não pode abandonar a campanha. Delete-a se necessário.', 'error');
            return;
        }
        
        try {
            // Remove o membro
            const { error } = await this.supabase
                .from('campaign_members')
                .delete()
                .eq('campaign_id', this.activeCampaign.id)
                .eq('user_id', this.user.id);
            
            if (error) throw error;
            
            // Remove da lista local
            this.joinedCampaigns = this.joinedCampaigns.filter(c => c.id !== this.activeCampaign.id);
            
            playSFX('success');
            this.notify('Você saiu da campanha.', 'success');
            
            // Volta para a lista
            await this.leaveCampaign();
            
        } catch (e) {
            console.error('[NETLINK] Erro ao sair da campanha:', e);
            this.notify('Erro ao sair da campanha.', 'error');
        }
    },
    
    /**
     * Carrega todas as campanhas do usuário
     */
    async loadCampaigns() {
        if (!this.supabase || !this.user) return;
        
        try {
            // Campanhas onde é GM
            const { data: gmCampaigns } = await this.supabase
                .from('campaigns')
                .select('*')
                .eq('gm_id', this.user.id)
                .order('updated_at', { ascending: false });
            
            this.myCampaigns = gmCampaigns || [];
            
            // Campanhas onde é player
            const { data: memberData } = await this.supabase
                .from('campaign_members')
                .select('campaign_id, campaigns(*)')
                .eq('user_id', this.user.id)
                .eq('role', NETLINK_CONFIG.ROLES.PLAYER)
                .eq('status', NETLINK_CONFIG.MEMBER_STATUS.ACTIVE);
            
            this.joinedCampaigns = memberData
                ?.map(m => m.campaigns)
                .filter(Boolean) || [];
                
        } catch (e) {
            console.error('[NETLINK] Erro ao carregar campanhas:', e);
        }
    },
    
    /**
     * Abre o inspetor de membro (GM Only)
     */
    inspectMember(member) {
        if (!member.char_data) return;
        
        // Cria uma cópia profunda para edição segura
        this.inspectedMember = JSON.parse(JSON.stringify(member));
        this.memberInspectorOpen = true;
    },
    
    /**
     * Fecha o inspetor
     */
    closeInspector() {
        this.memberInspectorOpen = false;
        this.inspectedMember = null;
    },
    
    /**
     * Abre a ficha de um membro usando a UI COMPLETA da ficha original
     * Substitui temporariamente `char` pelo `char_data` do membro
     */
    openMemberSheet(member) {
        if (!member?.char_data) {
            this.notify('Este membro não possui ficha.', 'warn');
            return;
        }
        
        // Faz backup da ficha atual do usuário
        this.campaignCharBackup = this.char ? JSON.parse(JSON.stringify(this.char)) : null;
        this.campaignMemberId = member.id;
        this.campaignCharMode = true;
        
        // Copia char_data do membro para char (a ficha usa `char`)
        this.char = JSON.parse(JSON.stringify(member.char_data));
        
        // Muda para view da ficha
        this.currentView = 'sheet';
        
        playSFX('success');
    },
    
    /**
     * Abre a própria ficha do jogador para edição na campanha
     * Funciona igual ao openMemberSheet mas para o próprio jogador
     */
    openMySheet() {
        const myMembership = this.getMyMembership();
        if (!myMembership?.char_data) {
            this.notify('Você não possui uma ficha nesta campanha.', 'warn');
            return;
        }
        
        // Usa a mesma lógica do GM para editar ficha
        this.openMemberSheet(myMembership);
    },
    
    /**
     * ═══════════════════════════════════════════════════════════════════════
     * SMART AUTO-SAVE PARA CAMPANHAS
     * Salva automaticamente após X alterações ou Y minutos
     * Evita spam de saves e economiza requests ao Supabase
     * ═══════════════════════════════════════════════════════════════════════
     */
    
    /**
     * Registra uma alteração na campanha e verifica se deve auto-salvar
     * Chame isso sempre que algo mudar na ficha durante modo campanha
     */
    trackCampaignChange() {
        if (!this.campaignCharMode || !this.activeCampaign) return;
        
        this.campaignChangeCount++;
        this.unsavedChanges = true;
        
        const now = Date.now();
        const timeSinceLastSave = this.campaignLastAutoSave ? now - this.campaignLastAutoSave : Infinity;
        
        // Auto-save se atingiu threshold de alterações OU passou o intervalo de tempo
        if (this.campaignChangeCount >= this.campaignAutoSaveThreshold || 
            timeSinceLastSave >= this.campaignAutoSaveInterval) {
            console.log(`[NETLINK] Smart auto-save triggered (changes: ${this.campaignChangeCount}, time: ${Math.round(timeSinceLastSave/1000)}s)`);
            this.saveCampaignSheetSilent();
        }
    },
    
    /**
     * Salva ficha da campanha silenciosamente (sem notificação)
     * Usado pelo smart auto-save
     */
    async saveCampaignSheetSilent() {
        if (!this.campaignCharMode || !this.campaignMemberId || !this.char) return;
        if (this.isSyncing) return; // Evita saves simultâneos
        
        this.isSyncing = true;
        this.saveStatus = 'saving';
        
        try {
            const { error } = await this.supabase
                .from('campaign_members')
                .update({ char_data: this.char })
                .eq('id', this.campaignMemberId);
            
            if (error) throw error;
            
            // Reseta contadores
            this.campaignChangeCount = 0;
            this.campaignLastAutoSave = Date.now();
            this.unsavedChanges = false;
            this.saveStatus = 'saved';
            
            // Broadcast silencioso (sem notificação local)
            if (this.realtimeChannel) {
                this.realtimeChannel.send({
                    type: 'broadcast',
                    event: 'member_update',
                    payload: { memberId: this.campaignMemberId }
                });
            }
            
            console.log('[NETLINK] Auto-save concluído');
            
            // Reseta status após 2s
            setTimeout(() => {
                if (this.saveStatus === 'saved') this.saveStatus = 'idle';
            }, 2000);
            
        } catch (e) {
            console.error('[NETLINK] Erro no auto-save:', e);
            this.saveStatus = 'error';
        } finally {
            this.isSyncing = false;
        }
    },
    
    /**
     * Inicia o timer de auto-save por intervalo
     * Chamado ao entrar em uma campanha
     */
    startCampaignAutoSaveTimer() {
        // Limpa timer anterior se existir
        if (this._campaignAutoSaveTimer) {
            clearInterval(this._campaignAutoSaveTimer);
        }
        
        // Inicia novo timer
        this._campaignAutoSaveTimer = setInterval(() => {
            if (this.campaignCharMode && this.unsavedChanges && this.campaignChangeCount > 0) {
                console.log('[NETLINK] Auto-save por intervalo de tempo');
                this.saveCampaignSheetSilent();
            }
        }, this.campaignAutoSaveInterval);
        
        console.log('[NETLINK] Timer de auto-save iniciado');
    },
    
    /**
     * Para o timer de auto-save
     * Chamado ao sair de uma campanha
     */
    stopCampaignAutoSaveTimer() {
        if (this._campaignAutoSaveTimer) {
            clearInterval(this._campaignAutoSaveTimer);
            this._campaignAutoSaveTimer = null;
            console.log('[NETLINK] Timer de auto-save parado');
        }
    },
    
    /**
     * Salva alterações e fecha o modo de ficha de campanha (manual)
     */
    async saveCampaignSheet() {
        if (!this.campaignCharMode || !this.campaignMemberId) {
            console.warn('[NETLINK] saveCampaignSheet: modo inválido ou sem memberId');
            return;
        }
        
        if (!this.char) {
            console.error('[NETLINK] saveCampaignSheet: char é null');
            this.notify('Erro: dados da ficha não encontrados.', 'error');
            return;
        }
        
        console.log('[NETLINK] Salvando ficha do membro:', this.campaignMemberId);
        this.isSyncing = true;
        this.saveStatus = 'saving';
        
        try {
            // Salva as alterações no banco
            const { data, error } = await this.supabase
                .from('campaign_members')
                .update({ char_data: this.char })
                .eq('id', this.campaignMemberId)
                .select();
            
            if (error) throw error;
            
            console.log('[NETLINK] Ficha salva com sucesso:', data);
            
            // Reseta contadores do smart auto-save
            this.campaignChangeCount = 0;
            this.campaignLastAutoSave = Date.now();
            this.unsavedChanges = false;
            this.saveStatus = 'saved';
            
            // Broadcast para atualizar outros clientes
            if (this.realtimeChannel) {
                await this.realtimeChannel.send({
                    type: 'broadcast',
                    event: 'member_update',
                    payload: { memberId: this.campaignMemberId }
                });
                console.log('[NETLINK] Broadcast enviado');
            }
            
            this.notify('Ficha atualizada!', 'success');
            playSFX('save');
            
            // Recarrega membros
            await this.loadCampaignMembers(this.activeCampaign.id);
            
        } catch (e) {
            console.error('[NETLINK] Erro ao salvar ficha:', e);
            this.notify('Erro ao salvar ficha: ' + e.message, 'error');
            this.saveStatus = 'error';
        } finally {
            this.isSyncing = false;
        }
    },
    
    /**
     * Fecha o modo de ficha de campanha e restaura a ficha original
     */
    closeCampaignSheet() {
        if (!this.campaignCharMode) return;
        
        // Restaura a ficha original do usuário (só se tiver backup)
        if (this.campaignCharBackup) {
            this.char = this.campaignCharBackup;
        }
        // Se não tinha backup, mantém char como está mas limpa para evitar confusão
        // O char será recarregado quando o usuário abrir uma ficha
        
        this.campaignCharBackup = null;
        this.campaignMemberId = null;
        this.campaignCharMode = false;
        
        // Volta para a campanha
        this.currentView = 'campaign';
    },
    
    /**
     * Salva as alterações feitas na ficha do jogador (GM Only)
     * Envia broadcast para forçar atualização em tempo real nos clientes dos jogadores
     */
    async saveInspectedMember() {
        if (!this.supabase || !this.inspectedMember) return;
        
        try {
            const { error } = await this.supabase
                .from('campaign_members')
                .update({ char_data: this.inspectedMember.char_data })
                .eq('id', this.inspectedMember.id);
            
            if (error) throw error;
            
            // Broadcast para forçar atualização em todos os clientes
            if (this.realtimeChannel) {
                this.realtimeChannel.send({
                    type: 'broadcast',
                    event: 'member_update',
                    payload: { memberId: this.inspectedMember.id }
                });
            }
            
            playSFX('success');
            this.notify('Ficha do jogador atualizada!', 'success');
            this.closeInspector();
            
            // Recarrega lista (await para garantir sincronia)
            await this.loadCampaignMembers(this.activeCampaign.id);
            
        } catch (e) {
            console.error('[NETLINK] Erro ao salvar membro:', e);
            this.notify('Erro ao salvar alterações.', 'error');
        }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // REALTIME & SINCRONIZAÇÃO
    // ─────────────────────────────────────────────────────────────────────────
    
    /**
     * Conecta ao canal realtime de uma campanha
     * @param {string} campaignId - ID da campanha
     */
    async connectToRealtime(campaignId) {
        if (!this.supabase) return;
        
        // Evita reconectar ao mesmo canal
        const channelName = `${NETLINK_CONFIG.REALTIME_CHANNEL_PREFIX}${campaignId}`;
        if (this.realtimeChannel?.topic === channelName) {
            console.log('[NETLINK] Já conectado ao canal:', channelName);
            return;
        }
        
        // Desconecta do canal anterior se existir
        if (this.realtimeChannel) {
            await this.supabase.removeChannel(this.realtimeChannel);
        }
        
        console.log('[NETLINK] Conectando ao canal:', channelName);
        
        this.realtimeChannel = this.supabase
            .channel(channelName)
            // Escuta TUDO da tabela dice_logs
            .on('postgres_changes', 
                { event: 'INSERT', schema: 'public', table: 'dice_logs', filter: `campaign_id=eq.${campaignId}` },
                (payload) => {
                    console.log('[REALTIME] Nova rolagem recebida');
                    this.handleNewDiceLog(payload.new);
                }
            )
            // Escuta TUDO da tabela campaign_members
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'campaign_members', filter: `campaign_id=eq.${campaignId}` },
                async (payload) => {
                    console.log('[REALTIME] Lista de membros atualizada:', payload.eventType);
                    
                    // Detecta se o próprio usuário foi removido (kickado)
                    if (payload.eventType === 'DELETE' && payload.old?.user_id === this.user?.id) {
                        console.warn('[REALTIME] Você foi removido da campanha!');
                        this.notify('Você foi removido da campanha pelo Mestre.', 'warn');
                        playSFX('error');
                        
                        // Sai da campanha e volta para o dashboard
                        await this.leaveCampaign();
                        this.currentView = 'dashboard';
                        return;
                    }
                    
                    // Recarrega membros normalmente
                    this.loadCampaignMembers(campaignId);
                }
            )
            // Escuta TUDO da tabela campaign_logs (Chat)
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'campaign_logs', filter: `campaign_id=eq.${campaignId}` },
                (payload) => {
                    console.log('[REALTIME] Nova mensagem de chat');
                    this.handleNewChatMessage(payload.new);
                }
            )
            // Broadcasts (Iniciativa, etc)
            .on('broadcast', { event: 'initiative' },
                (payload) => this.handleInitiativeUpdate(payload)
            )
            // Broadcast de atualização de membro (quando GM edita ficha de jogador)
            .on('broadcast', { event: 'member_update' },
                async (payload) => {
                    console.log('[REALTIME] Ficha de membro atualizada pelo GM:', payload.payload?.memberId);
                    
                    // Recarrega membros
                    await this.loadCampaignMembers(campaignId);
                    
                    // Se o jogador está visualizando sua própria ficha em modo campanha,
                    // atualiza os dados locais também
                    if (this.campaignCharMode && this.campaignMemberId === payload.payload?.memberId) {
                        const updatedMember = this.campaignMembers.find(m => m.id === payload.payload?.memberId);
                        if (updatedMember?.char_data) {
                            console.log('[REALTIME] Atualizando ficha local do jogador');
                            this.char = { ...updatedMember.char_data };
                            this.notify('Sua ficha foi atualizada pelo Mestre!', 'info');
                        }
                    }
                    
                    // Se é o próprio jogador (não GM) e sua ficha foi atualizada
                    const myMembership = this.getMyMembership();
                    if (myMembership && payload.payload?.memberId === myMembership.id) {
                        // Atualiza dados locais se não estiver em modo de edição
                        if (!this.campaignCharMode) {
                            console.log('[REALTIME] Dados do jogador atualizados pelo GM');
                        }
                    }
                }
            )
            // Broadcast de música ambiente (GM controla, jogadores recebem)
            .on('broadcast', { event: 'ambient_music' },
                (payload) => {
                    console.log('[REALTIME] Comando de música recebido:', payload.payload?.action);
                    if (!this.isGMOfActiveCampaign()) {
                        this.handleMusicCommand(payload.payload);
                    }
                }
            )
            .subscribe((status) => {
                console.log('[NETLINK] Status da conexão:', status);
                if (status === 'SUBSCRIBED') {
                    console.log('✅ [NETLINK] Conectado ao realtime com sucesso!');
                    // Força recarga inicial para garantir sincronia
                    this.loadChatHistory();
                    this.loadCampaignMembers(campaignId);
                    // Limpa tentativas de retry
                    if (this._realtimeRetryTimeout) {
                        clearTimeout(this._realtimeRetryTimeout);
                        this._realtimeRetryTimeout = null;
                    }
                    this._realtimeRetries = 0;
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.error('❌ [NETLINK] Erro na conexão realtime:', status);
                    
                    // Retry logic - tenta reconectar até 3 vezes
                    if (!this._realtimeRetries) this._realtimeRetries = 0;
                    
                    if (this._realtimeRetries < 3) {
                        this._realtimeRetries++;
                        const delay = this._realtimeRetries * 2000; // 2s, 4s, 6s
                        console.log(`[NETLINK] Tentando reconectar em ${delay/1000}s (tentativa ${this._realtimeRetries}/3)...`);
                        
                        this._realtimeRetryTimeout = setTimeout(() => {
                            console.log('[NETLINK] Reconectando...');
                            this.connectToRealtime(campaignId);
                        }, delay);
                    } else {
                        console.error('[NETLINK] Falha após 3 tentativas. Realtime desabilitado para esta sessão.');
                        this.notify('Tempo real indisponível. Recarregue a página para tentar novamente.', 'warn');
                    }
                } else if (status === 'CLOSED') {
                    console.warn('⚠️ [NETLINK] Conexão realtime fechada');
                }
            });
    },
    
    /**
     * Desconecta do canal realtime
     */
    async disconnectRealtime() {
        if (this.realtimeChannel && this.supabase) {
            await this.supabase.removeChannel(this.realtimeChannel);
            this.realtimeChannel = null;
        }
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // SISTEMA DE DADOS MULTIPLAYER
    // ─────────────────────────────────────────────────────────────────────────
    
    /**
     * Rola dados e envia para a campanha
     * @param {number} sides - Número de faces do dado
     * @param {boolean} isPrivate - Se a rolagem é privada (só GM vê)
     */
    async rollForCampaign(sides, isPrivate = false) {
        if (!this.activeCampaign) {
            // Rola localmente se não estiver em campanha
            this.roll(sides);
            return;
        }
        
        // Rate limiting: 10 rolls per minute
        if (!window._diceRollTimestamps) window._diceRollTimestamps = [];
        const now = Date.now();
        window._diceRollTimestamps = window._diceRollTimestamps.filter(t => now - t < 60000);
        
        if (window._diceRollTimestamps.length >= 10) {
            this.notify('Limite de rolagens atingido! Aguarde um momento.', 'warn');
            return;
        }
        window._diceRollTimestamps.push(now);
        
        playSFX('dice');
        
        const natural = this.cryptoRandom(sides);
        const modifier = parseInt(this.diceMod || 0);
        const total = natural + modifier;
        
        const isCrit = natural === sides;
        const isFumble = natural === 1;
        
        // Som especial
        setTimeout(() => {
            if (isCrit) playSFX('critical');
            else if (isFumble) playSFX('fumble');
        }, 400);
        
        // Atualiza estado local
        this.lastNatural = natural;
        this.lastFaces = sides;
        this.lastRoll = total;
        
        // Formata fórmula
        let formula = `D${sides}`;
        if (modifier !== 0) formula += modifier > 0 ? `+${modifier}` : `${modifier}`;
        
        // NOVO: Salva última rolagem do jogador para exibição na tela
        this.playerLastRoll = {
            formula,
            natural,
            modifier,
            total,
            isCrit,
            isFumble,
            reason: this.diceReason || '',
            timestamp: Date.now()
        };
        
        // Incrementa stats para achievements
        if (this.incrementStat) {
            this.incrementStat('totalRolls');
            if (isCrit) this.incrementStat('criticalRolls');
            if (isFumble) this.incrementStat('fumbleRolls');
        }
        
        // ═══════════════════════════════════════════════════════════════════════
        // OPTIMISTIC UI: Adiciona ao log LOCAL imediatamente
        // O jogador vê sua própria rolagem instantaneamente, sem esperar o servidor
        // ═══════════════════════════════════════════════════════════════════════
        const optimisticId = `local_${Date.now()}`;
        const username = this.char?.name || this.settings?.displayName || this.settings?.username || this.user.email?.split('@')[0] || 'Anônimo';
        
        this.sessionDiceLog.unshift({
            id: optimisticId,
            username: username,
            formula: formula,
            result: total,
            natural: natural,
            mod: modifier,
            crit: isCrit,
            fumble: isFumble,
            reason: this.diceReason || '',
            isPrivate: isPrivate,
            time: new Date().toLocaleTimeString('pt-BR'),
            isOptimistic: true // Flag para identificar entrada local
        });
        
        // Limita tamanho do log
        if (this.sessionDiceLog.length > 100) {
            this.sessionDiceLog = this.sessionDiceLog.slice(0, 100);
        }
        
        try {
            // Envia para o Supabase
            const { data, error } = await this.supabase
                .from('dice_logs')
                .insert([{
                    campaign_id: this.activeCampaign.id,
                    user_id: this.user.id,
                    username: username,
                    roll_data: {
                        sides,
                        natural,
                        modifier,
                        total,
                        reason: this.diceReason
                    },
                    is_private: isPrivate,
                    is_critical: isCrit,
                    is_fumble: isFumble,
                    natural_result: natural,
                    modifier: modifier,
                    total_result: total,
                    formula: formula,
                    reason: this.diceReason || null
                }])
                .select()
                .single();
            
            if (error) throw error;
            
            // Atualiza o ID local com o ID real do servidor
            const idx = this.sessionDiceLog.findIndex(l => l.id === optimisticId);
            if (idx !== -1 && data) {
                this.sessionDiceLog[idx].id = data.id;
                this.sessionDiceLog[idx].isOptimistic = false;
            }
            
        } catch (e) {
            console.error('[NETLINK] Erro ao enviar rolagem:', e);
            // Marca a entrada como erro mas mantém visível
            const idx = this.sessionDiceLog.findIndex(l => l.id === optimisticId);
            if (idx !== -1) {
                this.sessionDiceLog[idx].syncError = true;
            }
            this.notify('Erro ao sincronizar rolagem.', 'error');
        }
        
        this.diceReason = '';
    },
    
    /**
     * ═══════════════════════════════════════════════════════════════════════
     * ROLAGEM LOCAL DO GM (NÃO VAI PARA O LOG)
     * ═══════════════════════════════════════════════════════════════════════
     * Rola dados apenas localmente para o Mestre fazer testes secretos.
     * Os resultados ficam em gmLocalDiceLog e NÃO são enviados ao banco.
     * 
     * @param {number} sides - Lados do dado (d4, d6, d8, d10, d12, d20, d100)
     */
    rollGMLocalDice(sides = 20) {
        playSFX('dice');
        
        const natural = this.cryptoRandom(sides);
        const modifier = parseInt(this.gmDiceMod || 0);
        const total = natural + modifier;
        
        const isCrit = natural === sides;
        const isFumble = natural === 1;
        
        // Som especial
        setTimeout(() => {
            if (isCrit) playSFX('critical');
            else if (isFumble) playSFX('fumble');
        }, 400);
        
        // Formata fórmula
        let formula = `D${sides}`;
        if (modifier !== 0) formula += modifier > 0 ? `+${modifier}` : `${modifier}`;
        
        // Adiciona ao log LOCAL do GM (máximo 20 entradas)
        this.gmLocalDiceLog.unshift({
            id: Date.now(),
            formula,
            natural,
            modifier,
            total,
            isCrit,
            isFumble,
            timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        });
        
        // Limita tamanho do log
        if (this.gmLocalDiceLog.length > 20) {
            this.gmLocalDiceLog = this.gmLocalDiceLog.slice(0, 20);
        }
        
        // Reseta modificador após rolar
        this.gmDiceMod = 0;
    },
    
    /**
     * Limpa o log de dados local do GM
     */
    clearGMDiceLog() {
        this.gmLocalDiceLog = [];
    },
    
    /**
     * Handler para novas rolagens recebidas via realtime
     */
    handleNewDiceLog(log) {
        // Não processa se não estiver mais na campanha
        if (!this.activeCampaign || this.currentView !== 'campaign') {
            return;
        }
        
        // Não processa se for rolagem privada e não for GM
        if (log.is_private && this.activeCampaign?.gm_id !== this.user?.id) {
            return;
        }
        
        // OPTIMISTIC UI: Ignora se já existe (própria rolagem já adicionada localmente)
        // Verifica por ID real ou se é uma entrada optimistic que foi confirmada
        const existingIdx = this.sessionDiceLog.findIndex(l => 
            l.id === log.id || 
            (l.isOptimistic && l.username === log.username && l.result === log.total_result && l.formula === log.formula)
        );
        
        if (existingIdx !== -1) {
            // Atualiza a entrada existente com o ID real do servidor
            this.sessionDiceLog[existingIdx].id = log.id;
            this.sessionDiceLog[existingIdx].isOptimistic = false;
            return;
        }
        
        // Adiciona ao log da sessão (rolagem de outro jogador)
        this.sessionDiceLog.unshift({
            id: log.id,
            username: log.username,
            formula: log.formula,
            result: log.total_result,
            natural: log.natural_result,
            mod: log.modifier,
            crit: log.is_critical,
            fumble: log.is_fumble,
            reason: log.reason,
            isPrivate: log.is_private,
            time: new Date(log.created_at).toLocaleTimeString('pt-BR')
        });
        
        // Limita tamanho
        if (this.sessionDiceLog.length > 100) {
            this.sessionDiceLog = this.sessionDiceLog.slice(0, 100);
        }
        
        // Som de notificação para rolagens de outros
        if (log.user_id !== this.user?.id) {
            playSFX('notification');
        }
    },
    
    /**
     * Retorna a última rolagem de um membro específico
     * @param {string} username - Nome do personagem
     * @returns {object|null} - Última rolagem ou null
     */
    getLastRollForMember(username) {
        if (!username || !this.sessionDiceLog?.length) return null;
        return this.sessionDiceLog.find(log => log.username === username) || null;
    },
    
    /**
     * Carrega histórico de rolagens das últimas 24h do Supabase
     * @param {string} campaignId - ID da campanha
     */
    async loadDiceHistory(campaignId) {
        if (!this.supabase || !campaignId) return;
        
        try {
            // Calcula timestamp de 24h atrás
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            
            const { data, error } = await this.supabase
                .from('dice_logs')
                .select('*')
                .eq('campaign_id', campaignId)
                .gte('created_at', twentyFourHoursAgo)
                .order('created_at', { ascending: false })
                .limit(100);
            
            if (error) throw error;
            
            if (data && data.length > 0) {
                // Converte para o formato do sessionDiceLog
                this.sessionDiceLog = data.map(log => ({
                    id: log.id,
                    username: log.username,
                    formula: log.formula,
                    result: log.total_result,
                    natural: log.natural_result,
                    mod: log.modifier,
                    crit: log.is_critical,
                    fumble: log.is_fumble,
                    reason: log.reason,
                    isPrivate: log.is_private,
                    time: new Date(log.created_at).toLocaleTimeString('pt-BR')
                }));
                
                console.log(`[NETLINK] Carregadas ${data.length} rolagens das últimas 24h`);
            } else {
                this.sessionDiceLog = [];
            }
            
        } catch (e) {
            console.error('[NETLINK] Erro ao carregar histórico de dados:', e);
            this.sessionDiceLog = [];
        }
    },
    
    /**
     * Handler para novas mensagens de chat recebidas via realtime
     */
    handleNewChatMessage(message) {
        // Não processa se não estiver mais na campanha
        if (!this.activeCampaign || this.currentView !== 'campaign') {
            return;
        }
        
        // Não adiciona se já existe (evita duplicação)
        if (this.chatMessages.find(m => m.id === message.id)) {
            return;
        }
        
        // Whispers: só mostra para GM ou destinatário
        if (message.type === 'whisper') {
            const isGM = this.activeCampaign?.gm_id === this.user?.id;
            const isTarget = message.metadata?.targetUserId === this.user?.id;
            const isSender = message.user_id === this.user?.id;
            
            if (!isGM && !isTarget && !isSender) {
                return;
            }
        }
        
        // Adiciona a mensagem
        this.chatMessages.push(message);
        
        // Som de notificação se não for do próprio usuário
        if (message.user_id !== this.user?.id) {
            playSFX('notification');
        }
        
        // Auto-scroll
        this.$nextTick(() => {
            const container = document.getElementById('chat-container');
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        });
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // SISTEMA DE INICIATIVA
    // ─────────────────────────────────────────────────────────────────────────
    
    /**
     * Adiciona participante à iniciativa
     */
    addToInitiative(name, value, isNPC = false) {
        this.initiativeOrder.push({
            id: Date.now(),
            name,
            value: parseInt(value) || 0,
            isNPC,
            isActive: false
        });
        this.sortInitiative();
    },
    
    /**
     * Remove participante da iniciativa
     */
    removeFromInitiative(id) {
        this.initiativeOrder = this.initiativeOrder.filter(i => i.id !== id);
    },
    
    /**
     * Limpa toda a iniciativa
     */
    clearInitiative() {
        this.initiativeOrder = [];
        this.currentInitiativeIndex = 0;
    },
    
    /**
     * Define quem está ativo na iniciativa
     */
    setActiveInitiative(id) {
        this.initiativeOrder.forEach(i => i.isActive = false);
        const idx = this.initiativeOrder.findIndex(i => i.id === id);
        if (idx !== -1) {
            this.initiativeOrder[idx].isActive = true;
            this.currentInitiativeIndex = idx;
        }
        playSFX('click');
    },
    
    /**
     * Ordena iniciativa (maior primeiro)
     */
    sortInitiative() {
        this.initiativeOrder.sort((a, b) => b.value - a.value);
    },
    
    /**
     * Avança para o próximo na iniciativa
     */
    nextInitiative() {
        if (this.initiativeOrder.length === 0) return;
        
        // Remove highlight atual
        this.initiativeOrder.forEach(i => i.isActive = false);
        
        // Avança índice
        this.currentInitiativeIndex = (this.currentInitiativeIndex + 1) % this.initiativeOrder.length;
        
        // Marca novo ativo
        this.initiativeOrder[this.currentInitiativeIndex].isActive = true;
        
        // Broadcast para outros
        if (this.realtimeChannel) {
            this.realtimeChannel.send({
                type: 'broadcast',
                event: 'initiative',
                payload: {
                    order: this.initiativeOrder,
                    currentIndex: this.currentInitiativeIndex
                }
            });
        }
        
        playSFX('click');
    },
    
    /**
     * Handler para updates de iniciativa via realtime
     */
    handleInitiativeUpdate(payload) {
        // Não processa se não estiver mais na campanha
        if (!this.activeCampaign || this.currentView !== 'campaign') {
            return;
        }
        
        this.initiativeOrder = payload.payload.order;
        this.currentInitiativeIndex = payload.payload.currentIndex;
    },
    
    /**
     * Reseta iniciativa
     */
    resetInitiative() {
        this.initiativeOrder = [];
        this.currentInitiativeIndex = 0;
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // UTILITÁRIOS DO JOGADOR
    // ─────────────────────────────────────────────────────────────────────────
    
    /**
     * Retorna o membership do jogador atual na campanha ativa
     * Útil para o jogador ver sua própria ficha/stats na campanha
     * @returns {Object|null} O objeto de membership do jogador ou null
     */
    getMyMembership() {
        if (!this.user || !this.campaignMembers) return null;
        return this.campaignMembers.find(m => m.user_id === this.user.id) || null;
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // PAINEL DO MESTRE
    // ─────────────────────────────────────────────────────────────────────────
    
    /**
     * Carrega membros de uma campanha com dados completos
     * O mestre pode ver TUDO através do char_data em campaign_members
     */
    async loadCampaignMembers(campaignId) {
        if (!this.supabase) return;
        
        try {
            // Remove o join com profiles que pode estar falhando se a tabela estiver vazia/bloqueada
            const { data } = await this.supabase
                .from('campaign_members')
                .select('*')
                .eq('campaign_id', campaignId)
                .eq('status', NETLINK_CONFIG.MEMBER_STATUS.ACTIVE);
            
            this.campaignMembers = data || [];
            
            // Processa dados para fácil acesso pelo mestre
            this.campaignMembers = this.campaignMembers.map(member => ({
                ...member,
                // Extrai stats importantes para visualização rápida
                quickStats: member.char_data ? {
                    name: member.char_data.name || 'Sem Nome',
                    class: member.char_data.class || 'Desconhecido',
                    level: member.char_data.level || 1,
                    photo: member.char_data.photo || null,
                    pv: member.char_data.stats?.pv || { current: 0, max: 0 },
                    pf: member.char_data.stats?.pf || { current: 0, max: 0 },
                    pdf: member.char_data.stats?.pdf || { current: 0, max: 0 },
                    attrs: member.char_data.attrs || {}
                } : null
            }));
        } catch (e) {
            console.error('[NETLINK] Erro ao carregar membros:', e);
        }
    },
    
    /**
     * Sincroniza a ficha do jogador com a campanha (Player action)
     * Chamado quando o jogador salva sua ficha
     */
    async syncCharWithCampaign() {
        if (!this.supabase || !this.activeCampaign || !this.char) return;
        if (this.isGMOfActiveCampaign()) return; // GM não precisa sincronizar
        
        try {
            // Encontra o membership do jogador
            const { data: membership } = await this.supabase
                .from('campaign_members')
                .select('id')
                .eq('campaign_id', this.activeCampaign.id)
                .eq('user_id', this.user.id)
                .single();
            
            if (!membership) return;
            
            // Atualiza char_data com a ficha atual
            await this.supabase
                .from('campaign_members')
                .update({ char_data: JSON.parse(JSON.stringify(this.char)) })
                .eq('id', membership.id);
                
        } catch (e) {
            console.error('[NETLINK] Erro ao sincronizar ficha:', e);
        }
    },
    
    /**
     * Obtém resumo de stats de todos os jogadores (GM only)
     * Útil para exibir barras de vida no painel do mestre
     */
    getPlayersHealthSummary() {
        if (!this.isGMOfActiveCampaign()) return [];
        
        return this.campaignMembers
            .filter(m => m.role === NETLINK_CONFIG.ROLES.PLAYER && m.quickStats)
            .map(m => ({
                memberId: m.id,
                userId: m.user_id,
                name: m.quickStats.name,
                photo: m.quickStats.photo,
                class: m.quickStats.class,
                level: m.quickStats.level,
                pv: m.quickStats.pv,
                pvPercent: m.quickStats.pv.max > 0 
                    ? Math.round((m.quickStats.pv.current / m.quickStats.pv.max) * 100) 
                    : 0,
                pf: m.quickStats.pf,
                pdf: m.quickStats.pdf,
                isLow: m.quickStats.pv.current <= m.quickStats.pv.max * 0.25,
                isDead: m.quickStats.pv.current <= 0
            }));
    },
    
    /**
     * Aplica dano/cura a um jogador (GM only)
     * @param {string} memberId - ID do membro
     * @param {number} amount - Valor positivo = dano, negativo = cura
     * @param {string} stat - 'pv', 'pf', ou 'pdf'
     */
    async modifyPlayerStat(memberId, amount, stat = 'pv') {
        if (!this.supabase || !this.isGMOfActiveCampaign()) return;
        
        const member = this.campaignMembers.find(m => m.id === memberId);
        if (!member || !member.char_data) return;
        
        const charData = { ...member.char_data };
        if (!charData.stats || !charData.stats[stat]) return;
        
        // Aplica modificação
        const currentVal = charData.stats[stat].current;
        const maxVal = charData.stats[stat].max;
        charData.stats[stat].current = Math.max(0, Math.min(maxVal, currentVal - amount));
        
        try {
            await this.supabase
                .from('campaign_members')
                .update({ char_data: charData })
                .eq('id', memberId);
            
            // Broadcast para forçar atualização nos clientes
            if (this.realtimeChannel) {
                this.realtimeChannel.send({
                    type: 'broadcast',
                    event: 'member_update',
                    payload: { memberId }
                });
            }
            
            // Atualiza local
            await this.loadCampaignMembers(this.activeCampaign.id);
            
            playSFX(amount > 0 ? 'error' : 'success');
        } catch (e) {
            console.error('[NETLINK] Erro ao modificar stat:', e);
        }
    },
    
    /**
     * Atualiza dados do personagem de um membro (GM only)
     * Atualiza no banco, broadcast para jogadores, e recarrega localmente
     */
    async updateMemberCharData(memberId, charData) {
        if (!this.supabase || !this.isGMOfActiveCampaign()) return;
        
        try {
            const { error } = await this.supabase
                .from('campaign_members')
                .update({ char_data: charData })
                .eq('id', memberId);
            
            if (error) throw error;
            
            // Broadcast para forçar atualização nos clientes dos jogadores
            if (this.realtimeChannel) {
                this.realtimeChannel.send({
                    type: 'broadcast',
                    event: 'member_update',
                    payload: { memberId }
                });
            }
            
            // Recarrega membros para atualização imediata na UI do GM
            await this.loadCampaignMembers(this.activeCampaign.id);
            
            this.notify('Ficha atualizada!', 'success');
            playSFX('success');
        } catch (e) {
            console.error('[NETLINK] Erro ao atualizar ficha:', e);
            this.notify('Erro ao atualizar ficha.', 'error');
        }
    },
    
    /**
     * Remove um membro da campanha (GM only)
     * Deleta o registro do membro, permitindo que ele entre novamente se convidado
     */
    async kickMember(memberId) {
        if (!this.supabase || !this.isGMOfActiveCampaign()) {
            this.notify('Apenas o Mestre pode remover jogadores.', 'error');
            return;
        }
        
        // Não pode remover a si mesmo
        const member = this.campaignMembers.find(m => m.id === memberId);
        if (member?.user_id === this.user?.id) {
            this.notify('Você não pode remover a si mesmo.', 'error');
            return;
        }
        
        try {
            const { error } = await this.supabase
                .from('campaign_members')
                .delete()
                .eq('id', memberId);
            
            if (error) throw error;
            
            await this.loadCampaignMembers(this.activeCampaign.id);
            playSFX('success');
            this.notify('Jogador removido da campanha.', 'success');
        } catch (e) {
            console.error('[NETLINK] Erro ao remover membro:', e);
            this.notify('Erro ao remover jogador.', 'error');
        }
    },
    
    /**
     * Verifica se o usuário é GM da campanha ativa
     */
    isGMOfActiveCampaign() {
        return this.activeCampaign?.gm_id === this.user?.id;
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // BESTIÁRIO (GM ONLY)
    // ─────────────────────────────────────────────────────────────────────────
    
    // O bestiário será armazenado no campo 'settings' da campanha
    // ou em uma tabela separada futuramente
    
    /**
     * Adiciona criatura ao bestiário
     */
    async addToBestiary(creature) {
        if (!this.isGMOfActiveCampaign()) return;
        
        const bestiary = this.activeCampaign.settings?.bestiary || [];
        bestiary.push({
            id: Date.now(),
            ...creature,
            createdAt: new Date().toISOString()
        });
        
        await this.updateCampaignSettings({ bestiary });
    },
    
    /**
     * Atualiza configurações da campanha
     */
    async updateCampaignSettings(newSettings) {
        if (!this.supabase || !this.isGMOfActiveCampaign()) return;
        
        try {
            const settings = { ...this.activeCampaign.settings, ...newSettings };
            
            const { error } = await this.supabase
                .from('campaigns')
                .update({ settings, updated_at: new Date().toISOString() })
                .eq('id', this.activeCampaign.id);
            
            if (error) throw error;
            
            this.activeCampaign.settings = settings;
        } catch (e) {
            console.error('[NETLINK] Erro ao atualizar settings:', e);
        }
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // TIMER DE SESSÃO (GM ONLY)
    // ─────────────────────────────────────────────────────────────────────────
    
    sessionTimerInterval: null,
    sessionStartTime: null,
    sessionElapsed: 0,
    sessionTimerPaused: false,
    
    /**
     * Inicia o timer da sessão
     */
    startSessionTimer() {
        if (this.sessionTimerInterval) return;
        
        this.sessionStartTime = Date.now() - (this.sessionElapsed * 1000);
        this.sessionTimerPaused = false;
        
        this.sessionTimerInterval = setInterval(() => {
            if (!this.sessionTimerPaused) {
                this.sessionElapsed = Math.floor((Date.now() - this.sessionStartTime) / 1000);
            }
        }, 1000);
        
        playSFX('click');
    },
    
    /**
     * Pausa/resume o timer
     */
    toggleSessionTimer() {
        this.sessionTimerPaused = !this.sessionTimerPaused;
        if (!this.sessionTimerPaused) {
            this.sessionStartTime = Date.now() - (this.sessionElapsed * 1000);
        }
        playSFX('click');
    },
    
    /**
     * Para e reseta o timer
     */
    stopSessionTimer() {
        if (this.sessionTimerInterval) {
            clearInterval(this.sessionTimerInterval);
            this.sessionTimerInterval = null;
        }
        this.sessionElapsed = 0;
        this.sessionStartTime = null;
        this.sessionTimerPaused = false;
    },
    
    /**
     * Formata tempo para exibição (HH:MM:SS)
     */
    formatSessionTime() {
        const hours = Math.floor(this.sessionElapsed / 3600);
        const minutes = Math.floor((this.sessionElapsed % 3600) / 60);
        const seconds = this.sessionElapsed % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // CALCULADORA DE COMBATE (GM ONLY)
    // ─────────────────────────────────────────────────────────────────────────
    
    combatCalc: {
        damageInput: 0,
        defenseInput: 0,
        result: 0,
        history: []
    },
    
    /**
     * Calcula dano final
     */
    calculateDamage(damage, defense, penetration = 0) {
        const effectiveDefense = Math.max(0, defense - penetration);
        const finalDamage = Math.max(0, damage - effectiveDefense);
        
        this.combatCalc.result = finalDamage;
        this.combatCalc.history.unshift({
            id: Date.now(),
            damage,
            defense,
            penetration,
            result: finalDamage,
            time: new Date().toLocaleTimeString('pt-BR')
        });
        
        // Limita histórico
        if (this.combatCalc.history.length > 20) {
            this.combatCalc.history = this.combatCalc.history.slice(0, 20);
        }
        
        return finalDamage;
    },
    
    /**
     * Limpa histórico de combate
     */
    clearCombatHistory() {
        this.combatCalc.history = [];
        this.combatCalc.result = 0;
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // NOTAS DO GM (Privadas)
    // ─────────────────────────────────────────────────────────────────────────
    
    gmNotes: '',
    gmNotesAutoSave: null,
    
    /**
     * Atualiza notas do GM (com auto-save debounced)
     */
    updateGMNotes(content) {
        this.gmNotes = content;
        
        // Debounce para auto-save
        clearTimeout(this.gmNotesAutoSave);
        this.gmNotesAutoSave = setTimeout(async () => {
            if (this.activeCampaign && this.isGMOfActiveCampaign()) {
                try {
                    await this.supabase
                        .from('campaigns')
                        .update({ notes: content, updated_at: new Date().toISOString() })
                        .eq('id', this.activeCampaign.id);
                } catch (e) {
                    console.error('[NETLINK] Erro ao salvar notas:', e);
                }
            }
        }, 2000);
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // CHAT DA CAMPANHA
    // ─────────────────────────────────────────────────────────────────────────
    
    chatMessages: [],
    chatInput: '',
    
    /**
     * Envia mensagem no chat da campanha
     */
    async sendChatMessage(content, type = 'chat') {
        if (!this.supabase || !this.activeCampaign || !content.trim()) return;
        
        // Rate limiting: 20 messages per minute
        if (!window._chatTimestamps) window._chatTimestamps = [];
        const now = Date.now();
        window._chatTimestamps = window._chatTimestamps.filter(t => now - t < 60000);
        
        if (window._chatTimestamps.length >= 20) {
            this.notify('Limite de mensagens atingido! Aguarde um momento.', 'warn');
            return;
        }
        window._chatTimestamps.push(now);
        
        // Sanitize message (max 2000 chars, remove scripts)
        const sanitized = content
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
            .replace(/javascript:/gi, '')
            .slice(0, 2000);
        
        try {
            const senderName = this.char?.name || this.settings?.displayName || this.settings?.username || this.user?.email?.split('@')[0] || 'Anônimo';
            
            const { error } = await this.supabase
                .from('campaign_logs')
                .insert([{
                    campaign_id: this.activeCampaign.id,
                    user_id: this.user.id,
                    sender: senderName,
                    content: sanitized,
                    type: type,
                    metadata: {
                        isGM: this.isGMOfActiveCampaign()
                    }
                }]);
            
            if (error) throw error;
            
            this.chatInput = '';
            playSFX('click');
            
            // Incrementa stat para achievements
            if (this.incrementStat) this.incrementStat('messagesSent');
        } catch (e) {
            console.error('[NETLINK] Erro ao enviar mensagem:', e);
        }
    },
    
    /**
     * Compartilha imagem ou GIF no chat
     * @param {string} imageUrl - URL da imagem/GIF ou base64
     * @param {string} caption - Legenda opcional
     * @param {string} mediaType - 'image' ou 'gif'
     */
    async shareImageInChat(imageUrl, caption = '', mediaType = 'image') {
        if (!this.supabase || !this.activeCampaign) return;
        if (!this.campaignSettings.imagesEnabled) {
            this.notify('Imagens desabilitadas nesta campanha', 'warn');
            return;
        }
        
        // Detecta automaticamente se é GIF pela URL
        const isGif = mediaType === 'gif' || imageUrl.toLowerCase().includes('.gif') || 
                      imageUrl.toLowerCase().includes('giphy') || imageUrl.toLowerCase().includes('tenor');
        
        try {
            const senderName = this.char?.name || this.settings?.displayName || this.settings?.username || this.user?.email?.split('@')[0] || 'Anônimo';
            
            const { error } = await this.supabase
                .from('campaign_logs')
                .insert([{
                    campaign_id: this.activeCampaign.id,
                    user_id: this.user.id,
                    sender: senderName,
                    content: caption,
                    type: isGif ? 'gif' : 'image',
                    metadata: {
                        isGM: this.isGMOfActiveCampaign(),
                        imageUrl: imageUrl
                    }
                }]);
            
            if (error) throw error;
            playSFX('success');
        } catch (e) {
            console.error('[NETLINK] Erro ao enviar imagem:', e);
            this.notify('Erro ao enviar imagem', 'error');
        }
    },
    
    /**
     * Busca GIFs (usando Giphy API pública)
     * @param {string} query - Termo de busca
     */
    async searchTenorGifs(query) {
        if (!query || query.trim().length < 2) {
            this.tenorResults = [];
            return;
        }
        
        this.tenorLoading = true;
        
        try {
            // Giphy API SDK Key (pública para desenvolvimento)
            const GIPHY_KEY = 'GlVGYHkr3WSBnllca54iNt0yFbjz7L65';
            const url = `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(query)}&limit=50&rating=pg-13&lang=pt`;
            
            console.log('[GIPHY] Buscando:', query);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                console.error('[GIPHY] API response not OK:', response.status, response.statusText);
                const errorText = await response.text();
                console.error('[GIPHY] Error body:', errorText);
                throw new Error(`Giphy API error: ${response.status} - ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('[GIPHY] Response data:', data);
            console.log('[GIPHY] Resultados encontrados:', data.data?.length || 0);
            
            if (!data.data || data.data.length === 0) {
                this.tenorResults = [];
                this.notify('Nenhum GIF encontrado. Tente outro termo.', 'info');
                return;
            }
            
            this.tenorResults = (data.data || []).map(gif => {
                // Prioriza fixed_height_small para preview (mais rápido)
                const preview = gif.images?.fixed_height_small?.url || 
                               gif.images?.fixed_height?.url || 
                               gif.images?.downsized_small?.url ||
                               gif.images?.downsized?.url || 
                               gif.images?.original?.url;
                
                // Usa downsized_medium para envio (bom balanço qualidade/tamanho)
                const full = gif.images?.downsized_medium?.url || 
                            gif.images?.downsized?.url || 
                            gif.images?.original?.url;
                
                return {
                    id: gif.id,
                    title: gif.title || 'GIF',
                    preview: preview,
                    full: full
                };
            }).filter(gif => gif.preview && gif.full);
            
            console.log('[GIPHY] GIFs válidos após filtro:', this.tenorResults.length);
            
            if (this.tenorResults.length === 0) {
                this.notify('GIFs encontrados mas sem URLs válidas. Tente outro termo.', 'warn');
            }
        } catch (e) {
            console.error('[GIPHY] Erro na busca:', e);
            console.error('[GIPHY] Stack:', e.stack);
            this.tenorResults = [];
            
            // Mensagem de erro mais específica
            if (e.message.includes('Failed to fetch')) {
                this.notify('Erro de conexão com Giphy. Verifique sua internet.', 'error');
            } else if (e.message.includes('429')) {
                this.notify('Limite de requisições Giphy atingido. Aguarde um momento.', 'warn');
            } else {
                this.notify('Erro ao buscar GIFs: ' + e.message, 'error');
            }
        } finally {
            this.tenorLoading = false;
        }
    },
    
    /**
     * Seleciona e envia um GIF
     */
    async selectTenorGif(gif) {
        if (!gif || !gif.full) return;
        
        await this.shareImageInChat(gif.full, '', 'gif');
        this.gifModalOpen = false;
        this.tenorSearch = '';
        this.tenorResults = [];
    },
    
    /**
     * Carrega histórico de chat
     */
    async loadChatHistory(limit = 50) {
        if (!this.supabase || !this.activeCampaign) return;
        
        try {
            const { data } = await this.supabase
                .from('campaign_logs')
                .select('*')
                .eq('campaign_id', this.activeCampaign.id)
                .order('created_at', { ascending: false })
                .limit(limit);
            
            this.chatMessages = (data || []).reverse();
            
            // Auto-scroll
            this.$nextTick(() => {
                const container = document.getElementById('chat-container');
                if (container) {
                    container.scrollTop = container.scrollHeight;
                }
            });
        } catch (e) {
            console.error('[NETLINK] Erro ao carregar chat:', e);
        }
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // WHISPER (Mensagem privada GM <-> Player)
    // ─────────────────────────────────────────────────────────────────────────
    
    /**
     * Envia whisper para um jogador específico
     */
    async sendWhisper(targetUserId, content) {
        if (!this.supabase || !this.activeCampaign) return;
        
        try {
            const senderName = this.isGMOfActiveCampaign() ? 'GM' : (this.char?.name || this.settings?.displayName || this.settings?.username || 'Jogador');
            
            const { error } = await this.supabase
                .from('campaign_logs')
                .insert([{
                    campaign_id: this.activeCampaign.id,
                    user_id: this.user.id,
                    sender: senderName,
                    content: content.trim(),
                    type: 'whisper',
                    metadata: {
                        targetUserId,
                        isGM: this.isGMOfActiveCampaign()
                    }
                }]);
            
            if (error) throw error;
            
            playSFX('notification');
            this.notify('Whisper enviado', 'success');
        } catch (e) {
            console.error('[NETLINK] Erro ao enviar whisper:', e);
        }
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // UTILITÁRIOS
    // ─────────────────────────────────────────────────────────────────────────
    
    /**
     * Sai da campanha ativa
     */
    async leaveCampaign() {
        if (!this.activeCampaign) return;
        
        console.log('[NETLINK] Saindo da campanha...');
        
        // Para a música ambiente se estiver tocando
        if (this.ambientMusic.playing) {
            this.stopMusicLocally();
            this.ambientMusic.playing = false;
            this.ambientMusic.url = '';
        }
        
        // Desconecta do realtime
        await this.disconnectRealtime();
        
        // Para o timer se estiver rodando
        this.stopSessionTimer();
        
        // Para o timer de auto-save
        this.stopCampaignAutoSaveTimer();
        
        // Salva alterações pendentes antes de sair
        if (this.campaignCharMode && this.unsavedChanges && this.campaignChangeCount > 0) {
            await this.saveCampaignSheetSilent();
        }
        
        // Limpa estado
        this.activeCampaign = null;
        this.campaignMembers = [];
        this.sessionDiceLog = [];
        this.chatMessages = [];
        this.gmNotes = '';
        this.netlinkView = 'list';
        
        // Volta para dashboard usando router
        router.navigate('dashboard');
        
        // Troca contexto do log de dados de volta para local
        this.switchDiceLogContext();
    },
    
    /**
     * Entra em uma campanha
     */
    async enterCampaign(campaign) {
        // Evita re-entrar na mesma campanha
        if (this.activeCampaign?.id === campaign.id && this.currentView === 'campaign') {
            console.log('[NETLINK] Já está na campanha:', campaign.id);
            return;
        }
        
        this.activeCampaign = campaign;
        
        // Carrega dados da campanha
        await Promise.all([
            this.loadCampaignMembers(campaign.id),
            this.loadChatHistory(),
            this.loadDiceHistory(campaign.id),
            this.connectToRealtime(campaign.id)
        ]);
        
        // Carrega dados específicos do GM
        if (this.isGMOfActiveCampaign()) {
            this.gmNotes = campaign.notes || '';
            this.loadBestiary();           // Carrega NPCs do localStorage
            this.loadCampaignSettings();   // Carrega configurações da campanha
            this.loadPlaylistFromLocal();  // Carrega playlist de músicas
        }
        
        // Troca contexto do log de dados para esta campanha
        this.switchDiceLogContext();
        
        // Inicia timer de auto-save para campanhas
        this.startCampaignAutoSaveTimer();
        this.campaignChangeCount = 0;
        this.campaignLastAutoSave = Date.now();
        
        // Muda para a view da campanha
        this.currentView = 'campaign';
        this.netlinkView = 'campaign';
        
        // Atualiza a URL para permitir compartilhamento via router
        // skipProcess=true para evitar loop infinito (enterCampaign -> navigate -> processRoute -> joinByCode -> enterCampaign)
        if (campaign.invite_code) {
            router.navigate('netlink', campaign.invite_code, false, true);
        }
        
        // Atualiza o título da aba com o NOME da campanha (não o código)
        document.title = `ZENITE OS // ${campaign.name || 'Campanha'}`;
        
        playSFX('success');
    },
    
    /**
     * Fallback robusto para copiar texto para clipboard
     * Funciona em contextos não-seguros (HTTP) e browsers antigos
     */
    async copyToClipboard(text) {
        // Tenta API moderna primeiro
        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch (e) {
                console.warn('[CLIPBOARD] API moderna falhou, tentando fallback:', e);
            }
        }
        
        // Fallback: execCommand (deprecated mas funciona em mais contextos)
        try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            textarea.style.top = '-9999px';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            
            const success = document.execCommand('copy');
            document.body.removeChild(textarea);
            
            if (success) return true;
        } catch (e) {
            console.warn('[CLIPBOARD] Fallback execCommand falhou:', e);
        }
        
        return false;
    },
    
    /**
     * Copia código de convite para clipboard
     */
    async copyInviteCode() {
        if (!this.activeCampaign?.invite_code) return;
        
        const success = await this.copyToClipboard(this.activeCampaign.invite_code);
        if (success) {
            playSFX('success');
            this.notify('Código copiado!', 'success');
        } else {
            // Mostra o código para copiar manualmente
            this.notify(`Código: ${this.activeCampaign.invite_code}`, 'info');
        }
    },
    
    /**
     * Copia link de convite completo para clipboard
     */
    async copyInviteLink() {
        if (!this.activeCampaign?.invite_code) return;
        
        const url = `${window.location.origin}${window.location.pathname}#/netlink/${this.activeCampaign.invite_code}`;
        const success = await this.copyToClipboard(url);
        if (success) {
            playSFX('success');
            this.notify('Link copiado!', 'success');
        } else {
            // Mostra o link para copiar manualmente
            this.notify('Não foi possível copiar. Copie manualmente da barra de endereço.', 'warn');
        }
    },
    
    /**
     * Deleta uma campanha (GM only)
     */
    async deleteCampaign(campaignId) {
        if (!this.supabase || !this.user) return;
        
        try {
            // Verifica se é o GM
            const campaign = this.myCampaigns.find(c => c.id === campaignId);
            if (!campaign || campaign.gm_id !== this.user.id) {
                this.notify('Sem permissão para deletar', 'error');
                return;
            }
            
            // Deleta membros primeiro (cascade pode não estar ativo)
            await this.supabase.from('campaign_members').delete().eq('campaign_id', campaignId);
            await this.supabase.from('campaign_logs').delete().eq('campaign_id', campaignId);
            await this.supabase.from('dice_logs').delete().eq('campaign_id', campaignId);
            
            // Deleta campanha
            const { error } = await this.supabase.from('campaigns').delete().eq('id', campaignId);
            
            if (error) throw error;
            
            // Remove da lista local
            this.myCampaigns = this.myCampaigns.filter(c => c.id !== campaignId);
            
            // Se era a ativa, sai
            if (this.activeCampaign?.id === campaignId) {
                await this.leaveCampaign();
            }
            
            playSFX('success');
            this.notify('Campanha deletada', 'success');
        } catch (e) {
            console.error('[NETLINK] Erro ao deletar campanha:', e);
            this.notify('Erro ao deletar campanha', 'error');
        }
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // BESTIÁRIO DO MESTRE (LOCAL STORAGE)
    // ─────────────────────────────────────────────────────────────────────────
    // NPCs são armazenados localmente por campanha para não sobrecarregar o banco
    // O mestre pode criar, editar e deletar NPCs livremente
    
    /**
     * Carrega o bestiário do localStorage para a campanha atual
     */
    loadBestiary() {
        if (!this.activeCampaign) return;
        
        const key = `zenite_bestiary_${this.activeCampaign.id}`;
        const saved = localStorage.getItem(key);
        this.bestiary = saved ? JSON.parse(saved) : [];
    },
    
    /**
     * Salva o bestiário no localStorage
     */
    saveBestiary() {
        if (!this.activeCampaign) return;
        
        const key = `zenite_bestiary_${this.activeCampaign.id}`;
        localStorage.setItem(key, JSON.stringify(this.bestiary));
    },
    
    /**
     * Abre o modal para criar novo NPC
     */
    openNewNPCModal() {
        this.editingNPC = JSON.parse(JSON.stringify(this.npcTemplate));
        this.editingNPC.id = Date.now().toString();
        this.bestiaryModalOpen = true;
    },
    
    /**
     * Abre o modal para editar NPC existente
     */
    editNPC(npc) {
        this.editingNPC = JSON.parse(JSON.stringify(npc));
        this.bestiaryModalOpen = true;
    },
    
    /**
     * Salva o NPC (novo ou editado)
     */
    saveNPC() {
        if (!this.editingNPC || !this.editingNPC.name.trim()) {
            this.notify('Nome do NPC é obrigatório', 'error');
            return;
        }
        
        const existingIndex = this.bestiary.findIndex(n => n.id === this.editingNPC.id);
        
        if (existingIndex >= 0) {
            // Atualiza existente
            this.bestiary[existingIndex] = this.editingNPC;
        } else {
            // Adiciona novo
            this.bestiary.push(this.editingNPC);
        }
        
        this.saveBestiary();
        this.bestiaryModalOpen = false;
        this.editingNPC = null;
        playSFX('success');
    },
    
    /**
     * Deleta um NPC do bestiário
     */
    deleteNPC(npcId) {
        this.bestiary = this.bestiary.filter(n => n.id !== npcId);
        this.saveBestiary();
        playSFX('click');
    },
    
    /**
     * Duplica um NPC
     */
    duplicateNPC(npc) {
        const copy = JSON.parse(JSON.stringify(npc));
        copy.id = Date.now().toString();
        copy.name = copy.name + ' (cópia)';
        this.bestiary.push(copy);
        this.saveBestiary();
        playSFX('success');
    },
    
    /**
     * Adiciona NPC à iniciativa
     */
    addNPCToInitiative(npc) {
        // Rola iniciativa automaticamente (d20)
        const initRoll = this.cryptoRandom(20);
        this.addToInitiative(npc.name, initRoll, true);
        playSFX('dice');
    },
    
    /**
     * Atualiza PV de um NPC rapidamente
     */
    updateNPCHP(npcId, delta) {
        const npc = this.bestiary.find(n => n.id === npcId);
        if (npc) {
            npc.pv.current = Math.max(0, Math.min(npc.pv.max, npc.pv.current + delta));
            this.saveBestiary();
        }
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // CONFIGURAÇÕES DA CAMPANHA (ARMAZENADAS NO BANCO)
    // ─────────────────────────────────────────────────────────────────────────
    // Configurações são armazenadas na coluna 'settings' da tabela campaigns
    // Isso permite que as configurações sejam compartilhadas entre todos
    
    /**
     * Carrega configurações da campanha do banco de dados
     * A coluna 'settings' da tabela campaigns armazena um JSONB
     */
    loadCampaignSettings() {
        if (!this.activeCampaign) return;
        
        // Carrega do objeto da campanha (já vem do banco)
        const dbSettings = this.activeCampaign.settings || {};
        
        // Merge com valores padrão
        this.campaignSettings = {
            chatEnabled: dbSettings.chatEnabled !== undefined ? dbSettings.chatEnabled : true,
            diceLogEnabled: dbSettings.diceLogEnabled !== undefined ? dbSettings.diceLogEnabled : true,
            imagesEnabled: dbSettings.imagesEnabled !== undefined ? dbSettings.imagesEnabled : true,
        };
    },
    
    /**
     * Salva configurações da campanha no banco de dados
     * Atualiza a coluna 'settings' da tabela campaigns
     */
    async saveCampaignSettings() {
        if (!this.supabase || !this.activeCampaign) return;
        
        // Apenas o GM pode alterar configurações
        if (!this.isGMOfActiveCampaign()) {
            this.notify('Apenas o Mestre pode alterar configurações.', 'error');
            return;
        }
        
        try {
            const { error } = await this.supabase
                .from('campaigns')
                .update({ 
                    settings: this.campaignSettings,
                    updated_at: new Date().toISOString()
                })
                .eq('id', this.activeCampaign.id);
            
            if (error) throw error;
            
            // Atualiza o objeto local também
            this.activeCampaign.settings = { ...this.campaignSettings };
            
            playSFX('save');
            this.notify('Configurações salvas!', 'success');
            
        } catch (e) {
            console.error('[NETLINK] Erro ao salvar configurações:', e);
            this.notify('Erro ao salvar configurações.', 'error');
        }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // MÚSICA AMBIENTE (GM ONLY)
    // ─────────────────────────────────────────────────────────────────────────

    openMusicModal() {
        this.musicModalOpen = true;
    },

    // Extrai o ID do vídeo do YouTube de uma URL
    extractYouTubeId(url) {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    },

    // Inicia/para a música
    toggleMusic() {
        if (!this.ambientMusic.url) {
            this.notify('Insira uma URL do YouTube primeiro!', 'warn');
            return;
        }
        
        const videoId = this.extractYouTubeId(this.ambientMusic.url);
        if (!videoId) {
            this.notify('URL do YouTube inválida!', 'error');
            return;
        }
        
        this.ambientMusic.playing = !this.ambientMusic.playing;
        
        if (this.ambientMusic.playing) {
            // Se já tem URL e player carregado, apenas retoma. Se não, toca nova música
            const player = document.getElementById('ambient-music-player');
            const currentVideoId = this.extractYouTubeId(this.ambientMusic.url);
            const isAlreadyLoaded = player && player.src && player.src.includes(videoId);
            
            if (isAlreadyLoaded) {
                // Retoma música pausada (mantém posição)
                console.log('[MUSIC] Retomando música pausada');
                this.resumeMusicLocally();
            } else {
                // Toca nova música (carrega do início)
                console.log('[MUSIC] Carregando nova música:', videoId);
                this.playMusicLocally(videoId);
            }
            
            // Broadcast para todos os jogadores
            if (this.realtimeChannel) {
                this.realtimeChannel.send({
                    type: 'broadcast',
                    event: 'ambient_music',
                    payload: { 
                        action: 'play',
                        videoId: videoId,
                        volume: this.ambientMusic.volume
                    }
                });
            }
            this.notify('Música ambiente iniciada!', 'success');
        } else {
            // Pausa localmente (mantém src)
            this.stopMusicLocally();
            
            // Pausa a música para todos
            if (this.realtimeChannel) {
                this.realtimeChannel.send({
                    type: 'broadcast',
                    event: 'ambient_music',
                    payload: { action: 'pause' }
                });
            }
            this.notify('Música ambiente pausada.', 'info');
        }
    },
    
    // Toca música localmente (para GM e jogadores)
    playMusicLocally(videoId) {
        const player = document.getElementById('ambient-music-player');
        if (!player) return;
        
        player.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}&enablejsapi=1`;
        player.style.display = 'block';
    },
    
    // Pausa música localmente (mantém src para poder retomar)
    stopMusicLocally() {
        const player = document.getElementById('ambient-music-player');
        if (!player || !player.contentWindow) return;
        
        // Pausa via postMessage ao invés de limpar src
        try {
            player.contentWindow.postMessage(JSON.stringify({
                event: 'command',
                func: 'pauseVideo',
                args: []
            }), '*');
        } catch (e) {
            console.warn('[MUSIC] Erro ao pausar:', e);
            // Fallback: esconde o player mas mantém src
            player.style.display = 'none';
        }
    },
    
    // Resume música localmente
    resumeMusicLocally() {
        const player = document.getElementById('ambient-music-player');
        if (!player || !player.contentWindow) return;
        
        try {
            player.style.display = 'block';
            player.contentWindow.postMessage(JSON.stringify({
                event: 'command',
                func: 'playVideo',
                args: []
            }), '*');
        } catch (e) {
            console.warn('[MUSIC] Erro ao retomar:', e);
        }
    },
    
    // Toca uma música específica (da playlist ou URL)
    playMusicFromUrl(url) {
        const videoId = this.extractYouTubeId(url);
        if (!videoId) {
            this.notify('URL do YouTube inválida!', 'error');
            return;
        }
        
        this.ambientMusic.url = url;
        this.ambientMusic.playing = true;
        
        // Toca localmente
        this.playMusicLocally(videoId);
        
        // Broadcast para jogadores
        if (this.realtimeChannel) {
            this.realtimeChannel.send({
                type: 'broadcast',
                event: 'ambient_music',
                payload: { 
                    action: 'play',
                    videoId: videoId,
                    volume: this.ambientMusic.volume
                }
            });
        }
        
        this.notify('Tocando música!', 'success');
    },
    
    // Alias para uso rápido da playlist (hover button)
    quickPlayMusic(url) {
        this.playMusicFromUrl(url);
    },

    // Atualiza o volume (afeta todos incluindo o mestre)
    updateMusicVolume() {
        console.log('[MUSIC] Atualizando volume para:', this.ambientMusic.volume);
        
        // Atualiza iframe player local via postMessage
        const iframe = document.getElementById('ambient-music-player');
        if (iframe && iframe.contentWindow) {
            this.setIframeVolume(iframe, this.ambientMusic.volume);
        }
        
        // Broadcast para todos os jogadores
        if (this.realtimeChannel && this.ambientMusic.playing) {
            this.realtimeChannel.send({
                type: 'broadcast',
                event: 'ambient_music',
                payload: { 
                    action: 'volume',
                    volume: this.ambientMusic.volume
                }
            });
            console.log('[MUSIC] Volume sincronizado via realtime');
        }
    },
    
    // Formata tempo em minutos:segundos
    formatMusicTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },
    
    // Seek para posição específica (clique na timeline)
    seekMusic(event) {
        if (!this.ambientMusic.playing) {
            console.warn('[MUSIC] Música não está tocando');
            return;
        }
        
        const bar = event.currentTarget;
        const rect = bar.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        const seekTime = percent * (this.ambientMusic.duration || 1);
        
        console.log('[MUSIC] Seeking para:', Math.round(percent * 100), '%', 'Time:', seekTime);
        
        // Seek no iframe via postMessage
        const iframe = document.getElementById('ambient-music-player');
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage(JSON.stringify({
                event: 'command',
                func: 'seekTo',
                args: [seekTime, true]
            }), '*');
        }
        
        this.ambientMusic.currentTime = seekTime;
        
        // Broadcast para todos
        if (this.realtimeChannel) {
            this.realtimeChannel.send({
                type: 'broadcast',
                event: 'ambient_music',
                payload: { 
                    action: 'seek',
                    time: seekTime
                }
            });
        }
    },
    
    // Seek relativo (+/- segundos)
    seekRelative(seconds) {
        if (!this.ambientMusic.playing) return;
        
        const currentTime = this.ambientMusic.currentTime || 0;
        const newTime = Math.max(0, Math.min(currentTime + seconds, this.ambientMusic.duration || 0));
        
        // Seek no iframe via postMessage
        const iframe = document.getElementById('ambient-music-player');
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage(JSON.stringify({
                event: 'command',
                func: 'seekTo',
                args: [newTime, true]
            }), '*');
            this.ambientMusic.currentTime = newTime;
        }
        
        // Broadcast para todos
        if (this.realtimeChannel) {
            this.realtimeChannel.send({
                type: 'broadcast',
                event: 'ambient_music',
                payload: { 
                    action: 'seek',
                    time: newTime
                }
            });
        }
    },
    
    // Atualiza o tempo atual (chamado periodicamente pelo player)
    updateMusicProgress() {
        if (!this.ambientMusic.playing) return;
        
        // Solicita info do iframe via postMessage
        const iframe = document.getElementById('ambient-music-player');
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage(JSON.stringify({
                event: 'listening',
                func: 'getCurrentTime'
            }), '*');
            iframe.contentWindow.postMessage(JSON.stringify({
                event: 'listening',
                func: 'getDuration'
            }), '*');
        }
    },
    
    // ═══════════════════════════════════════════════════════════════════════
    // PLAYLIST DE MÚSICAS
    // ═══════════════════════════════════════════════════════════════════════
    
    addToPlaylist(url, title = '') {
        const videoId = this.extractYouTubeId(url);
        if (!videoId) {
            this.notify('URL do YouTube inválida!', 'error');
            return;
        }
        
        // Verifica se já existe
        if (this.musicPlaylist.some(m => m.id === videoId)) {
            this.notify('Música já está na playlist!', 'warn');
            return;
        }
        
        const music = {
            id: videoId,
            title: title || `Música ${this.musicPlaylist.length + 1}`,
            url: url,
            thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
        };
        
        this.musicPlaylist.push(music);
        this.savePlaylistToLocal();
        this.notify('Música adicionada à playlist!', 'success');
    },
    
    removeFromPlaylist(videoId) {
        this.musicPlaylist = this.musicPlaylist.filter(m => m.id !== videoId);
        this.savePlaylistToLocal();
        this.notify('Música removida da playlist.', 'info');
    },
    
    playFromPlaylist(music) {
        this.playMusicFromUrl(music.url);
    },
    
    savePlaylistToLocal() {
        if (this.activeCampaign) {
            localStorage.setItem(`zenite_playlist_${this.activeCampaign.id}`, JSON.stringify(this.musicPlaylist));
        }
    },
    
    loadPlaylistFromLocal() {
        if (this.activeCampaign) {
            const saved = localStorage.getItem(`zenite_playlist_${this.activeCampaign.id}`);
            if (saved) {
                this.musicPlaylist = JSON.parse(saved);
            } else {
                this.musicPlaylist = [];
            }
        }
    },

    // Handler para receber comandos de música (jogadores)
    handleMusicCommand(payload) {
        // Não processa se não estiver mais na campanha
        if (!this.activeCampaign || this.currentView !== 'campaign') {
            return;
        }
        
        const player = document.getElementById('ambient-music-player');
        if (!player) return;

        switch (payload.action) {
            case 'play':
                // Se já tem a mesma música, apenas retoma
                const currentVideoId = this.extractYouTubeId(this.ambientMusic.url);
                if (currentVideoId === payload.videoId && player.src) {
                    // Retoma música pausada
                    player.style.display = 'block';
                    player.contentWindow?.postMessage(JSON.stringify({
                        event: 'command',
                        func: 'playVideo',
                        args: []
                    }), '*');
                } else {
                    // Carrega nova música
                    player.src = `https://www.youtube.com/embed/${payload.videoId}?autoplay=1&loop=1&playlist=${payload.videoId}&enablejsapi=1`;
                    player.style.display = 'block';
                    this.ambientMusic.url = `https://youtube.com/watch?v=${payload.videoId}`;
                }
                this.ambientMusic.playing = true;
                
                // Aplica volume inicial após carregar
                setTimeout(() => {
                    if (payload.volume !== undefined) {
                        this.setIframeVolume(player, payload.volume);
                    }
                }, 1000);
                break;
            case 'pause':
                player.contentWindow?.postMessage(JSON.stringify({
                    event: 'command',
                    func: 'pauseVideo',
                    args: []
                }), '*');
                this.ambientMusic.playing = false;
                break;
            case 'stop':
                player.src = '';
                player.style.display = 'none';
                this.ambientMusic.playing = false;
                break;
            case 'volume':
                this.setIframeVolume(player, payload.volume);
                break;
            case 'seek':
                this.setIframeSeek(player, payload.time);
                break;
        }
    },
    
    // Envia comando de volume para o iframe via postMessage
    setIframeVolume(iframe, volume) {
        if (!iframe || !iframe.contentWindow) return;
        try {
            iframe.contentWindow.postMessage(JSON.stringify({
                event: 'command',
                func: 'setVolume',
                args: [volume]
            }), '*');
        } catch (e) {
            console.warn('[MUSIC] Erro ao definir volume:', e);
        }
    },
    
    // Envia comando de seek para o iframe via postMessage
    setIframeSeek(iframe, time) {
        if (!iframe || !iframe.contentWindow) return;
        try {
            iframe.contentWindow.postMessage(JSON.stringify({
                event: 'command',
                func: 'seekTo',
                args: [time, true]
            }), '*');
        } catch (e) {
            console.warn('[MUSIC] Erro ao fazer seek:', e);
        }
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // CONVITES DE AMIGOS PARA CAMPANHA
    // ─────────────────────────────────────────────────────────────────────────
    
    // Lista de convites pendentes para campanhas
    pendingCampaignInvites: [],
    
    /**
     * Convida um amigo para a campanha ativa
     * Cria um registro em campaign_members com status 'pending'
     * @param {string} friendUserId - ID do usuário amigo
     */
    async inviteFriendToCampaign(friendUserId) {
        if (!this.supabase || !this.activeCampaign || !this.user) {
            this.notify('Erro: Não foi possível enviar convite.', 'error');
            return false;
        }
        
        // Apenas GM pode convidar
        if (!this.isGMOfActiveCampaign()) {
            this.notify('Apenas o Mestre pode convidar jogadores.', 'error');
            return false;
        }
        
        try {
            // Verifica se já é membro ou tem convite pendente
            const { data: existing } = await this.supabase
                .from('campaign_members')
                .select('id, status')
                .eq('campaign_id', this.activeCampaign.id)
                .eq('user_id', friendUserId)
                .single();
            
            if (existing) {
                if (existing.status === NETLINK_CONFIG.MEMBER_STATUS.ACTIVE) {
                    this.notify('Este jogador já está na campanha.', 'warn');
                } else if (existing.status === NETLINK_CONFIG.MEMBER_STATUS.PENDING) {
                    this.notify('Convite já enviado para este jogador.', 'warn');
                }
                return false;
            }
            
            // Cria convite pendente
            const { error } = await this.supabase
                .from('campaign_members')
                .insert([{
                    campaign_id: this.activeCampaign.id,
                    user_id: friendUserId,
                    role: NETLINK_CONFIG.ROLES.PLAYER,
                    status: NETLINK_CONFIG.MEMBER_STATUS.PENDING,
                    char_data: null
                }]);
            
            if (error) throw error;
            
            playSFX('success');
            this.notify('Convite enviado com sucesso!', 'success');
            
            // Tenta enviar notificação realtime para o amigo
            if (this.realtimeChannel) {
                this.realtimeChannel.send({
                    type: 'broadcast',
                    event: 'campaign_invite',
                    payload: {
                        targetUserId: friendUserId,
                        campaignName: this.activeCampaign.name,
                        campaignId: this.activeCampaign.id,
                        invitedBy: this.settings?.displayName || this.settings?.username || 'Mestre'
                    }
                });
            }
            
            return true;
        } catch (e) {
            console.error('[NETLINK] Erro ao convidar amigo:', e);
            this.notify('Erro ao enviar convite.', 'error');
            return false;
        }
    },
    
    /**
     * Carrega convites pendentes de campanhas para o usuário atual
     */
    async loadPendingCampaignInvites() {
        if (!this.supabase || !this.user) return;
        
        try {
            const { data, error } = await this.supabase
                .from('campaign_members')
                .select(`
                    id,
                    campaign_id,
                    created_at,
                    campaigns:campaign_id (
                        id,
                        name,
                        description,
                        gm_id,
                        invite_code
                    )
                `)
                .eq('user_id', this.user.id)
                .eq('status', NETLINK_CONFIG.MEMBER_STATUS.PENDING);
            
            if (error) throw error;
            
            this.pendingCampaignInvites = (data || []).map(invite => ({
                id: invite.id,
                campaignId: invite.campaign_id,
                campaignName: invite.campaigns?.name || 'Campanha',
                campaignDesc: invite.campaigns?.description || '',
                inviteCode: invite.campaigns?.invite_code,
                createdAt: invite.created_at
            }));
            
            // Se tem convites, mostra notificação
            if (this.pendingCampaignInvites.length > 0) {
                this.notify(`Você tem ${this.pendingCampaignInvites.length} convite(s) de campanha pendente(s)!`, 'info');
            }
        } catch (e) {
            console.error('[NETLINK] Erro ao carregar convites:', e);
        }
    },
    
    /**
     * Aceita um convite de campanha
     * @param {string} inviteId - ID do registro do convite em campaign_members
     */
    async acceptCampaignInvite(inviteId) {
        if (!this.supabase || !this.user) return false;
        
        try {
            // Atualiza status para ativo
            const { error } = await this.supabase
                .from('campaign_members')
                .update({ 
                    status: NETLINK_CONFIG.MEMBER_STATUS.ACTIVE,
                    joined_at: new Date().toISOString()
                })
                .eq('id', inviteId)
                .eq('user_id', this.user.id);
            
            if (error) throw error;
            
            // Remove da lista de pendentes
            const invite = this.pendingCampaignInvites.find(i => i.id === inviteId);
            this.pendingCampaignInvites = this.pendingCampaignInvites.filter(i => i.id !== inviteId);
            
            // Recarrega campanhas
            await this.loadCampaigns();
            
            playSFX('success');
            this.notify('Convite aceito! Você agora faz parte da campanha.', 'success');
            
            // Se temos o código de convite, entra na campanha
            if (invite?.inviteCode) {
                await this.joinByCode(invite.inviteCode);
            }
            
            return true;
        } catch (e) {
            console.error('[NETLINK] Erro ao aceitar convite:', e);
            this.notify('Erro ao aceitar convite.', 'error');
            return false;
        }
    },
    
    /**
     * Recusa um convite de campanha
     * @param {string} inviteId - ID do registro do convite em campaign_members
     */
    async declineCampaignInvite(inviteId) {
        if (!this.supabase || !this.user) return false;
        
        try {
            // Remove o registro de convite
            const { error } = await this.supabase
                .from('campaign_members')
                .delete()
                .eq('id', inviteId)
                .eq('user_id', this.user.id);
            
            if (error) throw error;
            
            // Remove da lista de pendentes
            this.pendingCampaignInvites = this.pendingCampaignInvites.filter(i => i.id !== inviteId);
            
            playSFX('click');
            this.notify('Convite recusado.', 'info');
            
            return true;
        } catch (e) {
            console.error('[NETLINK] Erro ao recusar convite:', e);
            this.notify('Erro ao recusar convite.', 'error');
            return false;
        }
    },
    
    /**
     * Verifica se um amigo pode ser convidado para a campanha atual
     * @param {string} friendUserId - ID do usuário amigo
     * @returns {boolean} true se pode convidar
     */
    canInviteFriend(friendUserId) {
        if (!this.activeCampaign || !this.isGMOfActiveCampaign()) return false;
        
        // Verifica se já é membro
        const isMember = this.campaignMembers?.some(m => m.user_id === friendUserId);
        return !isMember;
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTA CONFIGURAÇÕES PARA USO EXTERNO
// ═══════════════════════════════════════════════════════════════════════════════

export { NETLINK_CONFIG };
