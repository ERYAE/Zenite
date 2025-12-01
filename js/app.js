/**
 * ZENITE OS - Core Application
 * Version: vFinal-Procedural-Engine
 */

const CONSTANTS = {
    MAX_AGENTS: 30,
    SAVE_INTERVAL: 180000, 
    SUPABASE_URL: 'https://pwjoakajtygmbpezcrix.supabase.co',
    SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3am9ha2FqdHlnbWJwZXpjcml4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNTA4OTQsImV4cCI6MjA3OTcyNjg5NH0.92HNNPCaKccRLIV6HbP1CBFI7jL5ktt24Qh1tr-Md5E'
};

let cursorX = -100, cursorY = -100;
let isCursorHover = false;
let renderRafId = null;

// --- PROCEDURAL AUDIO ENGINE (Sintetizador Tático) ---
let audioCtx = null;
let sfxEnabledGlobal = true;
let userHasInteracted = false;
let musicInterval = null;
let musicPlaying = false;
let sequenceBuffer = ''; 

const initAudio = () => {
    if (audioCtx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AC();
};

document.addEventListener('click', () => { 
    userHasInteracted = true; 
    initAudio(); 
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); 
}, { once: true });

// Sintetizador de SFX (Mais "Tech", menos "Veludo")
const playTone = (freq, type, duration, vol = 0.1) => {
    if (!userHasInteracted || !audioCtx || !sfxEnabledGlobal) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    osc.type = type; 
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    
    // Filtro Bandpass para som mais "digital" e focado
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, audioCtx.currentTime);
    filter.Q.value = 1.0; 

    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(vol, audioCtx.currentTime + 0.01); 
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration); 

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + duration + 0.05);
};

// Gerador de Música Procedural (Dark Synth / Ambient)
const synthEngine = {
    step: 0,
    baseFreq: 110, // Lá (A2)
    scale: [0, 3, 5, 7, 10, 12], // Escala Menor Pentatônica
    playNote: function() {
        if (!audioCtx || !musicPlaying) return;
        const now = audioCtx.currentTime;
        
        // Bass (Toca a cada 4 passos)
        if (this.step % 4 === 0) {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sawtooth';
            // Muda a nota base aleatoriamente na escala
            const note = this.scale[Math.floor(Math.random() * 3)]; 
            const freq = this.baseFreq * Math.pow(2, (note - 12) / 12);
            osc.frequency.setValueAtTime(freq, now);
            
            // Filtro Lowpass abrindo e fechando
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(200, now);
            filter.frequency.linearRampToValueAtTime(600, now + 0.1);
            filter.frequency.linearRampToValueAtTime(200, now + 0.4);

            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + 1);
        }

        // Arpejo (Toca sempre, agudo)
        if (Math.random() > 0.3) {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'square';
            const note = this.scale[Math.floor(Math.random() * this.scale.length)];
            const freq = this.baseFreq * 2 * Math.pow(2, note / 12); // Oitava acima
            osc.frequency.setValueAtTime(freq, now);
            
            gain.gain.setValueAtTime(0.03, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.2);
        }

        this.step++;
    },
    start: function() {
        if (musicInterval) clearInterval(musicInterval);
        musicInterval = setInterval(() => this.playNote(), 250); // 240 BPM (fast tick)
    },
    stop: function() {
        if (musicInterval) clearInterval(musicInterval);
    }
};

const playSFX = (type) => {
    if (!userHasInteracted) return;
    // Ajuste para sons mais "Tech/Militar"
    if (type === 'hover') playTone(800, 'triangle', 0.02, 0.01); // Curto e agudo
    else if (type === 'click') playTone(300, 'square', 0.05, 0.05); // "Click" mecânico
    else if (type === 'save') { playTone(440, 'square', 0.1, 0.05); setTimeout(() => playTone(880, 'square', 0.2, 0.05), 100); } // Confirmação
    else if (type === 'error') { playTone(100, 'sawtooth', 0.2, 0.1); setTimeout(() => playTone(80, 'sawtooth', 0.2, 0.1), 100); } // Erro grave
    else if (type === 'success') { playTone(600, 'sine', 0.1, 0.05); setTimeout(() => playTone(1200, 'sine', 0.3, 0.03), 100); }
    else if (type === 'glitch') playTone(Math.random()*500, 'sawtooth', 0.05, 0.05);
};

function debounce(func, wait) { let timeout; return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), wait); }; }

function zeniteSystem() {
    return {
        // --- ESTADOS ---
        systemLoading: true, loadingProgress: 0, loadingText: 'BOOT',
        loadingChar: false, notifications: [], user: null, isGuest: false,
        userMenuOpen: false, authLoading: false, authMsg: '', authMsgType: '',
        wizardNameError: false,
        
        // --- UX ---
        configModal: false, wizardOpen: false, cropperOpen: false, cropperInstance: null, uploadContext: 'char',
        confirmOpen: false, confirmData: { title:'', desc:'', action:null, type:'danger' },
        isOnboarding: false, hackerMode: false,   
        
        // --- GERADOR DE MÚSICA ---
        musicPlayerOpen: false, isPlaying: false,
        currentTrackName: "PROCEDURAL_CORE_V1", // Nome fixo da engine
        
        // --- SEGREDOS ---
        konamiBuffer: [], logoClickCount: 0, logoClickTimer: null, systemFailure: false, rebooting: false, rebootSequence: '----',
        
        // --- DADOS ---
        chars: {}, activeCharId: null, char: null, agentCount: 0,
        currentView: 'dashboard', activeTab: 'profile', logisticsTab: 'inventory', searchQuery: '',
        
        // --- WIDGETS ---
        diceTrayOpen: false, trayDockMode: 'float', trayPosition: { x: window.innerWidth - 350, y: window.innerHeight - 500 },
        isDraggingTray: false, dragOffset: { x: 0, y: 0 },
        showDiceTip: false, hasSeenDiceTip: false,
        diceLog: [], lastRoll: '--', lastNatural: 0, lastFaces: 20, diceMod: 0, diceReason: '',
        
        // --- UX UTILS ---
        revertConfirmMode: false, isReverting: false, shakeAlert: false,
        isMobile: window.innerWidth < 768,
        
        // --- WIZARD ---
        wizardStep: 1, wizardPoints: 8, wizardData: { class: '', name: '', identity: '', age: '', history: '', photo: null, attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} }, wizardFocusAttr: '',
        
        settings: { mouseTrail: true, compactMode: false, performanceMode: false, crtMode: true, sfxEnabled: true, themeColor: 'cyan' },
        
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
                if ((c.name && c.name.toLowerCase().includes(q)) || (c.class && c.class.toLowerCase().includes(q))) result[id] = c;
            });
            return result;
        },

        get dicePresets() {
            if (!this.char) return [];
            const presets = [];
            if (this.char.inventory?.weapons?.length > 0) {
                this.char.inventory.weapons.forEach(w => { if (w.name && w.dmg) presets.push({ type: 'weapon', label: `Dano: ${w.name}`, reason: `Ataque: ${w.name}`, formula: w.dmg }); });
            }
            if (this.char.skills?.length > 0) {
                this.char.skills.forEach(s => { if (s.name) presets.push({ type: 'skill', label: `Perícia: ${s.name}`, reason: `Teste de ${s.name} (NVL ${s.level})`, formula: `1d20 + ${s.level}` }); });
            }
            return presets;
        },

        async initSystem() {
            this.loadingProgress = 10; this.loadingText = 'CORE SYSTEM';
            const savedConfig = localStorage.getItem('zenite_cached_db');
            if (savedConfig) {
                try {
                    const parsed = JSON.parse(savedConfig);
                    if (parsed.config) {
                        this.settings = { ...this.settings, ...parsed.config };
                        this.applyTheme(this.settings.themeColor);
                        if(this.settings.compactMode && this.isMobile) document.body.classList.add('compact-mode');
                    }
                } catch(e) {}
            }

            setTimeout(() => { if(this.systemLoading) this.systemLoading = false; }, 8000);
            window.addEventListener('beforeunload', (e) => { if (this.unsavedChanges && !this.isGuest) { e.preventDefault(); e.returnValue = 'Alterações pendentes.'; } });

            try {
                await new Promise(r => setTimeout(r, 300));
                if (typeof window.supabase !== 'undefined') {
                    try {
                        this.supabase = window.supabase.createClient(CONSTANTS.SUPABASE_URL, CONSTANTS.SUPABASE_KEY, {
                            auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
                        });
                    } catch (supaErr) {
                        this.supabase = null;
                    }
                }
                
                this.loadingProgress = 30; this.loadingText = 'AUTHENTICATING';
                this.debouncedSaveFunc = debounce(() => { this.saveLocal(); }, 1000);
                this.setupListeners(); this.setupCursorEngine(); this.setupWatchers();
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
                            if (session) { this.user = session.user; this.loadingText = 'SYNCING CLOUD'; this.loadingProgress = 70; await this.fetchCloud(); }
                        } catch(e) {}
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
                if(this.settings.performanceMode) document.body.classList.add('performance-mode');
                sfxEnabledGlobal = this.settings.sfxEnabled; 
                this.updateVisualState();
                
                if ((this.user || this.isGuest) && !localStorage.getItem('zenite_setup_done')) {
                    setTimeout(() => { this.isOnboarding = true; this.configModal = true; }, 500);
                }

                this.updateAgentCount();
                setInterval(() => { if (this.user && this.unsavedChanges && !this.isSyncing) this.syncCloud(true); }, CONSTANTS.SAVE_INTERVAL);
                this.loadingProgress = 100; this.loadingText = 'READY';
                setTimeout(() => { this.systemLoading = false; }, 500);

            } catch (err) { 
                console.error("Critical Boot Error:", err); 
                this.systemLoading = false; 
                this.notify("Erro de sistema. Modo offline.", "error");
            }
        },

        // --- LOGIC CORE (FUNÇÕES RESTAURADAS) ---
        updateVisualState() {
            const isAuthenticated = this.user || this.isGuest;
            const showTrail = isAuthenticated && this.settings.mouseTrail && !this.settings.performanceMode && !this.isMobile;
            if (showTrail && !this.systemFailure) document.body.classList.add('custom-cursor-active');
            else document.body.classList.remove('custom-cursor-active');
            if (isAuthenticated && this.settings.crtMode) document.body.classList.add('crt-mode'); else document.body.classList.remove('crt-mode');
            sfxEnabledGlobal = this.settings.sfxEnabled;
        },

        askLogout() { this.askConfirm('SAIR?', 'Dados pendentes serão salvos.', 'warn', () => this.logout()); },
        async logout() { 
            this.systemLoading = true; 
            if(this.unsavedChanges && !this.isGuest) { try { await this.syncCloud(true); } catch(e) {} } 
            localStorage.removeItem('zenite_cached_db'); localStorage.removeItem('zenite_is_guest'); 
            if(this.supabase) { try { await this.supabase.auth.signOut(); } catch(e) {} }
            window.location.reload(); 
        },

        // --- ENGINE DE MÚSICA PROCEDURAL ---
        toggleMusic() {
            this.isPlaying = !this.isPlaying;
            musicPlaying = this.isPlaying;
            if (this.isPlaying) {
                synthEngine.start();
                this.notify("Gerando Trilha Sonora...", "info");
            } else {
                synthEngine.stop();
                this.notify("Áudio Pausado.", "info");
            }
        },
        nextTrack() {
            // Como é procedural, "next track" apenas muda a semente (reinicia a engine)
            if (this.isPlaying) {
                synthEngine.stop();
                setTimeout(() => synthEngine.start(), 100);
                this.notify("Recalibrando Frequências...", "info");
            }
        },

        // --- MINIGAME & ERRO ---
        handleLogoClick() {
            const TIME_WINDOW = 500; 
            const now = Date.now();
            if (now - (this.lastClickTime || 0) > TIME_WINDOW) this.logoClickCount = 0;
            this.lastClickTime = now;
            clearTimeout(this.logoClickTimer); 
            this.logoClickCount++;
            playSFX('click');
            const logo = document.querySelector('header img');
            if(logo) { logo.style.filter = `drop-shadow(0 0 ${this.logoClickCount * 5}px var(--neon-core))`; setTimeout(() => logo.style.filter = '', 200); }
            if (this.logoClickCount >= 5) { this.logoClickCount = 0; this.triggerSystemFailure(); return; }
            this.logoClickTimer = setTimeout(() => { this.logoClickCount = 0; }, TIME_WINDOW);
        },
        triggerSystemFailure() {
            playSFX('glitch'); 
            if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch(() => {}); }
            this.systemFailure = true; 
            this.updateVisualState(); 
            this.generateRebootSequence(); 
            sequenceBuffer = ''; 
        },
        generateRebootSequence() {
            const chars = "ABCDEF0123456789";
            let seq = "";
            for(let i=0; i<4; i++) seq += chars.charAt(Math.floor(Math.random() * chars.length));
            this.rebootSequence = seq;
        },
        rebootSystem() {
            if (this.rebooting) return;
            this.rebooting = true;
            playSFX('success');
            setTimeout(() => {
                this.systemFailure = false; this.rebooting = false;
                if (document.fullscreenElement) document.exitFullscreen().catch(e => {});
                this.updateVisualState();
                this.notify("SISTEMA REINICIADO", "success");
            }, 800);
        },
        handleKeys(e) {
            const key = e.key.toUpperCase();
            if (this.systemFailure) {
                if (key.length === 1 && /[A-Z0-9]/.test(key)) {
                    sequenceBuffer += key;
                    if (!this.rebootSequence.startsWith(sequenceBuffer)) {
                         sequenceBuffer = key === this.rebootSequence[0] ? key : ''; 
                         if(sequenceBuffer === '') playSFX('error');
                    } else { playSFX('click'); }
                    if (sequenceBuffer === this.rebootSequence) { this.rebootSystem(); }
                }
                return;
            }
            const kKey = e.key.toLowerCase();
            this.konamiBuffer.push(kKey);
            if (this.konamiBuffer.length > 10) this.konamiBuffer.shift();
            if (JSON.stringify(this.konamiBuffer) === JSON.stringify(['arrowup','arrowup','arrowdown','arrowdown','arrowleft','arrowright','arrowleft','arrowright','b','a'])) {
                this.toggleHackerMode();
                this.konamiBuffer = [];
            }
        },

        // --- FUNÇÕES DE SALVAMENTO E NAVEGAÇÃO (RESTAURADAS!) ---
        attemptGoBack() {
             if (this.unsavedChanges && !this.isGuest) { 
                 this.triggerShake(); 
                 this.notify("Salve ou descarte antes de sair.", "warn"); 
                 return; 
             } 
             this.saveAndExit(); 
        },
        
        saveAndExit(fromHistory = false) {
            if (this.unsavedChanges && !this.isGuest && !fromHistory) { this.triggerShake(); return; }
            if(this.char && this.activeCharId) { this.chars[this.activeCharId] = JSON.parse(JSON.stringify(this.char)); this.updateAgentCount(); } 
            this.saveLocal(); 
            if (!this.isGuest && this.unsavedChanges) this.syncCloud(true); 
            this.diceTrayOpen = false; 
            this.showDiceTip = false; 
            this.currentView = 'dashboard'; 
            this.activeCharId = null;
            this.char = null; // Limpa referência para evitar conflitos
            if (!fromHistory && window.location.hash === '#sheet') { history.back(); }
        },

        performRevert() {
            this.isReverting = true; 
            this.diceTrayOpen = false; 
            this.revertConfirmMode = false;
            document.body.classList.add('animating-out'); 
            document.body.classList.add('interaction-lock'); 
            playSFX('error'); // Som de descarte
            
            setTimeout(async () => {
                try {
                    // Recarrega do cache ou nuvem
                    if(this.isGuest) { 
                        this.loadLocal('zenite_guest_db'); 
                    } else { 
                        this.loadLocal('zenite_cached_db'); 
                        await this.fetchCloud(); 
                    }
                    
                    // Restaura o char ativo
                    if(this.activeCharId && this.chars[this.activeCharId]) { 
                        this.char = JSON.parse(JSON.stringify(this.chars[this.activeCharId])); 
                    } else { 
                        this.currentView = 'dashboard'; 
                        this.char = null; 
                    }
                    
                    this.unsavedChanges = false;
                    document.body.classList.remove('animating-out'); 
                    document.body.classList.add('animating-in'); 
                    this.notify('Dados restaurados.', 'success');
                    
                    setTimeout(() => { 
                        document.body.classList.remove('animating-in'); 
                        document.body.classList.remove('interaction-lock'); 
                        this.isReverting = false; 
                    }, 400);
                } catch (e) { 
                    this.notify("Erro na restauração.", "error"); 
                    document.body.classList.remove('animating-out'); 
                    document.body.classList.remove('interaction-lock'); 
                    this.isReverting = false; 
                }
            }, 300);
        },

        // --- OUTRAS FUNÇÕES ---
        completeOnboarding() { localStorage.setItem('zenite_setup_done', 'true'); this.isOnboarding = false; this.configModal = false; playSFX('success'); },
        toggleHackerMode() { this.hackerMode = !this.hackerMode; document.body.classList.toggle('theme-hacker', this.hackerMode); playSFX(this.hackerMode ? 'success' : 'click'); },
        
        handleEsc() {
            if (this.systemFailure) return; 
            if (this.confirmOpen) { this.confirmOpen = false; return; }
            if (this.cropperOpen) { this.cropperOpen = false; document.body.classList.remove('custom-cursor-active'); return; }
            if (this.configModal) { if(this.isOnboarding) return; this.configModal = false; return; }
            if (this.wizardOpen) { this.wizardOpen = false; return; }
            if (this.diceTrayOpen) { this.toggleDiceTray(); return; }
            if (this.userMenuOpen) { this.userMenuOpen = false; return; }
            if (this.currentView === 'sheet') { if (this.unsavedChanges && !this.isGuest) { this.triggerShake(); this.notify("Salve suas alterações (CTRL+S)", "warn"); } else { this.saveAndExit(true); } }
        },

        setupListeners() {
             window.addEventListener('pageshow', (event) => { if (event.persisted) window.location.reload(); });
             window.addEventListener('resize', () => { this.isMobile = window.innerWidth < 768; this.ensureTrayOnScreen(); });
             window.addEventListener('popstate', (event) => {
                if (this.currentView === 'sheet' && this.unsavedChanges && !this.isGuest) { history.pushState(null, null, location.href); this.triggerShake(); return; }
                if (this.currentView === 'sheet' || this.wizardOpen || this.configModal) { if(this.currentView === 'sheet') this.saveAndExit(true); this.wizardOpen = false; this.configModal = false; this.cropperOpen = false; }
            });
             let lastHovered = null; 
             document.addEventListener('click', (e) => { if(e.target.closest('button, a, .cursor-pointer')) playSFX('click'); });
             document.addEventListener('mouseover', (e) => { const t = e.target.closest('button, a, .cursor-pointer'); if(t && t!==lastHovered){ playSFX('hover'); lastHovered=t; } else if(!t) lastHovered=null; });
        },
        setupCursorEngine() {
            const trail = document.getElementById('mouse-trail');
            if (!window.matchMedia("(pointer: fine)").matches) { if(trail) trail.style.display = 'none'; return; }
            let trailX = 0, trailY = 0;
            document.addEventListener('mousemove', (e) => { cursorX = e.clientX; cursorY = e.clientY; if(this.settings.mouseTrail && !this.isMobile) isCursorHover = e.target.closest('button, a, input, select, .cursor-pointer') !== null; });
            const renderLoop = () => {
                if (!trail) return;
                if (this.user || this.isGuest) {
                    trailX += (cursorX - trailX) * 0.45; trailY += (cursorY - trailY) * 0.45;
                    trail.style.display = 'block'; 
                    trail.style.transform = `translate3d(${trailX}px, ${trailY}px, 0)`; 
                    if(isCursorHover) trail.classList.add('hover-active'); else trail.classList.remove('hover-active');
                } else { trail.style.display = 'none'; }
                renderRafId = requestAnimationFrame(renderLoop);
            };
            renderLoop();
        },
        setupWatchers() {
             this.$watch('char', (val) => { if(val && this.activeCharId && !this.loadingChar) { this.chars[this.activeCharId] = val; if(!this.isGuest) this.unsavedChanges = true; this.debouncedSaveFunc(); if(this.activeTab === 'profile') this.updateRadarChart(); } }, {deep:true});
             this.$watch('currentView', (val) => { if (val !== 'sheet') { this.diceTrayOpen = false; } });
             this.$watch('user', () => this.updateVisualState());
             this.$watch('isGuest', () => this.updateVisualState());
        },
        loadLocal(key) { 
            const d = localStorage.getItem(key); if(d) { try { const p = JSON.parse(d); this.chars = p; if(p.config) this.settings = {...this.settings, ...p.config}; } catch(e){} }
        },
        saveLocal() { 
             const k = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db';
             localStorage.setItem(k, JSON.stringify({...this.chars, config: this.settings}));
        },
        updateAgentCount() { this.agentCount = Object.keys(this.chars).length; },
        fetchCloud() { if(!this.supabase || !this.user) return; this.supabase.from('profiles').select('data').eq('id', this.user.id).single().then(({data}) => { if(data?.data) { this.chars = {...this.chars, ...data.data}; this.updateAgentCount(); } }); },
        syncCloud(s) { if(!this.supabase || !this.user || !this.unsavedChanges) return; this.isSyncing=true; this.supabase.from('profiles').upsert({id:this.user.id, data:{...this.chars, config:this.settings}}).then(({error})=>{ this.isSyncing=false; if(!error){ this.unsavedChanges=false; this.saveStatus='success'; if(!s) playSFX('save'); } else { this.saveStatus='error'; } }); },
        calculateBaseStats(c, l, a) { return {pv: 20 + (a.for*2), pf: 20 + (a.pod*2), pdf: 20 + (a.von*2)}; }, 
        recalcDerivedStats() { if(!this.char) return; const n = this.calculateBaseStats(this.char.class, this.char.level, this.char.attrs); this.char.stats.pv.max=n.pv; this.char.stats.pf.max=n.pf; this.char.stats.pdf.max=n.pdf; },
        modStat(s, v) { if(this.char?.stats?.[s]) this.char.stats[s].current += v; },
        modAttr(k, v) { if(this.char?.attrs) { this.char.attrs[k] += v; this.recalcDerivedStats(); } },
        openWizard() { this.wizardOpen = true; },
        selectArchetype(a) { this.wizardData.class = a.class; this.wizardStep = 2; },
        modWizardAttr(k, v) { 
            const curr = this.wizardData.attrs[k];
            if(v > 0 && this.wizardPoints > 0 && curr < 3) { this.wizardData.attrs[k]++; this.wizardPoints--; }
            if(v < 0 && curr > -1) { this.wizardData.attrs[k]--; this.wizardPoints++; }
            this.updateWizardChart();
        },
        finishWizard() { 
            if(!this.wizardData.name) { this.wizardNameError=true; setTimeout(()=>this.wizardNameError=false, 500); return; }
            const id = 'z_' + Date.now();
            const base = this.calculateBaseStats(this.wizardData.class, 1, this.wizardData.attrs);
            this.chars[id] = { id, name: this.wizardData.name, class: this.wizardData.class, level: 1, stats: {pv:{current:base.pv,max:base.pv}, pf:{current:base.pf,max:base.pf}, pdf:{current:base.pdf,max:base.pdf}}, attrs: {...this.wizardData.attrs}, inventory: {weapons:[], armor:[], gear:[], social:{people:[], objects:[]}}, powers: {concept:'', abilities:'', techniques:[]}, skills:[] };
            this.wizardOpen = false;
            this.loadCharacter(id);
        },
        askDeleteChar(id) { this.askConfirm("DELETAR?", "Irreversível.", "danger", () => { delete this.chars[id]; this.saveLocal(); this.updateAgentCount(); }); },
        askSwitchToOnline() { window.location.reload(); },
        enterGuest() { this.isGuest = true; this.loadLocal('zenite_guest_db'); },
        doSocialAuth(p) { if(this.supabase) this.supabase.auth.signInWithOAuth({provider: p}); },
        applyTheme(c) { document.documentElement.style.setProperty('--neon-core', c === 'purple' ? '#d946ef' : c === 'gold' ? '#eab308' : '#0ea5e9'); },
        toggleSetting(k,v) { if(v) this.settings[k]=v; else this.settings[k]=!this.settings[k]; this.saveLocal(); if(k==='themeColor') this.applyTheme(this.settings[k]); this.updateVisualState(); },
        exportData() { 
            const a = document.createElement('a'); a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.chars)); 
            a.download = `zenite_bkp.json`; a.click(); 
        },
        triggerFileImport() { document.getElementById('import-file').click(); },
        processImport(e) { 
            const r = new FileReader(); 
            r.onload = (evt) => { try { Object.assign(this.chars, JSON.parse(evt.target.result)); this.saveLocal(); this.updateAgentCount(); this.notify("Importado!", "success"); } catch(e) { this.notify("Erro no arquivo", "error"); } }; 
            r.readAsText(e.target.files[0]); 
        },
        askHardReset() { localStorage.clear(); location.reload(); },
        notify(m,t) { 
            const id=Date.now(); 
            this.notifications.push({id, message: m, type: t, icon: t==='error'?'fa-bug':t==='success'?'fa-check':'fa-info'}); 
            setTimeout(()=>this.notifications=this.notifications.filter(n=>n.id!==id), 3000); 
        },
        openImageEditor(ctx) { this.uploadContext = ctx; document.getElementById('file-input').click(); },
        initCropper(e) { 
            const f = e.target.files[0]; 
            if(f) { const r = new FileReader(); r.onload = (evt) => { document.getElementById('crop-target').src = evt.target.result; this.cropperOpen = true; this.$nextTick(() => { if(this.cropperInstance) this.cropperInstance.destroy(); this.cropperInstance = new Cropper(document.getElementById('crop-target')); }); }; r.readAsDataURL(f); } 
        },
        applyCrop() { 
            if(!this.cropperInstance) return;
            const data = this.cropperInstance.getCroppedCanvas().toDataURL(); 
            if(this.uploadContext==='wizard') this.wizardData.photo = data; else if(this.char) this.char.photo = data; 
            this.cropperOpen = false; 
        },
        ensureTrayOnScreen() {}, 
        setDockMode(m) { this.trayDockMode = m; },
        startDragTray() {},
        toggleDiceTray() { this.diceTrayOpen = !this.diceTrayOpen; },
        addItem(c) { if(!this.char) return; const target = c.includes('social') ? this.char.inventory.social[c.split('_')[1]] : this.char.inventory[c]; target.push({name: 'Novo'}); },
        deleteItem(c,i,s) { const target = s ? this.char.inventory.social[s] : this.char.inventory[c]; target.splice(i, 1); },
        addSkill() { this.char.skills.push({name:'Nova', level:1}); },
        deleteSkill(i) { this.char.skills.splice(i, 1); },
        setSkillLevel(i, l) { this.char.skills[i].level = l; },
        addTechnique() { this.char.powers.techniques.push({name:'Técnica', desc:''}); },
        deleteTechnique(i) { this.char.powers.techniques.splice(i, 1); },
        roll(d) { 
            playSFX('click'); 
            const r = Math.floor(Math.random()*d)+1; 
            this.lastRoll = r; this.lastFaces = d; this.lastNatural = r; 
            this.diceLog.unshift({id:Date.now(), result: r, formula: 'D'+d});
        },
        _renderChart(id, data, isWiz) { 
            const ctx = document.getElementById(id); if(!ctx) return;
            if(ctx.chart) ctx.chart.destroy();
            ctx.chart = new Chart(ctx, { type: 'radar', data: { labels: ['FOR','AGI','INT','VON','POD'], datasets: [{ data, backgroundColor: 'rgba(14,165,233,0.2)', borderColor: '#0ea5e9', borderWidth: 2 }] }, options: { scales: { r: { min:-1, max: isWiz?4:6, ticks:{display:false} } }, plugins: { legend: { display: false } } } });
        },
        updateRadarChart() { if(this.char) this._renderChart('radarChart', [this.char.attrs.for, this.char.attrs.agi, this.char.attrs.int, this.char.attrs.von, this.char.attrs.pod], false); },
        updateWizardChart() { this._renderChart('wizChart', [this.wizardData.attrs.for, this.wizardData.attrs.agi, this.wizardData.attrs.int, this.wizardData.attrs.von, this.wizardData.attrs.pod], true); },
        confirmYes() { if (this.confirmData.action) this.confirmData.action(); this.confirmOpen = false; },
        toggleRevertMode() { this.revertConfirmMode = !this.revertConfirmMode; }
    };
}