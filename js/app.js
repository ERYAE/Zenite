/**
 * ZENITE OS - Core Application
 * Version: vFinal-Bulletproof
 * Fixes: Scope issues, 8-bit audio removal, stability.
 */

const CONSTANTS = {
    MAX_AGENTS: 30,
    SAVE_INTERVAL: 180000, 
    SUPABASE_URL: 'https://pwjoakajtygmbpezcrix.supabase.co',
    SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3am9ha2FqdHlnbWJwZXpjcml4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNTA4OTQsImV4cCI6MjA3OTcyNjg5NH0.92HNNPCaKccRLIV6HbP1CBFI7jL5ktt24Qh1tr-Md5E'
};

function zeniteSystem() {
    // --- VARIÁVEIS DE ESCOPO (CLOSURE) ---
    // Elas vivem aqui dentro, protegidas, acessíveis por todo o componente.
    let audioCtx = null;
    let sfxEnabledGlobal = true;
    let userHasInteracted = false;
    let cursorX = -100;
    let cursorY = -100;
    let renderRafId = null;
    let sequenceBuffer = ''; // Para o minigame

    // --- HELPER: AUDIO ENGINE (AVELUDADO/HOLGRÁFICO) ---
    const initAudio = () => {
        if (audioCtx) return;
        const AC = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AC();
    };

    // Toca tons puros (Sine) para evitar som 8-bit
    const playTone = (freq, duration, vol = 0.1) => {
        if (!userHasInteracted || !audioCtx || !sfxEnabledGlobal) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        // SINE = Som suave, redondo, "aveludado"
        osc.type = 'sine'; 
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        
        // Envelope de volume suave (Fade in/out rápido)
        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(vol, audioCtx.currentTime + 0.02); 
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration); 

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + duration + 0.1);
    };

    const playSFX = (type) => {
        if (!userHasInteracted) return;
        // Design de Som: Interface Holográfica
        if (type === 'hover') playTone(800, 0.05, 0.01); // "Bip" ultra leve
        else if (type === 'click') playTone(500, 0.1, 0.05); // "Blip" suave
        else if (type === 'save') { playTone(400, 0.15, 0.05); setTimeout(() => playTone(600, 0.3, 0.05), 100); } // Acorde suave
        else if (type === 'error') playTone(150, 0.3, 0.1); // Grave suave
        else if (type === 'success') { playTone(600, 0.1, 0.05); setTimeout(() => playTone(900, 0.4, 0.05), 100); }
    };

    // Listener global para capturar interação e iniciar áudio
    document.addEventListener('click', () => { 
        userHasInteracted = true; 
        initAudio(); 
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); 
        playSFX('click');
    }, { once: true });

    // Listener global para o Cursor (agora dentro do escopo)
    document.addEventListener('mousemove', (e) => { 
        cursorX = e.clientX; 
        cursorY = e.clientY; 
    });

    function debounce(func, wait) { 
        let timeout; 
        return function(...args) { 
            clearTimeout(timeout); 
            timeout = setTimeout(() => func.apply(this, args), wait); 
        }; 
    }

    return {
        // =========================================
        // 1. DADOS (ESTADO)
        // =========================================
        systemLoading: true,
        loadingProgress: 0,
        loadingText: 'BOOT',
        user: null,
        isGuest: false,
        userMenuOpen: false,
        chars: {},
        char: null,
        activeCharId: null,
        agentCount: 0,
        
        // Estados de Interface
        currentView: 'dashboard',
        activeTab: 'profile',
        logisticsTab: 'inventory',
        searchQuery: '',
        diceTrayOpen: false,
        configModal: false,
        wizardOpen: false,
        cropperOpen: false,
        confirmOpen: false,
        
        // Notificações e Auth
        notifications: [],
        authLoading: false,
        authMsg: '',
        authMsgType: '',
        
        // Wizard Data
        wizardStep: 1,
        wizardPoints: 8,
        wizardData: { 
            class: '', name: '', identity: '', age: '', history: '', photo: null, 
            attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} 
        },
        wizardNameError: false,
        wizardFocusAttr: '', // Corrigido: variável declarada

        // Configurações
        settings: { 
            mouseTrail: true, compactMode: false, performanceMode: false, 
            crtMode: true, sfxEnabled: true, themeColor: 'cyan' 
        },
        
        // Controle de Sistema
        unsavedChanges: false,
        isSyncing: false,
        saveStatus: 'idle',
        isOnboarding: false,
        hackerMode: false,
        revertConfirmMode: false,
        systemFailure: false,
        rebooting: false,
        
        // Segredos
        konamiBuffer: [],
        rebootSequence: 'A1B2', // Valor padrão para evitar undefined
        logoClickCount: 0,
        
        // Player de Música (Com links de CDN reais)
        musicPlayerOpen: false,
        isPlaying: false,
        currentTrackIdx: 0,
        audioElement: new Audio(), 
        playlist: [
            { title: "NEURAL DIVE", artist: "System", url: "https://files.freemusicarchive.org/storage-rec/tracks/e6c62185-6f03-441d-b323-2b6583725a90/3c27e250-887d-4979-a217-2e62536f63e3.mp3" },
            { title: "VOID ECHOES", artist: "Protocol", url: "https://files.freemusicarchive.org/storage-rec/tracks/5d65097b-8e46-46a5-8652-667341767779/c7a51610-2c73-433f-8405-4d998b655344.mp3" },
            { title: "CYBER CHASE", artist: "Core", url: "https://files.freemusicarchive.org/storage-rec/tracks/9b2f809a-78d1-4974-9f05-639885044845/13a25809-2279-489c-921e-a68468960076.mp3" }
        ],

        // Dados Auxiliares
        confirmData: { title:'', desc:'', action:null, type:'danger' },
        uploadContext: 'char',
        cropperInstance: null,
        
        // Dados de Dados (Dice)
        diceLog: [],
        lastRoll: '--',
        lastNatural: 0,
        lastFaces: 20,
        diceMod: 0,
        diceReason: '',
        trayDockMode: 'float',
        trayPosition: { x: window.innerWidth - 350, y: window.innerHeight - 500 },
        showDiceTip: false,  // Corrigido: variável declarada
        hasSeenDiceTip: false,
        shakeAlert: false,   // Corrigido: variável declarada
        isMobile: window.innerWidth < 768,

        // Archetypes
        archetypes: [
            { class: 'Titã', icon: 'fa-solid fa-shield-halved', focus: 'for', color: 'text-rose-500', desc: 'Resiliência e força bruta.' },
            { class: 'Estrategista', icon: 'fa-solid fa-chess', focus: 'int', color: 'text-cyan-500', desc: 'Análise tática e liderança.' },
            { class: 'Infiltrador', icon: 'fa-solid fa-user-ninja', focus: 'agi', color: 'text-emerald-500', desc: 'Furtividade e precisão.' },
            { class: 'Controlador', icon: 'fa-solid fa-hand-spock', focus: 'pod', color: 'text-violet-500', desc: 'Manipulação de energia.' },
            { class: 'Psíquico', icon: 'fa-solid fa-brain', focus: 'von', color: 'text-amber-500', desc: 'Domínio mental.' }
        ],

        // =========================================
        // 2. GETTERS
        // =========================================
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
                this.char.inventory.weapons.forEach(w => {
                    if (w.name && w.dmg) presets.push({ type: 'weapon', label: `Dano: ${w.name}`, reason: `Ataque: ${w.name}`, formula: w.dmg });
                });
            }
            if (this.char.skills?.length > 0) {
                this.char.skills.forEach(s => {
                    if (s.name) presets.push({ type: 'skill', label: `Perícia: ${s.name}`, reason: `Teste de ${s.name} (NVL ${s.level})`, formula: `1d20 + ${s.level}` });
                });
            }
            return presets;
        },

        // =========================================
        // 3. INICIALIZAÇÃO
        // =========================================
        async initSystem() {
            this.loadingProgress = 10;
            this.loadingText = 'CORE SYSTEM';
            
            // Configurar Player (Cross Origin para evitar erros de CORB)
            this.audioElement.crossOrigin = "anonymous";
            this.audioElement.volume = 0.5;
            this.audioElement.onended = () => this.nextTrack(true);
            if(this.playlist.length > 0) this.audioElement.src = this.playlist[0].url;

            // Carregar Config Local
            const savedConfig = localStorage.getItem('zenite_cached_db');
            if (savedConfig) {
                try {
                    const parsed = JSON.parse(savedConfig);
                    if (parsed.config) {
                        this.settings = { ...this.settings, ...parsed.config };
                        this.applyTheme(this.settings.themeColor);
                        if(this.settings.compactMode && this.isMobile) document.body.classList.add('compact-mode');
                    }
                    if(parsed.hasSeenTip) this.hasSeenDiceTip = parsed.hasSeenTip;
                } catch(e) {}
            }

            // Timeout de segurança para loading
            setTimeout(() => { if(this.systemLoading) this.systemLoading = false; }, 6000);

            try {
                await new Promise(r => setTimeout(r, 300));
                
                // Supabase Seguro
                if (typeof window.supabase !== 'undefined') {
                    try {
                        this.supabase = window.supabase.createClient(CONSTANTS.SUPABASE_URL, CONSTANTS.SUPABASE_KEY, {
                            auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
                        });
                    } catch(e) { this.supabase = null; }
                }
                
                this.loadingProgress = 30; 
                this.loadingText = 'AUTHENTICATING';
                this.debouncedSaveFunc = debounce(() => { this.saveLocal(); }, 1000);
                
                this.setupListeners(); 
                this.setupCursorEngine(); 

                this.loadingProgress = 50; 
                this.loadingText = 'LOADING CACHE';
                
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
                                this.loadingProgress = 80;
                                await this.fetchCloud(); 
                            }
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
                        } catch(e) {}
                    }
                }

                this.loadingProgress = 100; 
                this.updateVisualState();
                this.updateAgentCount();
                
                if ((this.user || this.isGuest) && !localStorage.getItem('zenite_setup_done')) {
                    setTimeout(() => { this.isOnboarding = true; this.configModal = true; }, 500);
                }

                setInterval(() => { if (this.user && this.unsavedChanges && !this.isSyncing) this.syncCloud(true); }, CONSTANTS.SAVE_INTERVAL);
                
                setTimeout(() => { this.systemLoading = false; }, 500);

            } catch (err) { 
                console.error("Init Error:", err); 
                this.systemLoading = false; 
                this.notify("Erro no boot. Sistema offline.", "error");
            }
        },

        // =========================================
        // 4. CORE (Funções que o Alpine precisa ver)
        // =========================================
        
        updateVisualState() {
            const isAuthenticated = this.user || this.isGuest;
            const showTrail = isAuthenticated && this.settings.mouseTrail && !this.settings.performanceMode && !this.isMobile;
            
            if (showTrail && !this.systemFailure) document.body.classList.add('custom-cursor-active');
            else document.body.classList.remove('custom-cursor-active');
            
            if (isAuthenticated && this.settings.crtMode) document.body.classList.add('crt-mode'); 
            else document.body.classList.remove('crt-mode');
            
            sfxEnabledGlobal = this.settings.sfxEnabled;
        },

        askLogout() {
            this.askConfirm('SAIR?', 'Dados pendentes serão salvos.', 'warn', () => this.logout());
        },

        async logout() {
            this.systemLoading = true;
            if(this.unsavedChanges && !this.isGuest) await this.syncCloud(true);
            localStorage.removeItem('zenite_cached_db');
            localStorage.removeItem('zenite_is_guest');
            if(this.supabase) await this.supabase.auth.signOut();
            window.location.reload();
        },

        notify(msg, type='info') {
            const id = Date.now();
            const iconMap = { success: 'fa-check', error: 'fa-triangle-exclamation', warn: 'fa-bell', info: 'fa-info-circle' };
            this.notifications.push({ id, message: msg, type, icon: iconMap[type] || 'fa-info' });
            setTimeout(() => { this.notifications = this.notifications.filter(n => n.id !== id); }, 3000);
        },

        // --- PLAYER MÚSICA ---
        loadTrack(index) {
            if (index < 0 || index >= this.playlist.length) return;
            this.currentTrackIdx = index;
            this.audioElement.src = this.playlist[index].url;
            this.audioElement.load();
        },
        toggleMusic() {
            if (!this.audioElement.src) this.loadTrack(this.currentTrackIdx);
            if (this.isPlaying) {
                this.audioElement.pause();
                this.isPlaying = false;
            } else {
                const p = this.audioElement.play();
                if (p !== undefined) {
                    p.then(() => {
                        this.isPlaying = true;
                        this.notify(`Tocando: ${this.playlist[this.currentTrackIdx].title}`, 'info');
                    }).catch(() => {
                        this.notify("Clique na página para liberar áudio.", "warn");
                        this.isPlaying = false;
                    });
                }
            }
        },
        nextTrack(auto = false) {
            let next = this.currentTrackIdx + 1;
            if (next >= this.playlist.length) next = 0;
            this.loadTrack(next);
            if (this.isPlaying || auto) {
                this.audioElement.play();
                this.isPlaying = true;
            }
        },

        // --- CHARACTERS ---
        loadCharacter(id) {
            if (!this.chars[id]) { this.notify("Erro ao carregar.", "error"); return; }
            this.activeCharId = id;
            this.char = JSON.parse(JSON.stringify(this.chars[id]));
            
            // Migration
            if (!this.char.powers) this.char.powers = { concept: '', abilities: '', techniques: [] };
            if (this.char.powers.passive !== undefined) {
                this.char.powers.abilities = (this.char.powers.passive || '') + '\n' + (this.char.powers.active || '');
                delete this.char.powers.passive; delete this.char.powers.active;
            }

            this.currentView = 'sheet';
            this.activeTab = 'profile';
            this.diceTrayOpen = false;
            this.$nextTick(() => { this.updateRadarChart(); });
        },

        saveAndExit(fromHistory = false) {
            if (this.char && this.activeCharId) {
                this.chars[this.activeCharId] = JSON.parse(JSON.stringify(this.char));
            }
            this.saveLocal();
            if (!this.isGuest) this.syncCloud(true);
            
            this.currentView = 'dashboard';
            this.char = null;
            this.activeCharId = null;
            
            if (!fromHistory && window.location.hash === '#sheet') history.back();
        },

        attemptGoBack() {
            if (this.unsavedChanges && !this.isGuest) {
                this.notify("Salvando alterações...", "info");
            }
            this.saveAndExit();
        },

        askDeleteChar(id) {
            this.askConfirm('DELETAR?', 'Irreversível.', 'danger', () => {
                delete this.chars[id];
                this.saveLocal();
                this.updateAgentCount();
                this.notify("Deletado.", "success");
            });
        },

        // --- UTILS ---
        askConfirm(title, desc, type, action) {
            this.confirmData = { title, desc, type, action };
            this.confirmOpen = true;
            playSFX('error');
        },
        confirmYes() {
            if (this.confirmData.action) this.confirmData.action();
            this.confirmOpen = false;
            playSFX('click');
        },
        
        // Minigame
        handleLogoClick() {
            const now = Date.now();
            if (now - (this.lastClickTime || 0) > 500) this.logoClickCount = 0;
            this.lastClickTime = now;
            this.logoClickCount++;
            playSFX('click');
            
            // Feedback Visual na Logo
            const logo = document.querySelector('header img');
            if(logo) {
                logo.style.filter = `drop-shadow(0 0 ${this.logoClickCount * 5}px var(--neon-core))`;
                setTimeout(() => logo.style.filter = '', 200);
            }

            if (this.logoClickCount >= 5) {
                this.logoClickCount = 0;
                this.triggerSystemFailure();
            }
        },
        triggerSystemFailure() {
            playSFX('error');
            if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch(() => {}); }
            this.systemFailure = true;
            this.updateVisualState();
            // Gerar código
            const chars = "ABCDEF0123456789";
            this.rebootSequence = "";
            for(let i=0; i<4; i++) this.rebootSequence += chars.charAt(Math.floor(Math.random() * chars.length));
            this.sequenceBuffer = "";
        },
        handleKeys(e) {
            const key = e.key.toUpperCase();
            if (this.systemFailure) {
                if (key.length === 1 && /[A-Z0-9]/.test(key)) {
                    this.sequenceBuffer += key;
                    if (!this.rebootSequence.startsWith(this.sequenceBuffer)) {
                        this.sequenceBuffer = "";
                        playSFX('error');
                    } else {
                        playSFX('click');
                    }
                    if (this.sequenceBuffer === this.rebootSequence) {
                        this.rebootSystem();
                    }
                }
                return;
            }
            // Konami
            const kKey = e.key.toLowerCase();
            this.konamiBuffer.push(kKey);
            if (this.konamiBuffer.length > 10) this.konamiBuffer.shift();
            if (JSON.stringify(this.konamiBuffer) === JSON.stringify(['arrowup','arrowup','arrowdown','arrowdown','arrowleft','arrowright','arrowleft','arrowright','b','a'])) {
                this.toggleHackerMode();
                this.konamiBuffer = [];
            }
        },
        rebootSystem() {
            playSFX('success');
            this.rebooting = true;
            setTimeout(() => {
                this.systemFailure = false;
                this.rebooting = false;
                if (document.fullscreenElement) document.exitFullscreen().catch(e => {});
                this.updateVisualState();
                this.notify("SISTEMA REINICIADO", "success");
            }, 1000);
        },

        // --- HELPERS RESTANTES ---
        // Definidos aqui para garantir que o Alpine os encontre
        toggleHackerMode() { this.hackerMode = !this.hackerMode; document.body.classList.toggle('theme-hacker', this.hackerMode); playSFX('success'); },
        toggleSetting(k,v) { if(v) this.settings[k]=v; else this.settings[k]=!this.settings[k]; this.saveLocal(); this.updateVisualState(); },
        applyTheme(c) { document.documentElement.style.setProperty('--neon-core', c==='purple'?'#d946ef':c==='gold'?'#eab308':'#0ea5e9'); },
        completeOnboarding() { localStorage.setItem('zenite_setup_done', 'true'); this.isOnboarding = false; this.configModal = false; playSFX('success'); },
        askHardReset() { localStorage.clear(); window.location.reload(); },
        askSwitchToOnline() { window.location.reload(); },
        enterGuest() { this.isGuest = true; this.loadLocal('zenite_guest_db'); },
        doSocialAuth(p) { if(this.supabase) this.supabase.auth.signInWithOAuth({provider:p}); },
        exportData() { const a = document.createElement('a'); a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.chars)); a.download="zenite_bkp.json"; a.click(); },
        triggerFileImport() { document.getElementById('import-file').click(); },
        processImport(e) { const r = new FileReader(); r.onload = (ev) => { try{ Object.assign(this.chars, JSON.parse(ev.target.result)); this.saveLocal(); this.updateAgentCount(); this.notify("Importado.", "success"); }catch(e){ this.notify("Erro arquivo", "error"); } }; r.readAsText(e.target.files[0]); },
        openImageEditor(c) { this.uploadContext=c; document.getElementById('file-input').click(); },
        initCropper(e) { const f=e.target.files[0]; if(f){ const r=new FileReader(); r.onload=(ev)=>{ document.getElementById('crop-target').src=ev.target.result; this.cropperOpen=true; this.$nextTick(()=>{ if(this.cropperInstance) this.cropperInstance.destroy(); this.cropperInstance = new Cropper(document.getElementById('crop-target')); }); }; r.readAsDataURL(f); } },
        applyCrop() { if(this.cropperInstance) { const d=this.cropperInstance.getCroppedCanvas().toDataURL(); if(this.uploadContext==='wizard') this.wizardData.photo=d; else if(this.char) this.char.photo=d; this.cropperOpen=false; } },
        
        // Wizard & Stats
        openWizard() { this.wizardOpen = true; },
        selectArchetype(a) { this.wizardData.class = a.class; this.wizardStep = 2; },
        modWizardAttr(k,v) { 
            const curr = this.wizardData.attrs[k];
            if(v>0 && this.wizardPoints>0 && curr<3) { this.wizardData.attrs[k]++; this.wizardPoints--; }
            if(v<0 && curr>-1) { this.wizardData.attrs[k]--; this.wizardPoints++; }
            this.updateWizardChart();
        },
        finishWizard() { 
            if(!this.wizardData.name) { this.wizardNameError=true; setTimeout(()=>this.wizardNameError=false,500); return; }
            const id = 'z_'+Date.now(); 
            const base = this.calculateBaseStats(this.wizardData.class, 1, this.wizardData.attrs);
            this.chars[id] = { id, name:this.wizardData.name, class:this.wizardData.class, level:1, stats:{pv:{current:base.pv,max:base.pv},pf:{current:base.pf,max:base.pf},pdf:{current:base.pdf,max:base.pdf}}, attrs:{...this.wizardData.attrs}, inventory:{weapons:[],armor:[],gear:[],social:{people:[],objects:[]}}, skills:[], powers:{concept:'',abilities:'',techniques:[]} };
            this.wizardOpen=false; this.loadCharacter(id);
        },
        
        calculateBaseStats(c,l,a) { return {pv:20+(a.for*2), pf:20+(a.pod*2), pdf:20+(a.von*2)}; },
        recalcDerivedStats() { if(this.char) { const n = this.calculateBaseStats(this.char.class, this.char.level, this.char.attrs); this.char.stats.pv.max=n.pv; this.char.stats.pf.max=n.pf; this.char.stats.pdf.max=n.pdf; } },
        modStat(s,v) { if(this.char?.stats?.[s]) this.char.stats[s].current += v; },
        modAttr(k,v) { if(this.char?.attrs) { this.char.attrs[k] += v; this.recalcDerivedStats(); this.updateRadarChart(); } },
        
        // Dice & Items
        toggleDiceTray() { this.diceTrayOpen = !this.diceTrayOpen; if(this.diceTrayOpen) { this.hasSeenDiceTip=true; this.showDiceTip=false; } },
        addItem(c) { if(this.char) { const t=c.includes('social')?this.char.inventory.social[c.split('_')[1]]:this.char.inventory[c]; t.push({name:'Novo Item'}); } },
        deleteItem(c,i,s) { const t=s?this.char.inventory.social[s]:this.char.inventory[c]; t.splice(i,1); },
        addSkill() { this.char.skills.push({name:'Nova', level:1}); },
        deleteSkill(i) { this.char.skills.splice(i, 1); },
        setSkillLevel(i,l) { this.char.skills[i].level = l; },
        addTechnique() { this.char.powers.techniques.push({name:'Técnica', desc:''}); },
        deleteTechnique(i) { this.char.powers.techniques.splice(i, 1); },
        roll(d) { 
            playSFX('click'); 
            const r = Math.floor(Math.random()*d)+1; 
            this.lastRoll = r; this.lastFaces = d; this.lastNatural = r; 
            this.diceLog.unshift({id:Date.now(), result:r, formula:'D'+d}); 
        },
        
        // Charts & Utils
        updateRadarChart() { this._renderChart('radarChart', [this.char.attrs.for, this.char.attrs.agi, this.char.attrs.int, this.char.attrs.von, this.char.attrs.pod], false); },
        updateWizardChart() { this._renderChart('wizChart', [this.wizardData.attrs.for, this.wizardData.attrs.agi, this.wizardData.attrs.int, this.wizardData.attrs.von, this.wizardData.attrs.pod], true); },
        _renderChart(id, data, isWiz) {
             const ctx = document.getElementById(id); if(!ctx) return;
             if(ctx.chart) ctx.chart.destroy();
             ctx.chart = new Chart(ctx, { type: 'radar', data: { labels: ['FOR','AGI','INT','VON','POD'], datasets: [{ data, backgroundColor: 'rgba(14,165,233,0.2)', borderColor: '#0ea5e9', borderWidth: 2 }] }, options: { scales: { r: { min:-1, max: isWiz?4:6, ticks:{display:false}, angleLines: {color:'rgba(255,255,255,0.1)'}, grid: {color:'rgba(255,255,255,0.1)'} } }, plugins: { legend: { display: false } } } });
        },
        
        setDockMode(m) { this.trayDockMode = m; },
        startDragTray() {}, ensureTrayOnScreen() {}, 
        performRevert() { this.revertConfirmMode=false; if(this.isGuest) this.loadLocal('zenite_guest_db'); else this.loadLocal('zenite_cached_db'); if(this.activeCharId && this.chars[this.activeCharId]) this.char=JSON.parse(JSON.stringify(this.chars[this.activeCharId])); else this.currentView='dashboard'; this.notify("Revertido.", "success"); },
        toggleRevertMode() { this.revertConfirmMode = !this.revertConfirmMode; },
        updateAgentCount() { this.agentCount = Object.keys(this.chars).length; },
        saveLocal() { const k = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db'; localStorage.setItem(k, JSON.stringify({ ...this.chars, config: this.settings, hasSeenTip: this.hasSeenDiceTip })); },
        loadLocal(k) { const d = localStorage.getItem(k); if(d) { try { const p = JSON.parse(d); this.chars = p; if(p.config) this.settings = { ...this.settings, ...p.config }; } catch(e){} } },
        fetchCloud() { if(!this.supabase || !this.user) return; this.supabase.from('profiles').select('data').eq('id', this.user.id).single().then(({data}) => { if(data && data.data) { this.chars = {...this.chars, ...data.data}; this.updateAgentCount(); } }); },
        syncCloud(silent) { if(!this.supabase || !this.user || !this.unsavedChanges) return; this.isSyncing = true; this.supabase.from('profiles').upsert({ id: this.user.id, data: { ...this.chars, config: this.settings } }).then(({error}) => { this.isSyncing = false; if(!error) { this.unsavedChanges = false; this.saveStatus = 'success'; if(!silent) playSFX('save'); } }); },
        
        // Listeners e Cursor
        setupListeners() { 
            window.addEventListener('resize', () => { this.isMobile = window.innerWidth < 768; });
        },
        setupCursorEngine() {
            const trail = document.getElementById('mouse-trail');
            if (!window.matchMedia("(pointer: fine)").matches) { if(trail) trail.style.display = 'none'; return; }
            let trailX = 0, trailY = 0;
            const renderLoop = () => {
                if (!trail) return;
                if (this.user || this.isGuest) {
                    trailX += (cursorX - trailX) * 0.45; 
                    trailY += (cursorY - trailY) * 0.45;
                    if(trail) trail.style.transform = `translate3d(${trailX}px, ${trailY}px, 0)`;
                }
                requestAnimationFrame(renderLoop);
            };
            renderLoop();
        },
        setupWatchers() {
            this.$watch('char', (val) => { 
                if(val && this.activeCharId && !this.loadingChar) { 
                    this.chars[this.activeCharId] = val; 
                    if(!this.isGuest) this.unsavedChanges = true; 
                    this.debouncedSaveFunc(); 
                } 
            }, {deep:true});
            this.$watch('currentView', (val) => { if (val !== 'sheet') this.diceTrayOpen = false; });
            this.$watch('user', () => this.updateVisualState());
            this.$watch('isGuest', () => this.updateVisualState());
        }
    };
}