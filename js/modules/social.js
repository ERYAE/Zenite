/**
 * Copyright © 2025 Zenite - Todos os direitos reservados
 * Projeto desenvolvido com assistência de IA
 */

/**
 * ZENITE OS - Social Module
 * Sistema de Amigos, Chat, Achievements e Perfil Público
 * 
 * ARQUITETURA PROFISSIONAL:
 * - Realtime lazy loading (conecta apenas quando necessário)
 * - Cache agressivo com invalidação inteligente
 * - Funções SQL otimizadas (get_friends_full, get_pending_requests, etc)
 * - Chat entre amigos com mensagens não lidas
 * - Sistema de convite para campanha
 * - Performance e segurança em primeiro lugar
 */

import { playSFX } from './audio.js';
import { socialLogger } from './logger.js';

// ═══════════════════════════════════════════════════════════════════════════
// DEFINIÇÃO DE ACHIEVEMENTS (local, sem banco)
// ═══════════════════════════════════════════════════════════════════════════

export const ACHIEVEMENTS = {
    // Rolagens
    first_roll: {
        id: 'first_roll',
        name: 'Primeiro Passo',
        description: 'Role seu primeiro dado',
        icon: 'fa-dice',
        color: 'cyan',
        check: (stats) => stats.totalRolls >= 1
    },
    roll_master: {
        id: 'roll_master',
        name: 'Mestre dos Dados',
        description: 'Role 100 dados',
        icon: 'fa-dice-d20',
        color: 'purple',
        check: (stats) => stats.totalRolls >= 100
    },
    critical_striker: {
        id: 'critical_striker',
        name: 'Golpe Crítico',
        description: 'Tire um crítico natural',
        icon: 'fa-burst',
        color: 'green',
        check: (stats) => stats.criticalRolls >= 1
    },
    critical_legend: {
        id: 'critical_legend',
        name: 'Lenda Crítica',
        description: 'Tire 10 críticos naturais',
        icon: 'fa-crown',
        color: 'gold',
        check: (stats) => stats.criticalRolls >= 10
    },
    fumble_survivor: {
        id: 'fumble_survivor',
        name: 'Sobrevivente',
        description: 'Sobreviva a uma falha crítica',
        icon: 'fa-skull',
        color: 'red',
        check: (stats) => stats.fumbleRolls >= 1
    },
    
    // Personagens
    first_char: {
        id: 'first_char',
        name: 'Nascimento',
        description: 'Crie seu primeiro personagem',
        icon: 'fa-user-plus',
        color: 'cyan',
        check: (stats) => stats.charsCreated >= 1
    },
    collector: {
        id: 'collector',
        name: 'Colecionador',
        description: 'Tenha 5 personagens',
        icon: 'fa-users',
        color: 'purple',
        check: (stats) => stats.charsCreated >= 5
    },
    army_builder: {
        id: 'army_builder',
        name: 'Construtor de Exércitos',
        description: 'Tenha 15 personagens',
        icon: 'fa-people-group',
        color: 'gold',
        check: (stats) => stats.charsCreated >= 15
    },
    
    // Campanhas
    adventurer: {
        id: 'adventurer',
        name: 'Aventureiro',
        description: 'Entre em uma campanha',
        icon: 'fa-dungeon',
        color: 'cyan',
        check: (stats) => stats.campaignsJoined >= 1
    },
    game_master: {
        id: 'game_master',
        name: 'Mestre de Jogo',
        description: 'Crie uma campanha como GM',
        icon: 'fa-chess-king',
        color: 'yellow',
        check: (stats) => stats.campaignsMastered >= 1
    },
    veteran_gm: {
        id: 'veteran_gm',
        name: 'Mestre Veterano',
        description: 'Mestre 5 campanhas',
        icon: 'fa-hat-wizard',
        color: 'gold',
        check: (stats) => stats.campaignsMastered >= 5
    },
    
    // Social
    social_butterfly: {
        id: 'social_butterfly',
        name: 'Borboleta Social',
        description: 'Adicione um amigo',
        icon: 'fa-user-group',
        color: 'pink',
        check: (stats) => stats.friendsCount >= 1
    },
    popular: {
        id: 'popular',
        name: 'Popular',
        description: 'Tenha 10 amigos',
        icon: 'fa-heart',
        color: 'rose',
        check: (stats) => stats.friendsCount >= 10
    },
    
    // Chat
    chatterbox: {
        id: 'chatterbox',
        name: 'Tagarela',
        description: 'Envie 50 mensagens no chat',
        icon: 'fa-comments',
        color: 'cyan',
        check: (stats) => stats.messagesSent >= 50
    },
    
    // Especiais
    night_owl: {
        id: 'night_owl',
        name: 'Coruja Noturna',
        description: 'Jogue entre meia-noite e 4h',
        icon: 'fa-moon',
        color: 'indigo',
        check: (stats) => stats.nightOwl === true
    },
    customizer: {
        id: 'customizer',
        name: 'Estiloso',
        description: 'Mude o tema 3 vezes',
        icon: 'fa-palette',
        color: 'violet',
        check: (stats) => stats.themeChanges >= 3
    },
    
    // ═══════════════════════════════════════════════════════════════════════
    // ACHIEVEMENTS SECRETOS
    // ═══════════════════════════════════════════════════════════════════════
    
    konami_master: {
        id: 'konami_master',
        name: '???',
        description: 'Descubra o código secreto',
        icon: 'fa-gamepad',
        color: 'rainbow',
        secret: true,
        check: (stats) => stats.konamiActivated === true
    },
    system_breaker: {
        id: 'system_breaker',
        name: '???',
        description: 'Quebre o sistema',
        icon: 'fa-bug',
        color: 'red',
        secret: true,
        check: (stats) => stats.systemFailure === true
    },
    hacker_elite: {
        id: 'hacker_elite',
        name: '???',
        description: 'Entre no modo hacker',
        icon: 'fa-terminal',
        color: 'green',
        secret: true,
        check: (stats) => stats.hackerMode === true
    },
    perfectionist: {
        id: 'perfectionist',
        name: 'Perfeccionista',
        description: 'Tenha um personagem nível 10',
        icon: 'fa-star',
        color: 'gold',
        check: (stats) => stats.maxLevel >= 10
    },
    dice_addict: {
        id: 'dice_addict',
        name: 'Viciado em Dados',
        description: 'Role 1000 dados',
        icon: 'fa-dice',
        color: 'rainbow',
        check: (stats) => stats.totalRolls >= 1000
    },
    lucky_seven: {
        id: 'lucky_seven',
        name: '???',
        description: 'Tire 7 críticos seguidos',
        icon: 'fa-clover',
        color: 'green',
        secret: true,
        check: (stats) => stats.maxConsecutiveCrits >= 7
    },
    unlucky: {
        id: 'unlucky',
        name: '???',
        description: 'Tire 5 falhas críticas seguidas',
        icon: 'fa-face-sad-tear',
        color: 'gray',
        secret: true,
        check: (stats) => stats.maxConsecutiveFumbles >= 5
    },
    marathon_player: {
        id: 'marathon_player',
        name: 'Maratonista',
        description: 'Jogue por 5 horas em uma sessão',
        icon: 'fa-clock',
        color: 'blue',
        check: (stats) => stats.longestSession >= 300 // 5h em minutos
    },
    early_bird: {
        id: 'early_bird',
        name: 'Madrugador',
        description: 'Jogue entre 5h e 7h da manhã',
        icon: 'fa-sun',
        color: 'orange',
        check: (stats) => stats.earlyBird === true
    },
    storyteller: {
        id: 'storyteller',
        name: 'Contador de Histórias',
        description: 'Escreva mais de 500 caracteres no histórico de um personagem',
        icon: 'fa-book',
        color: 'amber',
        check: (stats) => stats.longestHistory >= 500
    },
    
    // ═══════════════════════════════════════════════════════════════════════
    // ACHIEVEMENT FINAL - PLATINA
    // ═══════════════════════════════════════════════════════════════════════
    
    platinum: {
        id: 'platinum',
        name: 'PLATINA',
        description: 'Conquiste todos os outros achievements',
        icon: 'fa-trophy',
        color: 'platinum',
        isPlatinum: true,
        check: (stats, unlockedCount, totalCount) => unlockedCount >= totalCount - 1 // Todos exceto a própria platina
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// SOCIAL LOGIC (Amigos, Achievements, Perfil)
// ═══════════════════════════════════════════════════════════════════════════

export const socialLogic = {
    
    // ─────────────────────────────────────────────────────────────────────────
    // ESTADO PRINCIPAL
    // ─────────────────────────────────────────────────────────────────────────
    
    // Amigos (cache local com dados completos)
    friends: [],
    friendRequests: [],
    friendsLoaded: false,
    friendsCacheTimestamp: null,
    friendsCacheTTL: 60000,
    
    // Realtime (lazy loading - conecta apenas quando necessário)
    friendsRealtimeChannel: null,
    chatRealtimeChannel: null,
    realtimeActive: false,
    
    // Chat entre amigos
    activeChatFriendId: null,
    activeChatFriend: null,
    chatMessages: [],
    chatLoading: false,
    chatInput: '',
    unreadCounts: {}, // { friendId: count }
    totalUnreadMessages: 0,
    
    // Convite para campanha
    inviteCampaignModalOpen: false,
    inviteTargetFriend: null,
    availableCampaigns: [],
    
    // Achievements (calculado localmente)
    unlockedAchievements: [],
    achievementsLoaded: false,
    
    // Stats locais
    localStats: {
        totalRolls: 0,
        criticalRolls: 0,
        fumbleRolls: 0,
        consecutiveCrits: 0,
        consecutiveFumbles: 0,
        maxConsecutiveCrits: 0,
        maxConsecutiveFumbles: 0,
        charsCreated: 0,
        maxLevel: 1,
        longestHistory: 0,
        campaignsJoined: 0,
        campaignsMastered: 0,
        messagesSent: 0,
        friendsCount: 0,
        themeChanges: 0,
        nightOwl: false,
        earlyBird: false,
        longestSession: 0,
        konamiActivated: false,
        systemFailure: false,
        hackerMode: false
    },
    
    // Perfil e Modais
    publicProfile: null,
    profileModalOpen: false,
    friendsModalOpen: false,
    achievementsModalOpen: false,
    changelogModalOpen: false,
    chatModalOpen: false,
    viewingProfile: null,
    
    // Username System
    usernameInput: '',
    usernameChecking: false,
    usernameCheckResult: null,
    usernameCheckMessage: '',
    usernameCooldownDays: 0,
    canChangeUsername: true,
    usernameSaving: false,
    
    // Busca de amigos
    friendSearchQuery: '',
    friendSearchLoading: false,
    
    // ─────────────────────────────────────────────────────────────────────────
    // INICIALIZAÇÃO (carrega do localStorage)
    // ─────────────────────────────────────────────────────────────────────────
    
    initSocial() {
        // Prefixo por usuário para evitar conflito entre contas
        const userPrefix = this.user?.id ? `zenite_${this.user.id.slice(0,8)}_` : 'zenite_guest_';
        
        // Carrega stats do localStorage (por usuário)
        const savedStats = localStorage.getItem(`${userPrefix}local_stats`) || localStorage.getItem('zenite_local_stats');
        if (savedStats) {
            this.localStats = { ...this.localStats, ...JSON.parse(savedStats) };
        }
        
        // Carrega achievements desbloqueados (por usuário)
        const savedAchievements = localStorage.getItem(`${userPrefix}achievements`) || localStorage.getItem('zenite_achievements');
        if (savedAchievements) {
            try {
                this.unlockedAchievements = JSON.parse(savedAchievements);
            } catch (e) {
                socialLogger.warn('Erro ao carregar achievements:', e);
                this.unlockedAchievements = [];
            }
        }
        this.achievementsLoaded = true;
        
        // Armazena prefixo para uso posterior
        this._userPrefix = userPrefix;
        
        // Atualiza contagem de personagens
        this.localStats.charsCreated = Object.keys(this.chars || {}).length;
        
        // Verifica se é coruja noturna ou madrugador
        const hour = new Date().getHours();
        if (hour >= 0 && hour < 4) {
            this.localStats.nightOwl = true;
            this.saveLocalStats();
        }
        if (hour >= 5 && hour < 7) {
            this.localStats.earlyBird = true;
            this.saveLocalStats();
        }
        
        // Atualiza stats de personagens
        this.updateCharStats();
        
        // Verifica achievements
        this.checkAchievements();
        
        // Sincroniza com banco de dados (se logado)
        if (this.supabase && this.user) {
            // Carrega stats e achievements do banco em background
            this.loadStatsFromCloud();
            this.loadAchievementsFromCloud();
        }
    },
    
    // Atualiza stats baseadas nos personagens
    updateCharStats() {
        if (!this.chars) return;
        
        const chars = Object.values(this.chars);
        this.localStats.charsCreated = chars.length;
        
        // Encontra maior nível
        let maxLevel = 1;
        let longestHistory = 0;
        
        chars.forEach(char => {
            if (char.level && char.level > maxLevel) {
                maxLevel = char.level;
            }
            if (char.history && char.history.length > longestHistory) {
                longestHistory = char.history.length;
            }
        });
        
        this.localStats.maxLevel = maxLevel;
        this.localStats.longestHistory = longestHistory;
        this.saveLocalStats();
    },
    
    saveLocalStats() {
        const prefix = this._userPrefix || 'zenite_guest_';
        localStorage.setItem(`${prefix}local_stats`, JSON.stringify(this.localStats));
        
        // Sincroniza com banco de dados (debounced)
        this._syncStatsToCloud();
    },
    
    // Debounce para sincronização de stats
    _statsSyncTimer: null,
    
    /**
     * Sincroniza stats com o banco de dados (debounced)
     */
    _syncStatsToCloud() {
        if (!this.supabase || !this.user) return;
        
        // Debounce de 5 segundos para evitar muitas chamadas
        if (this._statsSyncTimer) {
            clearTimeout(this._statsSyncTimer);
        }
        
        this._statsSyncTimer = setTimeout(async () => {
            try {
                // Função SQL aceita stats_data como JSONB
                await this.supabase.rpc('sync_user_stats', {
                    stats_data: {
                        total_rolls: this.localStats.totalRolls || 0,
                        critical_rolls: this.localStats.criticalRolls || 0,
                        fumble_rolls: this.localStats.fumbleRolls || 0,
                        characters_created: this.localStats.charsCreated || 0
                    }
                });
                console.log('[STATS] Sincronizado com banco');
            } catch (e) {
                // Silencioso - stats são secundários
                console.warn('[STATS] Erro ao sincronizar:', e.message);
            }
        }, 5000);
    },
    
    /**
     * Carrega stats do banco de dados
     */
    async loadStatsFromCloud() {
        if (!this.supabase || !this.user) return;
        
        try {
            const { data, error } = await this.supabase.rpc('get_user_stats');
            
            if (error) throw error;
            
            if (data) {
                // Merge com stats locais (mantém o maior valor)
                this.localStats.totalRolls = Math.max(this.localStats.totalRolls || 0, data.total_rolls || 0);
                this.localStats.criticalRolls = Math.max(this.localStats.criticalRolls || 0, data.critical_rolls || 0);
                this.localStats.fumbleRolls = Math.max(this.localStats.fumbleRolls || 0, data.fumble_rolls || 0);
                this.localStats.charsCreated = Math.max(this.localStats.charsCreated || 0, data.characters_created || 0);
                this.localStats.messagesSent = Math.max(this.localStats.messagesSent || 0, data.messages_sent || 0);
                this.localStats.maxLevel = Math.max(this.localStats.maxLevel || 1, data.max_level || 1);
                
                // Booleans - OR
                this.localStats.nightOwl = this.localStats.nightOwl || data.night_owl || false;
                this.localStats.earlyBird = this.localStats.earlyBird || data.early_bird || false;
                this.localStats.hackerMode = this.localStats.hackerMode || data.hacker_mode || false;
                this.localStats.konamiActivated = this.localStats.konamiActivated || data.konami_activated || false;
                this.localStats.systemFailure = this.localStats.systemFailure || data.system_failure || false;
                
                // Salva localmente o merge
                const prefix = this._userPrefix || 'zenite_guest_';
                localStorage.setItem(`${prefix}local_stats`, JSON.stringify(this.localStats));
                
                console.log('[STATS] Carregado do banco');
            }
        } catch (e) {
            console.warn('[STATS] Erro ao carregar do banco:', e.message);
        }
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // ACHIEVEMENTS (com sincronização para banco)
    // ─────────────────────────────────────────────────────────────────────────
    
    // Debounce timer para evitar chamadas múltiplas
    _achievementCheckTimer: null,
    _achievementCheckPending: false,
    
    /**
     * Verifica achievements com debounce para evitar chamadas excessivas
     * @param {boolean} immediate - Se true, executa imediatamente sem debounce
     */
    checkAchievements(immediate = false) {
        // Guard: não verifica se não está logado (evita popups antes do login)
        if (!this.user && !this.isGuest) {
            return [];
        }
        
        // Guard: não verifica antes de carregar do localStorage
        if (!this.achievementsLoaded) {
            console.log('[ACHIEVEMENTS] Aguardando carregamento...');
            return [];
        }
        
        // Debounce: agrupa múltiplas chamadas em uma só
        if (!immediate) {
            if (this._achievementCheckTimer) {
                this._achievementCheckPending = true;
                return [];
            }
            
            this._achievementCheckTimer = setTimeout(() => {
                this._achievementCheckTimer = null;
                if (this._achievementCheckPending) {
                    this._achievementCheckPending = false;
                    this._executeAchievementCheck();
                }
            }, 500); // 500ms debounce
            
            return this._executeAchievementCheck();
        }
        
        return this._executeAchievementCheck();
    },
    
    /**
     * Execução real da verificação de achievements
     * REGRA: Achievement desbloqueado NUNCA mais aparece (como num jogo)
     * @private
     */
    _executeAchievementCheck() {
        let newUnlocks = [];
        const achievements = Object.values(ACHIEVEMENTS);
        const totalCount = achievements.filter(a => !a.isPlatinum).length;
        const currentUnlocked = this.unlockedAchievements.filter(id => id !== 'platinum').length;
        
        const prefix = this._userPrefix || 'zenite_guest_';
        
        achievements.forEach(achievement => {
            // Se já está desbloqueado, NUNCA mostra novamente
            const isUnlocked = this.unlockedAchievements.includes(achievement.id);
            if (isUnlocked) return;
            
            // Platina usa lógica especial
            let shouldUnlock;
            if (achievement.isPlatinum) {
                shouldUnlock = achievement.check(this.localStats, currentUnlocked, totalCount);
            } else {
                shouldUnlock = achievement.check(this.localStats);
            }
            
            if (shouldUnlock) {
                // Adiciona à lista de desbloqueados
                this.unlockedAchievements.push(achievement.id);
                newUnlocks.push(achievement);
                
                // Salva no banco imediatamente
                this._saveAchievementToCloud(achievement.id);
            }
        });
        
        // Salva achievements desbloqueados no localStorage
        localStorage.setItem(`${prefix}achievements`, JSON.stringify(this.unlockedAchievements));
        
        // Notifica apenas achievements realmente novos (com delay entre cada)
        newUnlocks.forEach((achievement, index) => {
            setTimeout(() => {
                this.showAchievementUnlock(achievement);
            }, index * 4500); // 4.5s entre cada para não sobrepor
        });
        
        return newUnlocks;
    },
    
    /**
     * Salva achievement no banco de dados
     * @param {string} achievementId - ID do achievement
     */
    async _saveAchievementToCloud(achievementId) {
        if (!this.supabase || !this.user) return;
        
        try {
            await this.supabase.rpc('save_achievement', {
                achievement_id_param: achievementId,
                metadata_param: {}
            });
            console.log('[ACHIEVEMENTS] Salvo no banco:', achievementId);
        } catch (e) {
            // Silencioso - achievements locais são o fallback
            console.warn('[ACHIEVEMENTS] Erro ao salvar no banco:', e.message);
        }
    },
    
    /**
     * Carrega achievements do banco de dados
     */
    async loadAchievementsFromCloud() {
        if (!this.supabase || !this.user) return;
        
        try {
            const { data, error } = await this.supabase.rpc('get_user_achievements');
            
            if (error) throw error;
            
            if (data && data.length > 0) {
                // Merge com achievements locais
                const cloudAchievements = data.map(a => a.achievement_id);
                const merged = [...new Set([...this.unlockedAchievements, ...cloudAchievements])];
                
                if (merged.length > this.unlockedAchievements.length) {
                    this.unlockedAchievements = merged;
                    const prefix = this._userPrefix || 'zenite_guest_';
                    localStorage.setItem(`${prefix}achievements`, JSON.stringify(this.unlockedAchievements));
                    console.log('[ACHIEVEMENTS] Sincronizado do banco:', merged.length, 'achievements');
                }
            }
        } catch (e) {
            console.warn('[ACHIEVEMENTS] Erro ao carregar do banco:', e.message);
        }
    },
    
    showAchievementUnlock(achievement) {
        playSFX('success');
        
        // Efeito especial para Platina
        if (achievement.isPlatinum) {
            this.triggerPlatinumEffect();
        } else {
            // Cria toast de achievement estilizado
            this.showAchievementToast(achievement);
        }
    },
    
    /**
     * Exibe toast animado para achievement desbloqueado
     * Otimizado para não cortar em telas estreitas
     */
    showAchievementToast(achievement) {
        // Remove toast anterior se existir
        const existingToast = document.getElementById('achievement-toast');
        if (existingToast) existingToast.remove();
        
        const isSecret = achievement.secret;
        const color = achievement.color || 'yellow';
        
        const toast = document.createElement('div');
        toast.id = 'achievement-toast';
        // Usando estilos inline para garantir posicionamento correto mesmo sem classes Tailwind compiladas
        toast.className = 'fixed z-[100000] pointer-events-auto';
        toast.style.cssText = `
            top: 5rem;
            left: 50%;
            transform: translateX(-50%);
            min-width: 320px;
            max-width: 90vw;
        `;
        
        toast.innerHTML = `
            <div class="relative bg-black border-2 border-${color}-500 rounded-2xl p-4 shadow-2xl overflow-hidden" style="background: linear-gradient(135deg, rgba(0,0,0,0.95) 0%, rgba(var(--color-${color}-900), 0.3) 50%, rgba(0,0,0,0.95) 100%);">
                <!-- Glow effect -->
                <div class="absolute inset-0 bg-${color}-500/10 blur-xl"></div>
                
                <!-- Content -->
                <div class="relative flex items-center gap-4 pb-2">
                    <!-- Icon with animation -->
                    <div class="w-16 h-16 rounded-xl bg-${color}-500/20 border-2 border-${color}-400 flex items-center justify-center flex-shrink-0 animate-pulse">
                        <i class="fa-solid ${achievement.icon || 'fa-trophy'} text-3xl text-${color}-300"></i>
                    </div>
                    
                    <!-- Text -->
                    <div class="flex-1 min-w-0">
                        <p class="text-[10px] font-bold uppercase tracking-widest text-${color}-400 mb-1 flex items-center gap-2">
                            ${isSecret ? '<i class="fa-solid fa-key"></i> ACHIEVEMENT SECRETO' : '<i class="fa-solid fa-trophy"></i> ACHIEVEMENT DESBLOQUEADO'}
                        </p>
                        <p class="text-lg font-bold text-white mb-1 leading-tight">${achievement.name}</p>
                        <p class="text-xs text-gray-300 leading-relaxed">${achievement.description}</p>
                    </div>
                </div>
                
                <!-- Progress bar animation (Fixed framing) -->
                <div class="absolute bottom-0 left-0 right-0 h-1.5 bg-${color}-900/50">
                    <div class="h-full bg-${color}-500 achievement-progress shadow-[0_0_10px_rgba(var(--color-${color}-500),0.8)]"></div>
                </div>
            </div>
        `;
        
        // Animação de entrada mais dramática
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-30px) scale(0.9)';
        document.body.appendChild(toast);
        
        // Trigger animação
        requestAnimationFrame(() => {
            toast.style.transition = 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(0) scale(1)';
        });
        
        // Auto-remove após 5 segundos com animação de saída
        setTimeout(() => {
            toast.style.transition = 'all 0.3s ease-in';
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(-30px) scale(0.9)';
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    },
    
    // Efeito especial quando ganha a Platina
    triggerPlatinumEffect() {
        // Cria overlay de celebração
        const overlay = document.createElement('div');
        overlay.className = 'platinum-celebration';
        overlay.innerHTML = `
            <div class="platinum-content">
                <div class="platinum-trophy">
                    <i class="fa-solid fa-trophy"></i>
                </div>
                <h2>PLATINA</h2>
                <p>Todos os achievements conquistados!</p>
            </div>
        `;
        document.body.appendChild(overlay);
        
        // Remove após 4 segundos
        setTimeout(() => {
            overlay.classList.add('fade-out');
            setTimeout(() => overlay.remove(), 500);
        }, 4000);
    },
    
    // Incrementa stats (chamado de outros módulos)
    incrementStat(statName, amount = 1) {
        if (this.localStats[statName] !== undefined) {
            this.localStats[statName] += amount;
            this.saveLocalStats();
            this.checkAchievements();
        }
    },
    
    getAchievementProgress() {
        const total = Object.keys(ACHIEVEMENTS).length;
        const unlocked = this.unlockedAchievements.length;
        return { unlocked, total, percentage: Math.round((unlocked / total) * 100) };
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // SISTEMA DE AMIGOS (Refatorado - Usa funções SQL otimizadas)
    // ─────────────────────────────────────────────────────────────────────────
    
    // Estado de loading de amigos
    friendsLoading: false,
    friendsError: null,
    
    /**
     * Carrega lista completa de amigos com dados do perfil
     * Usa função SQL get_friends_full() para performance
     * Com fallback robusto e tratamento de erros melhorado
     */
    async loadFriends(forceRefresh = false) {
        if (!this.supabase || !this.user) {
            console.warn('[FRIENDS] Supabase ou usuário não disponível');
            return;
        }
        
        const now = Date.now();
        if (this.friendsLoaded && !forceRefresh) {
            const ttl = this.friendsCacheTTL || 0;
            if (this.friendsCacheTimestamp && ttl > 0 && (now - this.friendsCacheTimestamp) < ttl) {
                return;
            }
        }
        
        // Evita chamadas simultâneas
        if (this.friendsLoading) {
            console.log('[FRIENDS] Carregamento já em andamento...');
            return;
        }
        
        this.friendsLoading = true;
        this.friendsError = null;
        
        try {
            let friendsData = null;
            let usedFallback = false;
            
            // Tenta função SQL otimizada primeiro
            try {
                const { data: friends, error: friendsError } = await this.supabase
                    .rpc('get_friends_full');
                
                if (friendsError) {
                    // Verifica se é erro de função não existente
                    const isFunctionMissing = friendsError.message?.includes('function') || 
                                               friendsError.code === '42883' ||
                                               friendsError.code === 'PGRST202';
                    
                    if (isFunctionMissing) {
                        console.warn('[FRIENDS] Função SQL não existe, usando fallback...');
                    } else {
                        console.error('[FRIENDS] Erro na função SQL:', friendsError);
                    }
                    throw friendsError;
                }
                
                friendsData = friends;
            } catch (rpcError) {
                // Fallback para query tradicional
                console.log('[FRIENDS] Usando fallback de query tradicional...');
                usedFallback = true;
                friendsData = await this._loadFriendsDirectQuery();
            }
            
            // Mapeia para formato esperado
            this.friends = (friendsData || []).map(f => ({
                id: f.friendship_id || f.id,
                friendId: f.friend_id || f.friendId,
                username: f.username || 'desconhecido',
                displayName: f.display_name || f.displayName || f.username || 'Usuário',
                avatar: f.avatar_url || f.avatar,
                bio: f.bio || '',
                isOnline: f.is_online || false,
                lastSeen: f.last_seen,
                friendshipDate: f.friendship_date || f.friendshipDate,
                unreadMessages: f.unread_messages || f.unreadMessages || 0,
                achievementsCount: f.achievements_count || f.achievementsCount || 0
            }));
            
            // Calcula total de mensagens não lidas
            this.totalUnreadMessages = this.friends.reduce((sum, f) => sum + (f.unreadMessages || 0), 0);
            
            // Cria mapa de contagem
            this.unreadCounts = {};
            this.friends.forEach(f => {
                if (f.unreadMessages > 0) {
                    this.unreadCounts[f.friendId] = f.unreadMessages;
                }
            });
            
            // Carrega pedidos pendentes
            await this._loadPendingRequests();
            
            this.friendsLoaded = true;
            this.friendsCacheTimestamp = Date.now();
            this.localStats.friendsCount = this.friends.length;
            this.saveLocalStats();
            this.checkAchievements();
            
            if (usedFallback) {
                console.log('[FRIENDS] Carregado via fallback:', this.friends.length, 'amigos');
            } else {
                console.log('[FRIENDS] Carregado via SQL:', this.friends.length, 'amigos');
            }
            
        } catch (e) {
            console.error('[FRIENDS] Erro ao carregar:', e);
            this.friendsError = e.message || 'Erro ao carregar amigos';
            
            // Tenta fallback final
            try {
                await this.loadFriendsFallback();
            } catch (fallbackError) {
                console.error('[FRIENDS] Fallback também falhou:', fallbackError);
                this.friends = [];
                this.friendRequests = [];
            }
        } finally {
            this.friendsLoading = false;
        }
    },
    
    /**
     * Query direta para amigos (usado quando RPC falha)
     * @private
     */
    async _loadFriendsDirectQuery() {
        const { data: friendships, error } = await this.supabase
            .from('friendships')
            .select('id, user_id, friend_id, status, created_at')
            .or(`user_id.eq.${this.user.id},friend_id.eq.${this.user.id}`)
            .eq('status', 'accepted');
        
        if (error) throw error;
        
        // Busca perfis dos amigos
        const friendIds = (friendships || []).map(f => 
            f.user_id === this.user.id ? f.friend_id : f.user_id
        );
        
        if (friendIds.length === 0) return [];
        
        const { data: profiles } = await this.supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url, bio')
            .in('id', friendIds);
        
        const profileMap = {};
        (profiles || []).forEach(p => { profileMap[p.id] = p; });
        
        return (friendships || []).map(f => {
            const friendId = f.user_id === this.user.id ? f.friend_id : f.user_id;
            const profile = profileMap[friendId] || {};
            
            return {
                friendship_id: f.id,
                friend_id: friendId,
                username: profile.username || 'desconhecido',
                display_name: profile.display_name || profile.username || 'Usuário',
                avatar_url: profile.avatar_url,
                bio: profile.bio,
                friendship_date: f.created_at,
                unread_messages: 0,
                achievements_count: 0
            };
        });
    },
    
    /**
     * Carrega pedidos de amizade pendentes
     * @private
     */
    async _loadPendingRequests() {
        try {
            // Tenta RPC primeiro
            const { data: requests, error: requestsError } = await this.supabase
                .rpc('get_pending_requests');
            
            if (!requestsError && requests) {
                socialLogger.info('Pedidos pendentes (RPC):', requests);
                this.friendRequests = requests.map(r => {
                    // DEBUG: Log da estrutura completa
                    if (!r.friendship_id) {
                        console.warn('[FRIENDS] Pedido sem friendship_id:', r);
                    }
                    return {
                        id: r.friendship_id || r.id,
                        senderId: r.sender_id,
                        username: r.username || 'desconhecido',
                        displayName: r.display_name || r.username || 'Usuário',
                        avatar: r.avatar_url,
                        bio: r.bio,
                        sentAt: r.created_at || r.sent_at
                    };
                });
                socialLogger.success(`${this.friendRequests.length} pedidos mapeados`);
                return;
            }
        } catch (e) {
            console.error('[FRIENDS] RPC get_pending_requests falhou:', e);
            console.warn('[FRIENDS] Usando fallback...');
        }
        
        // Fallback: query direta
        try {
            const { data: requests } = await this.supabase
                .from('friendships')
                .select('id, user_id, created_at')
                .eq('friend_id', this.user.id)
                .eq('status', 'pending');
            
            if (!requests || requests.length === 0) {
                this.friendRequests = [];
                return;
            }
            
            // Busca perfis dos remetentes
            const senderIds = requests.map(r => r.user_id);
            const { data: profiles } = await this.supabase
                .from('profiles')
                .select('id, username, display_name, avatar_url')
                .in('id', senderIds);
            
            const profileMap = {};
            (profiles || []).forEach(p => { profileMap[p.id] = p; });
            
            this.friendRequests = requests.map(r => {
                const profile = profileMap[r.user_id] || {};
                return {
                    id: r.id,
                    senderId: r.user_id,
                    username: profile.username || 'desconhecido',
                    displayName: profile.display_name || profile.username || 'Usuário',
                    avatar: profile.avatar_url,
                    sentAt: r.created_at
                };
            });
        } catch (e) {
            console.error('[FRIENDS] Erro ao carregar pedidos pendentes:', e);
            this.friendRequests = [];
        }
    },
    
    /**
     * Fallback caso as funções SQL não existam
     */
    async loadFriendsFallback() {
        try {
            const { data: friendships } = await this.supabase
                .from('friendships')
                .select(`
                    id, user_id, friend_id, status, created_at,
                    profiles!friendships_friend_id_fkey(username, display_name, avatar_url, bio)
                `)
                .or(`user_id.eq.${this.user.id},friend_id.eq.${this.user.id}`)
                .eq('status', 'accepted');
            
            this.friends = (friendships || []).map(f => {
                const isMe = f.user_id === this.user.id;
                const friendId = isMe ? f.friend_id : f.user_id;
                const profile = f.profiles;
                
                return {
                    id: f.id,
                    friendId: friendId,
                    username: profile?.username || 'desconhecido',
                    displayName: profile?.display_name || profile?.username || 'Usuário',
                    avatar: profile?.avatar_url,
                    bio: profile?.bio,
                    friendshipDate: f.created_at,
                    unreadMessages: 0,
                    achievementsCount: 0
                };
            });
            
            // Pedidos pendentes
            const { data: requests } = await this.supabase
                .from('friendships')
                .select(`
                    id, user_id, created_at,
                    profiles!friendships_user_id_fkey(username, display_name, avatar_url)
                `)
                .eq('friend_id', this.user.id)
                .eq('status', 'pending');
            
            this.friendRequests = (requests || []).map(r => ({
                id: r.id,
                senderId: r.user_id,
                username: r.profiles?.username || 'desconhecido',
                displayName: r.profiles?.display_name || r.profiles?.username || 'Usuário',
                avatar: r.profiles?.avatar_url,
                sentAt: r.created_at
            }));
            
            this.friendsLoaded = true;
        } catch (e) {
            console.error('[FRIENDS] Fallback também falhou:', e);
            this.friends = [];
            this.friendRequests = [];
        }
    },
    
    /**
     * Configura subscription realtime para pedidos de amizade
     */
    async setupFriendsRealtime() {
        if (!this.supabase || !this.user) return;
        
        // Remove canal anterior se existir
        if (this.friendsRealtimeChannel) {
            await this.supabase.removeChannel(this.friendsRealtimeChannel);
            this.friendsRealtimeChannel = null;
        }
        
        socialLogger.info('Configurando realtime de amizades para:', this.user.id);
        
        // Ouve TODAS as mudanças na tabela friendships e filtra no cliente
        // Isso é mais confiável que filtros server-side em algumas versões do Supabase
        this.friendsRealtimeChannel = this.supabase
            .channel(`friendships-realtime-${this.user.id}`)
            .on('postgres_changes', 
                { 
                    event: '*', // Ouve INSERT, UPDATE, DELETE
                    schema: 'public', 
                    table: 'friendships'
                },
                (payload) => {
                    socialLogger.info('Mudança em friendships:', payload);
                    
                    const { eventType, new: newRecord, old: oldRecord } = payload;
                    const record = newRecord || oldRecord;
                    
                    // Verifica se a mudança é relevante para este usuário
                    const isRelevant = record && (
                        record.user_id === this.user.id || 
                        record.friend_id === this.user.id
                    );
                    
                    if (!isRelevant) {
                        console.log('[SOCIAL] Mudança não relevante, ignorando');
                        return;
                    }
                    
                    socialLogger.info('Mudança relevante detectada:', eventType);
                    
                    // INSERT = novo pedido de amizade
                    if (eventType === 'INSERT' && record.friend_id === this.user.id && record.status === 'pending') {
                        this.notify('Você recebeu um pedido de amizade!', 'info');
                        playSFX('notification');
                    }
                    
                    // UPDATE = pedido aceito/recusado
                    if (eventType === 'UPDATE') {
                        if (record.status === 'accepted' && record.user_id === this.user.id) {
                            this.notify('Seu pedido de amizade foi aceito!', 'success');
                            playSFX('success');
                        }
                    }
                    
                    // Recarrega lista de amigos em qualquer mudança relevante
                    this.loadFriends(true);
                }
            )
            .subscribe((status, err) => {
                socialLogger.info('Status do canal de amizades:', status);
                if (err) {
                    socialLogger.error('Erro no canal:', err);
                }
                if (status === 'SUBSCRIBED') {
                    console.log('[SOCIAL] ✓ Canal de amizades conectado!');
                }
            });
    },
    
    /**
     * Desconecta do canal realtime de amizades
     */
    async disconnectFriendsRealtime() {
        if (this.friendsRealtimeChannel && this.supabase) {
            await this.supabase.removeChannel(this.friendsRealtimeChannel);
            this.friendsRealtimeChannel = null;
        }
    },
    
    async sendFriendRequest(usernameOrId) {
        if (!this.supabase || !this.user) return;
        
        try {
            // Remove @ se houver e normaliza
            let searchTerm = usernameOrId.trim().replace(/^@/, '').toLowerCase();
            
            if (!searchTerm) {
                this.notify('Digite um username válido.', 'error');
                return;
            }
            
            // USA FUNÇÃO SQL OTIMIZADA com todas as validações
            const { data: result, error } = await this.supabase
                .rpc('send_friend_request', {
                    friend_username: searchTerm
                });
            
            if (error) throw error;
            
            // Processa resultado
            if (result.success) {
                this.notify(result.message || 'Pedido enviado!', 'success');
                playSFX('success');
            } else {
                // Mensagens de erro amigáveis
                const errorMessages = {
                    'user_not_found': 'Usuário não encontrado.',
                    'self_request': 'Você não pode enviar pedido para si mesmo!',
                    'already_exists': 'Já existe um pedido pendente ou vocês já são amigos.',
                    'database_error': 'Erro no banco de dados. Tente novamente.'
                };
                
                const message = errorMessages[result.error] || result.message || 'Erro ao enviar pedido.';
                this.notify(message, result.error === 'already_exists' ? 'warn' : 'error');
            }
            
        } catch (e) {
            socialLogger.error('Erro ao enviar pedido:', e);
            this.notify('Erro ao enviar pedido. Tente novamente.', 'error');
        }
    },
    
    async acceptFriendRequest(requestId) {
        if (!this.supabase) return;
        
        // VALIDAÇÃO CRÍTICA: Verifica se requestId existe
        if (!requestId) {
            console.error('[FRIENDS] acceptFriendRequest chamado com requestId undefined!');
            console.error('[FRIENDS] friendRequests atual:', this.friendRequests);
            this.notify('Erro: ID do pedido inválido.', 'error');
            return;
        }
        
        try {
            socialLogger.info('Aceitando pedido:', requestId);
            
            const { data, error } = await this.supabase
                .rpc('accept_friend_request', { friendship_id: requestId });
            
            if (error) {
                console.error('[FRIENDS] Erro na RPC accept_friend_request:', error);
                throw error;
            }
            
            if (data?.success) {
                this.notify('Amizade aceita!', 'success');
                playSFX('success');
                await this.loadFriends(true);
            } else {
                console.warn('[FRIENDS] RPC retornou success=false:', data);
                this.notify('Pedido não encontrado.', 'warn');
            }
            
        } catch (e) {
            socialLogger.error('Erro ao aceitar:', e);
            this.notify('Erro ao aceitar amizade.', 'error');
        }
    },
    
    async rejectFriendRequest(requestId) {
        if (!this.supabase) return;
        
        // VALIDAÇÃO CRÍTICA: Verifica se requestId existe
        if (!requestId) {
            console.error('[FRIENDS] rejectFriendRequest chamado com requestId undefined!');
            console.error('[FRIENDS] friendRequests atual:', this.friendRequests);
            this.notify('Erro: ID do pedido inválido.', 'error');
            return;
        }
        
        try {
            socialLogger.info('Recusando pedido:', requestId);
            
            const { data, error } = await this.supabase
                .rpc('reject_friend_request', { friendship_id: requestId });
            
            if (error) {
                console.error('[FRIENDS] Erro na RPC reject_friend_request:', error);
                throw error;
            }
            
            if (data?.success) {
                this.notify('Pedido recusado.', 'info');
                await this.loadFriends(true);
            } else {
                console.warn('[FRIENDS] RPC retornou success=false:', data);
                this.notify('Pedido não encontrado.', 'warn');
            }
            
        } catch (e) {
            socialLogger.error('Erro ao recusar:', e);
            this.notify('Erro ao recusar pedido.', 'error');
        }
    },
    
    async removeFriend(friendshipId) {
        if (!this.supabase) return;
        
        try {
            const { data, error } = await this.supabase
                .rpc('remove_friend', { friendship_id: friendshipId });
            
            if (error) throw error;
            
            if (data?.success) {
                this.notify('Amigo removido.', 'info');
                await this.loadFriends(true);
            } else {
                this.notify('Amizade não encontrada.', 'warn');
            }
            
        } catch (e) {
            console.error('[FRIENDS] Erro ao remover:', e);
        }
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // CHAT ENTRE AMIGOS (Whisper/Cochicho)
    // ─────────────────────────────────────────────────────────────────────────
    
    /**
     * Abre chat com um amigo específico
     */
    async openChat(friend) {
        if (!friend?.friendId) return;
        
        this.activeChatFriendId = friend.friendId;
        this.activeChatFriend = friend;
        this.chatMessages = [];
        this.chatInput = '';
        this.chatModalOpen = true;
        this.chatLoading = true;
        
        // Conecta realtime do chat
        await this.setupChatRealtime(friend.friendId);
        
        // Carrega mensagens
        await this.loadChatMessages(friend.friendId);
        
        // Marca mensagens como lidas no banco E atualiza contadores locais
        await this.markMessagesAsRead(friend.friendId);
        
        this.chatLoading = false;
    },
    
    /**
     * Fecha o chat e desconecta realtime
     */
    async closeChat() {
        await this.disconnectChatRealtime();
        this.activeChatFriendId = null;
        this.activeChatFriend = null;
        this.chatMessages = [];
        this.chatModalOpen = false;
    },
    
    /**
     * Carrega mensagens de uma conversa
     */
    async loadChatMessages(friendId, limit = 50) {
        if (!this.supabase || !friendId) return;
        
        try {
            const { data, error } = await this.supabase
                .rpc('get_friend_conversation', {
                    friend_uuid: friendId,
                    msg_limit: limit
                });
            
            if (error) throw error;
            
            // Inverte para ordem cronológica (mais antigas primeiro)
            this.chatMessages = (data || []).reverse().map(m => ({
                id: m.msg_id || m.id,
                content: m.content,
                isMine: m.is_mine !== true,
                createdAt: m.created_at,
                isRead: m.is_read
            }));
            
        } catch (e) {
            console.error('[CHAT] Erro ao carregar mensagens:', e);
            // Fallback
            await this.loadChatMessagesFallback(friendId);
        }
    },
    
    /**
     * Fallback para carregar mensagens
     */
    async loadChatMessagesFallback(friendId) {
        try {
            const { data } = await this.supabase
                .from('friend_messages')
                .select('*')
                .or(`and(sender_id.eq.${this.user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${this.user.id})`)
                .order('created_at', { ascending: true })
                .limit(50);
            
            this.chatMessages = (data || []).map(m => ({
                id: m.id,
                content: m.content,
                isMine: m.sender_id !== this.user.id,
                createdAt: m.created_at,
                isRead: m.is_read
            }));
            
            // Marca mensagens recebidas como lidas
            await this.markMessagesAsRead(friendId);
        } catch (e) {
            console.error('[CHAT] Fallback falhou:', e);
            this.chatMessages = [];
        }
    },
    
    /**
     * Marca todas as mensagens do amigo como lidas
     */
    async markMessagesAsRead(friendId) {
        if (!this.supabase || !friendId) return;
        
        try {
            await this.supabase
                .from('friend_messages')
                .update({ is_read: true })
                .eq('sender_id', friendId)
                .eq('receiver_id', this.user.id)
                .eq('is_read', false);
            
            // Atualiza contadores locais
            if (this.unreadCounts[friendId]) {
                this.totalUnreadMessages -= this.unreadCounts[friendId];
                if (this.totalUnreadMessages < 0) this.totalUnreadMessages = 0;
                this.unreadCounts[friendId] = 0;
            }
            
            // Atualiza o amigo na lista
            const friend = this.friends.find(f => f.friendId === friendId);
            if (friend) friend.unreadMessages = 0;
            
        } catch (e) {
            console.warn('[CHAT] Erro ao marcar como lidas:', e);
        }
    },
    
    /**
     * Envia mensagem para um amigo
     */
    async sendChatMessage() {
        const content = this.chatInput?.trim();
        if (!content || !this.activeChatFriendId || !this.supabase) return;
        
        const friendId = this.activeChatFriendId;
        this.chatInput = '';
        
        // Adiciona mensagem otimista
        const tempId = `temp-${Date.now()}`;
        const optimisticMessage = {
            id: tempId,
            content: content,
            isMine: false,
            createdAt: new Date().toISOString(),
            isRead: false,
            sending: true
        };
        
        this.chatMessages.push(optimisticMessage);
        
        try {
            const { data, error } = await this.supabase
                .rpc('send_friend_message', {
                    receiver: friendId,
                    message_content: content
                });
            
            if (error) throw error;
            
            if (!data?.success) {
                throw new Error(data?.error || 'Erro ao enviar');
            }
            
            // Atualiza mensagem otimista
            const idx = this.chatMessages.findIndex(m => m.id === tempId);
            if (idx !== -1) {
                this.chatMessages[idx].id = data.message_id;
                this.chatMessages[idx].sending = false;
            }
            
            // Incrementa stat
            this.localStats.messagesSent++;
            this.saveLocalStats();
            this.checkAchievements();
            
        } catch (e) {
            console.error('[CHAT] Erro ao enviar:', e);
            
            // Remove mensagem otimista em caso de erro
            const idx = this.chatMessages.findIndex(m => m.id === tempId);
            if (idx !== -1) {
                this.chatMessages.splice(idx, 1);
            }
            
            this.notify('Erro ao enviar mensagem.', 'error');
        }
    },
    
    /**
     * Configura realtime do chat
     */
    async setupChatRealtime(friendId) {
        await this.disconnectChatRealtime();
        
        if (!this.supabase) return;
        
        this.chatRealtimeChannel = this.supabase
            .channel(`chat-${this.user.id}-${friendId}`)
            .on('postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'friend_messages',
                    filter: `receiver_id=eq.${this.user.id}`
                },
                async (payload) => {
                    const msg = payload.new;
                    if (msg.sender_id === friendId) {
                        // Garante que a mensagem é exibida mesmo se o fetch falhar
                        this.chatMessages.push({
                            id: msg.id,
                            content: msg.content,
                            isMine: true,
                            createdAt: msg.created_at,
                            isRead: false
                        });
                        
                        // Atualiza UI scroll
                        this.$nextTick(() => {
                            const container = document.getElementById('chat-messages-container');
                            if (container) container.scrollTop = container.scrollHeight;
                        });

                        // Se o chat estiver aberto, marca como lida imediatamente
                        if (this.chatModalOpen && this.activeChatFriendId === friendId) {
                            playSFX('notification');
                            await this.markMessagesAsRead(friendId);
                        } else {
                            playSFX('notification');
                            // Atualiza contador se o chat não estiver focado
                            this.incrementUnreadCount(friendId);
                        }
                    }
                }
            )
            .on('postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'friend_messages',
                    filter: `sender_id=eq.${this.user.id}` // Minhas mensagens que foram alteradas (lidas)
                },
                (payload) => {
                    const msg = payload.new;
                    // Atualiza status de lido localmente
                    const localMsg = this.chatMessages.find(m => m.id === msg.id);
                    if (localMsg) {
                        localMsg.isRead = msg.is_read;
                    }
                }
            )
            .subscribe();
    },
    
    /**
     * Incrementa contador de não lidas localmente
     */
    incrementUnreadCount(friendId) {
        if (!this.unreadCounts[friendId]) this.unreadCounts[friendId] = 0;
        this.unreadCounts[friendId]++;
        this.totalUnreadMessages++;
        
        // Atualiza na lista de amigos visualmente
        const friend = this.friends.find(f => f.friendId === friendId);
        if (friend) {
            friend.unreadMessages = this.unreadCounts[friendId];
        }
    },
    
    /**
     * Desconecta realtime do chat
     */
    async disconnectChatRealtime() {
        if (this.chatRealtimeChannel && this.supabase) {
            await this.supabase.removeChannel(this.chatRealtimeChannel);
            this.chatRealtimeChannel = null;
        }
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // CONVITE PARA CAMPANHA
    // ─────────────────────────────────────────────────────────────────────────
    
    /**
     * Abre modal de convite para campanha
     */
    async openInviteCampaignModal(friend) {
        if (!friend?.friendId) return;
        
        this.inviteTargetFriend = friend;
        this.availableCampaigns = [];
        this.inviteCampaignModalOpen = true;
        
        // Carrega campanhas onde sou GM
        await this.loadAvailableCampaigns();
    },
    
    /**
     * Carrega campanhas disponíveis para convite
     */
    async loadAvailableCampaigns() {
        if (!this.supabase || !this.user) return;
        
        try {
            const { data, error } = await this.supabase
                .from('campaigns')
                .select('id, name, code, invite_code')
                .eq('gm_id', this.user.id);
            
            if (error) throw error;
            
            this.availableCampaigns = data || [];
        } catch (e) {
            console.error('[INVITE] Erro ao carregar campanhas:', e);
            this.availableCampaigns = [];
        }
    },
    
    /**
     * Envia convite de campanha para amigo
     * Usa função SQL segura para evitar problemas de RLS
     */
    async sendCampaignInvite(campaignId) {
        if (!this.inviteTargetFriend?.friendId || !campaignId) return;
        
        try {
            // Usa função SQL que valida GM e amizade
            const { data, error } = await this.supabase
                .rpc('send_campaign_invite', {
                    campaign_uuid: campaignId,
                    friend_uuid: this.inviteTargetFriend.friendId
                });
            
            if (error) throw error;
            
            if (!data?.success) {
                const errors = {
                    'campaign_not_found': 'Campanha não encontrada.',
                    'not_gm': 'Apenas o GM pode convidar jogadores.',
                    'not_friends': 'Vocês não são amigos.',
                    'already_member': 'Este amigo já está na campanha!'
                };
                this.notify(errors[data?.error] || 'Erro ao enviar convite.', 'warn');
                return;
            }
            
            this.notify(`Convite enviado para ${this.inviteTargetFriend.displayName}!`, 'success');
            playSFX('success');
            
            this.inviteCampaignModalOpen = false;
            this.inviteTargetFriend = null;
            
        } catch (e) {
            console.error('[INVITE] Erro ao enviar convite:', e);
            this.notify('Erro ao enviar convite.', 'error');
        }
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // PERFIL PÚBLICO (cache agressivo)
    // ─────────────────────────────────────────────────────────────────────────
    
    async loadMyProfile() {
        if (!this.supabase || !this.user) return;
        
        // Usa cache se existe
        const cached = localStorage.getItem('zenite_my_profile');
        if (cached) {
            this.publicProfile = JSON.parse(cached);
        }
        
        try {
            const { data } = await this.supabase
                .from('profiles')
                .select('*')
                .eq('id', this.user.id)
                .single();
            
            if (data) {
                this.publicProfile = data;
                localStorage.setItem('zenite_my_profile', JSON.stringify(data));
            }
        } catch (e) {
            socialLogger.error('Erro ao carregar perfil:', e);
        }
    },
    
    async updateProfile(updates) {
        if (!this.supabase || !this.user) return;
        
        try {
            // Se estiver alterando o username, usa a função especial com validação
            if (updates.username && updates.username !== this.publicProfile?.username) {
                const { data: usernameResult, error: usernameError } = await this.supabase
                    .rpc('change_username', { new_username: updates.username });
                
                if (usernameError) throw usernameError;
                
                if (!usernameResult?.success) {
                    this.notify(usernameResult?.error || 'Erro ao alterar username', 'error');
                    return;
                }
            }
            
            // Atualiza outros campos do perfil
            const { error } = await this.supabase
                .from('profiles')
                .update({
                    bio: updates.bio,
                    is_public: updates.isPublic,
                    updated_at: new Date().toISOString()
                })
                .eq('id', this.user.id);
            
            if (error) throw error;
            
            // Atualiza cache
            this.publicProfile = { ...this.publicProfile, ...updates };
            localStorage.setItem('zenite_my_profile', JSON.stringify(this.publicProfile));
            
            this.notify('Perfil atualizado!', 'success');
            playSFX('success');
            
        } catch (e) {
            socialLogger.error('Erro ao atualizar perfil:', e);
            this.notify('Erro ao atualizar perfil.', 'error');
        }
    },
    
    /**
     * Verifica se o username está disponível
     */
    async checkUsernameAvailable(username) {
        if (!this.supabase || !username || username.length < 3) {
            return { available: false, reason: 'Mínimo 3 caracteres' };
        }
        
        try {
            const { data, error } = await this.supabase
                .rpc('is_username_available', { 
                    username_to_check: username
                });
            
            if (error) throw error;
            
            return { 
                available: data, 
                reason: data ? 'Disponível!' : 'Username já em uso' 
            };
        } catch (e) {
            socialLogger.error('Erro ao verificar username:', e);
            return { available: false, reason: 'Erro ao verificar' };
        }
    },
    
    async viewProfile(userId, isFriend = false) {
        if (!this.supabase || !userId) {
            this.notify('Perfil não disponível.', 'warn');
            return;
        }
        
        try {
            // Se é amigo, pode ver mesmo que não seja público
            let query = this.supabase
                .from('profiles')
                .select('*')
                .eq('id', userId);
            
            // Se não é amigo, só mostra perfis públicos
            if (!isFriend) {
                query = query.eq('is_public', true);
            }
            
            const { data, error } = await query.single();
            
            if (error) {
                socialLogger.error('Erro ao buscar perfil:', error);
                this.notify('Erro ao carregar perfil.', 'error');
                return;
            }
            
            if (data) {
                this.viewingProfile = data;
                this.profileModalOpen = true;
            } else {
                this.notify('Perfil não encontrado ou privado.', 'warn');
            }
        } catch (e) {
            socialLogger.error('Erro ao ver perfil:', e);
            this.notify('Erro ao carregar perfil.', 'error');
        }
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // AVATAR UPLOAD
    // ─────────────────────────────────────────────────────────────────────────
    
    async uploadAvatar(event) {
        if (!this.supabase || !this.user) {
            this.notify('Faça login para alterar o avatar.', 'error');
            return;
        }
        
        const file = event.target.files?.[0];
        if (!file) return;
        
        // Validações
        if (!file.type.startsWith('image/')) {
            this.notify('Selecione uma imagem válida.', 'error');
            return;
        }
        
        if (file.size > 2 * 1024 * 1024) { // 2MB max
            this.notify('Imagem muito grande. Máximo 2MB.', 'error');
            return;
        }
        
        try {
            this.notify('Enviando avatar...', 'info');
            
            // Gera nome único para o arquivo
            const fileExt = file.name.split('.').pop();
            const fileName = `${this.user.id}-${Date.now()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;
            
            // Upload para o Supabase Storage
            const { data: uploadData, error: uploadError } = await this.supabase.storage
                .from('avatars')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: true
                });
            
            if (uploadError) {
                socialLogger.error('Erro no upload:', uploadError);
                throw uploadError;
            }
            
            // Obtém URL pública
            const { data: urlData } = this.supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);
            
            const avatarUrl = urlData?.publicUrl;
            
            if (!avatarUrl) {
                throw new Error('Não foi possível obter URL do avatar');
            }
            
            // Atualiza perfil no banco
            const { error: updateError } = await this.supabase
                .from('profiles')
                .update({ avatar_url: avatarUrl })
                .eq('id', this.user.id);
            
            if (updateError) {
                socialLogger.error('Erro ao atualizar perfil:', updateError);
                throw updateError;
            }
            
            // Atualiza estado local
            if (this.publicProfile) {
                this.publicProfile.avatar_url = avatarUrl;
            }
            
            this.notify('Avatar atualizado!', 'success');
            playSFX('success');
            
            // Recarrega perfil
            await this.loadMyProfile();
            
        } catch (e) {
            socialLogger.error('Erro ao fazer upload do avatar:', e);
            this.notify('Erro ao enviar avatar. Tente novamente.', 'error');
        }
        
        // Limpa o input
        event.target.value = '';
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────────────
    
    openFriendsModal() {
        this.loadFriends(true); // Força refresh
        this.friendsModalOpen = true;
    },
    
    openAchievementsModal() {
        this.achievementsModalOpen = true;
    },
    
    async openProfileModal() {
        await this.loadMyProfile();
        await this.loadUsernameCooldown();
        // Inicializa o input com o username atual
        this.usernameInput = this.settings?.username || '';
        this.usernameCheckResult = null;
        this.usernameCheckMessage = '';
        this.profileModalOpen = true;
        this.viewingProfile = null;
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // USERNAME SYSTEM - Sistema completo com cooldown de 14 dias
    // ─────────────────────────────────────────────────────────────────────────
    
    /**
     * Carrega o cooldown de alteração de username
     */
    async loadUsernameCooldown() {
        if (!this.user || !this.supabase) {
            this.usernameCooldownDays = 0;
            this.canChangeUsername = true;
            return;
        }
        
        try {
            const { data, error } = await this.supabase
                .rpc('get_username_cooldown_days');
            
            if (error) {
                console.error('[USERNAME] Erro ao carregar cooldown:', error);
                // Fallback: busca diretamente do profile
                const { data: profile } = await this.supabase
                    .from('profiles')
                    .select('username_changed_at')
                    .eq('id', this.user.id)
                    .single();
                
                if (profile?.username_changed_at) {
                    const lastChange = new Date(profile.username_changed_at);
                    const cooldownEnd = new Date(lastChange.getTime() + (14 * 24 * 60 * 60 * 1000));
                    const now = new Date();
                    
                    if (now < cooldownEnd) {
                        this.usernameCooldownDays = Math.ceil((cooldownEnd - now) / (24 * 60 * 60 * 1000));
                        this.canChangeUsername = false;
                    } else {
                        this.usernameCooldownDays = 0;
                        this.canChangeUsername = true;
                    }
                } else {
                    this.usernameCooldownDays = 0;
                    this.canChangeUsername = true;
                }
                return;
            }
            
            this.usernameCooldownDays = data || 0;
            this.canChangeUsername = (this.usernameCooldownDays === 0);
            console.log('[USERNAME] Cooldown:', this.usernameCooldownDays, 'dias');
        } catch (e) {
            console.error('[USERNAME] Erro ao carregar cooldown:', e);
            this.usernameCooldownDays = 0;
            this.canChangeUsername = true;
        }
    },
    
    /**
     * Verifica se um username está disponível (chamado pelo debounce do input)
     * Funciona tanto para usuários logados quanto durante registro
     */
    async checkUsernameAvailable(username) {
        // Limpa se vazio
        if (!username || username.trim().length === 0) {
            this.usernameCheckResult = null;
            this.usernameCheckMessage = '';
            this.usernameChecking = false;
            return;
        }
        
        const normalized = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
        
        // Validação local primeiro
        if (normalized.length < 2) {
            this.usernameCheckResult = 'invalid';
            this.usernameCheckMessage = 'Mínimo 2 caracteres';
            this.usernameChecking = false;
            return;
        }
        
        if (normalized.length > 20) {
            this.usernameCheckResult = 'invalid';
            this.usernameCheckMessage = 'Máximo 20 caracteres';
            this.usernameChecking = false;
            return;
        }
        
        if (!/^[a-z0-9_]+$/.test(normalized)) {
            this.usernameCheckResult = 'invalid';
            this.usernameCheckMessage = 'Apenas letras, números e _';
            this.usernameChecking = false;
            return;
        }
        
        // Se é o mesmo username atual do usuário logado, não precisa verificar
        if (this.user && normalized === this.settings?.username?.toLowerCase()) {
            this.usernameCheckResult = null;
            this.usernameCheckMessage = '';
            this.usernameChecking = false;
            return;
        }
        
        // Verifica no servidor
        this.usernameChecking = true;
        
        try {
            // Funciona com ou sem usuário logado (para registro)
            if (this.supabase) {
                const { data, error } = await this.supabase
                    .rpc('check_username_available', { 
                        username_to_check: normalized
                    });
                
                if (error) throw error;
                
                if (data === true) {
                    this.usernameCheckResult = 'available';
                    this.usernameCheckMessage = 'Disponível!';
                } else {
                    this.usernameCheckResult = 'taken';
                    this.usernameCheckMessage = 'Já está em uso';
                }
            } else {
                // Modo offline - assume disponível
                this.usernameCheckResult = 'available';
                this.usernameCheckMessage = 'Disponível (offline)';
            }
        } catch (e) {
            console.error('[USERNAME] Erro ao verificar:', e);
            this.usernameCheckResult = null;
            this.usernameCheckMessage = 'Erro ao verificar';
        } finally {
            this.usernameChecking = false;
        }
    },
    
    /**
     * Salva o novo username
     */
    async saveUsername() {
        const username = this.usernameInput?.trim();
        
        if (!username || username.length < 2) {
            this.notify('Username precisa ter pelo menos 2 caracteres!', 'error');
            playSFX('error');
            return;
        }
        
        if (!this.canChangeUsername) {
            this.notify(`Aguarde ${this.usernameCooldownDays} dias para alterar.`, 'warn');
            return;
        }
        
        if (this.usernameCheckResult === 'taken' || this.usernameCheckResult === 'invalid') {
            this.notify('Username inválido ou já em uso!', 'error');
            playSFX('error');
            return;
        }
        
        this.usernameSaving = true;
        
        try {
            if (this.supabase && this.user) {
                const { data, error } = await this.supabase
                    .rpc('change_username', { new_username: username });
                
                if (error) throw error;
                
                if (!data?.success) {
                    this.notify(data?.error || 'Erro ao alterar username', 'error');
                    playSFX('error');
                    return;
                }
                
                // Sucesso!
                this.settings.username = data.username || username.toLowerCase();
                this.saveLocal();
                
                this.notify('Username alterado com sucesso!', 'success');
                playSFX('save');
                
                // Recarrega cooldown e perfil
                await this.loadUsernameCooldown();
                await this.loadMyProfile();
                
                // Reseta estado
                this.usernameCheckResult = null;
                this.usernameCheckMessage = '';
            } else {
                // Modo offline
                this.settings.username = username.toLowerCase();
                this.saveLocal();
                this.notify('Username alterado!', 'success');
                playSFX('save');
            }
        } catch (e) {
            console.error('[USERNAME] Erro ao salvar:', e);
            this.notify('Erro ao alterar username', 'error');
            playSFX('error');
        } finally {
            this.usernameSaving = false;
        }
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // DISPLAY NAME & BIO - Funções de perfil
    // ─────────────────────────────────────────────────────────────────────────
    
    // Estado para controle de edição
    displayNameDirty: false,
    bioDirty: false,
    profileSaving: false,
    
    /**
     * Marca display name como modificado
     */
    markDisplayNameDirty() {
        this.displayNameDirty = true;
    },
    
    /**
     * Marca bio como modificada
     */
    markBioDirty() {
        this.bioDirty = true;
    },
    
    /**
     * Salva display name e bio no perfil do Supabase
     */
    async saveProfile() {
        if (!this.supabase || !this.user) {
            // Modo offline - salva localmente
            this.saveLocal();
            this.displayNameDirty = false;
            this.bioDirty = false;
            this.notify('Perfil salvo localmente!', 'success');
            playSFX('save');
            return true;
        }
        
        this.profileSaving = true;
        
        try {
            const displayName = this.settings?.displayName?.trim() || '';
            const bio = this.settings?.bio?.trim() || '';
            
            // Validação
            if (displayName.length > 30) {
                this.notify('Display name muito longo (máx 30 caracteres)', 'error');
                return false;
            }
            
            if (bio.length > 200) {
                this.notify('Bio muito longa (máx 200 caracteres)', 'error');
                return false;
            }
            
            // Atualiza no Supabase
            const { error } = await this.supabase
                .from('profiles')
                .update({
                    display_name: displayName || null,
                    bio: bio || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', this.user.id);
            
            if (error) throw error;
            
            // Salva localmente também
            this.saveLocal();
            
            // Sincroniza dados gerais
            await this.syncCloud(true);
            
            this.displayNameDirty = false;
            this.bioDirty = false;
            
            this.notify('Perfil salvo!', 'success');
            playSFX('save');
            
            return true;
        } catch (e) {
            console.error('[PROFILE] Erro ao salvar:', e);
            this.notify('Erro ao salvar perfil', 'error');
            playSFX('error');
            return false;
        } finally {
            this.profileSaving = false;
        }
    },
    
    /**
     * Verifica se há alterações não salvas no perfil
     */
    hasUnsavedProfileChanges() {
        return this.displayNameDirty || this.bioDirty;
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // CAMPANHAS - Funções de gerenciamento
    // ─────────────────────────────────────────────────────────────────────────
    
    /**
     * Sai de uma campanha específica
     */
    async leaveCampaign(campaignId) {
        if (!this.supabase || !this.user) return;
        
        // Usa activeCampaign.id como fallback se campaignId não for passado
        const targetId = campaignId || this.activeCampaign?.id;
        
        if (!targetId) {
            console.error('[CAMPAIGN] leaveCampaign chamado sem campaignId e sem activeCampaign');
            this.notify('Erro: Nenhuma campanha selecionada.', 'error');
            return;
        }
        
        try {
            // DELETE direto na tabela
            const { error } = await this.supabase
                .from('campaign_members')
                .delete()
                .eq('campaign_id', targetId)
                .eq('user_id', this.user.id);
            
            if (error) throw error;
            
            this.notify('Você saiu da campanha.', 'success');
            playSFX('save');
            
            // Fecha realtime se estiver na campanha
            if (this.currentCampaignId === campaignId && this.campaignChannel) {
                await this.supabase.removeChannel(this.campaignChannel);
                this.campaignChannel = null;
                this.currentCampaignId = null;
            }
            
            // Recarrega lista de campanhas
            if (typeof this.fetchCampaigns === 'function') {
                await this.fetchCampaigns();
            }
            
            // Navega para NetLink se estava na campanha
            if (window.location.hash.includes('/campaign/')) {
                window.location.hash = '#/netlink';
            }
            
            return true;
        } catch (e) {
            console.error('[CAMPAIGN] Erro ao sair:', e);
            this.notify('Erro ao sair da campanha.', 'error');
            return false;
        }
    },
    
    /**
     * Sai de TODAS as campanhas (exceto as que é GM)
     */
    async leaveAllCampaigns() {
        if (!this.supabase || !this.user) return;
        
        if (!confirm('Tem certeza que deseja sair de TODAS as campanhas?\n\nIsso não afeta campanhas onde você é o Mestre.')) {
            return false;
        }
        
        try {
            const { data, error } = await this.supabase
                .rpc('leave_all_campaigns');
            
            if (error) throw error;
            
            const count = data?.left_count || 0;
            this.notify(`Você saiu de ${count} campanha(s).`, 'success');
            playSFX('save');
            
            // Recarrega
            if (typeof this.fetchCampaigns === 'function') {
                await this.fetchCampaigns();
            }
            
            return true;
        } catch (e) {
            console.error('[CAMPAIGN] Erro ao sair de todas:', e);
            this.notify('Erro ao sair das campanhas.', 'error');
            return false;
        }
    },
    
    /**
     * Deleta TODAS as campanhas onde o usuário é GM
     */
    async deleteAllMyCampaigns() {
        if (!this.supabase || !this.user) return;
        
        if (!confirm('⚠️ ATENÇÃO: Isso vai DELETAR PERMANENTEMENTE todas as campanhas onde você é o Mestre!\n\nTodos os jogadores serão removidos e os dados perdidos.\n\nDigite "DELETAR" para confirmar.')) {
            return false;
        }
        
        const confirmation = prompt('Digite DELETAR para confirmar:');
        if (confirmation !== 'DELETAR') {
            this.notify('Operação cancelada.', 'info');
            return false;
        }
        
        try {
            const { data, error } = await this.supabase
                .rpc('delete_all_my_campaigns');
            
            if (error) throw error;
            
            const count = data?.deleted_count || 0;
            this.notify(`${count} campanha(s) deletada(s) permanentemente.`, 'success');
            playSFX('save');
            
            // Recarrega
            if (typeof this.fetchCampaigns === 'function') {
                await this.fetchCampaigns();
            }
            
            return true;
        } catch (e) {
            console.error('[CAMPAIGN] Erro ao deletar todas:', e);
            this.notify('Erro ao deletar campanhas.', 'error');
            return false;
        }
    }
};
