import { CONSTANTS, ARCHETYPES } from './modules/config.js';
import { playSFX, setSfxEnabled, initAudio } from './modules/audio.js';
import { debounce, sanitizeChar, calculateBaseStats } from './modules/utils.js';
import { rpgLogic } from './modules/rpg.js';
import { cloudLogic } from './modules/cloud.js';
import { uiLogic } from './modules/ui.js';

function zeniteSystem() {
    return {
        // --- ESTADO DO SISTEMA ---
        systemLoading: true, loadingProgress: 0, loadingText: 'BOOT',
        loadingChar: false, rebooting: false,
        
        // Auth
        user: null, isGuest: false, userMenuOpen: false, 
        authLoading: false, authMsg: '', authMsgType: '',
        
        // Navegação
        currentView: 'dashboard', activeTab: 'profile', logisticsTab: 'inventory',
        searchQuery: '', viewMode: 'grid',
        
        // Dados
        chars: {}, activeCharId: null, char: null, agentCount: 0,
        
        // Configs
        settings: { 
            compactMode: false, 
            crtMode: false, 
            sfxEnabled: true, 
            themeColor: 'cyan',
            mouseTrail: true // Adicionado explicitamente
        },
        
        // Wizard
        wizardOpen: false, wizardStep: 1, wizardPoints: 8, 
        wizardNameError: false, wizardFocusAttr: '',
        wizardData: { class: '', name: '', identity: '', age: '', history: '', photo: null, attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} },
        
        // UI / Modais
        notifications: [], configModal: false, confirmOpen: false,
        confirmData: { title:'', desc:'', action:null, type:'danger' },
        welcomeModal: false, // NOVO: Modal de boas-vindas
        historyModal: false,
        
        // Salvamento - CORREÇÃO CRÍTICA
        unsavedChanges: false, 
        isSyncing: false, 
        saveStatus: 'idle',
        revertConfirmMode: false, 
        shakeAlert: false, 
        isReverting: false,
        autoSaveEnabled: false, // NOVO: Controle manual do auto-save
        lastManualSave: null,
        
        // Ferramentas
        cropperOpen: false, cropperInstance: null, uploadContext: 'char',
        diceTrayOpen: false, trayDockMode: 'float', trayPosition: { x: window.innerWidth - 350, y: window.innerHeight - 500 },
        isDraggingTray: false, showDiceTip: false, hasSeenDiceTip: false,
        diceLog: [], lastRoll: '--', lastNatural: 0, lastFaces: 20, diceMod: 0, diceReason: '',
        
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

        // Módulos
        ...rpgLogic,
        ...cloudLogic,
        ...uiLogic,

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
                    } catch(e) {}
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
            
            // NOVO: Watcher para mouse trail e CRT
            this.$watch('settings.mouseTrail', () => this.updateVisualState());
            this.$watch('settings.crtMode', () => this.updateVisualState());

            this.updateAgentCount();
            this.loadingProgress = 100;
            setTimeout(() => { this.systemLoading = false; }, 500);
            
            // CORREÇÃO: Backup automático a cada 5 minutos (não interfere no save manual)
            setInterval(() => { 
                if (this.user && this.unsavedChanges && this.autoSaveEnabled) {
                    this.syncCloud(true); 
                }
            }, CONSTANTS.SAVE_INTERVAL);
        },

        checkOnboarding() {
            const hasSeenWelcome = localStorage.getItem('zenite_welcome_seen');
            if (!hasSeenWelcome) {
                setTimeout(() => {
                    this.welcomeModal = true;
                    localStorage.setItem('zenite_welcome_seen', 'true');
                }, 1000);
            }
        },

        setupListeners() {
            window.addEventListener('pageshow', (event) => { if (event.persisted) window.location.reload(); });
            window.addEventListener('resize', () => { this.isMobile = window.innerWidth < 768; });
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
            
            // Salva no histórico antes
            this.saveToHistory();

            // Salva Localmente AGORA (sem esperar 3 segundos)
            await this.saveLocal();
            
            // Se tiver logado, sincroniza com a nuvem
            if (!this.isGuest && this.user) {
                await this.syncCloud(true);
                playSFX('save');
            }
            
            this.isSyncing = false;
            this.unsavedChanges = false;
            this.autoSaveEnabled = false;
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
            const key = e.key.toLowerCase();
            const code = ['arrowup','arrowup','arrowdown','arrowdown','arrowleft','arrowright','arrowleft','arrowright','b','a'];
            this.konamiBuffer.push(key);
            if (this.konamiBuffer.length > code.length) this.konamiBuffer.shift();
            if (JSON.stringify(this.konamiBuffer) === JSON.stringify(code)) {
                this.hackerModeUnlocked = true;
                localStorage.setItem('zenite_hacker_unlocked', 'true');
                this.toggleHackerMode();
                this.konamiBuffer = [];
            }
        }
    };
}

window.zeniteSystem = zeniteSystem;

// --- INICIALIZAÇÃO CRÍTICA DO ALPINE ---
document.addEventListener('DOMContentLoaded', () => {
    import('https://cdn.jsdelivr.net/npm/alpinejs@3.13.3/dist/module.esm.js').then((module) => {
        const Alpine = module.default;
        Alpine.data('zeniteSystem', zeniteSystem);
        Alpine.start();
    });
});