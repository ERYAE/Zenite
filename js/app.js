/**
 * ZENITE OS - Main Controller v81.0 (Final Fix)
 */

// Globais para Rastro do Mouse
let cursorX = -100;
let cursorY = -100;
let isCursorHover = false;

// Mouse Engine Independente (Roda fora do Alpine para performance e garantia)
(function initMouseEngine() {
    const trail = document.getElementById('mouse-trail');
    
    document.addEventListener('mousemove', (e) => {
        cursorX = e.clientX;
        cursorY = e.clientY;
        // Detecta hover
        isCursorHover = !!e.target.closest('button, a, input, select, .cursor-pointer');
    });

    const loop = () => {
        if (trail) {
            // Só mostra se a classe estiver no body (controlado pelo Alpine)
            if (document.body.classList.contains('custom-cursor-active')) {
                trail.style.display = 'block';
                trail.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0)`;
                if (isCursorHover) trail.classList.add('hover-active');
                else trail.classList.remove('hover-active');
            } else {
                trail.style.display = 'none';
            }
        }
        requestAnimationFrame(loop);
    };
    loop();
})();

function zeniteSystem() {
    return {
        // STATES
        systemLoading: true,
        loadingProgress: 0,
        loadingText: 'BOOT',
        user: null,
        isGuest: false,
        
        // DATA
        chars: {},
        activeCharId: null,
        char: null,
        agentCount: 0,
        
        // UI
        currentView: 'dashboard',
        activeTab: 'profile',
        logisticsTab: 'inventory',
        searchQuery: '',
        userMenuOpen: false,
        configModal: false,
        
        // MODALS & WIZARD
        wizardOpen: false,
        wizardStep: 1,
        wizardPoints: 8,
        wizardData: { class: '', name: '', identity: '', age: '', history: '', photo: null, attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} },
        wizardFocusAttr: '',
        cropperOpen: false,
        confirmOpen: false,
        confirmData: { title:'', desc:'', action:null, type:'danger' },

        // AUTH STATES
        authLoading: false, authMsg: '', authMsgType: '',
        
        // WIDGETS
        diceTrayOpen: false,
        diceLog: [],
        lastRoll: '--',
        diceMod: 0,
        
        // SYSTEM/SECRETS
        konamiBuffer: [],
        logoClickCount: 0,
        logoClickTimer: null,
        systemFailure: false,
        revertConfirmMode: false, // Para o popup de alterações
        isReverting: false,
        
        // CONFIGS
        settings: {
            compactMode: false,
            themeColor: 'cyan',
            sfxEnabled: true,
            crtMode: false,
            mouseTrail: true
        },
        
        unsavedChanges: false,
        isSyncing: false,
        supabase: null,

        // GETTERS
        get archetypes() { return window.RPG ? window.RPG.archetypes : []; },
        
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

        // --- INIT ---
        async initSystem() {
            this.loadingProgress = 10;
            
            // Failsafe Timeout
            setTimeout(() => { if(this.systemLoading) this.systemLoading = false; }, 8000);
            
            // Prevent Exit
            window.addEventListener('beforeunload', (e) => {
                if (this.unsavedChanges && !this.isGuest) {
                    e.preventDefault(); e.returnValue = 'Alterações pendentes.';
                }
            });

            try {
                await new Promise(r => setTimeout(r, 300));
                
                // Conexão Supabase
                if (typeof window.supabase !== 'undefined' && typeof CONFIG !== 'undefined') {
                    this.supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
                }
                
                this.loadingProgress = 30;
                this.loadingText = 'AUTHENTICATING';

                // SFX Init Listener
                document.addEventListener('click', (e) => {
                    if(this.settings.sfxEnabled && window.SFX) window.SFX.play(e.target.closest('button') ? 'click' : 'hover');
                });

                this.loadLocalData();
                this.applyTheme(this.settings.themeColor);
                
                // Auth
                const isGuest = localStorage.getItem('zenite_is_guest') === 'true';
                this.loadingProgress = 60;
                
                if (isGuest) {
                    this.isGuest = true;
                    this.loadLocalData('zenite_guest_db');
                } else if (this.supabase) {
                    const { data: { session } } = await this.supabase.auth.getSession();
                    if (session) {
                        this.user = session.user;
                        await this.fetchCloud();
                    }
                    
                    this.supabase.auth.onAuthStateChange(async (event, session) => {
                        if (event === 'SIGNED_IN' && session) {
                            this.user = session.user;
                            this.isGuest = false;
                            localStorage.removeItem('zenite_is_guest');
                            await this.fetchCloud();
                        } else if (event === 'SIGNED_OUT') {
                            this.user = null;
                            this.chars = {};
                            this.currentView = 'dashboard';
                        }
                        this.updateVisuals();
                    });
                }

                this.updateVisuals();
                this.updateAgentCount();
                
                // Auto Save
                setInterval(() => { 
                    if (this.user && this.unsavedChanges && !this.isSyncing) this.syncCloud(true); 
                }, CONFIG.SAVE_INTERVAL);

                this.loadingProgress = 100;
                this.loadingText = 'READY';
                setTimeout(() => { this.systemLoading = false; }, 500);

            } catch (err) {
                console.error("BOOT ERROR:", err);
                this.systemLoading = false; // Libera mesmo com erro
            }
        },

        // --- VISUALS MANAGER (MOUSE & CRT) ---
        updateVisuals() {
            // CRT
            if (this.settings.crtMode) document.body.classList.add('crt-mode');
            else document.body.classList.remove('crt-mode');
            
            // Compact
            if (this.settings.compactMode && window.innerWidth < 768) document.body.classList.add('compact-mode');
            
            // Mouse Trail (Só se logado e habilitado)
            const isLoggedIn = this.user || this.isGuest;
            if (isLoggedIn && this.settings.mouseTrail && !this.settings.performanceMode && window.innerWidth > 768) {
                document.body.classList.add('custom-cursor-active');
            } else {
                document.body.classList.remove('custom-cursor-active');
            }
            
            // SFX Sync
            if(window.SFX) window.SFX.toggle(this.settings.sfxEnabled);
        },

        toggleSetting(key, val) {
            if (val !== undefined) this.settings[key] = val;
            else this.settings[key] = !this.settings[key];
            
            if(key === 'themeColor') this.applyTheme(this.settings.themeColor);
            
            this.updateVisuals();
            this.saveLocal();
            if(!this.isGuest && this.user) { this.unsavedChanges = true; this.syncCloud(true); }
        },

        applyTheme(colorName) {
            const map = { 'cyan': '#0ea5e9', 'purple': '#d946ef', 'gold': '#eab308' };
            const hex = map[colorName] || map['cyan'];
            document.documentElement.style.setProperty('--neon-core', hex);
            // RGB hack para opacidade
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            document.documentElement.style.setProperty('--neon-rgb', `${r}, ${g}, ${b}`);
        },

        // --- DATA LOGIC ---
        loadLocalData(key = 'zenite_cached_db') {
            const local = localStorage.getItem(key);
            if (local) {
                try {
                    const parsed = JSON.parse(local);
                    if(parsed.config) this.settings = { ...this.settings, ...parsed.config };
                    const validChars = {};
                    Object.keys(parsed).forEach(k => {
                        if (k !== 'config' && k !== 'trayPos' && parsed[k].id) validChars[k] = parsed[k];
                    });
                    this.chars = validChars;
                } catch(e) { console.error(e); }
            }
        },

        saveLocal() {
            const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db';
            const payload = { ...this.chars, config: this.settings };
            localStorage.setItem(key, JSON.stringify(payload));
        },

        async fetchCloud() {
            if (!this.user || !this.supabase) return;
            const { data, error } = await this.supabase.from('profiles').select('data').eq('id', this.user.id).single();
            
            if (data && data.data) {
                if(data.data.config) this.settings = { ...this.settings, ...data.data.config };
                Object.keys(data.data).forEach(k => {
                    if(k !== 'config') this.chars[k] = data.data[k];
                });
                this.saveLocal();
                this.updateVisuals();
                this.updateAgentCount();
            } else if (error && error.code === 'PGRST116') {
                await this.supabase.from('profiles').insert([{ id: this.user.id, data: { config: this.settings } }]);
            }
        },

        async syncCloud(silent = false) {
            if (!this.user || this.isGuest || !this.unsavedChanges || this.isSyncing) return;
            this.isSyncing = true;
            if(!silent) this.notify("Salvando...", "info");
            
            try {
                const payload = { ...this.chars, config: this.settings };
                await this.supabase.from('profiles').upsert({ id: this.user.id, data: payload });
                this.unsavedChanges = false;
                if(!silent) {
                    this.notify("Salvo!", "success");
                    if(window.SFX) window.SFX.play('save');
                }
            } catch(e) { this.notify("Erro no Sync", "error"); } 
            finally { this.isSyncing = false; }
        },

        // --- ACTIONS ---
        loadCharacter(id) {
            if (!this.chars[id]) return;
            this.char = JSON.parse(JSON.stringify(this.chars[id]));
            this.activeCharId = id;
            this.currentView = 'sheet';
            
            // Deep watch para unsaved changes
            this.$watch('char', () => {
                if(!this.isGuest) this.unsavedChanges = true;
            });

            // Gráfico
            this.$nextTick(() => { if(window.UTILS) this.updateRadarChart(); });
        },

        saveAndExit() {
            if (this.char && this.activeCharId) {
                this.chars[this.activeCharId] = JSON.parse(JSON.stringify(this.char));
                this.updateAgentCount();
                this.saveLocal();
                if (!this.isGuest) this.syncCloud();
            }
            this.currentView = 'dashboard';
            this.char = null;
            this.activeCharId = null;
            this.unsavedChanges = false;
        },

        attemptGoBack() {
            if(this.unsavedChanges && !this.isGuest) {
                // Abre o popup
                // Nota: O popup é controlado pela variável `unsavedChanges`, não precisa de função extra se o HTML estiver certo
                if(window.SFX) window.SFX.play('discard'); // Som de aviso
            } else {
                this.saveAndExit();
            }
        },

        // --- WIZARD & RPG ---
        openWizard() {
            if (this.agentCount >= CONFIG.MAX_AGENTS) return this.notify("Limite atingido!", "error");
            this.wizardStep = 1;
            this.wizardPoints = 8;
            this.wizardData = { class: '', name: '', identity: '', age: '', history: '', photo: null, attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} };
            this.wizardOpen = true;
        },

        selectArchetype(arch) {
            this.wizardData.class = arch.class;
            this.wizardData.attrs = {for:-1, agi:-1, int:-1, von:-1, pod:-1};
            this.wizardData.attrs[arch.focus] = 0;
            this.wizardFocusAttr = arch.focus;
            this.wizardStep = 2;
            this.$nextTick(() => this.updateWizardChart());
        },

        modWizardAttr(key, val) {
            const current = this.wizardData.attrs[key];
            const isFocus = key === this.wizardFocusAttr;
            if (val > 0 && this.wizardPoints > 0 && current < 3) {
                this.wizardData.attrs[key]++;
                this.wizardPoints--;
            } else if (val < 0 && current > (isFocus ? 0 : -1)) {
                this.wizardData.attrs[key]--;
                this.wizardPoints++;
            }
            this.updateWizardChart();
        },

        finishWizard() {
            if(!this.wizardData.name) return this.notify("Nome obrigatório!", "warn");
            const id = 'z_' + Date.now();
            const newChar = window.RPG.createBlankChar(id, this.wizardData);
            this.chars[id] = newChar;
            this.updateAgentCount();
            this.saveLocal();
            if(!this.isGuest) this.syncCloud(true);
            this.wizardOpen = false;
            this.loadCharacter(id);
            this.notify("Agente criado!", "success");
        },
        
        // --- UTILS (Delegates) ---
        updateRadarChart() { window.UTILS.renderChart('radarChart', [this.char.attrs.for, this.char.attrs.agi, this.char.attrs.int, this.char.attrs.von, this.char.attrs.pod]); },
        updateWizardChart() { window.UTILS.renderChart('wizChart', [this.wizardData.attrs.for, this.wizardData.attrs.agi, this.wizardData.attrs.int, this.wizardData.attrs.von, this.wizardData.attrs.pod], true); },
        openImageEditor(ctx) { this.uploadContext = ctx; document.getElementById('file-input').click(); },
        initCropper(e) { window.UTILS.initCropper(e.target.files[0], 'crop-target', () => { this.cropperOpen = true; this.$nextTick(() => { if(this.cropperInstance) this.cropperInstance.destroy(); this.cropperInstance = new Cropper(document.getElementById('crop-target'), { aspectRatio: 1, viewMode: 1 }); }); }); },
        applyCrop() { 
            const res = window.UTILS.getCroppedImage(this.cropperInstance);
            if(this.uploadContext==='wizard') this.wizardData.photo = res; else this.char.photo = res;
            this.cropperOpen = false;
        },
        exportData() { window.UTILS.exportJSON(this.chars, 'zenite_bkp.json'); },
        triggerFileImport() { document.getElementById('import-file').click(); },
        processImport(e) { window.UTILS.readJSON(e.target.files[0], (data) => { if(data) { this.chars = {...this.chars, ...data}; this.saveLocal(); this.configModal=false; this.notify("Importado!", "success"); } }); },

        // --- SECRETS ---
        handleKeys(e) {
            const k = e.key.toLowerCase();
            const code = ['arrowup','arrowup','arrowdown','arrowdown','arrowleft','arrowright','arrowleft','arrowright','b','a'];
            this.konamiBuffer.push(k);
            if(this.konamiBuffer.length > code.length) this.konamiBuffer.shift();
            if(JSON.stringify(this.konamiBuffer) === JSON.stringify(code)) {
                document.body.classList.toggle('theme-hacker');
                if(window.SFX) window.SFX.play('glitch');
                this.notify("HACKER MODE", "success");
                this.konamiBuffer = [];
            }
        },
        handleLogoClick() {
            clearTimeout(this.logoClickTimer);
            this.logoClickCount++;
            if(this.logoClickCount >= 5) {
                this.logoClickCount = 0;
                this.triggerSystemFailure();
            } else {
                this.logoClickTimer = setTimeout(() => this.logoClickCount = 0, 2000);
                // Fullscreen toggle
                if(!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{});
                else if(document.exitFullscreen) document.exitFullscreen();
            }
        },
        triggerSystemFailure() {
            if(window.SFX) window.SFX.play('glitch');
            this.systemFailure = true;
            if(!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{});
            setTimeout(() => { 
                this.systemFailure = false; 
                if(window.SFX) window.SFX.play('discard');
            }, 5000);
        },

        // --- BOILERPLATE ---
        notify(msg, type='info') { const id=Date.now(); this.notifications.push({id, message:msg, type}); setTimeout(()=>this.notifications=this.notifications.filter(n=>n.id!==id), 3000); },
        updateAgentCount() { this.agentCount = Object.keys(this.chars).length; },
        roll(d) { 
            const val = Math.floor(Math.random()*d)+1; 
            this.lastRoll = val + parseInt(this.diceMod||0); 
            if(window.SFX) window.SFX.play('roll'); 
            this.diceLog.unshift({time: new Date().toLocaleTimeString(), result: this.lastRoll, formula: `D${d}`});
        },
        toggleDiceTray() { this.diceTrayOpen = !this.diceTrayOpen; },
        
        // MODALS
        askLogout() { this.confirmData={title:'SAIR', desc:'Dados não salvos serão perdidos.', action:()=>this.logout(), type:'danger'}; this.confirmOpen=true; },
        askDeleteChar(id) { this.confirmData={title:'DELETAR', desc:'Irreversível.', action:()=>{delete this.chars[id]; this.saveLocal(); if(!this.isGuest) this.syncCloud();}, type:'danger'}; this.confirmOpen=true; },
        askSwitchToOnline() { this.confirmData={title:'ONLINE', desc:'Ir para login.', action:()=>{this.isGuest=false; localStorage.removeItem('zenite_is_guest'); window.location.reload();}, type:'info'}; this.confirmOpen=true; },
        askHardReset() { this.confirmData={title:'RESET', desc:'Apaga cache local.', action:()=>{localStorage.clear(); window.location.reload();}, type:'danger'}; this.confirmOpen=true; },
        confirmYes() { if(this.confirmData.action) this.confirmData.action(); this.confirmOpen = false; },
        
        // AUTH
        enterGuest() { this.isGuest=true; localStorage.setItem('zenite_is_guest','true'); this.loadLocalData('zenite_guest_db'); },
        doSocialAuth(p) { this.authLoading=true; this.supabase.auth.signInWithOAuth({provider:p, options:{redirectTo:window.location.origin}}); },
        
        // RPG Helpers (Pass-through)
        modStat(s,v) { if(!this.char) return; const st=this.char.stats[s]; st.current=Math.max(0, Math.min(st.max, st.current+v)); },
        modAttr(k,v) { if(!this.char) return; const c=this.char; if((v>0 && c.attrs[k]<6) || (v<0 && c.attrs[k]>-1)) { c.attrs[k]+=v; this.recalcDerivedStats(); this.updateRadarChart(); } },
        addItem(c) { if(this.char) { const def={name:'Item', qty:1}; if(c=='gear') this.char.inventory.gear.push(def); } },
        deleteItem(c,i) { if(this.char) this.char.inventory[c].splice(i,1); },
        addSkill() { this.char.skills.push({name:'Nova Perícia', level:1}); },
        deleteSkill(i) { this.char.skills.splice(i,1); },
        setSkillLevel(i,l) { this.char.skills[i].level = l; },
        addTechnique() { this.char.powers.techniques.push({name:'Tecnica', desc:''}); },
        deleteTechnique(i) { this.char.powers.techniques.splice(i,1); },
        toggleRevertMode() { this.revertConfirmMode = !this.revertConfirmMode; },
        performRevert() { this.loadCharacter(this.activeCharId); this.unsavedChanges = false; this.revertConfirmMode = false; this.notify("Revertido!", "success"); }
    };
}