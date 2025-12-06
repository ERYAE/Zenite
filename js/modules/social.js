/**
 * ZENITE OS - Social Module
 * Sistema de Amigos, Achievements e Perfil Público
 * 
 * OTIMIZADO para economizar recursos:
 * - Cache local agressivo
 * - Sync sob demanda
 * - Achievements calculados localmente
 * - Batch operations
 */

import { playSFX } from './audio.js';

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
    // ESTADO
    // ─────────────────────────────────────────────────────────────────────────
    
    // Amigos (cache local)
    friends: [],
    friendRequests: [],
    friendsLoaded: false,
    
    // Achievements (calculado localmente)
    unlockedAchievements: [],
    
    // Stats locais (economiza queries)
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
        longestSession: 0, // minutos
        konamiActivated: false,
        systemFailure: false,
        hackerMode: false
    },
    
    // Perfil
    publicProfile: null,
    profileModalOpen: false,
    friendsModalOpen: false,
    achievementsModalOpen: false,
    viewingProfile: null, // Perfil de outro usuário sendo visualizado
    
    // Username System
    usernameInput: '',           // Input do campo de username
    usernameChecking: false,     // Se está verificando disponibilidade
    usernameCheckResult: null,   // 'available', 'taken', 'invalid', null
    usernameCheckMessage: '',    // Mensagem de feedback
    usernameCooldownDays: 0,     // Dias restantes para poder alterar
    canChangeUsername: true,     // Se pode alterar agora
    usernameSaving: false,       // Se está salvando
    
    // ─────────────────────────────────────────────────────────────────────────
    // INICIALIZAÇÃO (carrega do localStorage)
    // ─────────────────────────────────────────────────────────────────────────
    
    initSocial() {
        // Carrega stats do localStorage
        const savedStats = localStorage.getItem('zenite_local_stats');
        if (savedStats) {
            this.localStats = { ...this.localStats, ...JSON.parse(savedStats) };
        }
        
        // Carrega achievements desbloqueados
        const savedAchievements = localStorage.getItem('zenite_achievements');
        if (savedAchievements) {
            this.unlockedAchievements = JSON.parse(savedAchievements);
        }
        
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
        localStorage.setItem('zenite_local_stats', JSON.stringify(this.localStats));
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // ACHIEVEMENTS (100% local, sem banco)
    // ─────────────────────────────────────────────────────────────────────────
    
    checkAchievements() {
        let newUnlocks = [];
        const achievements = Object.values(ACHIEVEMENTS);
        const totalCount = achievements.filter(a => !a.isPlatinum).length; // Exclui platina da contagem
        const currentUnlocked = this.unlockedAchievements.filter(id => id !== 'platinum').length;
        
        achievements.forEach(achievement => {
            const isUnlocked = this.unlockedAchievements.includes(achievement.id);
            
            // Platina usa lógica especial
            let shouldUnlock;
            if (achievement.isPlatinum) {
                shouldUnlock = achievement.check(this.localStats, currentUnlocked, totalCount);
            } else {
                shouldUnlock = achievement.check(this.localStats);
            }
            
            if (!isUnlocked && shouldUnlock) {
                this.unlockedAchievements.push(achievement.id);
                newUnlocks.push(achievement);
            }
        });
        
        // Salva no localStorage
        localStorage.setItem('zenite_achievements', JSON.stringify(this.unlockedAchievements));
        
        // Notifica novos achievements
        newUnlocks.forEach(achievement => {
            this.showAchievementUnlock(achievement);
        });
        
        return newUnlocks;
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
     */
    showAchievementToast(achievement) {
        // Remove toast anterior se existir
        const existingToast = document.getElementById('achievement-toast');
        if (existingToast) existingToast.remove();
        
        const isSecret = achievement.secret;
        const color = achievement.color || 'yellow';
        
        const toast = document.createElement('div');
        toast.id = 'achievement-toast';
        toast.className = 'fixed top-20 left-1/2 -translate-x-1/2 z-[100000] animate-achievement pointer-events-auto';
        toast.innerHTML = `
            <div class="relative bg-gradient-to-br from-black/95 to-${color}-900/20 border-2 border-${color}-500/50 rounded-2xl p-4 shadow-[0_0_40px_rgba(234,179,8,0.3)] backdrop-blur-xl min-w-[280px] max-w-sm">
                <!-- Glow effect -->
                <div class="absolute inset-0 rounded-2xl bg-gradient-to-r from-${color}-500/10 via-transparent to-${color}-500/10 animate-pulse"></div>
                
                <!-- Content -->
                <div class="relative flex items-center gap-4">
                    <!-- Icon -->
                    <div class="w-14 h-14 rounded-xl bg-gradient-to-br from-${color}-500/30 to-${color}-600/20 border border-${color}-500/50 flex items-center justify-center flex-shrink-0 shadow-[0_0_20px_rgba(234,179,8,0.3)]">
                        <i class="fa-solid ${achievement.icon || 'fa-trophy'} text-2xl text-${color}-400"></i>
                    </div>
                    
                    <!-- Text -->
                    <div class="flex-1 min-w-0">
                        <p class="text-[9px] font-bold uppercase tracking-wider text-${color}-400 mb-1 flex items-center gap-1">
                            ${isSecret ? '<i class="fa-solid fa-key"></i> SECRETO DESBLOQUEADO' : '<i class="fa-solid fa-trophy"></i> ACHIEVEMENT'}
                        </p>
                        <p class="text-sm font-bold text-white truncate">${achievement.name}</p>
                        <p class="text-[10px] text-gray-400 truncate">${achievement.description}</p>
                    </div>
                </div>
                
                <!-- Stars decoration -->
                <div class="absolute -top-2 -right-2 text-yellow-400 animate-ping text-sm">✦</div>
                <div class="absolute -bottom-1 -left-1 text-${color}-400 animate-bounce text-xs">★</div>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // Auto-remove após 4 segundos
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translate(-50%, -20px)';
            toast.style.transition = 'all 0.5s ease-out';
            setTimeout(() => toast.remove(), 500);
        }, 4000);
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
    // AMIGOS (cache local, sync sob demanda)
    // ─────────────────────────────────────────────────────────────────────────
    
    async loadFriends(forceRefresh = false) {
        if (!this.supabase || !this.user) return;
        
        // Usa cache se já carregou
        if (this.friendsLoaded && !forceRefresh) return;
        
        try {
            // Busca amizades aceitas
            const { data: friendships } = await this.supabase
                .from('friendships')
                .select('id, friend_id, user_id, status, created_at')
                .or(`user_id.eq.${this.user.id},friend_id.eq.${this.user.id}`)
                .eq('status', 'accepted');
            
            // Busca perfis dos amigos para obter username e avatar
            if (friendships && friendships.length > 0) {
                const friendIds = friendships.map(f => 
                    f.user_id === this.user.id ? f.friend_id : f.user_id
                );
                
                const { data: profiles } = await this.supabase
                    .from('profiles')
                    .select('id, username, avatar_url')
                    .in('id', friendIds);
                
                // Mapeia os perfis para as amizades
                const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
                
                this.friends = friendships.map(f => {
                    const friendId = f.user_id === this.user.id ? f.friend_id : f.user_id;
                    const profile = profileMap.get(friendId);
                    return {
                        ...f,
                        friend_username: profile?.username || null,
                        friend_display_name: profile?.username || null,
                        friend_avatar: profile?.avatar_url || null
                    };
                });
            } else {
                this.friends = [];
            }
            
            // Busca pedidos pendentes com username do remetente
            const { data: requests } = await this.supabase
                .from('friendships')
                .select('id, user_id, created_at')
                .eq('friend_id', this.user.id)
                .eq('status', 'pending');
            
            // Busca usernames dos remetentes
            if (requests && requests.length > 0) {
                const senderIds = requests.map(r => r.user_id);
                const { data: senderProfiles } = await this.supabase
                    .from('profiles')
                    .select('id, username')
                    .in('id', senderIds);
                
                const senderMap = new Map(senderProfiles?.map(p => [p.id, p.username]) || []);
                
                this.friendRequests = requests.map(r => ({
                    ...r,
                    sender_username: senderMap.get(r.user_id) || null
                }));
            } else {
                this.friendRequests = [];
            }
            
            this.friendsLoaded = true;
            
            // Atualiza stat
            this.localStats.friendsCount = this.friends.length;
            this.saveLocalStats();
            this.checkAchievements();
            
        } catch (e) {
            console.error('[SOCIAL] Erro ao carregar amigos:', e);
        }
    },
    
    async sendFriendRequest(usernameOrId) {
        if (!this.supabase || !this.user) return;
        if (!usernameOrId || usernameOrId.trim().length < 2) {
            this.notify('Digite um username ou ID válido.', 'error');
            return;
        }
        
        try {
            const searchTerm = usernameOrId.trim();
            
            // Primeiro tenta buscar por username (case insensitive)
            let { data: profile } = await this.supabase
                .from('profiles')
                .select('id, username')
                .ilike('username', searchTerm)
                .single();
            
            // Se não encontrou por username, tenta por ID exato
            if (!profile) {
                const { data: profileById } = await this.supabase
                    .from('profiles')
                    .select('id, username')
                    .eq('id', searchTerm)
                    .single();
                profile = profileById;
            }
            
            if (!profile) {
                this.notify('Usuário não encontrado. Verifique o username.', 'error');
                return;
            }
            
            if (profile.id === this.user.id) {
                this.notify('Você não pode adicionar a si mesmo!', 'error');
                return;
            }
            
            // Verifica se já existe amizade
            const { data: existing } = await this.supabase
                .from('friendships')
                .select('id, status')
                .or(`and(user_id.eq.${this.user.id},friend_id.eq.${profile.id}),and(user_id.eq.${profile.id},friend_id.eq.${this.user.id})`);
            
            if (existing && existing.length > 0) {
                const status = existing[0].status;
                if (status === 'accepted') {
                    this.notify('Vocês já são amigos!', 'warn');
                } else {
                    this.notify('Já existe um pedido pendente.', 'warn');
                }
                return;
            }
            
            // Cria o pedido
            const { error } = await this.supabase.from('friendships').insert({
                user_id: this.user.id,
                friend_id: profile.id,
                status: 'pending'
            });
            
            if (error) throw error;
            
            this.notify(`Pedido enviado para ${profile.username || 'usuário'}!`, 'success');
            playSFX('success');
            
        } catch (e) {
            console.error('[SOCIAL] Erro ao enviar pedido:', e);
            this.notify('Erro ao enviar pedido. Tente novamente.', 'error');
        }
    },
    
    async acceptFriendRequest(requestId) {
        if (!this.supabase) return;
        
        try {
            await this.supabase
                .from('friendships')
                .update({ status: 'accepted' })
                .eq('id', requestId);
            
            this.notify('Amizade aceita!', 'success');
            playSFX('success');
            
            // Recarrega lista
            await this.loadFriends(true);
            
        } catch (e) {
            console.error('[SOCIAL] Erro ao aceitar:', e);
        }
    },
    
    async rejectFriendRequest(requestId) {
        if (!this.supabase) return;
        
        try {
            await this.supabase
                .from('friendships')
                .delete()
                .eq('id', requestId);
            
            this.notify('Pedido recusado.', 'info');
            await this.loadFriends(true);
            
        } catch (e) {
            console.error('[SOCIAL] Erro ao recusar:', e);
        }
    },
    
    async removeFriend(friendshipId) {
        if (!this.supabase) return;
        
        try {
            await this.supabase
                .from('friendships')
                .delete()
                .eq('id', friendshipId);
            
            this.notify('Amigo removido.', 'info');
            await this.loadFriends(true);
            
        } catch (e) {
            console.error('[SOCIAL] Erro ao remover amigo:', e);
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
            console.error('[SOCIAL] Erro ao carregar perfil:', e);
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
            console.error('[SOCIAL] Erro ao atualizar perfil:', e);
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
                    new_username: username,
                    current_user_id: this.user?.id || null
                });
            
            if (error) throw error;
            
            return { 
                available: data, 
                reason: data ? 'Disponível!' : 'Username já em uso' 
            };
        } catch (e) {
            console.error('[SOCIAL] Erro ao verificar username:', e);
            return { available: false, reason: 'Erro ao verificar' };
        }
    },
    
    async viewProfile(userId) {
        if (!this.supabase) return;
        
        try {
            const { data } = await this.supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .eq('is_public', true)
                .single();
            
            if (data) {
                this.viewingProfile = data;
                this.profileModalOpen = true;
            } else {
                this.notify('Perfil não encontrado ou privado.', 'warn');
            }
        } catch (e) {
            console.error('[SOCIAL] Erro ao ver perfil:', e);
        }
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────────────
    
    openFriendsModal() {
        this.loadFriends();
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
                .rpc('get_username_cooldown_days', { user_id: this.user.id });
            
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
     */
    async checkUsernameAvailable(username) {
        // Limpa se vazio
        if (!username || username.trim().length === 0) {
            this.usernameCheckResult = null;
            this.usernameCheckMessage = '';
            return;
        }
        
        const normalized = username.trim().toLowerCase();
        
        // Validação local primeiro
        if (normalized.length < 2) {
            this.usernameCheckResult = 'invalid';
            this.usernameCheckMessage = 'Mínimo 2 caracteres';
            return;
        }
        
        if (normalized.length > 20) {
            this.usernameCheckResult = 'invalid';
            this.usernameCheckMessage = 'Máximo 20 caracteres';
            return;
        }
        
        if (!/^[a-z0-9_]+$/.test(normalized)) {
            this.usernameCheckResult = 'invalid';
            this.usernameCheckMessage = 'Apenas letras, números e _';
            return;
        }
        
        // Se é o mesmo username atual, não precisa verificar
        if (normalized === this.settings?.username?.toLowerCase()) {
            this.usernameCheckResult = null;
            this.usernameCheckMessage = '';
            return;
        }
        
        // Verifica no servidor
        this.usernameChecking = true;
        
        try {
            if (this.supabase && this.user) {
                const { data, error } = await this.supabase
                    .rpc('check_username_available', { 
                        check_username: normalized,
                        current_user_id: this.user.id 
                    });
                
                if (error) throw error;
                
                if (data) {
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
    }
};
