/**
 * ZENITE OS - Core Application
 * Version: vFinal-Stable-Tactical
 */

const CONSTANTS = {
    MAX_AGENTS: 30,
    SAVE_INTERVAL: 180000, 
    SUPABASE_URL: 'https://pwjoakajtygmbpezcrix.supabase.co',
    SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3am9ha2FqdHlnbWJwZXpjcml4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNTA4OTQsImV4cCI6MjA3OTcyNjg5NH0.92HNNPCaKccRLIV6HbP1CBFI7jL5ktt24Qh1tr-Md5E'
};

// --- AUDIO ENGINE: TACTICAL & REALISTIC ---
let audioCtx = null;
let noiseBuffer = null;
let sfxEnabledGlobal = true;
let userHasInteracted = false;

const initAudio = () => {
    if (audioCtx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AC();
    // Cria buffer de ruído para efeitos glitch/mecânicos
    const bufferSize = audioCtx.sampleRate * 2; // 2 segundos
    noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
};

document.addEventListener('click', () => { 
    userHasInteracted = true; 
    initAudio(); 
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); 
}, { once: true });

const playSFX = (type) => {
    if (!userHasInteracted || !audioCtx || !sfxEnabledGlobal) return;
    const now = audioCtx.currentTime;
    const gain = audioCtx.createGain();
    gain.connect(audioCtx.destination);

    if (type === 'click') {
        // Som de clique mecânico (High Tech)
        const osc = audioCtx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.connect(gain);
        osc.start(now);
        osc.stop(now + 0.05);
    } 
    else if (type === 'hover') {
        // Som de interface sutil (Ruído filtrado curto)
        const source = audioCtx.createBufferSource();
        source.buffer = noiseBuffer;
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 2000;
        filter.Q.value = 5;
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.02);
        source.connect(filter);
        filter.connect(gain);
        source.start(now);
        source.stop(now + 0.02);
    }
    else if (type === 'glitch' || type === 'error') {
        // Ruído digital áspero
        const source = audioCtx.createBufferSource();
        source.buffer = noiseBuffer;
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 500;
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        source.connect(filter);
        filter.connect(gain);
        source.start(now);
        source.stop(now + 0.3);
    }
    else if (type === 'success' || type === 'save') {
        // Confirmação limpa
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.linearRampToValueAtTime(880, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);
        osc.connect(gain);
        osc.start(now);
        osc.stop(now + 0.3);
    }
};

function debounce(func, wait) { let timeout; return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), wait); }; }

// --- APP LOGIC ---
function zeniteSystem() {
    return {
        // DADOS REATIVOS
        systemLoading: true, loadingProgress: 0, loadingText: 'BOOT',
        user: null, isGuest: false, userMenuOpen: false,
        chars: {}, char: null, activeCharId: null, agentCount: 0,
        
        // UX STATES
        currentView: 'dashboard', activeTab: 'profile', logisticsTab: 'inventory',
        searchQuery: '', diceTrayOpen: false, configModal: false, wizardOpen: false,
        cropperOpen: false, confirmOpen: false, 
        
        // MUSIC & AUDIO
        musicPlayerOpen: false, isPlaying: false, currentTrackIdx: 0, audioElement: null,
        playlist: [
            // Links diretos de Breakcore/DnB Creative Commons (FMA)
            { title: "AMEN BREAK", artist: "Unknown", url: "https://files.freemusicarchive.org/storage-rec/tracks/5d65097b-8e46-46a5-8652-667341767779/c7a51610-2c73-433f-8405-4d998b655344.mp3" },
            { title: "JUNGLE RUSH", artist: "System", url: "https://files.freemusicarchive.org/storage-rec/tracks/9b2f809a-78d1-4974-9f05-639885044845/13a25809-2279-489c-921e-a68468960076.mp3" },
            { title: "CYBER CORE", artist: "Protocol", url: "https://files.freemusicarchive.org/storage-rec/tracks/e6c62185-6f03-441d-b323-2b6583725a90/3c27e250-887d-4979-a217-2e62536f63e3.mp3" }
        ],

        // MINIGAME & SECRETS
        systemFailure: false, rebooting: false, rebootSequence: '----', konamiBuffer: [],
        
        // DADOS AUXILIARES
        notifications: [],
        wizardStep: 1, wizardPoints: 8, wizardData: { class: '', name: '', identity: '', age: '', history: '', photo: null, attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} },
        confirmData: { title:'', desc:'', action:null, type:'danger' },
        settings: { mouseTrail: true, compactMode: false, performanceMode: false, crtMode: true, sfxEnabled: true, themeColor: 'cyan' },
        diceLog: [], lastRoll: '--', lastNatural: 0, lastFaces: 20, diceMod: 0, diceReason: '',
        
        // CONFIGURAÇÕES DE ESTADO
        isOnboarding: false, hackerMode: false, unsavedChanges: false, isSyncing: false, saveStatus: 'idle',
        revertConfirmMode: false, uploadContext: 'char', cropperInstance: null,

        // HELPERS (GETTERS)
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

        archetypes: [
            { class: 'Titã', icon: 'fa-solid fa-shield-halved', focus: 'for', color: 'text-rose-500', desc: 'Resiliência e força bruta.' },
            { class: 'Estrategista', icon: 'fa-solid fa-chess', focus: 'int', color: 'text-cyan-500', desc: 'Análise tática e liderança.' },
            { class: 'Infiltrador', icon: 'fa-solid fa-user-ninja', focus: 'agi', color: 'text-emerald-500', desc: 'Furtividade e precisão.' },
            { class: 'Controlador', icon: 'fa-solid fa-hand-spock', focus: 'pod', color: 'text-violet-500', desc: 'Manipulação de energia.' },
            { class: 'Psíquico', icon: 'fa-solid fa-brain', focus: 'von', color: 'text-amber-500', desc: 'Domínio mental.' }
        ],

        // --- FUNÇÕES PRINCIPAIS ---
        
        async initSystem() {
            this.loadingProgress = 10; this.loadingText = 'CORE SYSTEM';
            
            // Player Init
            this.audioElement = new Audio();
            this.audioElement.volume = 0.5;
            this.audioElement.onended = () => this.nextTrack(true);
            if(this.playlist.length > 0) this.loadTrack(0);

            // Config Local
            const savedConfig = localStorage.getItem('zenite_cached_db');
            if (savedConfig) {
                try {
                    const parsed = JSON.parse(savedConfig);
                    if (parsed.config) {
                        this.settings = { ...this.settings, ...parsed.config };
                        this.applyTheme(this.settings.themeColor);
                    }
                } catch(e) {}
            }

            setTimeout(() => { if(this.systemLoading) this.systemLoading = false; }, 5000); // Failsafe

            try {
                await new Promise(r => setTimeout(r, 300));
                
                // Supabase Safe Init
                if (typeof window.supabase !== 'undefined') {
                    try {
                        this.supabase = window.supabase.createClient(CONSTANTS.SUPABASE_URL, CONSTANTS.SUPABASE_KEY);
                    } catch (e) { console.warn("Supabase Error"); }
                }

                this.loadingProgress = 50; this.loadingText = 'LOADING CACHE';
                
                // Auth Check
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
                                await this.fetchCloud(); 
                            }
                            this.supabase.auth.onAuthStateChange(async (ev, sess) => {
                                if (ev === 'SIGNED_IN' && sess) { this.user = sess.user; this.isGuest = false; await this.fetchCloud(); }
                                else if (ev === 'SIGNED_OUT') { this.user = null; this.chars = {}; this.currentView = 'dashboard'; }
                            });
                         } catch(e) {}
                    }
                }

                this.loadingProgress = 100; 
                this.updateVisualState();
                this.updateAgentCount();
                
                if((this.user || this.isGuest) && !localStorage.getItem('zenite_setup_done')) {
                    this.isOnboarding = true; this.configModal = true;
                }

                this.systemLoading = false;
                this.debouncedSaveFunc = debounce(() => this.saveLocal(), 1000);
                this.setupListeners();
                this.setupCursorEngine();
                this.setupWatchers();

            } catch (e) {
                console.error(e);
                this.systemLoading = false;
                this.notify("Erro crítico. Modo offline ativado.", "error");
            }
        },

        // --- FUNÇÕES DE CARREGAMENTO E DADOS (ESSENCIAIS PARA CORRIGIR O ERRO "NOT DEFINED") ---
        
        loadCharacter(id) {
            if (!this.chars[id]) return;
            this.activeCharId = id;
            this.char = JSON.parse(JSON.stringify(this.chars[id]));
            
            // Migração de dados antigos se necessário
            if(!this.char.powers) this.char.powers = { concept:'', abilities:'', techniques:[] };
            if(this.char.powers.passive !== undefined) {
                this.char.powers.abilities = (this.char.powers.passive||'') + '\n' + (this.char.powers.active||'');
                delete this.char.powers.passive; delete this.char.powers.active;
            }
            
            this.currentView = 'sheet';
            this.activeTab = 'profile';
            this.diceTrayOpen = false;
            this.$nextTick(() => {
                this.updateRadarChart();
            });
        },

        askDeleteChar(id) {
            this.askConfirm('DELETAR AGENTE?', 'Essa ação é irreversível.', 'danger', () => {
                delete this.chars[id];
                this.saveLocal();
                this.updateAgentCount();
                this.notify("Agente deletado.", "success");
            });
        },

        askLogout() {
            this.askConfirm('ENCERRAR SESSÃO?', 'Dados não salvos podem ser perdidos.', 'warn', () => {
                this.logout();
            });
        },

        async logout() {
            this.systemLoading = true;
            if(this.unsavedChanges && !this.isGuest) await this.syncCloud(true);
            localStorage.removeItem('zenite_cached_db');
            localStorage.removeItem('zenite_is_guest');
            if(this.supabase) await this.supabase.auth.signOut();
            window.location.reload();
        },

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

        saveAndExit(fromHistory = false) {
            if(this.char && this.activeCharId) {
                this.chars[this.activeCharId] = JSON.parse(JSON.stringify(this.char));
            }
            this.saveLocal();
            if(!this.isGuest) this.syncCloud(true);
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
        
        performRevert() {
            this.revertConfirmMode = false;
            if(this.isGuest) this.loadLocal('zenite_guest_db');
            else this.loadLocal('zenite_cached_db');
            
            if(this.activeCharId && this.chars[this.activeCharId]) {
                this.char = JSON.parse(JSON.stringify(this.chars[this.activeCharId]));
            } else {
                this.currentView = 'dashboard';
            }
            this.notify("Alterações descartadas.", "success");
        },

        toggleRevertMode() {
            this.revertConfirmMode = !this.revertConfirmMode;
        },

        // --- PLAYER DE MÚSICA ---
        loadTrack(index) {
            if(index < 0 || index >= this.playlist.length) return;
            this.currentTrackIdx = index;
            this.audioElement.src = this.playlist[index].url;
            this.audioElement.load();
        },
        toggleMusic() {
            if(!this.audioElement.src) this.loadTrack(this.currentTrackIdx);
            if (this.isPlaying) {
                this.audioElement.pause();
                this.isPlaying = false;
            } else {
                this.audioElement.play().then(() => {
                    this.isPlaying = true;
                    this.notify("Tocando Áudio", "info");
                }).catch(() => {
                    this.notify("Erro ao tocar. Clique na página.", "warn");
                    this.isPlaying = false;
                });
            }
        },
        nextTrack(auto = false) {
            let next = this.currentTrackIdx + 1;
            if (next >= this.playlist.length) next = 0;
            this.loadTrack(next);
            if(this.isPlaying || auto) this.audioElement.play();
        },

        // --- MINIGAME ---
        handleLogoClick() {
            const now = Date.now();
            if (now - (this.lastClickTime || 0) > 500) this.logoClickCount = 0;
            this.lastClickTime = now;
            this.logoClickCount++;
            playSFX('click');
            
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
            this.systemFailure = true;
            playSFX('glitch');
            // Gera sequência aleatória
            const chars = "ABCDEF0123456789";
            this.rebootSequence = "";
            for(let i=0; i<4; i++) this.rebootSequence += chars.charAt(Math.floor(Math.random() * chars.length));
            this.sequenceBuffer = "";
        },
        handleKeys(e) {
            if(this.systemFailure) {
                const key = e.key.toUpperCase();
                if (/[A-Z0-9]/.test(key) && key.length === 1) {
                    this.sequenceBuffer = (this.sequenceBuffer || "") + key;
                    if (this.sequenceBuffer === this.rebootSequence) {
                        this.rebootSystem();
                    } else if (!this.rebootSequence.startsWith(this.sequenceBuffer)) {
                        this.sequenceBuffer = ""; // Reset se errar
                        playSFX('error');
                    } else {
                        playSFX('click');
                    }
                }
                return;
            }
            // Konami...
        },
        rebootSystem() {
            playSFX('success');
            this.rebooting = true;
            setTimeout(() => {
                this.systemFailure = false;
                this.rebooting = false;
                this.notify("SISTEMA REINICIADO", "success");
            }, 1000);
        },

        // --- OUTROS HELPERS ---
        updateVisualState() {
            if (this.settings.mouseTrail && !this.isMobile && !this.systemFailure) document.body.classList.add('custom-cursor-active');
            else document.body.classList.remove('custom-cursor-active');
            if (this.settings.crtMode) document.body.classList.add('crt-mode');
            else document.body.classList.remove('crt-mode');
            sfxEnabledGlobal = this.settings.sfxEnabled;
        },
        saveLocal() {
            const k = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db';
            localStorage.setItem(k, JSON.stringify({ ...this.chars, config: this.settings }));
        },
        loadLocal(k) {
            const d = localStorage.getItem(k);
            if(d) {
                const p = JSON.parse(d);
                this.chars = p;
                if(p.config) this.settings = { ...this.settings, ...p.config };
            }
        },
        updateAgentCount() { this.agentCount = Object.keys(this.chars).length; },
        syncCloud(silent) { /* Lógica de sync segura */ if(!this.supabase) return; this.isSyncing=true; this.supabase.from('profiles').upsert({id:this.user.id, data:{...this.chars, config:this.settings}}).then(()=>{ this.isSyncing=false; if(!silent) this.notify("Salvo na nuvem.", "success"); }); },
        fetchCloud() { if(!this.supabase) return; this.supabase.from('profiles').select('data').eq('id', this.user.id).single().then(({data}) => { if(data) { this.chars = {...this.chars, ...data.data}; this.updateAgentCount(); } }); },
        
        // Mantendo funções menores para evitar quebra
        notify(m, t) { this.notifications.push({id: Date.now(), message: m, type: t}); setTimeout(()=>this.notifications.shift(), 3000); },
        toggleSetting(k,v) { if(v) this.settings[k]=v; else this.settings[k]=!this.settings[k]; this.saveLocal(); this.updateVisualState(); },
        applyTheme(c) { document.documentElement.style.setProperty('--neon-core', c==='purple'?'#d946ef':c==='gold'?'#eab308':'#0ea5e9'); },
        completeOnboarding() { localStorage.setItem('zenite_setup_done', 'true'); this.isOnboarding=false; this.configModal=false; },
        toggleHackerMode() { this.hackerMode=!this.hackerMode; document.body.classList.toggle('theme-hacker', this.hackerMode); },
        askHardReset() { localStorage.clear(); window.location.reload(); },
        askSwitchToOnline() { window.location.reload(); },
        enterGuest() { this.isGuest=true; this.loadLocal('zenite_guest_db'); },
        doSocialAuth(p) { if(this.supabase) this.supabase.auth.signInWithOAuth({provider:p}); },
        exportData() { const a = document.createElement('a'); a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.chars)); a.download="zenite_bkp.json"; a.click(); },
        triggerFileImport() { document.getElementById('import-file').click(); },
        processImport(e) { const r = new FileReader(); r.onload = (ev) => { Object.assign(this.chars, JSON.parse(ev.target.result)); this.saveLocal(); this.updateAgentCount(); this.notify("Importado.", "success"); }; r.readAsText(e.target.files[0]); },
        openImageEditor(c) { this.uploadContext=c; document.getElementById('file-input').click(); },
        initCropper(e) { const f=e.target.files[0]; if(f){ const r=new FileReader(); r.onload=(ev)=>{ document.getElementById('crop-target').src=ev.target.result; this.cropperOpen=true; this.$nextTick(()=>{ new Cropper(document.getElementById('crop-target')); }); }; r.readAsDataURL(f); } },
        applyCrop() { this.cropperOpen=false; /* Lógica simplificada de crop */ },
        
        // Wizard & Stats
        openWizard() { this.wizardOpen=true; },
        selectArchetype(a) { this.wizardData.class=a.class; this.wizardStep=2; },
        modWizardAttr(k,v) { this.wizardData.attrs[k]+=v; }, // Simplificado
        finishWizard() { 
            const id='z_'+Date.now(); 
            this.chars[id] = {id, name:this.wizardData.name, class:this.wizardData.class, level:1, stats:{pv:{current:20,max:20},pf:{current:20,max:20},pdf:{current:20,max:20}}, attrs:{...this.wizardData.attrs}, inventory:{weapons:[],armor:[],gear:[],social:{people:[],objects:[]}}, skills:[], powers:{concept:'',abilities:'',techniques:[]} };
            this.wizardOpen=false; this.loadCharacter(id);
        },
        calculateBaseStats(c,l,a) { return {pv:20, pf:20, pdf:20}; },
        recalcDerivedStats() {},
        modStat(s,v) { if(this.char) this.char.stats[s].current+=v; },
        modAttr(k,v) { if(this.char) this.char.attrs[k]+=v; },
        addItem(c) { if(this.char) { const t=c.includes('social')?this.char.inventory.social[c.split('_')[1]]:this.char.inventory[c]; t.push({name:'Novo Item'}); } },
        deleteItem(c,i,s) { const t=s?this.char.inventory.social[s]:this.char.inventory[c]; t.splice(i,1); },
        addSkill() { this.char.skills.push({name:'Nova', level:1}); },
        deleteSkill(i) { this.char.skills.splice(i,1); },
        setSkillLevel(i,l) { this.char.skills[i].level=l; },
        addTechnique() { this.char.powers.techniques.push({name:'Técnica', desc:''}); },
        deleteTechnique(i) { this.char.powers.techniques.splice(i,1); },
        
        // Dice
        toggleDiceTray() { this.diceTrayOpen = !this.diceTrayOpen; },
        setDockMode(m) { this.trayDockMode = m; },
        startDragTray() {},
        ensureTrayOnScreen() {},
        roll(d) { 
            playSFX('click'); 
            const r=Math.floor(Math.random()*d)+1; 
            this.lastRoll=r; this.lastFaces=d; this.lastNatural=r; 
            this.diceLog.unshift({id:Date.now(), result:r, formula:'D'+d}); 
        },
        updateRadarChart() { this._renderChart('radarChart', [this.char.attrs.for, this.char.attrs.agi, this.char.attrs.int, this.char.attrs.von, this.char.attrs.pod], false); },
        updateWizardChart() { this._renderChart('wizChart', [this.wizardData.attrs.for, this.wizardData.attrs.agi, this.wizardData.attrs.int, this.wizardData.attrs.von, this.wizardData.attrs.pod], true); },
        _renderChart(id, data, isWiz) {
             const ctx = document.getElementById(id); if(!ctx) return;
             if(ctx.chart) ctx.chart.destroy();
             ctx.chart = new Chart(ctx, { type: 'radar', data: { labels: ['FOR','AGI','INT','VON','POD'], datasets: [{ data, backgroundColor: 'rgba(14,165,233,0.2)', borderColor: '#0ea5e9', borderWidth: 2 }] }, options: { scales: { r: { min:-1, max: isWiz?4:6, ticks:{display:false} } }, plugins: { legend: { display: false } } } });
        },
        
        // Helpers que estavam faltando
        setupListeners() { window.addEventListener('resize', () => this.isMobile = window.innerWidth < 768); },
        setupCursorEngine() { /* Lógica do mouse trail simples */ 
             const trail = document.getElementById('mouse-trail');
             let tx=0, ty=0;
             document.addEventListener('mousemove', (e) => { cursorX = e.clientX; cursorY = e.clientY; });
             const loop = () => {
                 if(this.user || this.isGuest) {
                     tx += (cursorX - tx) * 0.4; ty += (cursorY - ty) * 0.4;
                     if(trail) trail.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
                 }
                 requestAnimationFrame(loop);
             };
             loop();
        },
        setupWatchers() { this.$watch('char', (v) => { if(v && this.activeCharId) { this.chars[this.activeCharId]=v; this.debouncedSaveFunc(); } }, {deep:true}); }
    };
}