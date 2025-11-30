/**
 * ZENITE OS - Core Application v2.2
 * Integrado com NetLink, SheetModule e GMPanel.
 */

function zeniteSystem() {
    return {
        // --- ESTADOS ---
        systemLoading: true, loadingProgress: 0, loadingText: 'BOOT',
        user: null, isGuest: false,
        
        // --- DADOS ---
        chars: {}, activeCharId: null, char: null, agentCount: 0,
        campaigns: [], 
        
        // --- UI ---
        currentView: 'dashboard', activeTab: 'profile',
        userMenuOpen: false, configModal: false, wizardOpen: false,
        notifications: [],
        
        // --- Variáveis GM Panel ---
        gmNoteBuffer: '', // Para o textarea de notas
        newInitName: '', newInitRoll: '', // Inputs da iniciativa
        
        // --- Módulos Internos ---
        sheetLogic: null,
        netLink: null,
        gmPanel: null, // Instância do GM Panel
        supabase: null,
        
        // --- Settings ---
        settings: { mouseTrail: true, themeColor: 'cyan', sfxEnabled: true },
        
        get archetypes() { return window.RPG ? window.RPG.archetypes : []; },
        get filteredChars() { if (!this.searchQuery) return this.chars; const q = this.searchQuery.toLowerCase(); const r = {}; Object.keys(this.chars).forEach(id => { const c = this.chars[id]; if ((c.name && c.name.toLowerCase().includes(q)) || (c.class && c.class.toLowerCase().includes(q))) r[id] = c; }); return r; },

        // ============================
        // INICIALIZAÇÃO
        // ============================
        async initSystem() {
            this.loadingProgress = 20;
            
            // 1. Inicia Módulos Lógicos
            if(window.SheetModule) this.sheetLogic = window.SheetModule();
            
            // 2. Inicia Supabase & NetLink
            if (typeof window.supabase !== 'undefined' && window.CONFIG) {
                this.supabase = window.supabase.createClient(window.CONFIG.SUPABASE_URL, window.CONFIG.SUPABASE_KEY);
                
                if(window.netLinkSystem) {
                    this.netLink = window.netLinkSystem(this.supabase, null); // User entra depois
                    this.gmPanel = window.GMPanel(this.netLink); // Passa o NetLink pro GM Panel
                }
            }

            // 3. Carrega Cache Local
            this.loadLocal('zenite_cached_db');
            
            // 4. Auth Check
            if(this.supabase) {
                const { data: { session } } = await this.supabase.auth.getSession();
                if(session) {
                    this.setupUser(session.user);
                }
                
                this.supabase.auth.onAuthStateChange(async (evt, session) => {
                    if (evt === 'SIGNED_IN' && session) {
                        this.setupUser(session.user);
                        window.location.reload(); 
                    } else if (evt === 'SIGNED_OUT') {
                        this.user = null;
                        this.currentView = 'dashboard';
                    }
                });
            }

            this.loadingProgress = 100;
            setTimeout(() => { this.systemLoading = false; }, 500);
            
            setInterval(() => { if (this.user && this.unsavedChanges) this.syncCloud(true); }, window.CONFIG.SAVE_INTERVAL);
        },

        async setupUser(user) {
            this.user = user;
            if(this.netLink) {
                this.netLink.user = user;
                await this.netLink.init();
                this.campaigns = this.netLink.campaigns;
            }
            await this.fetchCloud();
        },

        // ============================
        // FUNÇÕES GM PANEL (Ponte)
        // ============================
        gmSetAtmosphere(type) { if(this.gmPanel) this.gmPanel.setAtmosphere(type); },
        
        gmAddInit() { 
            if(this.gmPanel && this.newInitName) {
                this.gmPanel.addToInitiative(this.newInitName, this.newInitRoll);
                this.newInitName = ''; this.newInitRoll = '';
            }
        },
        gmNextTurn() { if(this.gmPanel) this.gmPanel.nextTurn(); },
        gmRemoveInit(idx) { if(this.gmPanel) this.gmPanel.removeFromInitiative(idx); },
        gmSaveNotes() { 
            if(this.gmPanel && this.netLink?.activeCampaign) {
                this.gmPanel.saveNotes(this.netLink.activeCampaign.data.notes);
                this.notify("Notas salvas.", "success");
            }
        },

        // ============================
        // LÓGICA DE FICHA
        // ============================
        modAttr(key, val) {
            if(this.sheetLogic && this.char) {
                this.char = this.sheetLogic.modAttr(this.char, key, val);
                this.unsavedChanges = true;
            }
        },
        
        recalcDerivedStats() {
            if(this.sheetLogic && this.char) {
                this.char = this.sheetLogic.recalcStats(this.char);
                if(window.UTILS) window.UTILS.renderChart('radarChart', [this.char.attrs.for, this.char.attrs.agi, this.char.attrs.int, this.char.attrs.von, this.char.attrs.pod]);
            }
        },
        
        // ... (MANTENHA AS OUTRAS FUNÇÕES: loadCharacter, wizard, etc. IGUAL ANTES) ...
        // Para economizar espaço, assuma que o resto do código (saveLocal, loadLocal, etc) continua aqui.
        // Se precisar do arquivo COMPLETO com 100% das linhas, me avise, mas é basicamente copiar as funções utilitárias do upload anterior.
        
        // Helpers Essenciais para UI
        loadLocal(key) { const l=localStorage.getItem(key); if(l) { try { const p=JSON.parse(l); if(p.config)this.settings={...this.settings,...p.config}; const v={}; Object.keys(p).forEach(k=>{if(p[k]?.id)v[k]=p[k]}); this.chars=v; this.agentCount=Object.keys(this.chars).length; }catch(e){} } },
        saveLocal() { const k=this.isGuest?'zenite_guest_db':'zenite_cached_db'; localStorage.setItem(k, JSON.stringify({...this.chars, config:this.settings})); },
        notify(msg, type='info') { const id=Date.now(); this.notifications.push({id, message:msg, type}); setTimeout(()=>this.notifications=this.notifications.filter(n=>n.id!==id),3000); },
        updateRadarChart() { if(!this.char || !window.UTILS) return; window.UTILS.renderChart('radarChart', [this.char.attrs.for, this.char.attrs.agi, this.char.attrs.int, this.char.attrs.von, this.char.attrs.pod]); },
        
        // NetLink UI
        async createCampaignUI() { const n=prompt("Nome:"); if(n&&this.netLink) { await this.netLink.createCampaign(n); this.campaigns=this.netLink.campaigns; this.notify("Criada!", "success"); } },
        async joinCampaignUI() { const c=prompt("Código:"); if(c&&this.netLink) { await this.netLink.joinCampaign(c); this.campaigns=this.netLink.campaigns; this.notify("Entrou!", "success"); } },
        async openCampaign(id) { if(this.netLink) { await this.netLink.enterCampaign(id); this.currentView='campaign_panel'; } },
        
        // Auth UI
        doSocialAuth(p) { this.supabase.auth.signInWithOAuth({provider:p, options:{redirectTo:window.location.origin}}); },
        askLogout() { if(confirm("Sair?")) { localStorage.removeItem('zenite_cached_db'); this.supabase.auth.signOut(); window.location.reload(); } },
        enterGuest() { this.isGuest=true; this.loadLocal('zenite_guest_db'); },
        
        // Wizard
        openWizard() { if(this.agentCount>=30) return this.notify("Cheio!","error"); this.wizardStep=1; this.wizardPoints=8; this.wizardData={class:'',name:'',identity:'',age:'',history:'',photo:null,attrs:{for:-1,agi:-1,int:-1,von:-1,pod:-1}}; this.wizardOpen=true; },
        selectArchetype(a) { this.wizardData.class=a.class; this.wizardData.attrs={for:-1,agi:-1,int:-1,von:-1,pod:-1}; this.wizardData.attrs[a.focus]=0; this.wizardFocusAttr=a.focus; this.wizardStep=2; setTimeout(()=>window.UTILS.renderChart('wizChart',[this.wizardData.attrs.for,this.wizardData.attrs.agi,this.wizardData.attrs.int,this.wizardData.attrs.von,this.wizardData.attrs.pod],true),50); },
        modWizardAttr(k,v) { const c=this.wizardData.attrs[k], f=k===this.wizardFocusAttr; if(v>0&&this.wizardPoints>0&&c<3){this.wizardData.attrs[k]++;this.wizardPoints--;} if(v<0&&c>(f?0:-1)){this.wizardData.attrs[k]--;this.wizardPoints++;} window.UTILS.renderChart('wizChart',[this.wizardData.attrs.for,this.wizardData.attrs.agi,this.wizardData.attrs.int,this.wizardData.attrs.von,this.wizardData.attrs.pod],true); },
        finishWizard() { if(!this.wizardData.name) return this.notify("Nome?","warn"); const id='z_'+Date.now(); let nc=window.RPG.createBlankChar(id,this.wizardData); nc=this.sheetLogic.recalcStats(nc); this.chars[id]=nc; this.agentCount++; this.saveLocal(); if(this.user) this.syncCloud(true); this.wizardOpen=false; this.loadCharacter(id); this.notify("Criado!","success"); },
        
        loadCharacter(id) { if(!this.chars[id]) return; this.char=JSON.parse(JSON.stringify(this.chars[id])); this.char=this.sheetLogic.recalcStats(this.char); this.activeCharId=id; this.currentView='sheet'; setTimeout(()=>this.updateRadarChart(),100); },
        attemptGoBack() { this.saveLocal(); if(this.user) this.syncCloud(true); this.currentView='dashboard'; this.char=null; },
        
        // Sheet UI
        modStat(s,v) { if(this.char) { const st=this.char.stats[s]; st.current=Math.max(0,Math.min(st.max,st.current+v)); } },
        addItem(cat) { if(this.sheetLogic) this.char=this.sheetLogic.addItem(this.char,cat); },
        deleteItem(cat,i,sub) { if(this.sheetLogic) this.char=this.sheetLogic.removeItem(this.char,cat,i,sub); },
        openImageEditor(ctx) { document.getElementById('file-input').click(); this.uploadContext=ctx; },
        initCropper(e) { window.UTILS.initCropper(e.target.files[0], 'crop-target', ()=>{this.cropperOpen=true; setTimeout(()=>{if(this.cropperInstance)this.cropperInstance.destroy(); this.cropperInstance=new Cropper(document.getElementById('crop-target'),{aspectRatio:1,viewMode:1});},50);}); document.getElementById('file-input').value=''; },
        applyCrop() { const r=window.UTILS.getCroppedImage(this.cropperInstance); if(r){ if(this.uploadContext==='wizard')this.wizardData.photo=r; else this.char.photo=r; } this.cropperOpen=false; },
        
        // Settings
        toggleSetting(k,v) { if(v) {this.settings[k]=v; if(k==='themeColor') this.applyTheme(v);} else {this.settings[k]=!this.settings[k]; if(k==='sfxEnabled') window.SFX.toggle(this.settings[k]); if(k==='crtMode') this.updateVisualState();} this.saveLocal(); },
        applyTheme(c) { const m={'cyan':'#0ea5e9','purple':'#d946ef','gold':'#eab308'}; const h=m[c]||m['cyan']; document.documentElement.style.setProperty('--neon-core',h); },
        updateVisualState() { if((this.user||this.isGuest)&&this.settings.crtMode) document.body.classList.add('crt-mode'); else document.body.classList.remove('crt-mode'); },
        
        // Common
        handleLogoClick() { this.logoClickCount++; if(this.logoClickCount>=5){this.systemFailure=true; window.SFX.play('glitch');} setTimeout(()=>this.logoClickCount=0,2000); }
    };
}