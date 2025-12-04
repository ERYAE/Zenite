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
        charsCreated: 0,
        campaignsJoined: 0,
        campaignsMastered: 0,
        messagesSent: 0,
        friendsCount: 0,
        themeChanges: 0,
        nightOwl: false
    },
    
    // Perfil
    publicProfile: null,
    profileModalOpen: false,
    friendsModalOpen: false,
    achievementsModalOpen: false,
    viewingProfile: null, // Perfil de outro usuário sendo visualizado
    
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
        
        // Verifica se é coruja noturna
        const hour = new Date().getHours();
        if (hour >= 0 && hour < 4) {
            this.localStats.nightOwl = true;
            this.saveLocalStats();
        }
        
        // Verifica achievements
        this.checkAchievements();
    },
    
    saveLocalStats() {
        localStorage.setItem('zenite_local_stats', JSON.stringify(this.localStats));
    },
    
    // ─────────────────────────────────────────────────────────────────────────
    // ACHIEVEMENTS (100% local, sem banco)
    // ─────────────────────────────────────────────────────────────────────────
    
    checkAchievements() {
        let newUnlocks = [];
        
        Object.values(ACHIEVEMENTS).forEach(achievement => {
            const isUnlocked = this.unlockedAchievements.includes(achievement.id);
            const shouldUnlock = achievement.check(this.localStats);
            
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
        this.notify(`🏆 Achievement: ${achievement.name}!`, 'success');
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
            const { error } = await this.supabase
                .from('profiles')
                .update({
                    username: updates.username,
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
    
    openProfileModal() {
        this.loadMyProfile();
        this.profileModalOpen = true;
        this.viewingProfile = null; // Mostra meu perfil
    }
};
