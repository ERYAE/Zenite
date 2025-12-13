/**
 * Copyright © 2025 Zenite - Todos os direitos reservados
 * Projeto desenvolvido com assistência de IA
 */

import Alpine from 'alpinejs';
import focus from '@alpinejs/focus';

Alpine.plugin(focus);
window.Alpine = Alpine;

import { CONSTANTS, ARCHETYPES } from './modules/config.js';
import { playSFX, setSfxEnabled, initAudio } from './modules/audio.js';
import { debounce, sanitizeChar, calculateBaseStats } from './modules/utils.js';
import { rpgLogic } from './modules/rpg.js';
import { cloudLogic } from './modules/cloud.js';
import { uiLogic } from './modules/ui.js';
import { netlinkLogic } from './modules/netlink.js';
import { socialLogic, ACHIEVEMENTS } from './modules/social.js';
import { router } from './modules/router.js';
import { logger } from './modules/logger.js';
import { hasNewUpdate, markUpdateSeen, hasNewChangelogAsync, markChangelogSeenAsync } from './modules/changelog.js';
import { loadUserPreferences, clearPreferencesCache } from './modules/preferences.js';
import './modules/notifications.js'; // Sistema de notificações (NotificationCenter global)
import { realtimeManager } from './modules/realtime-manager.js'; // Gerenciamento de conexões Realtime
import { compressForUpload } from './modules/image-compression.js'; // Compressão de imagens

function zeniteSystem() {
    return {
        // --- ESTADO DO SISTEMA ---
        // ⚠️ v2.3.0 - Loading com progresso real
        // Em js/app.js, dentro de Alpine.data('zeniteSystem', () => ({ ..
        migrationModalOpen: false, 
        systemLoading: true, 
        loadingProgress: 0, 
        loadingText: 'INITIALIZING',
        loadingStage: 'init', // 'init', 'auth', 'sync', 'load', 'ready'
        loadingChar: false, 
        rebooting: false,
        isOffline: false, // Modo offline (sem conexão)
        
        // NetLink sempre habilitado
        netlinkEnabled: true,
        
        // Timer para sync de vitais
        _vitalStatsTimer: null,
        
        // Auth
        user: null, isGuest: false, userMenuOpen: false, 
        authLoading: false, authMsg: '', authMsgType: '',
        authMode: 'login', // 'login', 'register', 'forgot'
        authEmail: '', authPassword: '', authPasswordConfirm: '', authUsername: '',
        recoverMode: false, // Password reset mode (from email link)
        newPassword: '', newPasswordConfirm: '', // For password reset
        currentPassword: '', // For secure password change (requires verification)
        
        // Verificação de username
        usernameChecking: false,
        usernameCheckResult: null, // 'available', 'taken', null
        
        // Navegação
        currentView: 'dashboard', activeTab: 'profile', logisticsTab: 'inventory',
        searchQuery: '', viewMode: 'grid',
        dashboardPageSize: 50,
        dashboardVisibleCount: 50,
        
        // Dados
        chars: {}, activeCharId: null, char: null, agentCount: 0,
        profile: null, // Perfil do Supabase (inclui username_changed_at)
        
        // ═══════════════════════════════════════════════════════════════════════
        // CONFIGURAÇÕES DO USUÁRIO
        // ═══════════════════════════════════════════════════════════════════════
        // IMPORTANTE: sfxEnabled começa FALSE por padrão (usuários reclamaram)
        settings: { 
            compactMode: false, 
            crtMode: false, 
            sfxEnabled: true, 
            lowPerfMode: false, // Modo de performance para PCs antigos
            themeColor: 'cyan',
            username: '', // Nome de usuário único (14 dias cooldown)
            displayName: '', // Nome de exibição (alterável a qualquer momento)
            bio: '', // Biografia do usuário
            dashboardView: 'grid', // 'grid', 'list', 'compact'
            dashboardSort: 'recent' // 'recent', 'name', 'class', 'level'
        },
        
        // Macros de Dados
        diceMacros: [], // Array de macros: { id, name, dice, modifier, description }
        macrosModalOpen: false,
        editingMacro: null, // Macro sendo editada
        
        // Música Ambiente (GM)
        ambientMusic: {
            url: '',
            playing: false,
            volume: 50,
            currentTime: 0, // Tempo atual do vídeo
            duration: 0 // Duração total
        },
        musicModalOpen: false,
        musicPlaylist: [], // Array: { id, title, url, thumbnail }
        playlistModalOpen: false,
        
        // Wizard
        wizardOpen: false, wizardStep: 1, wizardPoints: 8, 
        wizardNameError: false, wizardFocusAttr: '',
        wizardData: { class: '', name: '', identity: '', age: '', history: '', photo: null, attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} },
        
        // UI / Modais
        notifications: [], configModal: false, confirmOpen: false,
        confirmData: { title:'', desc:'', action:null, type:'danger' },
        accountSettingsOpen: false, // Account Settings Modal
        welcomeModal: false, // Modal de boas-vindas
        historyModal: false,
        usernameModalOpen: false, // Modal para forçar username
        tempUsername: '', // Username temporário para o modal
        
        // Notificações (histórico)
        notificationPanelOpen: false,
        notificationHistory: [],
        notificationUnreadCount: 0,
        _notificationPollingTimer: null,
        
        // Chat flutuante
        chatPanelOpen: false,
        
        netlinkModal: false, // Modal do NetLink
        netlinkCreateMode: false, // Modo de criação de campanha
        netlinkJoinCode: '', // Código de convite para entrar
        wizardFromNetlink: false, // Se o wizard foi aberto a partir do NetLink
        memberInspectorOpen: false, // Modal de inspeção de jogador
        inspectedMember: null, // Membro sendo inspecionado
        netlinkView: 'list', // 'list' ou 'campaign'
        playerSheetOpen: false, // Modal para jogador ver sua ficha na campanha
        unsavedChanges: false, 
        isSyncing: false, 
        saveStatus: 'idle',
        revertConfirmMode: false, 
        shakeAlert: false, 
        isReverting: false,
        autoSaveEnabled: false, // NOVO: Controle manual do auto-save
        lastManualSave: null,
        
        // ═══════════════════════════════════════════════════════════════════════
        // SMART AUTO-SAVE PARA CAMPANHAS
        // Salva automaticamente após X alterações ou Y minutos
        // ═══════════════════════════════════════════════════════════════════════
        campaignChangeCount: 0, // Contador de alterações na campanha
        campaignLastAutoSave: null, // Timestamp do último auto-save
        campaignAutoSaveThreshold: 5, // Salva após 5 alterações
        campaignAutoSaveInterval: 3 * 60 * 1000, // Salva a cada 3 minutos
        
        // Modal de seleção de personagem para campanhas
        characterSelectModalOpen: false,
        characterSelectCampaign: null,
        selectedCharForCampaign: null,
        pendingCampaign: null,
        
        // Emotes
        emotesModalOpen: false,
        emoteCategories: [
            { id: 'faces', name: 'Rostos', emotes: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐'] },
            { id: 'emotions', name: 'Emoções', emotes: ['😤', '😠', '😡', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '🙈', '🙉', '🙊'] },
            { id: 'gestures', name: 'Gestos', emotes: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '🦾', '🦿'] },
            { id: 'rpg', name: 'RPG', emotes: ['⚔️', '🗡️', '🛡️', '🏹', '🪓', '🔮', '📜', '📖', '🎲', '🎯', '💎', '👑', '🏰', '🐉', '🧙', '🧝', '🧛', '🧟', '🧞', '🧜', '🦹', '🦸', '🧚', '🔥', '❄️', '⚡', '💫', '✨', '💥', '💢', '💦', '💨', '🌟', '⭐', '🌙', '☀️'] },
            { id: 'objects', name: 'Objetos', emotes: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '🎁', '🎉', '🎊', '🎈', '🏆', '🥇', '🥈', '🥉', '🎮', '🕹️', '🎰', '🎭', '🎨', '🎬', '🎤', '🎧', '🎵', '🎶', '🎼'] }
        ],
        selectedEmoteCategory: 'faces',
        
        // Username
        usernameCheckStatus: '', // '', 'checking', 'available', 'taken', 'error'
        usernameCheckMessage: '',
        canEditUsername: true, // Se passou cooldown de 14 dias
        daysUntilUsernameChange: 0,
        
        // ═══════════════════════════════════════════════════════════════════════
        // FERRAMENTAS E DADOS
        // ═══════════════════════════════════════════════════════════════════════
        cropperOpen: false, cropperInstance: null, uploadContext: 'char', cropperMode: 'upload', originalCropImage: null,
        
        // Modo de visualização de ficha de campanha (GM vê ficha de jogador)
        campaignCharMode: false,  // true = visualizando ficha de membro
        campaignCharBackup: null, // backup da ficha local antes de entrar no modo
        campaignMemberId: null,   // ID do membro sendo visualizado
        
        diceTrayOpen: false, trayDockMode: 'float', 
        // Posição inicial segura - será recalculada ao abrir
        trayPosition: { x: 100, y: 100 },
        isDraggingTray: false, showDiceTip: false, hasSeenDiceTip: false,
        diceLog: [], lastRoll: '--', lastNatural: 0, lastFaces: 20, diceMod: 0, diceReason: '',
        diceLogModalOpen: false, diceLogModalMember: null, // Modal de histórico de rolagens
        
        // ═══════════════════════════════════════════════════════════════════════
        // DADOS DO GM (LOCAL ONLY)
        // ═══════════════════════════════════════════════════════════════════════
        // Rolagens do GM ficam apenas localmente, não vão para o log da campanha
        gmLocalDiceLog: [],
        gmDiceFaces: 20,
        gmDiceMod: 0,
        
        // ═══════════════════════════════════════════════════════════════════════
        // BESTIÁRIO DO MESTRE
        // ═══════════════════════════════════════════════════════════════════════
        // NPCs são armazenados no localStorage, organizados por campanha
        // Cada mestre pode criar seus próprios NPCs customizados
        bestiary: [],
        bestiaryModalOpen: false,
        editingNPC: null, // NPC sendo editado no modal
        npcTemplate: {
            id: null,
            name: '',
            type: 'enemy', // enemy, ally, neutral
            pv: { current: 10, max: 10 },
            pf: { current: 5, max: 5 },
            pdf: { current: 5, max: 5 },
            defesa: 10,
            notes: '',
            tags: []
        },
        
        // ═══════════════════════════════════════════════════════════════════════
        // CONFIGURAÇÕES DA CAMPANHA (POR CAMPANHA)
        // ═══════════════════════════════════════════════════════════════════════
        // Cada campanha pode ter configurações específicas
        // Armazenadas em localStorage por campanha
        campaignSettingsOpen: false,
        campaignSettings: {
            chatEnabled: true,       // Se o chat está habilitado
            diceLogEnabled: true,    // Se os dados ficam no log público
            imagesEnabled: true,     // Se permite compartilhar imagens no chat
        },
        
        // Histórico - NOVO
        saveHistory: [],
        
        // Minigame & Falhas
        systemFailure: false, minigameActive: false, minigameClicks: 5, minigamePos: {x:50, y:50},
        
        // Hacks & Segredos
        isHackerMode: false, hackerModeUnlocked: false, konamiBuffer: [], logoClickCount: 0, logoClickTimer: null,
        
        // Auxiliares
        isMobile: window.innerWidth < 768,
        mobileWarningDismissed: false,
        modalClickStartedOutside: false, // Para controle de fechamento de modais
        supabase: null, debouncedSaveFunc: null,
        archetypes: ARCHETYPES,
        _listeners: [],
        
        // ═══════════════════════════════════════════════════════════════════════
        // ÚLTIMA ROLAGEM DO JOGADOR (para exibir na tela)
        // ═══════════════════════════════════════════════════════════════════════
        playerLastRoll: null, // {formula, natural, modifier, total, isCrit, isFumble, reason, timestamp}
        
        // ═══════════════════════════════════════════════════════════════════════
        // CHANGELOG MODAL
        // ═══════════════════════════════════════════════════════════════════════
        changelogModalOpen: false,
        hasUnseenChangelog: false, // Badge "NEW" no menu

        // Módulos
        ...rpgLogic,
        ...cloudLogic,
        ...uiLogic,
        ...netlinkLogic,
        ...socialLogic,
        
        // Achievements disponíveis (referência)
        ACHIEVEMENTS,

        // --- COMPUTEDS ---
        get filteredChars() {
            if (!this.searchQuery) return this.chars;
            const q = this.searchQuery.toLowerCase();
            const result = {};
            Object.keys(this.chars).forEach(id => {
                const c = this.chars[id];
                if ((c.name && c.name.toLowerCase().includes(q)) || (c.class && c.class.toLowerCase().includes(q))) {
                    result[id] = c;
                }
            });
            return result;
        },
        
        // Chars ordenados baseado na configuração do usuário
        get sortedChars() {
            const chars = this.filteredChars;
            const entries = Object.entries(chars);
            const sortMode = this.settings?.dashboardSort || 'recent';
            
            entries.sort(([idA, a], [idB, b]) => {
                switch (sortMode) {
                    case 'name':
                        return (a.name || '').localeCompare(b.name || '');
                    case 'class':
                        return (a.class || '').localeCompare(b.class || '');
                    case 'level':
                        return (b.level || 1) - (a.level || 1);
                    case 'recent':
                    default:
                        // IDs mais recentes primeiro (z_timestamp)
                        return idB.localeCompare(idA);
                }
            });
            
            return Object.fromEntries(entries);
        },
        
        get limitedSortedChars() {
            const entries = Object.entries(this.sortedChars);
            if (!this.dashboardVisibleCount || this.dashboardVisibleCount >= entries.length) {
                return Object.fromEntries(entries);
            }
            const limited = entries.slice(0, this.dashboardVisibleCount);
            return Object.fromEntries(limited);
        },
        
        // NOTA: canChangeUsername e usernameCooldownDays são propriedades 
        // definidas em social.js e carregadas via loadUsernameCooldown()

        // --- INICIALIZAÇÃO ---
        async initSystem() {
            this.loadingProgress = 20;
            
            // Inicializa Audio Context no primeiro clique
            document.body.addEventListener('click', () => initAudio(), { once: true });

            this.setupListeners();

            if (typeof window.supabase !== 'undefined') {
                this.supabase = window.supabase.createClient(CONSTANTS.SUPABASE_URL, CONSTANTS.SUPABASE_KEY);
            }

            if ('serviceWorker' in navigator) {
                try {
                    navigator.serviceWorker.register('/sw.js');
                } catch (err) {
                    logger.warn('SW', 'Failed to register service worker:', err);
                }
            }

            // CORREÇÃO: Auto-Save agora é MANUAL por padrão
            // Usuário precisa clicar no botão SALVAR
            this.debouncedSaveFunc = debounce(async () => {
                if (!this.autoSaveEnabled) return; // Respeita o controle manual
                
                await this.saveLocal();
                
                if (!this.isGuest && this.user) {
                    await this.syncCloud(true);
                    playSFX('save');
                }
                
                this.isSyncing = false;
                this.unsavedChanges = false;
                this.autoSaveEnabled = false; // Desativa após salvar
            }, 3000); // Aumentado para 3s

            // ⚠️ v2.3.0 - Loading com progresso real
            // Etapa 1: INIT (0-20%)
            this.updateLoading(10, 'INITIALIZING', 'init');
            
            // Carrega Banco de Dados
            const isGuest = localStorage.getItem('zenite_is_guest') === 'true';
            if (isGuest) {
                this.isGuest = true;
                this.loadLocal('zenite_guest_db');
                this.updateLoading(20, 'OFFLINE MODE', 'init');
            } else {
                this.loadLocal('zenite_cached_db');
                this.updateLoading(20, 'CACHE LOADED', 'init');
                
                if(this.supabase) {
                    try {
                        // Etapa 2: AUTH (20-40%)
                        this.updateLoading(25, 'AUTHENTICATING', 'auth');
                        const { data: { session } } = await this.supabase.auth.getSession();
                        
                        if (session) {
                            this.user = session.user;
                            this.updateLoading(40, 'AUTHENTICATED', 'auth');
                            
                            // Etapa 3: SYNC (40-70%)
                            this.updateLoading(45, 'SYNCING CLOUD', 'sync');
                            await this.fetchCloud();
                            this.updateLoading(60, 'CLOUD SYNCED', 'sync');
                            
                            this.checkOnboarding();
                            
                            // Etapa 4: LOAD (70-90%)
                            this.updateLoading(70, 'LOADING FRIENDS', 'load');
                            try {
                                await this.setupFriendsRealtime();
                            } catch (friendsErr) {
                                logger.error('FRIENDS', 'Erro ao configurar realtime:', friendsErr);
                            }
                            this.updateLoading(80, 'CHECKING DATA', 'load');
                            try {
                                await this.autoCloudCheck();
                            } catch (checkErr) {
                                logger.error('CLOUD', 'Erro ao verificar dados:', checkErr);
                            }
                            this.updateLoading(90, 'FINALIZING', 'load');
                        } else {
                            this.updateLoading(40, 'NOT AUTHENTICATED', 'auth');
                        }
                    } catch(e) {
                        logger.warn('AUTH', "Erro na inicialização:", e);
                        this.updateLoading(40, 'AUTH ERROR', 'auth');
                    }
                    
                    // Setup auth state listener
                    if (this.supabase) {
                        // Track last event to avoid duplicate logs
                        let lastAuthEvent = null;
                        
                        this.supabase.auth.onAuthStateChange(async (event, session) => {
                            // Só loga se o evento for diferente do anterior (evita spam de SIGNED_IN)
                            if (event !== lastAuthEvent) {
                                logger.info('AUTH', 'Event:', event);
                                lastAuthEvent = event;
                            }
                            
                            if (event === 'PASSWORD_RECOVERY') {
                                logger.info('AUTH', 'Password recovery mode detected');
                                this.recoverMode = true;
                                if (session) {
                                    this.user = session.user;
                                }
                                window.location.hash = '#/recover';
                            } else if (event === 'SIGNED_IN' && session) {
                                // Reset loading state (importante para OAuth)
                                this.authLoading = false;
                                this.authMsg = '';
                                this.recoverMode = false; // Garante que modal de login feche
                                
                                if (this.user?.id === session.user.id) return;
                                this.user = session.user;
                                this.isGuest = false;
                                localStorage.removeItem('zenite_is_guest');
                                
                                // Navega para dashboard se ainda estiver no login
                                if (!window.location.hash.includes('dashboard')) {
                                    if (window.zeniteRouter) {
                                        window.zeniteRouter.navigate('dashboard', null, true);
                                    } else {
                                        this.currentView = 'dashboard';
                                        window.history.replaceState({ route: 'dashboard' }, '', '#/dashboard');
                                    }
                                }
                                try {
                                    await this.fetchCloud();
                                } catch (fetchErr) {
                                    logger.error('CLOUD', 'Erro ao buscar dados:', fetchErr);
                                }
                                try {
                                    await this.checkOnboarding();
                                } catch (onboardErr) {
                                    logger.error('ONBOARD', 'Erro ao verificar onboarding:', onboardErr);
                                }
                                try {
                                    await this.setupFriendsRealtime();
                                } catch (friendsErr) {
                                    logger.error('FRIENDS', 'Erro ao configurar realtime:', friendsErr);
                                }
                                try {
                                    await this.autoCloudCheck();
                                } catch (checkErr) {
                                    logger.error('CLOUD', 'Erro ao verificar dados:', checkErr);
                                }
                            } else if (event === 'SIGNED_OUT') {
                                this.user = null;
                                this.chars = {};
                                this.currentView = 'dashboard';
                                this.recoverMode = false;
                                this.disconnectFriendsRealtime();
                            }
                        });
                    }
                }
            }

            // Carrega histórico com error handling
            try {
                this.loadHistory();     // Histórico de Fichas
            } catch (histErr) {
                logger.error('HISTORY', 'Erro ao carregar histórico:', histErr);
            }
            try {
                this.loadDiceHistory(); // Histórico de Dados (rpg.js)
            } catch (diceHistErr) {
                logger.error('DICE', 'Erro ao carregar histórico de dados:', diceHistErr);
            }

            // Aplica Configs
            if(this.settings) {
                if(this.settings.themeColor) this.applyTheme(this.settings.themeColor);
                setSfxEnabled(this.settings.sfxEnabled);
                this.updateVisualState(); // Aplica CRT e Mouse Trail
                if(this.settings.compactMode && this.isMobile) this.applyCompactMode();
            }

            // ENHANCED: Watcher with autosave to localStorage + cloud sync
            this.$watch('char', (val) => {
                if (!val || this.loadingChar || this.isReverting) return;
                
                // Marca que a ficha foi mexida recentemente
                if (this.char) {
                    this.char.lastAccess = Date.now();
                }
                
                // Atualiza o personagem no objeto chars
                if (this.activeCharId && this.chars[this.activeCharId]) {
                    this.chars[this.activeCharId] = JSON.parse(JSON.stringify(this.char));
                }
                
                this.unsavedChanges = true;
                this.saveStatus = 'pending';
                
                // Debounced autosave: localStorage (2s) + cloud (5s)
                if (this._localSaveTimeout) clearTimeout(this._localSaveTimeout);
                if (this._cloudSaveTimeout) clearTimeout(this._cloudSaveTimeout);
                
                // Salva localmente após 2s
                this._localSaveTimeout = setTimeout(() => {
                    this.saveStatus = 'saving';
                    this.saveLocal();
                    this.saveStatus = 'local';
                }, 2000);
                
                // Sincroniza com nuvem após 5s (se logado)
                this._cloudSaveTimeout = setTimeout(() => {
                    if (this.user && !this.isGuest && this.unsavedChanges) {
                        this.syncCloud(true).then(() => {
                            this.unsavedChanges = false;
                            this.saveStatus = 'synced';
                        }).catch(() => {
                            this.saveStatus = 'local';
                        });
                    }
                }, 5000);
            });
            
            this.$watch('settings.sfxEnabled', (val) => setSfxEnabled(val));
            this.$watch('settings.crtMode', () => this.updateVisualState());

            this.updateAgentCount();
            
            // Inicializa sistema social (amigos, achievements, perfil)
            try {
                await this.initSocial();
            } catch (socialErr) {
                logger.error('SOCIAL', 'Erro ao inicializar sistema social:', socialErr);
            }
            
            // Inicializa sistema de notificações
            this.initNotifications();
            
            // Verifica se o usuário tem username definido
            try {
                await this.checkUsername();
            } catch (usernameErr) {
                logger.error('USERNAME', 'Erro ao verificar username:', usernameErr);
            }
            
            // Etapa 5: READY (90-100%)
            this.updateLoading(95, 'ALMOST READY', 'ready');
            await this.delay(200); // Pequeno delay para suavizar
            this.updateLoading(100, 'READY', 'ready');
            
            // ⚠️ LOADING DELAY - 1500ms para mostrar "READY" e evitar flash
            setTimeout(() => { 
                this.systemLoading = false;
                // Inicializa o router após o sistema carregar
                router.init(this);
            }, 1500);
            
            // CORREÇÃO: Backup automático a cada 5 minutos (não interfere no save manual)
            // Armazena referência para cleanup no logout
            // OTIMIZAÇÃO: Usa setTimeout recursivo para evitar acúmulo de tasks
            const scheduleAutoSave = () => {
                this._autoSaveTimeout = setTimeout(() => { 
                    if (this.user && this.unsavedChanges && this.autoSaveEnabled) {
                        this.syncCloud(true); 
                    }
                    scheduleAutoSave(); // Re-agenda
                }, CONSTANTS.SAVE_INTERVAL);
            };
            scheduleAutoSave();
        },

        // ⚠️ v2.3.0 - Helper para atualizar loading com progresso real
        updateLoading(progress, text, stage) {
            this.loadingProgress = progress;
            this.loadingText = text;
            this.loadingStage = stage;
            logger.info('LOADING', `${progress}% - ${text} (${stage})`);
        },
        
        // Helper para delay assíncrono
        delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        },
        
        maybeLoadMoreDashboardItems() {
            if (this.currentView !== 'dashboard') return;
            const total = Object.keys(this.filteredChars || this.chars || {}).length;
            if (!total) return;
            if (!this.dashboardPageSize) this.dashboardPageSize = 50;
            if (!this.dashboardVisibleCount) this.dashboardVisibleCount = this.dashboardPageSize;
            if (this.dashboardVisibleCount >= total) return;
            const scrollPosition = window.innerHeight + window.scrollY;
            const threshold = document.body.offsetHeight - 300;
            if (scrollPosition >= threshold) {
                const next = this.dashboardVisibleCount + this.dashboardPageSize;
                this.dashboardVisibleCount = Math.min(next, total);
            }
        },
        
        async checkOnboarding() {
            // Sistema de "Evolução do Sistema" (Welcome Modal) - POR CONTA
            if (!this.user || !this.supabase) {
                // Guest: usa localStorage simples
                const hasSeenWelcome = localStorage.getItem('zenite_welcome_seen');
                if (!hasSeenWelcome) {
                    setTimeout(() => {
                        this.welcomeModal = true;
                        localStorage.setItem('zenite_welcome_seen', 'true');
                    }, 1000);
                }
                return;
            }
            
            // Usuário logado: verifica no banco de dados (persiste por conta)
            try {
                const { data: profile } = await this.supabase
                    .from('profiles')
                    .select('has_seen_welcome')
                    .eq('id', this.user.id)
                    .single();
                
                if (!profile?.has_seen_welcome) {
                    setTimeout(() => {
                        this.welcomeModal = true;
                        // Marca no banco para persistir por conta
                        this.supabase.from('profiles')
                            .update({ has_seen_welcome: true })
                            .eq('id', this.user.id)
                            .then(() => logger.info('SYSTEM', 'Welcome marked as seen in database'));
                    }, 1000);
                }
            } catch (e) {
                logger.error('SYSTEM', 'Erro ao verificar onboarding:', e);
            }
            
            // Verifica se há changelog novo para mostrar
            this.checkChangelog();
        },
        
        async checkChangelog() {
            // Verifica se há update novo do changelog
            const userId = this.user?.id || null;
            
            // Usa Supabase para usuários logados, localStorage para guests
            if (userId && this.supabase) {
                // Carrega preferências do banco (inclui changelog_version_seen)
                const prefs = await loadUserPreferences(this.supabase, userId);
                const cachedVersion = prefs?.changelog_version_seen || 0;
                this.hasUnseenChangelog = await hasNewChangelogAsync(this.supabase, userId, cachedVersion);
            } else {
                // Guest: usa localStorage
                this.hasUnseenChangelog = hasNewUpdate(userId);
            }
            
            logger.info('CHANGELOG', `Verificando changelog - userId: ${userId ? userId.substring(0, 8) + '...' : 'guest'}, hasNew: ${this.hasUnseenChangelog}`);
            
            // Se tem update novo, abre modal automaticamente UMA VEZ
            if (this.hasUnseenChangelog) {
                setTimeout(() => {
                    // Só abre se estiver no dashboard e não tiver outros modais abertos
                    if (this.currentView === 'dashboard' && !this.welcomeModal && !this.migrationModalOpen && !this.usernameModalOpen) {
                        this.changelogModalOpen = true;
                        logger.info('CHANGELOG', 'Novo update detectado - abrindo modal automaticamente');
                    } else {
                        logger.info('CHANGELOG', `Modal não aberto - currentView: ${this.currentView}, welcomeModal: ${this.welcomeModal}, migrationModal: ${this.migrationModalOpen}`);
                    }
                }, 3000); // Delay maior para garantir que outros modais fechem primeiro
            }
        },
        
        async closeChangelogModal() {
            this.changelogModalOpen = false;
            const userId = this.user?.id || null;
            
            // Salva no Supabase para usuários logados, localStorage para guests
            if (userId && this.supabase) {
                await markChangelogSeenAsync(this.supabase, userId);
            } else {
                markUpdateSeen(userId);
            }
            
            this.hasUnseenChangelog = false;
            logger.info('CHANGELOG', 'Changelog marcado como visto');
        },
        
        // ═══════════════════════════════════════════════════════════════════════
        // NOTIFICAÇÕES - Histórico e Polling
        // ═══════════════════════════════════════════════════════════════════════
        
        initNotifications() {
            // Carrega histórico do NotificationCenter
            if (window.NotificationCenter) {
                window.NotificationCenter.init();
                this.notificationHistory = window.NotificationCenter.getHistory(20);
                this.notificationUnreadCount = window.NotificationCenter.getUnreadCount();
            }
            
            // Inicia polling de mensagens/convites (a cada 30 segundos)
            this.startNotificationPolling();
        },
        
        startNotificationPolling() {
            if (this._notificationPollingTimer) return;
            
            this._notificationPollingTimer = setInterval(() => {
                this.checkForNewNotifications();
            }, 30000); // 30 segundos
        },
        
        stopNotificationPolling() {
            if (this._notificationPollingTimer) {
                clearInterval(this._notificationPollingTimer);
                this._notificationPollingTimer = null;
            }
        },
        
        async checkForNewNotifications() {
            if (!this.supabase || !this.user || this.isGuest) return;
            
            try {
                // Verifica mensagens não lidas
                const { data: unreadMessages } = await this.supabase
                    .from('chat_messages')
                    .select('id, sender_id, content, created_at')
                    .eq('receiver_id', this.user.id)
                    .eq('read', false)
                    .order('created_at', { ascending: false })
                    .limit(5);
                
                if (unreadMessages && unreadMessages.length > 0) {
                    // Notifica sobre novas mensagens (apenas se não estiver no chat)
                    if (!this.chatModalOpen) {
                        const count = unreadMessages.length;
                        if (count > this._lastUnreadCount) {
                            window.NotificationCenter?.show('message', 
                                `Você tem ${count} mensagem${count > 1 ? 's' : ''} não lida${count > 1 ? 's' : ''}`,
                                { duration: 5000 }
                            );
                        }
                        this._lastUnreadCount = count;
                    }
                }
                
                // Verifica convites de amizade pendentes
                const { data: pendingRequests } = await this.supabase
                    .from('friendships')
                    .select('id')
                    .eq('friend_id', this.user.id)
                    .eq('status', 'pending');
                
                if (pendingRequests && pendingRequests.length > this.friendRequests?.length) {
                    window.NotificationCenter?.show('invite', 
                        'Você tem novos pedidos de amizade!',
                        { duration: 5000 }
                    );
                }
                
                // Atualiza histórico
                this.refreshNotificationHistory();
                
            } catch (e) {
                console.warn('[NOTIFICATIONS] Erro no polling:', e.message);
            }
        },
        
        refreshNotificationHistory() {
            if (window.NotificationCenter) {
                this.notificationHistory = window.NotificationCenter.getHistory(20);
                this.notificationUnreadCount = window.NotificationCenter.getUnreadCount();
            }
        },
        
        markAllNotificationsRead() {
            if (window.NotificationCenter) {
                window.NotificationCenter.markAllRead();
                this.notificationUnreadCount = 0;
                this.refreshNotificationHistory();
            }
        },
        
        clearNotificationHistory() {
            if (window.NotificationCenter) {
                window.NotificationCenter.clearHistory();
                this.notificationHistory = [];
                this.notificationUnreadCount = 0;
            }
        },
        
        formatNotificationTime(timestamp) {
            if (!timestamp) return '';
            const date = new Date(timestamp);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);
            
            if (diffMins < 1) return 'Agora';
            if (diffMins < 60) return `${diffMins}min atrás`;
            if (diffHours < 24) return `${diffHours}h atrás`;
            if (diffDays < 7) return `${diffDays}d atrás`;
            return date.toLocaleDateString('pt-BR');
        },

        setupListeners() {
            // Helper para registrar e limpar listeners
            const addListener = (target, type, handler, options) => {
                target.addEventListener(type, handler, options);
                this._listeners.push(() => target.removeEventListener(type, handler, options));
            };

            // Reconecta realtime quando página é restaurada do cache (bfcache)
            // Em vez de recarregar a página inteira, apenas reconecta os serviços
            addListener(window, 'pageshow', (event) => { 
                if (event.persisted) {
                    logger.info('SYSTEM', 'Página restaurada do cache, reconectando serviços...');
                    // Reconecta realtime se estava em campanha
                    if (this.activeCampaign && this.connectToRealtime) {
                        this.connectToRealtime(this.activeCampaign.id);
                    }
                    // Recarrega dados da nuvem se logado
                    if (this.user && !this.isGuest && this.fetchCloud) {
                        this.fetchCloud();
                    }
                }
            });
            
            // ═══════════════════════════════════════════════════════════════════════
            // OFFLINE MODE DETECTION
            // Detecta perda de conexão e entra em modo somente-leitura
            // ═══════════════════════════════════════════════════════════════════════
            this.isOffline = !navigator.onLine;
            
            addListener(window, 'online', () => {
                logger.info('NETWORK', 'Conexão restaurada');
                this.isOffline = false;
                this.notify('Conexão restaurada! Sincronizando...', 'success');
                
                // Tenta reconectar realtime se estava em campanha
                if (this.activeCampaign && this.connectToRealtime) {
                    this.connectToRealtime(this.activeCampaign.id);
                }
                
                // Sincroniza dados pendentes
                if (this.unsavedChanges && this.user && !this.isGuest) {
                    this.syncCloud(true);
                }
            });
            
            addListener(window, 'offline', () => {
                logger.warn('NETWORK', 'Conexão perdida - entrando em modo offline');
                this.isOffline = true;
                this.notify('Sem conexão. Modo offline ativado.', 'warn');
                
                // Desconecta realtime para evitar erros
                if (this.disconnectRealtime) {
                    this.disconnectRealtime();
                }
            });
            
            // CRITICAL: Warn user before leaving with unsaved changes
            addListener(window, 'beforeunload', (e) => {
                if (this.unsavedChanges && this.currentView === 'sheet') {
                    e.preventDefault();
                    e.returnValue = 'Você tem alterações não salvas. Deseja realmente sair?';
                    return e.returnValue;
                }
            });
            // Debounce para evitar múltiplas chamadas durante resize
            let resizeTimeout;
            addListener(window, 'resize', () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    const wasMobile = this.isMobile;
                    this.isMobile = window.innerWidth < 768;
                    
                    // Sempre fecha menus e UI flutuante quando muda de mobile/desktop
                    if (wasMobile !== this.isMobile) {
                        this.diceTrayOpen = false;
                        this.userMenuOpen = false;
                        this.showDiceTip = false;
                        
                        // Reseta posição do float
                        if (this.trayDockMode === 'float') {
                            this.trayPosition = { x: Math.max(20, window.innerWidth - 340), y: 100 };
                        }
                    }
                    
                    // Garante que diceTray está fechado se não estiver no sheet
                    if (this.currentView !== 'sheet' && this.diceTrayOpen) {
                        this.diceTrayOpen = false;
                    }
                }, 150); // Debounce de 150ms
            });
            
            const handleDashboardScroll = debounce(() => {
                this.maybeLoadMoreDashboardItems();
            }, 100);
            addListener(window, 'scroll', handleDashboardScroll);
            addListener(window, 'popstate', () => {
                if (this.currentView === 'sheet' && this.unsavedChanges && !this.isGuest) { 
                    history.pushState(null, null, location.href); 
                    this.triggerShake(); 
                    return; 
                }
                if (this.currentView === 'sheet' || this.wizardOpen || this.configModal) { 
                    if(this.currentView === 'sheet') this.saveAndExit(true); 
                    this.wizardOpen = false; 
                    this.configModal = false; 
                    this.cropperOpen = false; 
                }
            });
            
            // Global Click Handler para SFX
            addListener(document, 'click', (e) => { 
                if(e.target.closest('button, a, input, select, .cursor-pointer, .dice-tray-opt')) {
                    playSFX('click'); 
                }
            });
            
            // YouTube postMessage listener para música ambiente
            window.addEventListener('message', (event) => {
                if (event.origin !== 'https://www.youtube.com') return;
                
                try {
                    const data = JSON.parse(event.data);
                    if (data.event === 'infoDelivery' && data.info) {
                        if (data.info.currentTime !== undefined) {
                            this.ambientMusic.currentTime = data.info.currentTime;
                        }
                        if (data.info.duration !== undefined && data.info.duration > 0) {
                            this.ambientMusic.duration = data.info.duration;
                        }
                    }
                } catch (e) {
                    // Ignora mensagens inválidas
                }
            });
            
            // Atualiza progresso da música ambiente a cada 2 segundos (reduz carga)
            // Armazena referência para cleanup no logout
            // OTIMIZAÇÃO: Usa setTimeout recursivo e aumenta intervalo
            const scheduleMusicUpdate = () => {
                this._musicProgressTimeout = setTimeout(() => {
                    if (this.ambientMusic.playing) {
                        this.updateMusicProgress();
                    }
                    scheduleMusicUpdate(); // Re-agenda
                }, 2000); // 2s ao invés de 1s
            };
            scheduleMusicUpdate();
            
            // ESC key handler
            addListener(document, 'keydown', (e) => {
                if (e.key === 'Escape') this.handleEscKey();
            });
        },

        _cleanupListeners() {
            if (Array.isArray(this._listeners) && this._listeners.length) {
                this._listeners.forEach(off => {
                    try { off(); } catch (_) {}
                });
            }
            this._listeners = [];
        },

        // --- SALVAR MANUAL ---
        async manualSave() {
            if (!this.unsavedChanges) return;
            
            // Clear any pending local save timeout
            if (this._localSaveTimeout) clearTimeout(this._localSaveTimeout);
            
            this.saveStatus = 'saving';
            this.isSyncing = true;
            
            // 1. Salva no histórico de versões
            this.saveToHistory();

            // 2. Salva Localmente (Instantâneo)
            await this.saveLocal();
            
            // 3. Sincroniza com Nuvem (Silencioso para não flodar notificações)
            if (!this.isGuest && this.user) {
                await this.syncCloud(true); 
                playSFX('save');
            }
            
            this.isSyncing = false;
            this.unsavedChanges = false;
            this.autoSaveEnabled = false;
            this.saveStatus = 'synced';
            
            // Reset status after a few seconds
            setTimeout(() => {
                if (this.saveStatus === 'synced') {
                    this.saveStatus = 'idle';
                }
            }, 3000);
            
            // 4. Feedback final para o usuário
            this.notify('Salvo com sucesso!', 'success');
        },

        // --- HISTÓRICO ---
        saveToHistory() {
            if (!this.char || !this.activeCharId) return;
            
            const snapshot = {
                id: Date.now(),
                charId: this.activeCharId,
                timestamp: new Date().toISOString(),
                data: JSON.parse(JSON.stringify(this.char))
            };
            
            this.saveHistory.unshift(snapshot);
            
            // Mantém últimas 50 versões
            if (this.saveHistory.length > 50) {
                this.saveHistory = this.saveHistory.slice(0, 50);
            }
            
            localStorage.setItem('zenite_history', JSON.stringify(this.saveHistory));
        },

        loadHistory() {
            const stored = localStorage.getItem('zenite_history');
            if (stored) {
                try {
                    this.saveHistory = JSON.parse(stored);
                } catch(e) {
                    this.saveHistory = [];
                }
            }
        },

        restoreFromHistory(snapshotId) {
            const snapshot = this.saveHistory.find(s => s.id === snapshotId);
            if (!snapshot) return;
            
            this.askConfirm(
                'RESTAURAR VERSÃO?',
                `Isso irá sobrescrever os dados atuais com a versão de ${new Date(snapshot.timestamp).toLocaleString('pt-BR')}`,
                'warn',
                () => {
                    this.char = sanitizeChar(snapshot.data);
                    this.unsavedChanges = true;
                    this.historyModal = false; // Fecha o modal
                    this.notify('Versão restaurada! Clique em SALVAR para confirmar.', 'success');
                    this.triggerShake(); // Efeito visual para indicar mudança
                }
            );
        },
        // --- MINIGAME ---
        triggerSystemFailure() {
            playSFX('error');
            this.systemFailure = true;
            this.minigameActive = false;
            const elem = document.documentElement;
            if (elem.requestFullscreen) { elem.requestFullscreen().catch(() => {}); }
            
            // Achievement: System Breaker
            if (this.localStats) {
                this.localStats.systemFailure = true;
                this.saveLocalStats();
                this.checkAchievements();
            }
        },
        startMinigame() {
            this.minigameActive = true;
            this.minigameClicks = 5;
            this.moveMinigameTarget();
        },
        moveMinigameTarget() {
            this.minigamePos.x = Math.floor(Math.random() * 80) + 10;
            this.minigamePos.y = Math.floor(Math.random() * 80) + 10;
        },
        hitMinigame() {
            playSFX('click');
            this.minigameClicks--;
            if (this.minigameClicks <= 0) {
                playSFX('success');
                this.notify("SISTEMA RESTAURADO", "success");
                this.systemFailure = false;
                this.minigameActive = false;
                if (document.exitFullscreen) { document.exitFullscreen().catch(() => {}); }
                this.rebooting = true;
                setTimeout(() => { this.rebooting = false; }, 1000);
            } else {
                this.moveMinigameTarget();
            }
        },

        // --- NOTIFICAÇÕES ---
        // Agora usa NotificationCenter por baixo, mantendo compatibilidade
        notify(msg, type='info', options = {}) {
            // Se NotificationCenter disponível, usa ele (sistema novo)
            if (window.NotificationCenter) {
                // Mapeia tipos antigos para os do NotificationCenter
                const typeMap = {
                    'info': 'system',
                    'success': 'success',
                    'error': 'error',
                    'warn': 'system',
                    'invite': 'invite',
                    'campaign': 'campaign'
                };
                
                const mappedType = typeMap[type] || 'system';
                
                return window.NotificationCenter.show(mappedType, msg, {
                    action: options.action,
                    actionLabel: options.actionLabel,
                    persistent: options.persistent,
                    duration: options.duration || (type === 'error' ? 5000 : 3000)
                });
            }
            
            // Fallback para sistema legado (se NotificationCenter não carregou)
            const id = Date.now();
            let icon = 'fa-circle-info';
            if(type === 'success') icon = 'fa-circle-check';
            if(type === 'error') icon = 'fa-triangle-exclamation';
            if(type === 'warn') icon = 'fa-bell';
            if(type === 'invite') icon = 'fa-envelope';
            if(type === 'campaign') icon = 'fa-users';
            
            const notification = { 
                id, 
                message: msg, 
                type, 
                icon,
                action: options.action || null,
                actionLabel: options.actionLabel || null,
                persistent: options.persistent || false,
                dismissable: options.dismissable !== false
            };
            
            this.notifications.push(notification);
            
            if (!options.persistent) {
                const duration = options.duration || (type === 'error' ? 5000 : 3000);
                setTimeout(() => {
                    this.notifications = this.notifications.filter(n => n.id !== id);
                }, duration);
            }
            
            return id;
        },
        
        // Remove notificação específica
        dismissNotification(id) {
            if (window.NotificationCenter) {
                window.NotificationCenter.dismiss(id);
            }
            this.notifications = this.notifications.filter(n => n.id !== id);
        },
        
        // Executa ação da notificação e fecha
        executeNotificationAction(notification) {
            if (notification.action && typeof notification.action === 'function') {
                notification.action();
            }
            this.dismissNotification(notification.id);
        },

        // --- KONAMI CODE ---
        handleKeys(e) {
            // Guarda contra teclas indefinidas (ex: teclas de função, modificadores)
            if (!e.key) return;
            const key = e.key.toLowerCase();
            const code = ['arrowup','arrowup','arrowdown','arrowdown','arrowleft','arrowright','arrowleft','arrowright','b','a'];
            this.konamiBuffer.push(key);
            if (this.konamiBuffer.length > code.length) this.konamiBuffer.shift();
            if (JSON.stringify(this.konamiBuffer) === JSON.stringify(code)) {
                this.hackerModeUnlocked = true;
                localStorage.setItem('zenite_hacker_unlocked', 'true');
                this.toggleHackerMode();
                this.konamiBuffer = [];
                
                // Achievement: Konami Master
                if (this.localStats) {
                    this.localStats.konamiActivated = true;
                    this.saveLocalStats();
                    this.checkAchievements();
                }
            }
        },
        
        // ═══════════════════════════════════════════════════════════════════════
        // HASH ROUTING - Navegação com URLs compartilháveis
        // ═══════════════════════════════════════════════════════════════════════
        
        /**
         * Navega para o dashboard e atualiza a URL
         */
        goToDashboard() {
            router.navigate('dashboard');
            this.currentView = 'dashboard';
        },
        
        /**
         * Abre uma ficha e atualiza a URL
         */
        async openSheet(charId) {
            const success = this.loadCharacter(charId);
            if (success) {
                router.navigate('sheet', charId);
            }
        },
        
        /**
         * Alias para loadCharacter (compatibilidade)
         */
        loadChar(id) {
            return this.loadCharacter(id);
        },
        
        /**
         * Entra em uma campanha pelo código e atualiza a URL
         */
        async openCampaign(code) {
            router.navigate('netlink', code);
        },
        
        /**
         * Copia o link da página atual
         */
        async copyPageLink() {
            await router.copyCurrentUrl();
        },
        
        /**
         * Retorna a URL compartilhável da ficha atual
         */
        getSheetShareUrl() {
            if (this.activeCharId) {
                return `${window.location.origin}${window.location.pathname}#/sheet/${this.activeCharId}`;
            }
            return null;
        },
        
        /**
         * Retorna a URL compartilhável da campanha atual
         */
        getCampaignShareUrl() {
            if (this.activeCampaign?.invite_code) {
                return `${window.location.origin}${window.location.pathname}#/netlink/${this.activeCampaign.invite_code}`;
            }
            return null;
        }
    };
}

// Expor zeniteSystem globalmente para o Alpine (no HTML)
window.zeniteSystem = zeniteSystem;

// --- INICIALIZAÇÃO CRÍTICA DO ALPINE ---
document.addEventListener('DOMContentLoaded', async () => {
    logger.info('BOOT', 'Initializing...');
    
    try {
        // Carregar Alpine e plugins dinamicamente
        const [alpineModule, collapseModule, focusModule] = await Promise.all([
            import('https://cdn.jsdelivr.net/npm/alpinejs@3.13.3/dist/module.esm.js'),
            import('https://cdn.jsdelivr.net/npm/@alpinejs/collapse@3.13.3/dist/module.esm.js'),
            import('https://cdn.jsdelivr.net/npm/@alpinejs/focus@3.13.3/dist/module.esm.js')
        ]);
        
        const Alpine = alpineModule.default;
        const collapse = collapseModule.default;
        const focus = focusModule.default;
        
        // Registrar plugins
        Alpine.plugin(collapse);
        Alpine.plugin(focus);
        
        // Expor Alpine globalmente
        window.Alpine = Alpine;
        
        // ═══════════════════════════════════════════════════════════════════════
        // SUPRIMIR ERROS NÃO-CRÍTICOS DO ALPINE
        // Erros de null/undefined em expressões são esperados durante transições
        // ═══════════════════════════════════════════════════════════════════════
        const originalWarn = console.warn;
        const originalError = console.error;
        
        // Lista de padrões de erro para suprimir
        const suppressPatterns = [
            'Alpine Expression Error',
            'Cannot read properties of null',
            'Cannot read properties of undefined',
            'AudioContext was not allowed',
            '[DOM] Password field is not contained'
        ];
        
        console.warn = function(...args) {
            const msg = args[0]?.toString() || '';
            if (suppressPatterns.some(p => msg.includes(p))) return;
            originalWarn.apply(console, args);
        };
        
        console.error = function(...args) {
            const msg = args[0]?.toString() || '';
            // Só suprime erros de Alpine com null/undefined (não-críticos)
            if (msg.includes('Alpine') && suppressPatterns.some(p => msg.includes(p))) return;
            originalError.apply(console, args);
        };
        
        // Iniciar Alpine explicitamente
        Alpine.start();
        logger.info('BOOT', 'Alpine started');
        
    } catch (e) {
        logger.error('BOOT', 'Critical Error:', e);
    }
});
