import { CONSTANTS, ARCHETYPES } from './modules/config.js';
import { playSFX, setSfxEnabled } from './modules/audio.js';
import { debounce } from './modules/utils.js';
import { rpgLogic } from './modules/rpg.js';
import { cloudLogic } from './modules/cloud.js';
import { uiLogic } from './modules/ui.js';

// --- CURSOR ENGINE (Global do arquivo, executado uma vez) ---
let cursorX = -100, cursorY = -100;
let isCursorHover = false;

function setupCursorEngine(systemContext) {
    const trail = document.getElementById('mouse-trail');
    if (!window.matchMedia("(pointer: fine)").matches) { if(trail) trail.style.display = 'none'; return; }
    
    document.addEventListener('mousemove', (e) => { 
        cursorX = e.clientX; cursorY = e.clientY;
        if(systemContext.settings.mouseTrail && !systemContext.isMobile) { 
            isCursorHover = e.target.closest('button, a, input, select, textarea, .cursor-pointer, .draggable-handle') !== null; 
        }
    });

    let trailX = 0, trailY = 0;
    const renderLoop = () => {
        if (!trail) return;
        const isAuthenticated = systemContext.user || systemContext.isGuest;
        if (isAuthenticated && systemContext.settings.mouseTrail && !systemContext.isMobile) {
            trailX += (cursorX - trailX) * 0.45;
            trailY += (cursorY - trailY) * 0.45;
            trail.style.display = 'block'; 
            trail.style.transform = `translate3d(${trailX}px, ${trailY}px, 0)`; 
            if(isCursorHover) trail.classList.add('hover-active'); else trail.classList.remove('hover-active');
            if(trail.style.opacity === '0') trail.style.opacity = '1';
        } else { trail.style.display = 'none'; }
        requestAnimationFrame(renderLoop);
    };
    renderLoop();
}

function zeniteSystem() {
    return {
        // --- STATES (Dados Iniciais) ---
        systemLoading: true, loadingProgress: 0, loadingText: 'BOOT',
        loadingChar: false, notifications: [], user: null, isGuest: false,
        userMenuOpen: false, authLoading: false, authMsg: '', authMsgType: '',
        wizardNameError: false,
        rebooting: false,
        
        // Secrets
        konamiBuffer: [], logoClickCount: 0, logoClickTimer: null, 
        systemFailure: false, minigameActive: false, minigameClicks: 5, minigamePos: { x: 50, y: 50 },
        isHackerMode: false, hackerModeUnlocked: false,

        // Data
        chars: {}, activeCharId: null, char: null, agentCount: 0,
        currentView: 'dashboard', activeTab: 'profile', logisticsTab: 'inventory', searchQuery: '',
        unsavedChanges: false, isSyncing: false, saveStatus: 'idle', supabase: null, debouncedSaveFunc: null,
        
        // Widgets
        diceTrayOpen: false, trayDockMode: 'float', trayPosition: { x: window.innerWidth - 350, y: window.innerHeight - 500 },
        isDraggingTray: false, showDiceTip: false, hasSeenDiceTip: false,
        diceLog: [], lastRoll: '--', lastNatural: 0, lastFaces: 20, diceMod: 0, diceReason: '',
        
        // UI
        revertConfirmMode: false, isReverting: false, shakeAlert: false,
        isMobile: window.innerWidth < 768,
        configModal: false, wizardOpen: false, cropperOpen: false, cropperInstance: null, uploadContext: 'char',
        confirmOpen: false, confirmData: { title:'', desc:'', action:null, type:'danger' },
        
        // Wizard
        wizardStep: 1, wizardPoints: 8, wizardData: { class: '', name: '', identity: '', age: '', history: '', photo: null, attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} }, wizardFocusAttr: '',
        
        // Configs
        settings: { mouseTrail: true, compactMode: false, crtMode: true, sfxEnabled: true, themeColor: 'cyan' },
        archetypes: ARCHETYPES,

        // --- MERGE DOS MÓDULOS ---
        ...rpgLogic,
        ...cloudLogic,
        ...uiLogic,

        // --- COMPUTED ---
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

        // --- BOOT (initSystem) ---
        async initSystem() {
            this.loadingProgress = 10; this.loadingText = 'CORE SYSTEM';
            setTimeout(() => { if(this.systemLoading) this.systemLoading = false; }, 5000);
            
            window.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') this.handleEscKey();
            });

            window.addEventListener('beforeunload', (e) => { 
                if (this.unsavedChanges && !this.isGuest) { e.preventDefault(); e.returnValue = 'Alterações pendentes.'; } 
            });

            try {
                await new Promise(r => setTimeout(r, 300));
                
                if (typeof window.supabase !== 'undefined') {
                    this.supabase = window.supabase.createClient(CONSTANTS.SUPABASE_URL, CONSTANTS.SUPABASE_KEY, {
                        auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
                    });
                }
                
                this.loadingProgress = 30; this.loadingText = 'AUTHENTICATING';
                this.debouncedSaveFunc = debounce(() => { this.saveLocal(); }, 1000);
                
                this.setupListeners(); 
                setupCursorEngine(this); // Inicia o cursor
                this.setupWatchers();

                this.loadingProgress = 50; this.loadingText = 'LOADING CACHE';
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
                        } catch(e) { this.notify("Modo Offline", "warn"); }
                        
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
                    }
                }

                this.loadingProgress = 90; this.loadingText = 'APPLYING THEME';
                this.applyTheme(this.settings.themeColor);
                if(this.settings.compactMode && this.isMobile) document.body.classList.add('compact-mode');
                
                if (localStorage.getItem('zenite_hacker_unlocked') === 'true') {
                    this.hackerModeUnlocked = true;
                }
                if (localStorage.getItem('zenite_hacker_mode') === 'true') {
                    this.isHackerMode = true;
                    this.hackerModeUnlocked = true;
                    document.body.classList.add('theme-hacker');
                }

                setSfxEnabled(this.settings.sfxEnabled);
                this.updateVisualState();
                this.updateAgentCount();
                
                setInterval(() => { if (this.user && this.unsavedChanges && !this.isSyncing) this.syncCloud(true); }, CONSTANTS.SAVE_INTERVAL);
                
                this.loadingProgress = 100; this.loadingText = 'READY';
                setTimeout(() => { this.systemLoading = false; }, 500);

            } catch (err) { 
                console.error("Boot Error:", err); 
                this.notify("Erro na inicialização.", "error"); 
                this.systemLoading = false; 
            }
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
            window.addEventListener('resize', () => { this.isMobile = window.innerWidth < 768; this.ensureTrayOnScreen(); });
            window.addEventListener('popstate', (event) => {
                if (this.currentView === 'sheet' && this.unsavedChanges && !this.isGuest) { 
                    history.pushState(null, null, location.href); 
                    this.triggerShake(); 
                    this.notify("Salve antes de sair!", "warn"); 
                    return; 
                }
                if (this.currentView === 'sheet' || this.wizardOpen || this.configModal) { 
                    if(this.currentView === 'sheet') this.saveAndExit(true); 
                    this.wizardOpen = false; 
                    this.configModal = false; 
                    this.cropperOpen = false; 
                }
            });
            
            let lastHovered = null;
            document.addEventListener('click', (e) => { 
                if(e.target.closest('button, a, .cursor-pointer')) playSFX('click'); 
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
        }
    };
}

// A SOLUÇÃO DO PROBLEMA "NOT DEFINED"
window.zeniteSystem = zeniteSystem;