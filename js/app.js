/**
 * ZENITE OS - Core Application
 * Version: vFinal-Velvet-UX
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

// --- VELVET AUDIO ENGINE (Onda Senoidal Suave) ---
let audioCtx = null;
let sfxEnabledGlobal = true;
let userHasInteracted = false;
let sequenceBuffer = ''; // Buffer para o minigame

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

// Função para gerar tons suaves (Aveludados)
const playTone = (freq, type, duration, vol = 0.1) => {
    if (!userHasInteracted || !audioCtx || !sfxEnabledGlobal) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    osc.type = 'sine'; // Senoidal = Suave
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    
    // Filtro LowPass para cortar agudos irritantes (efeito "underwater" leve)
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, audioCtx.currentTime);

    // Envelope de volume suave (Attack e Release)
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(vol, audioCtx.currentTime + 0.02); // Attack rápido mas suave
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration); // Release natural

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + duration + 0.1);
};

const playSFX = (type) => {
    if (!userHasInteracted) return;
    // Sons desenhados para serem agradáveis e "High Tech"
    if (type === 'hover') {
        // Som de "vidro" muito sutil
        playTone(600, 'sine', 0.05, 0.02); 
    } else if (type === 'click') {
        // Pulso digital firme mas redondo
        playTone(400, 'sine', 0.1, 0.05);
    } else if (type === 'save') {
        // Acorde ascendente suave
        playTone(300, 'sine', 0.2, 0.05);
        setTimeout(() => playTone(450, 'sine', 0.2, 0.05), 100);
    } else if (type === 'error') {
        // Som grave e curto, não agressivo
        playTone(150, 'triangle', 0.3, 0.05);
    } else if (type === 'success') {
        // Brilho etéreo
        playTone(500, 'sine', 0.3, 0.05);
        setTimeout(() => playTone(800, 'sine', 0.4, 0.03), 150);
    } else if (type === 'glitch') {
        // Ruído controlado
        playTone(100, 'sawtooth', 0.1, 0.02);
    }
};

function debounce(func, wait) { let timeout; return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), wait); }; }

function zeniteSystem() {
    return {
        // STATES
        systemLoading: true, loadingProgress: 0, loadingText: 'BOOT',
        loadingChar: false, notifications: [], user: null, isGuest: false,
        userMenuOpen: false, authLoading: false, authMsg: '', authMsgType: '',
        wizardNameError: false,
        
        // UX & CONFIGS
        configModal: false, wizardOpen: false, cropperOpen: false, cropperInstance: null, uploadContext: 'char',
        confirmOpen: false, confirmData: { title:'', desc:'', action:null, type:'danger' },
        isOnboarding: false, 
        hackerMode: false,   
        
        // MUSIC PLAYER (LINKS FUNCIONAIS PARA TESTE)
        musicPlayerOpen: false, isPlaying: false, currentTrackIdx: 0,
        audioElement: null, 
        playlist: [
            { title: "NEURAL DIVE", artist: "System", url: "https://cdn.pixabay.com/download/audio/2022/03/24/audio_8a01d87958.mp3" },
            { title: "CYBER CHASE", artist: "Core", url: "https://cdn.pixabay.com/download/audio/2022/11/22/audio_febc508520.mp3" },
            { title: "VOID ECHOES", artist: "Protocol", url: "https://cdn.pixabay.com/download/audio/2023/09/28/audio_4f0b3c06d3.mp3" }
        ],
        
        // SECRETS & MINIGAME REBOOT
        konamiBuffer: [], logoClickCount: 0, logoClickTimer: null, systemFailure: false, rebooting: false,
        rebootSequence: '----', // Sequência visual
        
        // DATA
        chars: {}, activeCharId: null, char: null, agentCount: 0,
        currentView: 'dashboard', activeTab: 'profile', logisticsTab: 'inventory', searchQuery: '',
        
        // WIDGETS
        diceTrayOpen: false, trayDockMode: 'float', trayPosition: { x: window.innerWidth - 350, y: window.innerHeight - 500 },
        isDraggingTray: false, dragOffset: { x: 0, y: 0 },
        showDiceTip: false, hasSeenDiceTip: false,
        diceLog: [], lastRoll: '--', lastNatural: 0, lastFaces: 20, diceMod: 0, diceReason: '',
        
        // UX UTILS
        revertConfirmMode: false, isReverting: false, shakeAlert: false,
        isMobile: window.innerWidth < 768,
        
        // WIZARD DATA
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
            
            // Carrega configurações locais primeiro
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

            // Inicializa o objeto de áudio (Player MP3)
            this.audioElement = new Audio();
            this.audioElement.volume = 0.5; 
            this.audioElement.onended = () => { this.nextTrack(true); };
            
            // Tenta carregar a primeira faixa (mas não dá play automático para não bloquear)
            if(this.playlist.length > 0) this.audioElement.src = this.playlist[0].url;

            setTimeout(() => { if(this.systemLoading) this.systemLoading = false; }, 8000); // Fallback de segurança
            window.addEventListener('beforeunload', (e) => { if (this.unsavedChanges && !this.isGuest) { e.preventDefault(); e.returnValue = 'Alterações pendentes.'; } });

            try {
                await new Promise(r => setTimeout(r, 300));
                // SUPABASE INIT COM PROTEÇÃO CONTRA FALHA
                if (typeof window.supabase !== 'undefined') {
                    try {
                        this.supabase = window.supabase.createClient(CONSTANTS.SUPABASE_URL, CONSTANTS.SUPABASE_KEY, {
                            auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
                        });
                    } catch (supaErr) {
                        console.warn("Supabase init failed, falling back to offline mode.");
                        this.supabase = null;
                    }
                }
                
                this.loadingProgress = 30; this.loadingText = 'AUTHENTICATING';
                this.debouncedSaveFunc = debounce(() => { this.saveLocal(); }, 1000);
                
                this.setupListeners(); this.setupCursorEngine(); this.setupWatchers();

                this.loadingProgress = 50; this.loadingText = 'LOADING CACHE';
                
                // Lógica de Login / Guest
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
                        } catch(e) {
                            // Se falhar fetch, apenas segue com dados locais
                            console.warn("Cloud sync failed, using local cache.");
                        }
                        
                        // Listener de Auth
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
                
                // Onboarding Check
                if ((this.user || this.isGuest) && !localStorage.getItem('zenite_setup_done')) {
                    setTimeout(() => {
                        this.isOnboarding = true;
                        this.configModal = true;
                        this.notify("Bem-vindo, Agente.", "info");
                    }, 500);
                }

                this.updateAgentCount();
                setInterval(() => { if (this.user && this.unsavedChanges && !this.isSyncing) this.syncCloud(true); }, CONSTANTS.SAVE_INTERVAL);
                
                this.loadingProgress = 100; this.loadingText = 'READY';
                setTimeout(() => { this.systemLoading = false; }, 500);

            } catch (err) { 
                console.error("Critical Boot Error:", err); 
                // Garante que o loader saia mesmo com erro
                this.systemLoading = false; 
                this.notify("Erro de sistema. Modo offline.", "error");
            }
        },

        // --- PLAYER ---
        toggleMusic() {
            if (!this.audioElement) return;
            if (this.isPlaying) {
                this.audioElement.pause();
                this.isPlaying = false;
            } else {
                // Se não tiver source carregada, carrega agora
                if (!this.audioElement.src || this.audioElement.src === '') {
                   this.loadTrack(this.currentTrackIdx);
                }
                this.audioElement.play().then(() => {
                    this.isPlaying = true;
                    this.notify(`Tocando: ${this.playlist[this.currentTrackIdx].title}`, 'info');
                }).catch(e => {
                    console.warn("Audio autoplay blocked", e);
                    this.notify("Clique na página p/ tocar", "warn");
                    this.isPlaying = false;
                });
            }
        },
        loadTrack(index) {
            if(index < 0 || index >= this.playlist.length) return;
            this.currentTrackIdx = index;
            this.audioElement.src = this.playlist[index].url;
            this.audioElement.load();
        },
        nextTrack(fromEnd = false) {
            const next = (this.currentTrackIdx + 1) % this.playlist.length;
            this.loadTrack(next);
            if(this.isPlaying || fromEnd) this.audioElement.play();
        },

        // --- MINIGAME & REBOOT ---
        generateRebootSequence() {
            const chars = "ABCDEF0123456789";
            let seq = "";
            for(let i=0; i<4; i++) seq += chars.charAt(Math.floor(Math.random() * chars.length));
            this.rebootSequence = seq;
            // Sequência será mostrada no HTML, não no console
        },

        handleKeys(e) {
            const key = e.key.toUpperCase();
            
            // MINIGAME LOGIC
            if (this.systemFailure) {
                // Aceita apenas letras/números
                if (key.length === 1 && /[A-Z0-9]/.test(key)) {
                    sequenceBuffer += key;
                    // Verifica se o que foi digitado bate com o final da sequência alvo
                    // Ex: Alvo "A1B2". User digita "A", "1", "B", "2" -> Match.
                    // Se digitar errado, reseta buffer se não der match parcial.
                    if (!this.rebootSequence.startsWith(sequenceBuffer)) {
                         sequenceBuffer = key === this.rebootSequence[0] ? key : ''; 
                         if(sequenceBuffer === '') playSFX('error');
                    } else {
                        playSFX('click');
                    }

                    if (sequenceBuffer === this.rebootSequence) {
                        this.rebootSystem();
                    }
                }
                return;
            }

            // KONAMI
            const kKey = e.key.toLowerCase();
            const konamiCode = ['arrowup','arrowup','arrowdown','arrowdown','arrowleft','arrowright','arrowleft','arrowright','b','a'];
            this.konamiBuffer.push(kKey);
            if (this.konamiBuffer.length > konamiCode.length) this.konamiBuffer.shift();
            if (JSON.stringify(this.konamiBuffer) === JSON.stringify(konamiCode)) {
                this.toggleHackerMode();
                this.konamiBuffer = [];
            }
        },

        // --- RESTO DAS FUNÇÕES (MANTIDAS E PROTEGIDAS) ---
        // (Mantenha as funções loadCharacter, saveLocal, etc. do código anterior, 
        // mas certifique-se que initSystem foi substituído pelo acima)
        
        handleLogoClick() {
            const TIME_WINDOW = 500; 
            const now = Date.now();
            if (now - (this.lastClickTime || 0) > TIME_WINDOW) this.logoClickCount = 0;
            this.lastClickTime = now;
            
            clearTimeout(this.logoClickTimer); 
            this.logoClickCount++;
            playSFX('click');

            if (this.logoClickCount >= 5) {
                this.logoClickCount = 0;
                this.triggerSystemFailure();
                return;
            }
            this.logoClickTimer = setTimeout(() => { this.logoClickCount = 0; }, TIME_WINDOW);
        },
        
        triggerSystemFailure() {
            playSFX('glitch'); 
            if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch(() => {}); }
            this.systemFailure = true; 
            this.generateRebootSequence(); 
            sequenceBuffer = ''; 
        },
        rebootSystem() {
            if (this.rebooting) return;
            this.rebooting = true;
            playSFX('success');
            setTimeout(() => {
                this.systemFailure = false; this.rebooting = false;
                if (document.fullscreenElement) document.exitFullscreen().catch(e => {});
                this.notify("SISTEMA REINICIADO", "success");
            }, 800);
        },
        
        // Outras funções auxiliares... (copiar do snippet anterior se necessário, focando na lógica de dados)
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

        // Mantenha o resto das funções de dados (updateAgentCount, loadCharacter, saveLocal, etc)
        // Elas não causam o erro CORB. O erro CORB vinha de fetchs ruins ou HTML malformado no src de img/audio.
        // Certifique-se de que loadCharacter verifica se `char` existe antes de setar.
        
        setupListeners() { /* Igual ao anterior */ 
             window.addEventListener('resize', () => { this.isMobile = window.innerWidth < 768; this.ensureTrayOnScreen(); });
             document.addEventListener('click', (e) => { if(e.target.closest('button, a, .cursor-pointer')) playSFX('click'); });
             document.addEventListener('mouseover', (e) => { if(e.target.closest('button, a, .cursor-pointer')) playSFX('hover'); });
        },
        setupCursorEngine() { /* Igual ao anterior */ 
            const trail = document.getElementById('mouse-trail');
            if (!window.matchMedia("(pointer: fine)").matches) { if(trail) trail.style.display = 'none'; return; }
            let trailX = 0, trailY = 0;
            document.addEventListener('mousemove', (e) => { cursorX = e.clientX; cursorY = e.clientY; });
            const renderLoop = () => {
                if (!trail) return;
                if (this.user || this.isGuest) {
                    trailX += (cursorX - trailX) * 0.45; trailY += (cursorY - trailY) * 0.45;
                    trail.style.transform = `translate3d(${trailX}px, ${trailY}px, 0)`; 
                }
                requestAnimationFrame(renderLoop);
            };
            renderLoop();
        },
        setupWatchers() { /* Igual */ 
             this.$watch('char', (val) => { if(val && this.activeCharId && !this.loadingChar) { this.chars[this.activeCharId] = val; this.debouncedSaveFunc(); } }, {deep:true});
        },
        loadLocal(key) { /* Igual */ 
            const d = localStorage.getItem(key); if(d) { try { const p = JSON.parse(d); this.chars = p; } catch(e){} }
        },
        saveLocal() { /* Igual */ 
             const k = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db';
             localStorage.setItem(k, JSON.stringify({...this.chars, config: this.settings}));
        },
        updateAgentCount() { this.agentCount = Object.keys(this.chars).length; },
        fetchCloud() { /* Igual ao anterior, mas dentro do try catch do init */ },
        syncCloud(s) { /* Igual */ },
        calculateBaseStats(c, l, a) { /* Igual */ return {pv: 20, pf: 20, pdf: 20}; }, // Simplificado para não quebrar, use a lógica completa se tiver
        recalcDerivedStats() { /* Igual */ },
        modStat(s, v) { if(this.char?.stats?.[s]) this.char.stats[s].current += v; },
        modAttr(k, v) { if(this.char?.attrs) this.char.attrs[k] += v; },
        openWizard() { this.wizardOpen = true; },
        selectArchetype(a) { this.wizardData.class = a.class; this.wizardStep = 2; },
        modWizardAttr(k, v) { /* Igual */ },
        finishWizard() { 
            const id = 'z_' + Date.now();
            this.chars[id] = { id, name: this.wizardData.name, class: this.wizardData.class, level: 1, stats: {pv:{current:20,max:20}, pf:{current:20,max:20}, pdf:{current:20,max:20}}, attrs: this.wizardData.attrs, inventory: {weapons:[], armor:[], gear:[], social:{people:[], objects:[]}}, powers: {concept:'', abilities:'', techniques:[]} };
            this.wizardOpen = false;
            this.loadCharacter(id);
        },
        loadCharacter(id) { this.activeCharId = id; this.char = this.chars[id]; this.currentView = 'sheet'; },
        attemptGoBack() { this.currentView = 'dashboard'; this.char = null; },
        askDeleteChar(id) { delete this.chars[id]; this.saveLocal(); },
        askSwitchToOnline() { window.location.reload(); },
        enterGuest() { this.isGuest = true; this.systemLoading = false; },
        doSocialAuth(p) { if(this.supabase) this.supabase.auth.signInWithOAuth({provider: p}); },
        applyTheme(c) { document.documentElement.style.setProperty('--neon-core', c === 'purple' ? '#d946ef' : c === 'gold' ? '#eab308' : '#0ea5e9'); },
        toggleSetting(k,v) { if(v) this.settings[k]=v; else this.settings[k]=!this.settings[k]; this.saveLocal(); if(k==='themeColor') this.applyTheme(this.settings[k]); },
        exportData() { /* Igual */ },
        triggerFileImport() { document.getElementById('import-file').click(); },
        processImport(e) { /* Igual */ },
        askHardReset() { localStorage.clear(); location.reload(); },
        notify(m,t) { this.notifications.push({id: Date.now(), message: m, type: t}); setTimeout(()=>this.notifications.shift(), 3000); },
        openImageEditor() { document.getElementById('file-input').click(); },
        initCropper(e) { const f = e.target.files[0]; if(f) { const r = new FileReader(); r.onload = (evt) => { document.getElementById('crop-target').src = evt.target.result; this.cropperOpen = true; this.$nextTick(() => { new Cropper(document.getElementById('crop-target')); }); }; r.readAsDataURL(f); } },
        applyCrop() { this.cropperOpen = false; }, // Simplificado
        ensureTrayOnScreen() {}, 
        setDockMode(m) { this.trayDockMode = m; },
        startDragTray() {},
        toggleDiceTray() { this.diceTrayOpen = !this.diceTrayOpen; },
        addItem(c) { if(!this.char) return; const map = {weapons:[], armor:[], gear:[], social_people:[], social_objects:[]}; const target = c.includes('social') ? this.char.inventory.social[c.split('_')[1]] : this.char.inventory[c]; target.push({name: 'Novo Item'}); },
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
        }
    };
}