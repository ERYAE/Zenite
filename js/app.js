import { CONSTANTS, ARCHETYPES } from './modules/config.js';
import { playSFX, setSfxEnabled } from './modules/audio.js';
import { debounce, sanitizeChar } from './modules/utils.js';
import { rpgLogic } from './modules/rpg.js';
import { cloudLogic } from './modules/cloud.js';
import { uiLogic } from './modules/ui.js';

// --- CURSOR ENGINE ---
function setupCursorEngine(systemContext) {
    const trail = document.getElementById('mouse-trail');
    if (!trail || !window.matchMedia("(pointer: fine)").matches) return;
    
    let cursorX = -100, cursorY = -100;
    let isCursorHover = false;
    let trailX = 0, trailY = 0;

    document.addEventListener('mousemove', (e) => { 
        cursorX = e.clientX; cursorY = e.clientY;
        if(systemContext.settings.mouseTrail && !systemContext.isMobile) { 
            isCursorHover = e.target.closest('button, a, input, select, textarea, .cursor-pointer, .draggable-handle') !== null; 
        }
    });

    const renderLoop = () => {
        const isAuthenticated = systemContext.user || systemContext.isGuest;
        if (isAuthenticated && systemContext.settings.mouseTrail && !systemContext.isMobile) {
            trailX += (cursorX - trailX) * 0.45;
            trailY += (cursorY - trailY) * 0.45;
            trail.style.display = 'block'; 
            trail.style.transform = `translate3d(${trailX}px, ${trailY}px, 0)`; 
            if(isCursorHover) trail.classList.add('hover-active'); else trail.classList.remove('hover-active');
            if(trail.style.opacity === '0') trail.style.opacity = '1';
        } else { 
            trail.style.display = 'none'; 
        }
        requestAnimationFrame(renderLoop);
    };
    renderLoop();
}

// --- FUNÇÃO PRINCIPAL ---
function zeniteSystem() {
    return {
        // --- ESTADO INICIAL DO SISTEMA (CORREÇÃO DOS ERROS "NOT DEFINED") ---
        
        // Sistema & Loading
        systemLoading: true, 
        loadingProgress: 0, 
        loadingText: 'BOOT',
        loadingChar: false,
        rebooting: false,
        
        // Usuário & Auth
        user: null, 
        isGuest: false,
        userMenuOpen: false, 
        authLoading: false, 
        authMsg: '', 
        authMsgType: '',
        
        // Navegação
        currentView: 'dashboard', 
        activeTab: 'profile', 
        logisticsTab: 'inventory',
        searchQuery: '',
        
        // Dados Principais
        chars: {}, 
        activeCharId: null, 
        char: null, 
        agentCount: 0,
        
        // Configurações
        settings: { 
            mouseTrail: true, 
            compactMode: false, 
            crtMode: true, 
            sfxEnabled: true, 
            themeColor: 'cyan' 
        },
        
        // Wizard (Criação de Personagem)
        wizardOpen: false,
        wizardStep: 1, 
        wizardPoints: 8, 
        wizardNameError: false,
        wizardFocusAttr: '',
        wizardData: { 
            class: '', name: '', identity: '', age: '', history: '', photo: null, 
            attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} 
        },
        
        // Notificações & Modais
        notifications: [], 
        configModal: false,
        confirmOpen: false,
        confirmData: { title:'', desc:'', action:null, type:'danger' },
        unsavedChanges: false,
        revertConfirmMode: false,
        isReverting: false,
        shakeAlert: false,
        isSyncing: false,
        saveStatus: 'idle',
        
        // Cropper (Imagem)
        cropperOpen: false,
        cropperInstance: null, 
        uploadContext: 'char',
        
        // Dados & Bandeja
        diceTrayOpen: false,
        trayDockMode: 'float', 
        trayPosition: { x: window.innerWidth - 350, y: window.innerHeight - 500 }, 
        isDraggingTray: false,
        showDiceTip: false, 
        hasSeenDiceTip: false,
        diceLog: [], 
        lastRoll: '--', 
        lastNatural: 0, 
        lastFaces: 20, 
        diceMod: 0, 
        diceReason: '',
        
        // Segredos & Minigame
        konamiBuffer: [], 
        logoClickCount: 0, 
        logoClickTimer: null, 
        systemFailure: false, 
        minigameActive: false, 
        minigameClicks: 5, 
        minigamePos: { x: 50, y: 50 },
        isHackerMode: false, 
        hackerModeUnlocked: false,
        
        // Variável Auxiliar
        isMobile: window.innerWidth < 768,
        supabase: null,
        debouncedSaveFunc: null,
        archetypes: ARCHETYPES, // Constante importada

        // --- MERGE DOS MÓDULOS (Traz as funções de volta) ---
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
            this.loadingProgress = 10;
            
            // Setup Supabase
            if (typeof window.supabase !== 'undefined') {
                this.supabase = window.supabase.createClient(CONSTANTS.SUPABASE_URL, CONSTANTS.SUPABASE_KEY);
            }

            this.setupListeners();
            this.debouncedSaveFunc = debounce(() => { this.saveLocal(); }, 1000);

            // Carregar Dados
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
                            this.loadingText = 'SYNCING CLOUD';
                            this.loadingProgress = 70;
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
                    } catch(e) { this.notify("Modo Offline", "warn"); }
                }
            }

            // Aplicar Configs e SFX
            if(this.settings) {
                this.applyTheme(this.settings.themeColor);
                setSfxEnabled(this.settings.sfxEnabled); // <--- AQUI CORRIGE O SOM
                this.updateVisualState();
            }

            // Watchers Manuais
            this.$watch('char', () => { 
                if(!this.isGuest && this.char) { 
                    this.unsavedChanges = true; 
                    this.debouncedSaveFunc(); 
                } 
            });
            
            // Watcher CRÍTICO para o SOM
            this.$watch('settings.sfxEnabled', (val) => {
                setSfxEnabled(val);
            });

            setupCursorEngine(this);

            this.loadingProgress = 100;
            setTimeout(() => { this.systemLoading = false; }, 500);
            
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
        },
        
        handleKeys(e) {
            if (e.key === 'Escape') this.handleEscKey();
            const key = e.key.toLowerCase();
            const code = ['arrowup','arrowup','arrowdown','arrowdown','arrowleft','arrowright','arrowleft','arrowright','b','a'];
            this.konamiBuffer.push(key);
            if (this.konamiBuffer.length > code.length) this.konamiBuffer.shift();
            
            if (JSON.stringify(this.konamiBuffer) === JSON.stringify(code)) {
                this.hackerModeUnlocked = true;
                localStorage.setItem('zenite_hacker_unlocked', 'true');
                if (!this.isHackerMode) this.toggleHackerMode();
                else { playSFX('success'); this.notify("ACESSO RECONHECIDO", "success"); }
                this.konamiBuffer = [];
            }
        }
    };
}

// --- REGISTRO GLOBAL ---
window.zeniteSystem = zeniteSystem;

// --- GARANTIA DE CARREGAMENTO ---
document.addEventListener('alpine:init', () => {
    Alpine.data('zeniteSystem', zeniteSystem);
});