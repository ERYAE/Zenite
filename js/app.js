/**
 * ZENITE OS - Core Application
 * Version: v86-stable
 * Fixes: Data Sanitization, Reboot State, Audio Handling
 */

const CONSTANTS = {
    MAX_AGENTS: 30,
    SAVE_INTERVAL: 180000, 
    TOAST_DURATION: 3000,
    // AVISO: Em produção, use variáveis de ambiente para estas chaves
    SUPABASE_URL: 'https://pwjoakajtygmbpezcrix.supabase.co',
    SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3am9ha2FqdHlnbWJwZXpjcml4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNTA4OTQsImV4cCI6MjA3OTcyNjg5NH0.92HNNPCaKccRLIV6HbP1CBFI7jL5ktt24Qh1tr-Md5E'
};

let cursorX = -100, cursorY = -100;
let isCursorHover = false;
let renderRafId = null;

/// --- AUDIO ENGINE: WHITE NOISE SYNTHESIS ---
let audioCtx = null;
let noiseBuffer = null;
let sfxEnabledGlobal = true;
let userHasInteracted = false;

const initAudio = () => {
    if (audioCtx) return; 
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
        const bufferSize = audioCtx.sampleRate * 2;
        noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
    } catch(e) {
        console.warn("Audio Context not supported or blocked");
    }
};

document.addEventListener('click', () => {
    userHasInteracted = true;
    initAudio();
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}, { once: true });

const playSFX = (type) => {
    if (!userHasInteracted || !audioCtx || !sfxEnabledGlobal) return;

    try {
        const now = audioCtx.currentTime;
        const gain = audioCtx.createGain();
        gain.connect(audioCtx.destination);

        if (type === 'hover') {
            const src = audioCtx.createBufferSource();
            src.buffer = noiseBuffer;
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 800;
            filter.Q.value = 10;
            src.connect(filter);
            filter.connect(gain);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            src.start(now); src.stop(now + 0.05);

        } else if (type === 'click') {
            const osc = audioCtx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1200, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            osc.connect(gain);
            osc.start(now); osc.stop(now + 0.05);

        } else if (type === 'save') { 
            const osc = audioCtx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, now);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
            osc.connect(gain);
            osc.start(now); osc.stop(now + 0.6);

        } else if (type === 'discard') { 
            const osc = audioCtx.createOscillator();
            osc.type = 'sawtooth';
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            osc.frequency.setValueAtTime(100, now);
            osc.frequency.linearRampToValueAtTime(10, now + 0.3);
            filter.frequency.setValueAtTime(500, now);
            filter.frequency.linearRampToValueAtTime(50, now + 0.3);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
            osc.connect(filter); filter.connect(gain);
            osc.start(now); osc.stop(now + 0.3);

        } else if (type === 'glitch') {
            const src = audioCtx.createBufferSource();
            src.buffer = noiseBuffer;
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 400;
            src.connect(filter);
            filter.connect(gain);
            gain.gain.setValueAtTime(0.8, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 2.0);
            src.start(now); src.stop(now + 2.0);
        }
    } catch(e) {
        console.error("SFX Error", e);
    }
};

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function zeniteSystem() {
    return {
        // STATES
        systemLoading: true, loadingProgress: 0, loadingText: 'BOOT',
        loadingChar: false, notifications: [], user: null, isGuest: false,
        userMenuOpen: false, authLoading: false, authMsg: '', authMsgType: '',
        wizardNameError: false,
        rebooting: false, // CORREÇÃO: Variável adicionada para evitar ReferenceError
        
        // SECRETS
        konamiBuffer: [], logoClickCount: 0, logoClickTimer: null, systemFailure: false,

        // DATA
        chars: {}, activeCharId: null, char: null, agentCount: 0,
        currentView: 'dashboard', activeTab: 'profile', logisticsTab: 'inventory', searchQuery: '',
        
        // WIDGETS
        diceTrayOpen: false, trayDockMode: 'float', trayPosition: { x: window.innerWidth - 350, y: window.innerHeight - 500 },
        isDraggingTray: false, dragOffset: { x: 0, y: 0 },
        showDiceTip: false, hasSeenDiceTip: false,
        diceLog: [], lastRoll: '--', lastNatural: 0, lastFaces: 20, diceMod: 0, diceReason: '',
        
        // UX
        revertConfirmMode: false, isReverting: false, shakeAlert: false,
        isMobile: window.innerWidth < 768,

        // MODALS
        configModal: false, wizardOpen: false, cropperOpen: false, cropperInstance: null, uploadContext: 'char',
        confirmOpen: false, confirmData: { title:'', desc:'', action:null, type:'danger' },
        
        // WIZARD
        wizardStep: 1, wizardPoints: 8, wizardData: { class: '', name: '', identity: '', age: '', history: '', photo: null, attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} }, wizardFocusAttr: '',
        
        // CONFIGS
        settings: {
            mouseTrail: true, compactMode: false, performanceMode: false, 
            crtMode: true, sfxEnabled: true,
            themeColor: 'cyan'
        },
        
        unsavedChanges: false, isSyncing: false, saveStatus: 'idle', supabase: null, debouncedSaveFunc: null,

        archetypes: [
            { class: 'Titã', icon: 'fa-solid fa-shield-halved', focus: 'for', color: 'text-rose-500', desc: 'Resiliência e força bruta.' },
            { class: 'Estrategista', icon: 'fa-solid fa-chess', focus: 'int', color: 'text-cyan-500', desc: 'Análise tática e liderança.' },
            { class: 'Infiltrador', icon: 'fa-solid fa-user-ninja', focus: 'agi', color: 'text-emerald-500', desc: 'Furtividade e precisão.' },
            { class: 'Controlador', icon: 'fa-solid fa-hand-spock', focus: 'pod', color: 'text-violet-500', desc: 'Manipulação de energia.' },
            { class: 'Psíquico', icon: 'fa-solid fa-brain', focus: 'von', color: 'text-amber-500', desc: 'Domínio mental.' }
        ],

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

        async initSystem() {
            this.loadingProgress = 10; this.loadingText = 'CORE SYSTEM';
            // Timeout de segurança reduzido
            setTimeout(() => { if(this.systemLoading) this.systemLoading = false; }, 5000);
            
            window.addEventListener('beforeunload', (e) => { 
                if (this.unsavedChanges && !this.isGuest) { e.preventDefault(); e.returnValue = 'Alterações pendentes.'; } 
            });

            try {
                await new Promise(r => setTimeout(r, 300));
                
                // Inicializa Supabase se disponível
                if (typeof window.supabase !== 'undefined') {
                    this.supabase = window.supabase.createClient(CONSTANTS.SUPABASE_URL, CONSTANTS.SUPABASE_KEY, {
                        auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
                    });
                }
                
                this.loadingProgress = 30; this.loadingText = 'AUTHENTICATING';
                this.debouncedSaveFunc = debounce(() => { this.saveLocal(); }, 1000);
                
                this.setupListeners(); 
                this.setupCursorEngine(); 
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
                            }
                        } catch(e) { this.notify("Modo Offline", "warn"); }
                        
                        this.supabase.auth.onAuthStateChange(async (event, session) => {
                            if (event === 'SIGNED_IN' && session) { 
                                if (this.user?.id === session.user.id) return; 
                                this.user = session.user; 
                                this.isGuest = false; 
                                localStorage.removeItem('zenite_is_guest'); 
                                await this.fetchCloud(); 
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
                if(this.settings.performanceMode) document.body.classList.add('performance-mode');
                
                sfxEnabledGlobal = this.settings.sfxEnabled;
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

        // --- FUNÇÃO NOVA: Sanitize Data ---
        // Garante que o objeto char tenha todos os campos necessários para não quebrar o Alpine
        sanitizeChar(data) {
            if (!data) return null;
            const safe = JSON.parse(JSON.stringify(data));
            
            // Garante campos básicos
            if (!safe.attrs) safe.attrs = {for:0, agi:0, int:0, von:0, pod:0};
            if (!safe.stats) safe.stats = {};
            if (!safe.stats.pv) safe.stats.pv = {current: 10, max: 10};
            if (!safe.stats.pf) safe.stats.pf = {current: 10, max: 10};
            if (!safe.stats.pdf) safe.stats.pdf = {current: 10, max: 10};
            
            // Garante Inventário
            if (!safe.inventory) safe.inventory = { weapons:[], armor:[], gear:[], backpack: "", social: { people:[], objects:[]} };
            if (!safe.inventory.weapons) safe.inventory.weapons = [];
            if (!safe.inventory.armor) safe.inventory.armor = [];
            if (!safe.inventory.gear) safe.inventory.gear = [];
            if (!safe.inventory.social) safe.inventory.social = { people:[], objects:[] };
            
            // Garante Skills e Poderes
            if (!safe.skills) safe.skills = [];
            if (!safe.powers) safe.powers = { passive:'', active:'', techniques:[], lvl3:'', lvl6:'', lvl9:'', lvl10:'' };
            if (!safe.powers.techniques) safe.powers.techniques = [];
            
            return safe;
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
        },

        handleKeys(e) {
            const key = e.key.toLowerCase();
            const konamiCode = ['arrowup','arrowup','arrowdown','arrowdown','arrowleft','arrowright','arrowleft','arrowright','b','a'];
            this.konamiBuffer.push(key);
            if (this.konamiBuffer.length > konamiCode.length) this.konamiBuffer.shift();
            if (JSON.stringify(this.konamiBuffer) === JSON.stringify(konamiCode)) {
                document.body.classList.toggle('theme-hacker');
                if(document.body.classList.contains('theme-hacker')) { playSFX('success'); this.notify("SYSTEM OVERRIDE: HACKER MODE", "success"); } 
                else { playSFX('click'); this.notify("SYSTEM NORMAL", "info"); }
                this.konamiBuffer = [];
            }
        },

        handleLogoClick() {
            clearTimeout(this.logoClickTimer); 
            this.logoClickCount++;
            
            if (this.logoClickCount >= 5) {
                this.logoClickCount = 0;
                this.triggerSystemFailure();
                return;
            }
            
            this.logoClickTimer = setTimeout(() => { this.logoClickCount = 0; }, 2000);
            
            if (!this.systemFailure) { 
                 if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(()=>{});
                } else if (document.exitFullscreen) {
                    document.exitFullscreen();
                }
            }
        },

        triggerSystemFailure() {
            playSFX('glitch'); 
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch((err) => { console.log("Fullscreen blocked:", err); });
            }
            this.systemFailure = true; 
            setTimeout(() => { this.systemFailure = false; }, 5000); // Reset automático
        },

        ensureTrayOnScreen() {
            if(this.isMobile || this.trayDockMode !== 'float') return;
            this.trayPosition.x = Math.max(10, Math.min(window.innerWidth - 320, this.trayPosition.x));
            this.trayPosition.y = Math.max(60, Math.min(window.innerHeight - 400, this.trayPosition.y));
        },

        updateVisualState() {
            const isAuthenticated = this.user || this.isGuest;
            const showTrail = isAuthenticated && this.settings.mouseTrail && !this.settings.performanceMode && !this.isMobile;

            if (showTrail) { document.body.classList.add('custom-cursor-active'); } 
            else { document.body.classList.remove('custom-cursor-active'); }

            if (isAuthenticated && this.settings.crtMode) { document.body.classList.add('crt-mode'); } 
            else { document.body.classList.remove('crt-mode'); }
            
            sfxEnabledGlobal = this.settings.sfxEnabled;
        },

        setupCursorEngine() {
            const trail = document.getElementById('mouse-trail');
            if (!window.matchMedia("(pointer: fine)").matches) { if(trail) trail.style.display = 'none'; return; }
            
            let trailX = 0, trailY = 0;

            document.addEventListener('mousemove', (e) => { 
                cursorX = e.clientX; cursorY = e.clientY;
                if(this.settings.mouseTrail && !this.isMobile) { 
                    isCursorHover = e.target.closest('button, a, input, select, textarea, .cursor-pointer, .draggable-handle') !== null; 
                }
            });
            
            const renderLoop = () => {
                if (!trail) return;
                const isAuthenticated = this.user || this.isGuest;
                
                if (isAuthenticated && this.settings.mouseTrail && !this.settings.performanceMode && !this.isMobile) {
                    trailX += (cursorX - trailX) * 0.45;
                    trailY += (cursorY - trailY) * 0.45;

                    trail.style.display = 'block'; 
                    trail.style.transform = `translate3d(${trailX}px, ${trailY}px, 0)`; 
                    
                    if(isCursorHover) trail.classList.add('hover-active'); else trail.classList.remove('hover-active');
                    if(trail.style.opacity === '0') trail.style.opacity = '1';
                } else { 
                    trail.style.display = 'none'; 
                }
                renderRafId = requestAnimationFrame(renderLoop);
            };
            renderLoop();
        },

        toggleDiceTray() {
            if (this.isReverting) return;
            this.diceTrayOpen = !this.diceTrayOpen;
            if(this.diceTrayOpen) {
                if(!this.hasSeenDiceTip) { this.hasSeenDiceTip = true; this.saveLocal(); }
                this.showDiceTip = false; this.ensureTrayOnScreen();
            }
        },
        setDockMode(mode) {
            this.trayDockMode = mode;
            if(mode === 'float') { this.trayPosition = { x: window.innerWidth - 350, y: window.innerHeight - 500 }; this.ensureTrayOnScreen(); }
        },
        startDragTray(e) {
            if(this.isMobile || this.trayDockMode !== 'float') return;
            if(e.target.closest('button') || e.target.closest('input')) return;
            
            const trayEl = document.getElementById('dice-tray-window');
            if(!trayEl) return;

            this.isDraggingTray = true;
            const startX = e.clientX;
            const startY = e.clientY;
            const startLeft = this.trayPosition.x;
            const startTop = this.trayPosition.y;
            
            trayEl.style.transition = 'none';

            const moveHandler = (ev) => {
                if(!this.isDraggingTray) return;
                const dx = ev.clientX - startX;
                const dy = ev.clientY - startY;
                trayEl.style.left = `${startLeft + dx}px`;
                trayEl.style.top = `${startTop + dy}px`;
            };

            const upHandler = (ev) => {
                this.isDraggingTray = false;
                document.removeEventListener('mousemove', moveHandler);
                document.removeEventListener('mouseup', upHandler);
                const dx = ev.clientX - startX;
                const dy = ev.clientY - startY;
                this.trayPosition.x = startLeft + dx;
                this.trayPosition.y = startTop + dy;
                if(trayEl) trayEl.style.transition = '';
                this.saveLocal(); 
            };

            document.addEventListener('mousemove', moveHandler);
            document.addEventListener('mouseup', upHandler);
        },

        setupWatchers() {
            this.$watch('char', (val) => {
                if (this.loadingChar || this.systemLoading || this.isReverting) return;
                if (val && this.activeCharId) {
                    this.chars[this.activeCharId] = JSON.parse(JSON.stringify(val));
                    if (!this.isGuest) { this.unsavedChanges = true; this.saveStatus = 'idle'; }
                    this.debouncedSaveFunc();
                    if (this.activeTab === 'profile') this.updateRadarChart();
                }
            }, {deep: true});
            this.$watch('currentView', (val) => { if (val !== 'sheet') { this.diceTrayOpen = false; this.revertConfirmMode = false; } });
            this.$watch('user', (val) => { this.updateVisualState(); });
            this.$watch('isGuest', (val) => { this.updateVisualState(); });
        },

        loadLocal(key) {
            const local = localStorage.getItem(key);
            if(local) {
                try {
                    const parsed = JSON.parse(local);
                    if(parsed.config) this.settings = { ...this.settings, ...parsed.config };
                    if(parsed.trayPos) this.trayPosition = parsed.trayPos;
                    if(parsed.hasSeenTip !== undefined) this.hasSeenDiceTip = parsed.hasSeenTip;
                    const validChars = {};
                    Object.keys(parsed).forEach(k => { 
                        if(!['config','trayPos','hasSeenTip'].includes(k) && parsed[k]?.id) {
                            // Sanitiza ao carregar do local também
                            validChars[k] = this.sanitizeChar(parsed[k]); 
                        }
                    });
                    this.chars = validChars;
                    this.updateAgentCount();
                } catch(e) { console.error("Local Load Error", e); }
            }
        },

        saveLocal() {
            const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db';
            const payload = { ...this.chars, config: this.settings, trayPos: this.trayPosition, hasSeenTip: this.hasSeenDiceTip };
            localStorage.setItem(key, JSON.stringify(payload));
        },

        triggerShake() { this.shakeAlert = true; setTimeout(() => this.shakeAlert = false, 300); },
        attemptGoBack() { if (this.unsavedChanges && !this.isGuest) { this.triggerShake(); this.notify("Salve ou descarte antes de sair.", "warn"); return; } this.saveAndExit(); },

        saveAndExit(fromHistory = false) {
            if (this.unsavedChanges && !this.isGuest && !fromHistory) { 
                this.triggerShake(); 
                return; 
            }
            
            if(this.char && this.activeCharId) { 
                this.chars[this.activeCharId] = JSON.parse(JSON.stringify(this.char)); 
                this.updateAgentCount(); 
            } 
            
            this.saveLocal(); 
            if (!this.isGuest && this.unsavedChanges) this.syncCloud(true); 
            
            this.diceTrayOpen = false; 
            this.showDiceTip = false;
            this.currentView = 'dashboard'; 
            this.activeCharId = null;
            
            if (!fromHistory && window.location.hash === '#sheet') { history.back(); }
        },

        toggleRevertMode() { this.revertConfirmMode = !this.revertConfirmMode; if(this.revertConfirmMode) this.diceTrayOpen = false; },
        
        async performRevert() {
            this.isReverting = true; this.diceTrayOpen = false; this.revertConfirmMode = false;
            document.body.classList.add('animating-out'); document.body.classList.add('interaction-lock');
            playSFX('discard'); 
            setTimeout(async () => {
                try {
                    if(this.isGuest) { this.loadLocal('zenite_guest_db'); } else { this.loadLocal('zenite_cached_db'); await this.fetchCloud(); }
                    
                    if(this.activeCharId && this.chars[this.activeCharId]) { 
                        // Sanitiza ao reverter
                        this.char = this.sanitizeChar(this.chars[this.activeCharId]); 
                    } else { 
                        this.currentView = 'dashboard'; 
                        this.char = null; 
                    }
                    
                    this.unsavedChanges = false;
                    document.body.classList.remove('animating-out'); document.body.classList.add('animating-in');
                    this.notify('Dados restaurados.', 'success');
                    setTimeout(() => { document.body.classList.remove('animating-in'); document.body.classList.remove('interaction-lock'); this.isReverting = false; }, 400);
                } catch (e) {
                    console.error("Revert Error:", e); this.notify("Erro na restauração.", "error");
                    document.body.classList.remove('animating-out'); document.body.classList.remove('interaction-lock'); this.isReverting = false;
                }
            }, 300);
        },

        async fetchCloud() {
            if (!this.user || !this.supabase) return;
            try {
                let { data, error } = await this.supabase.from('profiles').select('data').eq('id', this.user.id).single();
                if (error && error.code === 'PGRST116') { await this.supabase.from('profiles').insert([{ id: this.user.id, data: { config: this.settings } }]); data = { data: { config: this.settings } }; }
                if (data && data.data) {
                    const cloudData = data.data;
                    if(cloudData.config) { this.settings = { ...this.settings, ...cloudData.config }; this.applyTheme(this.settings.themeColor); }
                    if(cloudData.hasSeenTip !== undefined) this.hasSeenDiceTip = cloudData.hasSeenTip;
                    
                    let merged = { ...this.chars }; 
                    let hasLocalOnly = false;
                    
                    Object.keys(cloudData).forEach(k => { 
                        if(!['config','hasSeenTip'].includes(k)) {
                            // Sanitiza dados da nuvem
                            merged[k] = this.sanitizeChar(cloudData[k]); 
                        }
                    });
                    
                    Object.keys(this.chars).forEach(localId => { if (!cloudData[localId] && localId !== 'config') { merged[localId] = this.chars[localId]; hasLocalOnly = true; } });
                    
                    this.chars = merged; 
                    this.updateAgentCount(); 
                    this.saveLocal();
                    if (hasLocalOnly) { this.unsavedChanges = true; this.syncCloud(true); }
                }
            } catch(e) {}
        },

        async syncCloud(silent = false) {
             if (!this.user || this.isGuest || !this.unsavedChanges || this.isSyncing || !this.supabase) return;
            this.isSyncing = true; if(!silent) this.notify('Sincronizando...', 'info');
            try {
                const payload = { ...this.chars, config: this.settings, hasSeenTip: this.hasSeenDiceTip };
                const { error } = await this.supabase.from('profiles').upsert({ id: this.user.id, data: payload });
                if (error) throw error;
                this.unsavedChanges = false; this.saveStatus = 'success'; 
                if(!silent) { this.notify('Salvo!', 'success'); playSFX('save'); } 
            } catch (e) { this.saveStatus = 'error'; if(!silent) this.notify('Erro ao salvar.', 'error'); } finally { this.isSyncing = false; }
        },
        
        updateAgentCount() { this.agentCount = Object.keys(this.chars).length; },
        
        calculateBaseStats(className, levelStr, attrs) {
            const cl = className || 'Titã'; const lvl = Math.max(1, parseInt(levelStr) || 1); const get = (v) => parseInt(attrs[v] || 0);
            const config = { 'Titã':{pv:[15,4],pf:[12,2],pdf:[12,2]}, 'Estrategista':{pv:[12,2],pf:[15,4],pdf:[12,2]}, 'Infiltrador':{pv:[12,2],pf:[15,4],pdf:[12,3]}, 'Controlador':{pv:[12,2],pf:[12,2],pdf:[15,4]}, 'Psíquico':{pv:[12,2],pf:[13,3],pdf:[14,3]} };
            const cfg = config[cl] || config['Titã'];
            return { pv:(cfg.pv[0]+get('for'))+((cfg.pv[1]+get('for'))*(lvl-1)), pf:(cfg.pf[0]+get('pod'))+((cfg.pf[1]+get('pod'))*(lvl-1)), pdf:(cfg.pdf[0]+get('von'))+((cfg.pdf[1]+get('von'))*(lvl-1)) };
        },
        
        recalcDerivedStats() { 
            if(!this.char) return; 
            // Proteção contra stats undefined
            if(!this.char.stats) this.char.stats = {pv:{current:0,max:0}, pf:{current:0,max:0}, pdf:{current:0,max:0}};
            
            const newStats = this.calculateBaseStats(this.char.class, this.char.level, this.char.attrs); 
            const c = this.char;
            
            // Funções auxiliares para evitar NaN
            const safeStat = (stat, key) => (stat && stat[key] !== undefined) ? stat[key] : 0;
            
            const diffPv = (safeStat(c.stats.pv, 'max')||newStats.pv) - safeStat(c.stats.pv, 'current'); 
            const diffPf = (safeStat(c.stats.pf, 'max')||newStats.pf) - safeStat(c.stats.pf, 'current'); 
            const diffPdf = (safeStat(c.stats.pdf, 'max')||newStats.pdf) - safeStat(c.stats.pdf, 'current');
            
            c.stats.pv.max = newStats.pv; c.stats.pv.current = Math.max(0, newStats.pv-diffPv); 
            c.stats.pf.max = newStats.pf; c.stats.pf.current = Math.max(0, newStats.pf-diffPf); 
            c.stats.pdf.max = newStats.pdf; c.stats.pdf.current = Math.max(0, newStats.pdf-diffPdf);
        },
        
        modAttr(key, val) { 
            const c = this.char; 
            if(!c.attrs) c.attrs = {for:0, agi:0, int:0, von:0, pod:0};
            if ((val > 0 && c.attrs[key] < 6) || (val < 0 && c.attrs[key] > -1)) { c.attrs[key] += val; this.recalcDerivedStats(); this.updateRadarChart(); } 
        },
        
        modStat(stat, val) { 
            if(!this.char || !this.char.stats[stat]) return; 
            const s = this.char.stats[stat]; 
            s.current = Math.max(0, Math.min(s.max, s.current + val)); 
        },

        openWizard() { if(this.agentCount >= CONSTANTS.MAX_AGENTS) return this.notify('Limite atingido.', 'error'); this.wizardStep = 1; this.wizardPoints = 8; this.wizardData = { class: '', name: '', identity: '', age: '', history: '', photo: null, attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} }; this.wizardFocusAttr = ''; history.pushState({ modal: 'wizard' }, "Wizard", "#new"); this.wizardOpen = true; },
        selectArchetype(a) { this.wizardData.class = a.class; this.wizardData.attrs = {for:-1, agi:-1, int:-1, von:-1, pod:-1}; this.wizardData.attrs[a.focus] = 0; this.wizardFocusAttr = a.focus; this.wizardStep = 2; this.$nextTick(() => { this.updateWizardChart(); }); },
        modWizardAttr(k,v) { const c = this.wizardData.attrs[k]; const f = k === this.wizardFocusAttr; if(v>0 && this.wizardPoints>0 && c<3) { this.wizardData.attrs[k]++; this.wizardPoints--; this.updateWizardChart(); } if(v<0 && c>(f?0:-1)) { this.wizardData.attrs[k]--; this.wizardPoints++; this.updateWizardChart(); } },
        
        finishWizard() {
            if(!this.wizardData.name) { 
                this.wizardNameError = true;
                this.notify("Codinome obrigatório!", "warn");
                playSFX('error'); 
                setTimeout(() => { this.wizardNameError = false; }, 500);
                return; 
            }
            
            const id = 'z_'+Date.now(); 
            const calculated = this.calculateBaseStats(this.wizardData.class, 1, this.wizardData.attrs);
            // Sanitização já na criação
            const newChar = this.sanitizeChar({ 
                id, 
                name: this.wizardData.name, 
                identity: this.wizardData.identity, 
                class: this.wizardData.class, 
                level: 1, 
                age: this.wizardData.age, 
                photo: this.wizardData.photo || '', 
                history: this.wizardData.history, 
                credits: 0, 
                attrs: {...this.wizardData.attrs}, 
                stats: { pv: {current: calculated.pv, max: calculated.pv}, pf: {current: calculated.pf, max: calculated.pf}, pdf: {current: calculated.pdf, max: calculated.pdf} }, 
                inventory: { weapons:[], armor:[], gear:[], backpack:"", social:{people:[], objects:[]} }, 
                skills: [], 
                powers: { passive:'', active:'', techniques:[], lvl3:'', lvl6:'', lvl9:'', lvl10:'' } 
            });
            
            this.chars[id] = newChar; 
            this.updateAgentCount(); 
            this.saveLocal(); 
            
            if(!this.isGuest) { 
                this.unsavedChanges = true; 
                this.syncCloud(true); 
            }
            
            this.wizardOpen = false; 
            history.replaceState({ view: 'sheet', id: id }, "Ficha", "#sheet"); 
            this.loadCharacter(id, true); 
            this.notify('Agente Inicializado.', 'success');
        },
        
        toggleSetting(key, val=null) {
            if(val !== null) { this.settings[key] = val; if(key === 'themeColor') this.applyTheme(val); } 
            else { 
                this.settings[key] = !this.settings[key]; 
                if(key === 'compactMode') { if(this.isMobile) document.body.classList.toggle('compact-mode', this.settings.compactMode); }
                if(key === 'performanceMode') document.body.classList.toggle('performance-mode', this.settings.performanceMode); 
                if(key === 'crtMode') this.updateVisualState();
            }
            this.updateVisualState(); this.saveLocal(); if(!this.isGuest && this.user) { this.unsavedChanges = true; this.syncCloud(true); }
        },
        
        applyTheme(color) {
            const root = document.documentElement; const map = { 'cyan': '#0ea5e9', 'purple': '#d946ef', 'gold': '#eab308' };
            const hex = map[color] || map['cyan']; const r = parseInt(hex.slice(1, 3), 16); const g = parseInt(hex.slice(3, 5), 16); const b = parseInt(hex.slice(5, 7), 16);
            root.style.setProperty('--neon-core', hex); root.style.setProperty('--neon-rgb', `${r}, ${g}, ${b}`); 
            const trail = document.getElementById('mouse-trail'); if(trail) trail.style.background = `radial-gradient(circle, rgba(${r}, ${g}, ${b}, 0.2), transparent 70%)`;
        },
        
        askLogout() { this.askConfirm('SAIR?', 'Dados pendentes serão salvos.', 'warn', () => this.logout()); },
        
        async logout() { 
            this.systemLoading = true; 
            if(this.unsavedChanges && !this.isGuest) { 
                try { await this.syncCloud(true); } catch(e) { console.warn("Erro ao salvar no logout", e); } 
            } 
            localStorage.removeItem('zenite_cached_db'); 
            localStorage.removeItem('zenite_is_guest'); 
            if(this.supabase) {
                try { await this.supabase.auth.signOut(); } catch(e) { console.error("Erro no Supabase SignOut", e); }
            }
            window.location.reload(); 
        },

        askSwitchToOnline() { this.askConfirm('FICAR ONLINE?', 'Ir para login.', 'info', () => { this.isGuest = false; localStorage.removeItem('zenite_is_guest'); window.location.reload(); }); },
        enterGuest() { this.isGuest = true; localStorage.setItem('zenite_is_guest', 'true'); this.loadLocal('zenite_guest_db'); },
        doSocialAuth(provider) { if(!this.supabase) return this.notify("Erro de conexão.", "error"); this.authLoading = true; this.authMsg = "Conectando..."; this.supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } }).then(({error}) => { if(error) { this.notify(error.message, 'error'); this.authLoading = false; } }); },
        
        loadCharacter(id, skipPush = false) {
            if(!this.chars[id]) return this.notify('Erro ao carregar.', 'error');
            if (!skipPush) history.pushState({ view: 'sheet', id: id }, "Ficha", "#sheet");
            
            this.loadingChar = true; 
            this.activeCharId = id; 
            this.diceTrayOpen = false; 
            
            requestAnimationFrame(() => {
                // CORREÇÃO: Sanitiza os dados ao carregar para evitar erros "undefined"
                this.char = this.sanitizeChar(this.chars[id]);
                
                this.currentView = 'sheet'; 
                this.activeTab = 'profile'; 
                this.diceTrayOpen = false; 
                
                if(!this.hasSeenDiceTip) setTimeout(() => this.showDiceTip = true, 1000);
                
                this.$nextTick(() => { 
                    this.updateRadarChart(); 
                    setTimeout(() => { this.loadingChar = false; this.unsavedChanges = false; }, 300); 
                });
            });
         },
         
        askDeleteChar(id) { this.askConfirm('ELIMINAR?', 'Irreversível.', 'danger', () => { delete this.chars[id]; this.saveLocal(); if(!this.isGuest) this.syncCloud(true); this.updateAgentCount(); this.notify('Deletado.', 'success'); }); },
        askHardReset() { this.askConfirm('LIMPAR TUDO?', 'Apaga cache local.', 'danger', () => { localStorage.clear(); window.location.reload(); }); },
        askConfirm(title, desc, type, action) { this.confirmData = { title, desc, type, action }; this.confirmOpen = true; }, 
        confirmYes() { if (this.confirmData.action) this.confirmData.action(); this.confirmOpen = false; },

        _renderChart(id, data, isWizard=false) { const ctx = document.getElementById(id); if(!ctx) return; const color = getComputedStyle(document.documentElement).getPropertyValue('--neon-core').trim(); const r = parseInt(color.slice(1, 3), 16); const g = parseInt(color.slice(3, 5), 16); const b = parseInt(color.slice(5, 7), 16); const rgb = `${r},${g},${b}`; if (ctx.chart) { ctx.chart.data.datasets[0].data = data; ctx.chart.data.datasets[0].backgroundColor = `rgba(${rgb}, 0.2)`; ctx.chart.data.datasets[0].borderColor = `rgba(${rgb}, 1)`; ctx.chart.update(); } else { ctx.chart = new Chart(ctx, { type: 'radar', data: { labels: ['FOR','AGI','INT','VON','POD'], datasets: [{ data: data, backgroundColor: `rgba(${rgb}, 0.2)`, borderColor: `rgba(${rgb}, 1)`, borderWidth: 2, pointBackgroundColor: '#fff', pointRadius: isWizard ? 4 : 3 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { r: { min: -1, max: isWizard ? 4 : 6, ticks: { display: false, stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.1)', circular: false }, angleLines: { color: 'rgba(255,255,255,0.1)' } } }, plugins: { legend: { display: false } }, transitions: { active: { animation: { duration: 600 } } } } }); } },
        updateRadarChart() { if(!this.char || !this.char.attrs) return; const d = [this.char.attrs.for, this.char.attrs.agi, this.char.attrs.int, this.char.attrs.von, this.char.attrs.pod]; this._renderChart('radarChart', d); },
        updateWizardChart() { const d = [this.wizardData.attrs.for, this.wizardData.attrs.agi, this.wizardData.attrs.int, this.wizardData.attrs.von, this.wizardData.attrs.pod]; this._renderChart('wizChart', d, true); },
        
        triggerFX(type) { const el = document.getElementById(type+'-overlay'); if(el) { el.style.opacity='0.4'; setTimeout(()=>el.style.opacity='0', 200); } },
        addItem(cat) { const defs = { weapons: { name: 'Arma', dmg: '1d6', range: 'C' }, armor: { name: 'Traje', def: '1', pen: '0' }, gear: { name: 'Item', desc: '', qty: 1 }, social_people: { name: 'Nome', role: 'Relação' }, social_objects: { name: 'Objeto', desc: 'Detalhes' } }; if(cat.startsWith('social_')) this.char.inventory.social[cat.split('_')[1]].push({...defs[cat]}); else this.char.inventory[cat].push({...defs[cat]}); },
        deleteItem(cat, i, sub=null) { if(sub) this.char.inventory.social[sub].splice(i,1); else this.char.inventory[cat].splice(i,1); },
        addSkill() { this.char.skills.push({name:'Nova Perícia', level:1}); }, deleteSkill(idx) { this.char.skills.splice(idx,1); }, setSkillLevel(idx, l) { this.char.skills[idx].level = l; },
        addTechnique() { this.char.powers.techniques.push({name:'Técnica', desc:''}); }, deleteTechnique(idx) { this.char.powers.techniques.splice(idx,1); },
        
        roll(s) { playSFX('click'); const arr = new Uint32Array(1); window.crypto.getRandomValues(arr); const n = (arr[0] % s) + 1; const m = parseInt(this.diceMod || 0); this.lastNatural = n; this.lastFaces = s; this.lastRoll = n + m; let formulaStr = `D${s}`; if (m !== 0) formulaStr += (m > 0 ? `+${m}` : `${m}`); this.diceLog.unshift({id: Date.now(), time: new Date().toLocaleTimeString(), formula: formulaStr, result: n+m, crit: n===s, fumble: n===1, reason: this.diceReason}); this.diceReason = ''; if (this.isMobile && this.diceLog.length > 10) this.diceLog.pop(); else if (!this.isMobile && this.diceLog.length > 100) this.diceLog.pop(); },
        notify(msg, type='info') { const id = Date.now(); this.notifications.push({id, message: msg, type}); setTimeout(() => { this.notifications = this.notifications.filter(n => n.id !== id); }, 3000); },
        openImageEditor(context = 'sheet') { this.uploadContext = context; document.getElementById('file-input').click(); }, 
        initCropper(e) { const file = e.target.files[0]; if(!file) return; const reader = new FileReader(); reader.onload = (evt) => { document.getElementById('crop-target').src = evt.target.result; this.cropperOpen = true; this.$nextTick(() => { if(this.cropperInstance) this.cropperInstance.destroy(); this.cropperInstance = new Cropper(document.getElementById('crop-target'), { aspectRatio: 1, viewMode: 1 }); }); }; reader.readAsDataURL(file); e.target.value = ''; }, 
        applyCrop() { if(!this.cropperInstance) return; const result = this.cropperInstance.getCroppedCanvas({width:300, height:300}).toDataURL('image/jpeg', 0.8); if (this.uploadContext === 'wizard') { this.wizardData.photo = result; } else if (this.char) { this.char.photo = result; } this.cropperOpen = false; this.notify('Foto processada.', 'success'); },
        exportData() { const s = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.chars)); const a = document.createElement('a'); a.href = s; a.download = `zenite_bkp.json`; a.click(); a.remove(); this.notify('Backup baixado.', 'success'); },
        triggerFileImport() { document.getElementById('import-file').click(); },
        processImport(e) { const f = e.target.files[0]; if(!f) return; const r = new FileReader(); r.onload = (evt) => { try { const d = JSON.parse(evt.target.result); this.chars = {...this.chars, ...d}; this.updateAgentCount(); this.saveLocal(); this.unsavedChanges = true; this.notify('Importado!', 'success'); this.configModal = false; } catch(e){ this.notify('Erro arquivo.', 'error'); } }; r.readAsText(f); }
    };
}