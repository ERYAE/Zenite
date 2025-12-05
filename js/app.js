import { CONSTANTS, ARCHETYPES, FEATURES } from './modules/config.js';
import { playSFX, setSfxEnabled, initAudio } from './modules/audio.js';
import { debounce, sanitizeChar, calculateBaseStats } from './modules/utils.js';
import { rpgLogic } from './modules/rpg.js';
import { cloudLogic } from './modules/cloud.js';
import { uiLogic } from './modules/ui.js';
import { netlinkLogic } from './modules/netlink.js';
import { socialLogic, ACHIEVEMENTS } from './modules/social.js';
import { router } from './modules/router.js';

function zeniteSystem() {
    return {
        // --- ESTADO DO SISTEMA ---
        systemLoading: true, loadingProgress: 0, loadingText: 'BOOT',
        loadingChar: false, rebooting: false,
        
        // Feature Flags
        netlinkEnabled: FEATURES.NETLINK_ENABLED,
        
        // Auth
        user: null, isGuest: false, userMenuOpen: false, 
        authLoading: false, authMsg: '', authMsgType: '',
        authMode: 'login', // 'login', 'register', 'forgot'
        authEmail: '', authPassword: '', authPasswordConfirm: '', authUsername: '',
        
        // Verificação de username
        usernameChecking: false,
        usernameCheckResult: null, // 'available', 'taken', null
        
        // Navegação
        currentView: 'dashboard', activeTab: 'profile', logisticsTab: 'inventory',
        searchQuery: '', viewMode: 'grid',
        
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
            themeColor: 'cyan',
            username: '', // Nome de usuário customizável
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
        welcomeModal: false, // Modal de boas-vindas
        historyModal: false,
        usernameModalOpen: false, // Modal para forçar username
        tempUsername: '', // Username temporário para o modal
        
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
        
        // GIF/Tenor
        gifModalOpen: false,
        tenorSearch: '',
        tenorResults: [],
        tenorLoading: false,
        
        // Username
        usernameCheckStatus: '', // '', 'checking', 'available', 'taken', 'error'
        usernameCheckMessage: '',
        canEditUsername: true, // Se passou cooldown de 14 dias
        daysUntilUsernameChange: 0,
        
        // ═══════════════════════════════════════════════════════════════════════
        // FERRAMENTAS E DADOS
        // ═══════════════════════════════════════════════════════════════════════
        cropperOpen: false, cropperInstance: null, uploadContext: 'char',
        
        // Modo de visualização de ficha de campanha (GM vê ficha de jogador)
        campaignCharMode: false,  // true = visualizando ficha de membro
        campaignCharBackup: null, // backup da ficha local antes de entrar no modo
        campaignMemberId: null,   // ID do membro sendo visualizado
        
        diceTrayOpen: false, trayDockMode: 'float', 
        // Posição inicial segura - será recalculada ao abrir
        trayPosition: { x: 100, y: 100 },
        isDraggingTray: false, showDiceTip: false, hasSeenDiceTip: false,
        diceLog: [], lastRoll: '--', lastNatural: 0, lastFaces: 20, diceMod: 0, diceReason: '',
        
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
        supabase: null, debouncedSaveFunc: null,
        archetypes: ARCHETYPES,
        
        // ═══════════════════════════════════════════════════════════════════════
        // ÚLTIMA ROLAGEM DO JOGADOR (para exibir na tela)
        // ═══════════════════════════════════════════════════════════════════════
        playerLastRoll: null, // {formula, natural, modifier, total, isCrit, isFumble, reason, timestamp}

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

            // Carrega Banco de Dados
            const isGuest = localStorage.getItem('zenite_is_guest') === 'true';
            if (isGuest) {
                this.isGuest = true;
                this.loadLocal('zenite_guest_db');
            } else {
                this.loadLocal('zenite_cached_db');
                if(this.supabase) {
                    try {
                        const { data: { session } } = await this.supabase.auth.getSession();
                        if (session) {
                            this.user = session.user;
                            this.loadingText = 'SYNC CLOUD';
                            await this.fetchCloud();
                            this.checkOnboarding();
                        }
                        this.supabase.auth.onAuthStateChange(async (event, session) => {
                            if (event === 'SIGNED_IN' && session) {
                                if (this.user?.id === session.user.id) return;
                                this.user = session.user;
                                this.isGuest = false;
                                localStorage.removeItem('zenite_is_guest');
                                await this.fetchCloud();
                                this.checkOnboarding();
                            } else if (event === 'SIGNED_OUT') {
                                this.user = null;
                                this.chars = {};
                                this.currentView = 'dashboard';
                            }
                        });
                    } catch(e) {
                        console.warn("[AUTH] Erro na inicialização:", e);
                    }
                }
            }

            // Carrega histórico
            this.loadHistory();     // Histórico de Fichas
            this.loadDiceHistory(); // NOVO: Histórico de Dados (rpg.js)

            // Aplica Configs
            if(this.settings) {
                if(this.settings.themeColor) this.applyTheme(this.settings.themeColor);
                setSfxEnabled(this.settings.sfxEnabled);
                this.updateVisualState(); // Aplica CRT e Mouse Trail
                if(this.settings.compactMode && this.isMobile) this.applyCompactMode();
            }

            // CORREÇÃO: Watcher agora apenas marca como alterado
            this.$watch('char', (val) => {
                if (!val || this.loadingChar || this.isReverting) return;
                
                // Marca que a ficha foi mexida recentemente
                if (this.char) {
                    this.char.lastAccess = Date.now();
                }
                
                this.unsavedChanges = true;
                // Save manual continua mandatório para FICHA
            });
            
            this.$watch('settings.sfxEnabled', (val) => setSfxEnabled(val));
            this.$watch('settings.crtMode', () => this.updateVisualState());

            this.updateAgentCount();
            
            // Inicializa sistema social (amigos, achievements, perfil)
            this.initSocial();
            
            // Verifica se o usuário tem username definido
            this.checkUsername();
            
            this.loadingProgress = 100;
            setTimeout(() => { 
                this.systemLoading = false;
                // Inicializa o router após o sistema carregar
                router.init(this);
            }, 500);
            
            // CORREÇÃO: Backup automático a cada 5 minutos (não interfere no save manual)
            setInterval(() => { 
                if (this.user && this.unsavedChanges && this.autoSaveEnabled) {
                    this.syncCloud(true); 
                }
            }, CONSTANTS.SAVE_INTERVAL);
        },

        async checkOnboarding() {
            // Verifica se já viu o welcome modal
            if (!this.user || !this.supabase) {
                const hasSeenWelcome = localStorage.getItem('zenite_welcome_seen');
                if (!hasSeenWelcome) {
                    setTimeout(() => {
                        this.welcomeModal = true;
                        localStorage.setItem('zenite_welcome_seen', 'true');
                    }, 1000);
                }
                return;
            }
            
            try {
                const { data: profile } = await this.supabase
                    .from('profiles')
                    .select('has_seen_welcome')
                    .eq('id', this.user.id)
                    .single();
                
                if (!profile?.has_seen_welcome) {
                    setTimeout(() => {
                        this.welcomeModal = true;
                        this.supabase.from('profiles')
                            .update({ has_seen_welcome: true })
                            .eq('id', this.user.id)
                            .then(() => console.log('[SYSTEM] Welcome marked as seen'));
                    }, 1000);
                }
            } catch (e) {
                console.error('[SYSTEM] Erro ao verificar onboarding:', e);
            }
        },

        setupListeners() {
            window.addEventListener('pageshow', (event) => { if (event.persisted) window.location.reload(); });
            // Debounce para evitar múltiplas chamadas durante resize
            let resizeTimeout;
            window.addEventListener('resize', () => {
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
            window.addEventListener('popstate', () => {
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
            document.addEventListener('click', (e) => { 
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
            
            // Atualiza progresso da música ambiente a cada segundo
            setInterval(() => {
                if (this.ambientMusic.playing) {
                    this.updateMusicProgress();
                }
            }, 1000);
            
            // ESC key handler
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') this.handleEscKey();
            });
        },

        // --- SALVAR MANUAL ---
        async manualSave() {
            if (!this.unsavedChanges) return;
            
            this.notify('Salvando...', 'info');
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
        notify(msg, type='info') {
            const id = Date.now();
            let icon = 'fa-circle-info';
            if(type === 'success') icon = 'fa-circle-check';
            if(type === 'error') icon = 'fa-triangle-exclamation';
            if(type === 'warn') icon = 'fa-bell';
            
            this.notifications.push({ id, message: msg, type, icon });
            setTimeout(() => {
                this.notifications = this.notifications.filter(n => n.id !== id);
            }, 3000);
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
            const success = await this.loadChar(charId);
            if (success) {
                router.navigate('sheet', charId);
                this.currentView = 'sheet';
            }
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

window.zeniteSystem = zeniteSystem;

// --- INICIALIZAÇÃO CRÍTICA DO ALPINE ---
document.addEventListener('DOMContentLoaded', async () => {
    // Carregar Alpine e plugins
    const [alpineModule, collapseModule] = await Promise.all([
        import('https://cdn.jsdelivr.net/npm/alpinejs@3.13.3/dist/module.esm.js'),
        import('https://cdn.jsdelivr.net/npm/@alpinejs/collapse@3.13.3/dist/module.esm.js')
    ]);
    
    const Alpine = alpineModule.default;
    const collapse = collapseModule.default;
    
    // Registrar plugins ANTES de iniciar
    Alpine.plugin(collapse);
    
    Alpine.data('zeniteSystem', zeniteSystem);
    Alpine.start();
});