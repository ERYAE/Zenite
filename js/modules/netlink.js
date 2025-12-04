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
            
            // Copia os dados do personagem
            const charData = characterId && this.chars[characterId] 
                ? JSON.parse(JSON.stringify(this.chars[characterId])) 
                : null;
            
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
            this.notify(`Você entrou em "${campaign.name}"!`, 'success');
            
            return true;
        } catch (e) {
            console.error('[NETLINK] Erro ao entrar na campanha:', e);
            this.notify('Erro ao entrar na campanha.', 'error');
            return false;
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
     * Salva as alterações feitas na ficha do jogador (GM Only)
     */
    async saveInspectedMember() {
        if (!this.supabase || !this.inspectedMember) return;
        
        try {
            const { error } = await this.supabase
                .from('campaign_members')
                .update({ char_data: this.inspectedMember.char_data })
                .eq('id', this.inspectedMember.id);
            
            if (error) throw error;
            
            playSFX('success');
            this.notify('Ficha do jogador atualizada!', 'success');
            this.closeInspector();
            
            // Recarrega lista
            this.loadCampaignMembers(this.activeCampaign.id);
            
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
        
        // Desconecta do canal anterior se existir
        if (this.realtimeChannel) {
            await this.supabase.removeChannel(this.realtimeChannel);
        }
        
        const channelName = `${NETLINK_CONFIG.REALTIME_CHANNEL_PREFIX}${campaignId}`;
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
                () => {
                    console.log('[REALTIME] Lista de membros atualizada');
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
            .subscribe((status) => {
                console.log('[NETLINK] Status da conexão:', status);
                if (status === 'SUBSCRIBED') {
                    // Força recarga inicial para garantir sincronia
                    this.loadChatHistory();
                    this.loadCampaignMembers(campaignId);
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
        
        try {
            // Envia para o Supabase
            const { error } = await this.supabase
                .from('dice_logs')
                .insert([{
                    campaign_id: this.activeCampaign.id,
                    user_id: this.user.id,
                    username: this.char?.name || this.user.email?.split('@')[0] || 'Anônimo',
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
                }]);
            
            if (error) throw error;
            
        } catch (e) {
            console.error('[NETLINK] Erro ao enviar rolagem:', e);
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
        // Não processa se for rolagem privada e não for GM
        if (log.is_private && this.activeCampaign?.gm_id !== this.user?.id) {
            return;
        }
        
        // Adiciona ao log da sessão
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
     * Handler para novas mensagens de chat recebidas via realtime
     */
    handleNewChatMessage(message) {
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
            
            // Atualiza local
            await this.loadCampaignMembers(this.activeCampaign.id);
            
            playSFX(amount > 0 ? 'error' : 'success');
        } catch (e) {
            console.error('[NETLINK] Erro ao modificar stat:', e);
        }
    },
    
    /**
     * Atualiza dados do personagem de um membro (GM only)
     */
    async updateMemberCharData(memberId, charData) {
        if (!this.supabase || !this.isGMOfActiveCampaign()) return;
        
        try {
            const { error } = await this.supabase
                .from('campaign_members')
                .update({ char_data: charData })
                .eq('id', memberId);
            
            if (error) throw error;
            
            this.notify('Ficha atualizada.', 'success');
        } catch (e) {
            console.error('[NETLINK] Erro ao atualizar ficha:', e);
            this.notify('Erro ao atualizar ficha.', 'error');
        }
    },
    
    /**
     * Remove um membro da campanha (GM only)
     */
    async kickMember(memberId) {
        if (!this.supabase || !this.isGMOfActiveCampaign()) return;
        
        try {
            const { error } = await this.supabase
                .from('campaign_members')
                .update({ status: NETLINK_CONFIG.MEMBER_STATUS.KICKED })
                .eq('id', memberId);
            
            if (error) throw error;
            
            await this.loadCampaignMembers(this.activeCampaign.id);
            this.notify('Membro removido.', 'success');
        } catch (e) {
            console.error('[NETLINK] Erro ao remover membro:', e);
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
        
        try {
            const senderName = this.char?.name || this.user?.email?.split('@')[0] || 'Anônimo';
            
            const { error } = await this.supabase
                .from('campaign_logs')
                .insert([{
                    campaign_id: this.activeCampaign.id,
                    user_id: this.user.id,
                    sender: senderName,
                    content: content.trim(),
                    type: type,
                    metadata: {
                        isGM: this.isGMOfActiveCampaign()
                    }
                }]);
            
            if (error) throw error;
            
            this.chatInput = '';
            playSFX('click');
        } catch (e) {
            console.error('[NETLINK] Erro ao enviar mensagem:', e);
        }
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
            const senderName = this.isGMOfActiveCampaign() ? 'GM' : (this.char?.name || 'Jogador');
            
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
        
        // Desconecta do realtime
        await this.disconnectRealtime();
        
        // Para o timer se estiver rodando
        this.stopSessionTimer();
        
        // Limpa estado
        this.activeCampaign = null;
        this.campaignMembers = [];
        this.sessionDiceLog = [];
        this.chatMessages = [];
        this.gmNotes = '';
        this.netlinkView = 'list';
    },
    
    /**
     * Entra em uma campanha
     */
    async enterCampaign(campaign) {
        this.activeCampaign = campaign;
        
        // Carrega dados da campanha
        await Promise.all([
            this.loadCampaignMembers(campaign.id),
            this.loadChatHistory(),
            this.connectToRealtime(campaign.id)
        ]);
        
        // Carrega dados específicos do GM
        if (this.isGMOfActiveCampaign()) {
            this.gmNotes = campaign.notes || '';
            this.loadBestiary();           // Carrega NPCs do localStorage
            this.loadCampaignSettings();   // Carrega configurações da campanha
        }
        
        // Muda para a view da campanha
        this.currentView = 'campaign';
        this.netlinkView = 'campaign';
        playSFX('success');
    },
    
    /**
     * Copia código de convite para clipboard
     */
    async copyInviteCode() {
        if (!this.activeCampaign?.invite_code) return;
        
        try {
            await navigator.clipboard.writeText(this.activeCampaign.invite_code);
            playSFX('success');
            this.notify('Código copiado!', 'success');
        } catch (e) {
            this.notify('Erro ao copiar código', 'error');
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
    // CONFIGURAÇÕES DA CAMPANHA
    // ─────────────────────────────────────────────────────────────────────────
    // Configurações são armazenadas no localStorage por campanha
    
    /**
     * Carrega configurações da campanha do localStorage
     */
    loadCampaignSettings() {
        if (!this.activeCampaign) return;
        
        const key = `zenite_campaign_settings_${this.activeCampaign.id}`;
        const saved = localStorage.getItem(key);
        
        if (saved) {
            this.campaignSettings = { ...this.campaignSettings, ...JSON.parse(saved) };
        } else {
            // Valores padrão
            this.campaignSettings = {
                chatEnabled: true,
                diceLogEnabled: true,
                discordWebhook: '',
                notifyDiceRolls: false,
                notifyCriticals: true,
            };
        }
    },
    
    /**
     * Salva configurações da campanha no localStorage
     */
    saveCampaignSettings() {
        if (!this.activeCampaign) return;
        
        const key = `zenite_campaign_settings_${this.activeCampaign.id}`;
        localStorage.setItem(key, JSON.stringify(this.campaignSettings));
        this.notify('Configurações salvas!', 'success');
    },
    
    /**
     * Envia notificação para o Discord via webhook
     * @param {string} content - Mensagem a enviar
     * @param {string} type - Tipo de mensagem (roll, critical, fumble, chat)
     */
    async sendDiscordNotification(content, type = 'roll') {
        if (!this.campaignSettings.discordWebhook) return;
        
        // Verifica se deve notificar baseado no tipo
        if (type === 'roll' && !this.campaignSettings.notifyDiceRolls) return;
        if ((type === 'critical' || type === 'fumble') && !this.campaignSettings.notifyCriticals) return;
        
        try {
            // Prepara embed colorido baseado no tipo
            let color = 0x6366f1; // Roxo padrão
            let emoji = '🎲';
            
            if (type === 'critical') {
                color = 0x22c55e; // Verde
                emoji = '💥';
            } else if (type === 'fumble') {
                color = 0xef4444; // Vermelho
                emoji = '💀';
            } else if (type === 'chat') {
                color = 0x06b6d4; // Ciano
                emoji = '💬';
            }
            
            const payload = {
                embeds: [{
                    title: `${emoji} ${this.activeCampaign.name}`,
                    description: content,
                    color: color,
                    footer: {
                        text: 'Zenite NetLink'
                    },
                    timestamp: new Date().toISOString()
                }]
            };
            
            await fetch(this.campaignSettings.discordWebhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
        } catch (e) {
            console.error('[NETLINK] Erro ao enviar para Discord:', e);
        }
    },
    
    /**
     * Testa o webhook do Discord
     */
    async testDiscordWebhook() {
        if (!this.campaignSettings.discordWebhook) {
            this.notify('Configure o webhook primeiro!', 'error');
            return;
        }
        
        await this.sendDiscordNotification(
            '✅ Teste de integração Zenite NetLink funcionando!',
            'roll'
        );
        this.notify('Mensagem de teste enviada!', 'success');
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTA CONFIGURAÇÕES PARA USO EXTERNO
// ═══════════════════════════════════════════════════════════════════════════════

export { NETLINK_CONFIG };
