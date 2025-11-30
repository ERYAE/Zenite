/**
 * ZENITE OS v83.0 - Stable Core
 */

// Fallback
if (typeof window.CONFIG === 'undefined') window.CONFIG = { MAX_AGENTS: 30, SAVE_INTERVAL: 180000 };

function zeniteSystem() {
    return {
        systemLoading: true, loadingProgress: 0, loadingText: 'BOOT',
        user: null, isGuest: false,
        chars: {}, activeCharId: null, char: null, agentCount: 0,
        currentView: 'dashboard', activeTab: 'profile', logisticsTab: 'inventory',
        searchQuery: '', userMenuOpen: false, configModal: false,
        
        // MOUSE VARS
        cursorX: -100, cursorY: -100, isCursorHover: false,

        // WIDGETS
        diceTrayOpen: false, diceLog: [], lastRoll: '--', diceMod: 0,
        wizardOpen: false, wizardStep: 1, wizardPoints: 8, wizardData: {}, wizardFocusAttr: '',
        cropperOpen: false, cropperInstance: null, uploadContext: 'char',
        confirmOpen: false, confirmData: { title:'', desc:'', action:null, type:'danger' },
        
        // SECRETS
        konamiBuffer: [], logoClickCount: 0, logoClickTimer: null, systemFailure: false,
        
        // CONFIG
        settings: { mouseTrail: true, compactMode: false, performanceMode: false, crtMode: false, sfxEnabled: true, themeColor: 'cyan' },
        
        unsavedChanges: false, isSyncing: false, supabase: null, netLink: null, debouncedSaveFunc: null,

        get filteredChars() {
            if (!this.searchQuery) return this.chars;
            const q = this.searchQuery.toLowerCase();
            const res = {};
            Object.keys(this.chars).forEach(id => {
                if (this.chars[id].name?.toLowerCase().includes(q) || this.chars[id].class?.toLowerCase().includes(q)) res[id] = this.chars[id];
            });
            return res;
        },
        get archetypes() { return window.RPG ? window.RPG.archetypes : []; },

        // --- INIT ---
        async initSystem() {
            console.log("Zenite: Starting...");
            this.loadingProgress = 10;
            
            // MOUSE ENGINE START
            this.initMouseTrail();

            setTimeout(() => { if(this.systemLoading) this.systemLoading = false; }, 5000);

            try {
                await new Promise(r => setTimeout(r, 300));
                if (typeof window.supabase !== 'undefined') {
                    this.supabase = window.supabase.createClient(window.CONFIG.SUPABASE_URL, window.CONFIG.SUPABASE_KEY);
                }
                this.loadingProgress = 30;
                
                // SFX Listener Global
                document.addEventListener('click', (e) => {
                    if(this.settings.sfxEnabled && window.SFX && e.target.closest('button, a, .cursor-pointer')) window.SFX.play('click');
                });

                this.loadLocal();
                this.applyTheme(this.settings.themeColor);
                this.updateVisuals();

                // Auth Check
                const isGuest = localStorage.getItem('zenite_is_guest') === 'true';
                if (isGuest) {
                    this.isGuest = true;
                    this.loadLocal('zenite_guest_db');
                } else if (this.supabase) {
                    const { data: { session } } = await this.supabase.auth.getSession();
                    if (session) { this.user = session.user; await this.fetchCloud(); }
                    
                    this.supabase.auth.onAuthStateChange(async (evt, session) => {
                        if (evt === 'SIGNED_IN' && session) {
                            this.user = session.user; this.isGuest = false; localStorage.removeItem('zenite_is_guest');
                            await this.fetchCloud();
                        } else if (evt === 'SIGNED_OUT') {
                            this.user = null; this.chars = {}; this.currentView = 'dashboard';
                        }
                        this.updateVisuals();
                    });
                }

                this.updateAgentCount();
                this.loadingProgress = 100;
                setTimeout(() => { this.systemLoading = false; }, 500);

            } catch (e) {
                console.error(e);
                this.notify("Erro de inicialização: " + e.message, "error");
                this.systemLoading = false;
            }
        },

        // --- MOUSE TRAIL (Integrado ao Alpine para funcionar) ---
        initMouseTrail() {
            if (window.innerWidth < 768) return;
            document.addEventListener('mousemove', (e) => {
                this.cursorX = e.clientX;
                this.cursorY = e.clientY;
                this.isCursorHover = !!e.target.closest('button, a, input, select, .cursor-pointer');
            });
        },

        // --- CORE ---
        loadLocal(key='zenite_cached_db') {
            const d = localStorage.getItem(key);
            if(d) {
                const p = JSON.parse(d);
                if(p.config) this.settings = {...this.settings, ...p.config};
                Object.keys(p).forEach(k => { if(p[k].id) this.chars[k] = p[k]; });
            }
        },
        saveLocal() {
            const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db';
            localStorage.setItem(key, JSON.stringify({...this.chars, config: this.settings}));
        },
        async fetchCloud() {
            if(!this.user) return;
            const { data } = await this.supabase.from('profiles').select('data').eq('id', this.user.id).single();
            if(data?.data) {
                if(data.data.config) this.settings = {...this.settings, ...data.data.config};
                Object.keys(data.data).forEach(k => { if(k!=='config') this.chars[k] = data.data[k]; });
                this.saveLocal(); this.updateVisuals(); this.updateAgentCount();
            }
        },
        async syncCloud(silent=false) {
            if(!this.user || this.isGuest || !this.unsavedChanges) return;
            this.isSyncing = true; if(!silent) this.notify("Salvando...");
            await this.supabase.from('profiles').upsert({id: this.user.id, data: {...this.chars, config: this.settings}});
            this.isSyncing = false; this.unsavedChanges = false; if(!silent) { this.notify("Salvo!", "success"); if(window.SFX) window.SFX.play('save'); }
        },
        
        // --- VISUALS ---
        updateVisuals() {
            if(this.settings.crtMode) document.body.classList.add('crt-mode'); else document.body.classList.remove('crt-mode');
            if(this.settings.compactMode && window.innerWidth < 768) document.body.classList.add('compact-mode');
            if(window.SFX) window.SFX.toggle(this.settings.sfxEnabled);
        },
        toggleSetting(key, val) {
            if(val!==undefined) this.settings[key]=val; else this.settings[key]=!this.settings[key];
            if(key==='themeColor') this.applyTheme(this.settings.themeColor);
            this.updateVisuals(); this.saveLocal(); if(!this.isGuest) this.syncCloud(true);
        },
        applyTheme(c) {
            const hex = {'cyan':'#0ea5e9','purple':'#d946ef','gold':'#eab308'}[c] || '#0ea5e9';
            document.documentElement.style.setProperty('--neon-core', hex);
            const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
            document.documentElement.style.setProperty('--neon-rgb', `${r},${g},${b}`);
        },

        // --- ACTIONS ---
        loadCharacter(id) { 
            this.char = JSON.parse(JSON.stringify(this.chars[id])); 
            this.activeCharId = id; this.currentView = 'sheet'; 
            this.$watch('char', () => { if(!this.isGuest) this.unsavedChanges = true; });
            this.$nextTick(() => { if(window.UTILS) this.updateRadarChart(); });
        },
        saveAndExit() {
            if(this.char) { this.chars[this.activeCharId] = JSON.parse(JSON.stringify(this.char)); this.saveLocal(); if(!this.isGuest) this.syncCloud(); }
            this.currentView = 'dashboard'; this.char = null;
        },
        attemptGoBack() {
            if(this.unsavedChanges && !this.isGuest) { if(window.SFX) window.SFX.play('discard'); alert("Salve suas alterações!"); } // Fallback simples temporário para garantir UX
            else this.saveAndExit();
        },
        
        // --- SECRETS & ERROR ---
        handleLogoClick() {
            clearTimeout(this.logoClickTimer); this.logoClickCount++;
            if(this.logoClickCount >= 5) { this.logoClickCount = 0; this.systemFailure = true; if(window.SFX) window.SFX.play('glitch'); if(!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{}); setTimeout(()=>{this.systemFailure=false;},5000); }
            else this.logoClickTimer = setTimeout(()=>this.logoClickCount=0, 2000);
        },
        
        // --- HELPERS ---
        notify(msg, type='info') { const id=Date.now(); this.notifications.push({id, message:msg, type}); setTimeout(()=>this.notifications=this.notifications.filter(n=>n.id!==id),3000); },
        updateAgentCount() { this.agentCount = Object.keys(this.chars).length; },
        roll(d) { const v=Math.floor(Math.random()*d)+1; this.lastRoll=v+(parseInt(this.diceMod)||0); this.diceLog.unshift({time:new Date().toLocaleTimeString(), result:this.lastRoll, formula:`D${d}`}); if(window.SFX) window.SFX.play('roll'); },
        
        // --- PROXIES ---
        updateRadarChart() { window.UTILS.renderChart('radarChart', [this.char.attrs.for, this.char.attrs.agi, this.char.attrs.int, this.char.attrs.von, this.char.attrs.pod]); },
        openImageEditor(ctx) { this.uploadContext=ctx; document.getElementById('file-input').click(); },
        initCropper(e) { window.UTILS.initCropper(e.target.files[0], 'crop-target', ()=>{this.cropperOpen=true; this.$nextTick(()=>{this.cropperInstance=new Cropper(document.getElementById('crop-target'),{aspectRatio:1,viewMode:1});});}); },
        applyCrop() { const img=window.UTILS.getCroppedImage(this.cropperInstance); if(this.uploadContext==='wizard') this.wizardData.photo=img; else this.char.photo=img; this.cropperOpen=false; },
        
        // --- WIZARD ---
        openWizard() { this.wizardStep=1; this.wizardPoints=8; this.wizardData={class:'', attrs:{for:-1,agi:-1,int:-1,von:-1,pod:-1}}; this.wizardOpen=true; },
        selectArchetype(a) { this.wizardData.class=a.class; this.wizardData.attrs={for:-1,agi:-1,int:-1,von:-1,pod:-1}; this.wizardData.attrs[a.focus]=0; this.wizardFocusAttr=a.focus; this.wizardStep=2; this.$nextTick(()=>window.UTILS.renderChart('wizChart',[...Object.values(this.wizardData.attrs)], true)); },
        modWizardAttr(k,v) { 
            const c=this.wizardData.attrs[k]; const f=(k===this.wizardFocusAttr);
            if(v>0 && this.wizardPoints>0 && c<3) { this.wizardData.attrs[k]++; this.wizardPoints--; }
            if(v<0 && c>(f?0:-1)) { this.wizardData.attrs[k]--; this.wizardPoints++; }
            window.UTILS.renderChart('wizChart',[this.wizardData.attrs.for,this.wizardData.attrs.agi,this.wizardData.attrs.int,this.wizardData.attrs.von,this.wizardData.attrs.pod], true);
        },
        finishWizard() { 
            const id = 'z_'+Date.now(); const c = window.RPG.createBlankChar(id, this.wizardData); 
            this.chars[id] = c; this.saveLocal(); this.wizardOpen=false; this.loadCharacter(id); 
        },
        
        // --- MODALS ---
        askDeleteChar(id) { if(confirm("Deletar?")) { delete this.chars[id]; this.saveLocal(); if(!this.isGuest) this.syncCloud(); } },
        askLogout() { if(confirm("Sair?")) { localStorage.removeItem('zenite_cached_db'); window.location.reload(); } },
        doSocialAuth(p) { this.authLoading=true; this.supabase.auth.signInWithOAuth({provider:p, options:{redirectTo:window.location.origin}}); },
        enterGuest() { this.isGuest=true; localStorage.setItem('zenite_is_guest','true'); this.loadLocal(); }
    };
}