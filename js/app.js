import { CONSTANTS, ARCHETYPES } from './modules/config.js';
import { playSFX, setSfxEnabled, initAudio } from './modules/audio.js';
import { debounce, sanitizeChar, calculateBaseStats } from './modules/utils.js';
import { rpgLogic } from './modules/rpg.js';
import { cloudLogic } from './modules/cloud.js';
import { uiLogic } from './modules/ui.js';

function zeniteSystem() {
    return {
        // --- ESTADO GERAL ---
        systemLoading: true, loadingProgress: 0, loadingText: 'BOOT',
        loadingChar: false, rebooting: false,
        
        // Auth
        user: null, isGuest: false, userMenuOpen: false, 
        authLoading: false, authMsg: '', authMsgType: '',
        
        // Navegação
        currentView: 'dashboard', activeTab: 'profile', logisticsTab: 'inventory',
        searchQuery: '',
        
        // Dados
        chars: {}, activeCharId: null, char: null, agentCount: 0,
        
        // Configs & Estado
        settings: { compactMode: false, crtMode: true, sfxEnabled: true, themeColor: 'cyan' },
        
        // Wizard
        wizardOpen: false, wizardStep: 1, wizardPoints: 8, 
        wizardNameError: false, wizardFocusAttr: '',
        wizardData: { class: '', name: '', identity: '', age: '', history: '', photo: null, attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} },
        
        // UI Globais
        notifications: [], configModal: false, confirmOpen: false,
        confirmData: { title:'', desc:'', action:null, type:'danger' },
        
        // Salvamento
        unsavedChanges: false, isSyncing: false, saveStatus: 'idle',
        revertConfirmMode: false, shakeAlert: false, isReverting: false,
        
        // Ferramentas
        cropperOpen: false, cropperInstance: null, uploadContext: 'char',
        diceTrayOpen: false, trayDockMode: 'float', trayPosition: { x: window.innerWidth - 350, y: window.innerHeight - 500 },
        isDraggingTray: false, showDiceTip: false, hasSeenDiceTip: false,
        diceLog: [], lastRoll: '--', lastNatural: 0, lastFaces: 20, diceMod: 0, diceReason: '',
        
        // Minigame & Falhas
        systemFailure: false, minigameActive: false, minigameClicks: 5, minigamePos: {x:50, y:50},
        
        // Hacks
        isHackerMode: false, hackerModeUnlocked: false, konamiBuffer: [], logoClickCount: 0, logoClickTimer: null,
        
        // Auxiliares
        isMobile: window.innerWidth < 768,
        supabase: null, debouncedSaveFunc: null,
        archetypes: ARCHETYPES,

        // Módulos Externos
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
            
            // Tenta inicializar áudio no primeiro clique do user
            document.body.addEventListener('click', () => initAudio(), { once: true });

            this.setupListeners();

            // Carrega dependências
            if (typeof window.supabase !== 'undefined') {
                this.supabase = window.supabase.createClient(CONSTANTS.SUPABASE_URL, CONSTANTS.SUPABASE_KEY);
            }

            // Define função de salvamento com debounce
            this.debouncedSaveFunc = debounce(async () => { 
                await this.saveLocal(); 
                if (!this.isGuest && this.user) {
                    await this.syncCloud(true);
                    playSFX('save'); // Som de confirmação
                }
                this.unsavedChanges = false;
                this.isSyncing = false;
            }, 1500);

            // Carrega estado inicial
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

            // Aplica configurações visuais
            if(this.settings) {
                if(this.settings.themeColor) this.applyTheme(this.settings.themeColor);
                setSfxEnabled(this.settings.sfxEnabled);
                if(this.settings.crtMode) document.body.classList.add('crt-mode');
            }

            // Watchers para Autosave e UX
            this.$watch('char', (val) => {
                if (!val || this.loadingChar || this.isReverting) return;
                this.unsavedChanges = true; 
                this.isSyncing = true; // Feedback visual imediato "Salvando..."
                this.debouncedSaveFunc(); 
            });
            
            this.$watch('settings.sfxEnabled', (val) => setSfxEnabled(val));

            this.updateAgentCount();
            this.loadingProgress = 100;
            setTimeout(() => { this.systemLoading = false; }, 500);
            
            // Intervalo de segurança para salvamento
            setInterval(() => { if (this.user && this.unsavedChanges) this.syncCloud(true); }, CONSTANTS.SAVE_INTERVAL);
        },

        checkOnboarding() {
            if (!localStorage.getItem('zenite_setup_done')) {
                setTimeout(() => {
                    this.notify("Bem-vindo! Configure seu terminal.", "info");
                    this.configModal = true;
                    localStorage.setItem('zenite_setup_done', 'true');
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
            
            // Listener Global de Cliques para SFX
            let lastHovered = null;
            document.addEventListener('click', (e) => { 
                if(e.target.closest('button, a, input, select, .cursor-pointer, .dice-tray-opt')) {
                    playSFX('click'); 
                }
            });
            
            document.addEventListener('mouseover', (e) => {
                const target = e.target.closest('button, a, .cursor-pointer');
                if (target && target !== lastHovered) {
                    playSFX('hover');
                    lastHovered = target;
                } else if (!target) {
                    lastHovered = null;
                }
            });
        },

        // --- MINIGAME DE ERRO ---
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
            // Garante que não sai da tela (margem 10% a 90%)
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

        // --- UTILITÁRIOS ---
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

        // Atalho Konami
        handleKeys(e) {
            const key = e.key.toLowerCase();
            const code = ['arrowup','arrowup','arrowdown','arrowdown','arrowleft','arrowright','arrowleft','arrowright','b','a'];
            this.konamiBuffer.push(key);
            if (this.konamiBuffer.length > code.length) this.konamiBuffer.shift();
            if (JSON.stringify(this.konamiBuffer) === JSON.stringify(code)) {
                this.hackerModeUnlocked = true;
                this.toggleHackerMode();
                this.konamiBuffer = [];
            }
        }
    };
}

window.zeniteSystem = zeniteSystem;

// INICIALIZAÇÃO DO ALPINE (IMPORTANTE: NÃO APAGAR)
document.addEventListener('DOMContentLoaded', () => {
    import('https://cdn.jsdelivr.net/npm/alpinejs@3.13.3/dist/module.esm.js').then((module) => {
        const Alpine = module.default;
        Alpine.data('zeniteSystem', zeniteSystem);
        Alpine.start();
    });
});