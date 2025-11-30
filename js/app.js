/**
 * ZENITE OS - Core Application (Unified & Fixed)
 * Restaura funcionalidades da v75 e integra NetLink/SheetModule.
 */

// Função Debounce (Essencial para performance de save)
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function zeniteSystem() {
    return {
        // ============================
        // 1. ESTADOS GERAIS (Restaurados)
        // ============================
        systemLoading: true, 
        loadingProgress: 0, 
        loadingText: 'BOOT',
        loadingChar: false,
        
        user: null, 
        isGuest: false,
        chars: {}, 
        activeCharId: null, 
        char: null, 
        agentCount: 0,
        
        // Navegação
        currentView: 'dashboard', 
        activeTab: 'profile',
        logisticsTab: 'inventory',
        searchQuery: '',
        
        // UI States
        userMenuOpen: false, 
        configModal: false, 
        notifications: [],
        
        // ============================
        // 2. MÓDULOS NOVOS (NetLink & Sheet)
        // ============================
        netLink: null,
        campaigns: [],
        sheetLogic: null,
        gmPanel: null,
        supabase: null,
        
        // Variáveis do Painel do Mestre
        gmNoteBuffer: '',
        newInitName: '', 
        newInitRoll: '',

        // ============================
        // 3. WIDGETS ANTIGOS (Restaurados)
        // ============================
        // Dice Tray
        diceTrayOpen: false,
        trayDockMode: 'float',
        trayPosition: { x: window.innerWidth - 350, y: window.innerHeight - 500 },
        isDraggingTray: false, dragOffset: { x: 0, y: 0 },
        showDiceTip: false, hasSeenDiceTip: false,
        diceLog: [], lastRoll: '--', lastNatural: 0, lastFaces: 20, diceMod: 0, diceReason: '',
        
        // Image Cropper
        cropperOpen: false, cropperInstance: null, uploadContext: 'char',
        
        // Modais de Confirmação
        confirmOpen: false, confirmData: { title:'', desc:'', action:null, type:'danger' },
        
        // WIZARD (Criação de Personagem) - ESSENCIAL
        wizardOpen: false,
        wizardStep: 1, 
        wizardPoints: 8, 
        wizardData: { class: '', name: '', identity: '', age: '', history: '', photo: null, attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} }, 
        wizardFocusAttr: '',
        
        // Configurações e Visuais
        settings: { mouseTrail: true, compactMode: false, performanceMode: false, crtMode: true, sfxEnabled: true, themeColor: 'cyan' },
        cursorX: -100, cursorY: -100, isCursorHover: false, isMobile: window.innerWidth < 768,
        
        // Save & System
        unsavedChanges: false, isSyncing: false, saveStatus: 'idle', debouncedSaveFunc: null,
        systemFailure: false, logoClickCount: 0, logoClickTimer: null, konamiBuffer: [],

        // Getters para a UI
        get archetypes() { return window.RPG ? window.RPG.archetypes : []; },
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

        // ============================
        // INICIALIZAÇÃO DO SISTEMA
        // ============================
        async initSystem() {
            this.loadingProgress = 10;
            this.loadingText = 'MODULES LINK';
            
            // 1. Instancia Módulos
            if(window.SheetModule) this.sheetLogic = window.SheetModule();
            
            // 2. Conecta Supabase
            if (typeof window.supabase !== 'undefined' && window.CONFIG) {
                this.supabase = window.supabase.createClient(window.CONFIG.SUPABASE_URL, window.CONFIG.SUPABASE_KEY);
                
                // Instancia NetLink se existir
                if(window.netLinkSystem) {
                    this.netLink = window.netLinkSystem(this.supabase, null);
                    this.gmPanel = window.GMPanel(this.netLink);
                }
            }

            // 3. Configurações Iniciais
            this.debouncedSaveFunc = debounce(() => { this.saveLocal(); }, 1000);
            this.setupListeners();
            this.setupCursorEngine();
            this.setupWatchers();

            // 4. Carrega Dados Locais
            this.loadingProgress = 50;
            this.loadingText = 'READING MEMORY';
            const isGuest = localStorage.getItem('zenite_is_guest') === 'true';
            
            if (isGuest) { 
                this.isGuest = true; 
                this.loadLocal('zenite_guest_db'); 
            } else {
                this.loadLocal('zenite_cached_db');
                if(this.supabase) {
                    this.loadingText = 'CLOUD SYNC';
                    const { data: { session } } = await this.supabase.auth.getSession();
                    if(session) {
                        await this.setupUser(session.user);
                    }
                    
                    this.supabase.auth.onAuthStateChange(async (evt, session) => {
                        if (evt === 'SIGNED_IN' && session) {
                            if(this.user?.id !== session.user.id) {
                                await this.setupUser(session.user);
                                window.location.reload();
                            }
                        } else if (evt === 'SIGNED_OUT') {
                            this.user = null;
                            this.chars = {};
                            this.currentView = 'dashboard';
                        }
                    });
                }
            }

            // 5. Aplica Visual
            this.applyTheme(this.settings.themeColor);
            if(this.settings.compactMode && this.isMobile) document.body.classList.add('compact-mode');
            if(this.settings.performanceMode) document.body.classList.add('performance-mode');
            this.updateVisualState();
            if(window.SFX) window.SFX.toggle(this.settings.sfxEnabled);

            this.loadingProgress = 100;
            this.loadingText = 'SYSTEM READY';
            setTimeout(() => { this.systemLoading = false; }, 500);
            
            // Loop de Save
            setInterval(() => { if (this.user && this.unsavedChanges && !this.isSyncing) this.syncCloud(true); }, window.CONFIG ? window.CONFIG.SAVE_INTERVAL : 180000);
        },

        async setupUser(user) {
            this.user = user;
            this.isGuest = false;
            localStorage.removeItem('zenite_is_guest');
            
            if(this.netLink) {
                this.netLink.user = user;
                await this.netLink.init();
                this.campaigns = this.netLink.campaigns;
            }
            await this.fetchCloud();
        },

        // ============================
        // LISTENERS E UX (Visuais)
        // ============================
        setupListeners() {
            window.addEventListener('resize', () => { this.isMobile = window.innerWidth < 768; this.ensureTrayOnScreen(); });
            window.addEventListener('popstate', (event) => {
                if (this.currentView === 'sheet' && this.unsavedChanges && !this.isGuest) { 
                    history.pushState(null, null, location.href); 
                    this.triggerShake(); 
                    this.notify("Salve antes de sair!", "warn"); 
                    return; 
                }
                if (this.currentView === 'sheet') this.saveAndExit(true);
                this.wizardOpen = false; this.configModal = false; this.cropperOpen = false;
            });
            
            let lastHovered = null;
            document.addEventListener('click', (e) => { 
                if(e.target.closest('button, a, .cursor-pointer') && window.SFX) window.SFX.play('click'); 
            });
            document.addEventListener('mouseover', (e) => {
                const target = e.target.closest('button, a, .cursor-pointer');
                if (target && target !== lastHovered && window.SFX) {
                    window.SFX.play('hover');
                    lastHovered = target;
                } else if (!target) lastHovered = null;
            });
        },

        setupCursorEngine() {
            const trail = document.getElementById('mouse-trail');
            if (!trail) return;
            document.addEventListener('mousemove', (e) => { 
                this.cursorX = e.clientX; 
                this.cursorY = e.clientY;
                if(this.settings.mouseTrail && !this.isMobile) { 
                    this.isCursorHover = e.target.closest('button, a, input, select, textarea, .cursor-pointer, .draggable-handle') !== null; 
                }
            });
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
            this.$watch('currentView', (val) => { if (val !== 'sheet') { this.diceTrayOpen = false; } });
            this.$watch('user', () => this.updateVisualState());
            this.$watch('isGuest', () => this.updateVisualState());
        },

        // ============================
        // NUVEKM E DADOS
        // ============================
        async fetchCloud() {
            if (!this.user || !this.supabase) return;
            try {
                let { data, error } = await this.supabase.from('profiles').select('data').eq('id', this.user.id).single();
                if (error && (error.code === 'PGRST116' || error.message.includes('row'))) { 
                    await this.supabase.from('profiles').insert([{ id: this.user.id, data: { config: this.settings } }]); 
                    data = { data: { config: this.settings } }; 
                }
                if (data && data.data) {
                    const cloudData = data.data;
                    if(cloudData.config) { this.settings = { ...this.settings, ...cloudData.config }; this.applyTheme(this.settings.themeColor); }
                    if(cloudData.hasSeenTip !== undefined) this.hasSeenDiceTip = cloudData.hasSeenTip;
                    
                    let merged = { ...this.chars }; let hasLocalOnly = false;
                    Object.keys(cloudData).forEach(k => { if(!['config','hasSeenTip'].includes(k)) merged[k] = cloudData[k]; });
                    Object.keys(this.chars).forEach(localId => { if (!cloudData[localId] && localId !== 'config') { merged[localId] = this.chars[localId]; hasLocalOnly = true; } });
                    
                    this.chars = merged; this.updateAgentCount(); this.saveLocal();
                    if (hasLocalOnly) { this.unsavedChanges = true; this.syncCloud(true); }
                }
            } catch(e) { console.error("Cloud Error", e); }
        },

        async syncCloud(silent = false) {
             if (!this.user || this.isGuest || !this.unsavedChanges || this.isSyncing || !this.supabase) return;
            this.isSyncing = true; 
            if(!silent) this.notify('Sincronizando...', 'info');
            try {
                const payload = { ...this.chars, config: this.settings, hasSeenTip: this.hasSeenDiceTip };
                const { error } = await this.supabase.from('profiles').upsert({ id: this.user.id, data: payload });
                if (error) throw error;
                this.unsavedChanges = false; this.saveStatus = 'success'; 
                if(!silent && window.SFX) { this.notify('Salvo!', 'success'); window.SFX.play('save'); }
            } catch (e) { this.saveStatus = 'error'; if(!silent) this.notify('Erro ao salvar.', 'error'); } finally { this.isSyncing = false; }
        },

        loadLocal(key) {
            const local = localStorage.getItem(key);
            if(local) {
                try {
                    const parsed = JSON.parse(local);
                    if(parsed.config) this.settings = {...this.settings, ...parsed.config};
                    if(parsed.trayPos) this.trayPosition = parsed.trayPos;
                    if(parsed.hasSeenTip !== undefined) this.hasSeenDiceTip = parsed.hasSeenTip;
                    const valid = {};
                    Object.keys(parsed).forEach(k => { if(parsed[k]?.id) valid[k] = parsed[k]; });
                    this.chars = valid;
                    this.updateAgentCount();
                } catch(e) {}
            }
        },

        saveLocal() {
            const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db';
            localStorage.setItem(key, JSON.stringify({...this.chars, config:this.settings, trayPos: this.trayPosition, hasSeenTip: this.hasSeenDiceTip}));
        },

        // ============================
        // WIZARD (Criação de Char)
        // ============================
        openWizard() { 
            if(this.agentCount >= 30) return this.notify("Limite atingido!", "error");
            this.wizardStep = 1; this.wizardPoints = 8; 
            this.wizardData = { class: '', name: '', identity: '', age: '', history: '', photo: null, attrs: {for:-1,agi:-1,int:-1,von:-1,pod:-1} };
            this.wizardOpen = true; 
        },
        selectArchetype(a) { 
            this.wizardData.class = a.class; 
            this.wizardData.attrs = {for:-1,agi:-1,int:-1,von:-1,pod:-1}; 
            this.wizardData.attrs[a.focus] = 0; 
            this.wizardFocusAttr = a.focus; 
            this.wizardStep = 2; 
            setTimeout(() => this.updateWizardChart(), 50); 
        },
        modWizardAttr(k,v) { 
            const c = this.wizardData.attrs[k];
            const f = k === this.wizardFocusAttr; 
            if(v > 0 && this.wizardPoints > 0 && c < 3) { this.wizardData.attrs[k]++; this.wizardPoints--; } 
            if(v < 0 && c > (f ? 0 : -1)) { this.wizardData.attrs[k]--; this.wizardPoints++; } 
            this.updateWizardChart(); 
        },
        finishWizard() { 
            if(!this.wizardData.name) return this.notify("Nome Obrigatório!", "warn"); 
            const id = 'z_'+Date.now(); 
            let nc = window.RPG.createBlankChar(id, this.wizardData);
            if(this.sheetLogic) nc = this.sheetLogic.recalcStats(nc);
            this.chars[id] = nc; 
            this.updateAgentCount(); 
            this.saveLocal(); 
            if(this.user) this.syncCloud(true); 
            this.wizardOpen = false; 
            this.loadCharacter(id); 
            this.notify("Criado com sucesso!", "success"); 
        },

        // ============================
        // FICHA (Sheet Logic)
        // ============================
        loadCharacter(id, skipPush = false) {
            if(!this.chars[id]) return this.notify('Erro ao carregar.', 'error');
            if (!skipPush) history.pushState({ view: 'sheet', id: id }, "Ficha", "#sheet");
            
            this.loadingChar = true; this.activeCharId = id; this.diceTrayOpen = false; 
            requestAnimationFrame(() => {
                this.char = JSON.parse(JSON.stringify(this.chars[id]));
                if(this.sheetLogic) this.char = this.sheetLogic.recalcStats(this.char);
                if(!this.char.inventory) this.char.inventory = { weapons:[], armor:[], gear:[], backpack: "", social: { people:[], objects:[]} };
                
                this.currentView = 'sheet'; this.activeTab = 'profile'; 
                if(!this.hasSeenDiceTip) setTimeout(() => this.showDiceTip = true, 1000);
                this.$nextTick(() => { this.updateRadarChart(); setTimeout(() => { this.loadingChar = false; this.unsavedChanges = false; }, 300); });
            });
        },
        modAttr(key, val) {
            if(this.sheetLogic && this.char) {
                this.char = this.sheetLogic.modAttr(this.char, key, val);
                this.unsavedChanges = true;
            }
        },
        modStat(s,v) { if(this.char) { const st=this.char.stats[s]; st.current=Math.max(0,Math.min(st.max,st.current+v)); } },
        addItem(cat) { if(this.sheetLogic) this.char=this.sheetLogic.addItem(this.char,cat); },
        deleteItem(cat,i,sub) { if(this.sheetLogic) this.char=this.sheetLogic.removeItem(this.char,cat,i,sub); },
        addSkill() { this.char.skills.push({name:'Nova Perícia', level:1}); }, 
        deleteSkill(idx) { this.char.skills.splice(idx,1); }, 
        setSkillLevel(idx, l) { this.char.skills[idx].level = l; },
        addTechnique() { this.char.powers.techniques.push({name:'Técnica', desc:''}); }, 
        deleteTechnique(idx) { this.char.powers.techniques.splice(idx,1); },

        // ============================
        // NETLINK & GM PANEL
        // ============================
        async createCampaignUI() { const n = prompt("Nome da Campanha:"); if(n && this.netLink) { await this.netLink.createCampaign(n); this.campaigns = this.netLink.campaigns; this.notify("Campanha Criada!", "success"); } },
        async joinCampaignUI() { const c = prompt("Código:"); if(c && this.netLink) { await this.netLink.joinCampaign(c); this.campaigns = this.netLink.campaigns; this.notify("Acesso Concedido!", "success"); } },
        async openCampaign(id) { if(this.netLink) { await this.netLink.enterCampaign(id); this.currentView = 'campaign_panel'; } },
        
        gmSetAtmosphere(type) { if(this.gmPanel) this.gmPanel.setAtmosphere(type); },
        gmAddInit() { if(this.gmPanel && this.newInitName) { this.gmPanel.addToInitiative(this.newInitName, this.newInitRoll); this.newInitName = ''; this.newInitRoll = ''; } },
        gmNextTurn() { if(this.gmPanel) this.gmPanel.nextTurn(); },
        gmRemoveInit(idx) { if(this.gmPanel) this.gmPanel.removeFromInitiative(idx); },
        gmSaveNotes() { if(this.gmPanel && this.netLink?.activeCampaign) { this.gmPanel.saveNotes(this.netLink.activeCampaign.data.notes); this.notify("Notas salvas.", "success"); } },

        // ============================
        // FERRAMENTAS & VISUAIS
        // ============================
        notify(msg, type='info') { const id = Date.now(); this.notifications.push({id, message: msg, type}); setTimeout(() => this.notifications = this.notifications.filter(n => n.id !== id), 3000); },
        updateRadarChart() { if(!this.char || !window.UTILS) return; window.UTILS.renderChart('radarChart', [this.char.attrs.for, this.char.attrs.agi, this.char.attrs.int, this.char.attrs.von, this.char.attrs.pod]); },
        updateWizardChart() { if(!window.UTILS) return; window.UTILS.renderChart('wizChart', [this.wizardData.attrs.for, this.wizardData.attrs.agi, this.wizardData.attrs.int, this.wizardData.attrs.von, this.wizardData.attrs.pod], true); },
        
        openImageEditor(ctx) { document.getElementById('file-input').click(); this.uploadContext=ctx; },
        initCropper(e) { window.UTILS.initCropper(e.target.files[0], 'crop-target', ()=>{this.cropperOpen=true; setTimeout(()=>{if(this.cropperInstance)this.cropperInstance.destroy(); this.cropperInstance=new Cropper(document.getElementById('crop-target'),{aspectRatio:1,viewMode:1});},50);}); document.getElementById('file-input').value=''; },
        applyCrop() { const r=window.UTILS.getCroppedImage(this.cropperInstance); if(r){ if(this.uploadContext==='wizard')this.wizardData.photo=r; else this.char.photo=r; } this.cropperOpen=false; this.notify("Foto atualizada!", "success"); },
        
        toggleSetting(k,v) { if(v) { this.settings[k]=v; if(k==='themeColor') this.applyTheme(v); } else { this.settings[k]=!this.settings[k]; if(k==='sfxEnabled') window.SFX.toggle(this.settings[k]); if(k==='crtMode') this.updateVisualState(); } this.saveLocal(); if(this.user) this.syncCloud(true); },
        applyTheme(c) { const m={'cyan':'#0ea5e9','purple':'#d946ef','gold':'#eab308', 'red':'#ef4444'}; const h=m[c]||m['cyan']; document.documentElement.style.setProperty('--neon-core',h); },
        updateVisualState() { 
            if((this.user||this.isGuest)&&this.settings.crtMode) document.body.classList.add('crt-mode'); else document.body.classList.remove('crt-mode'); 
            if((this.user||this.isGuest)&&this.settings.mouseTrail) document.body.classList.add('custom-cursor-active'); else document.body.classList.remove('custom-cursor-active');
        },
        
        // Dados e Bandeja
        toggleDiceTray() { this.diceTrayOpen = !this.diceTrayOpen; if(this.diceTrayOpen) { if(!this.hasSeenDiceTip) { this.hasSeenDiceTip = true; this.saveLocal(); } this.showDiceTip = false; this.ensureTrayOnScreen(); } },
        roll(s) { 
            if(window.SFX) window.SFX.play('click'); 
            const arr = new Uint32Array(1); window.crypto.getRandomValues(arr); 
            const n = (arr[0] % s) + 1; const m = parseInt(this.diceMod || 0); 
            this.lastNatural = n; this.lastFaces = s; this.lastRoll = n + m; 
            let formulaStr = `D${s}`; if (m !== 0) formulaStr += (m > 0 ? `+${m}` : `${m}`); 
            this.diceLog.unshift({id: Date.now(), time: new Date().toLocaleTimeString(), formula: formulaStr, result: n+m, crit: n===s, fumble: n===1, reason: this.diceReason}); 
            this.diceReason = ''; 
            if (this.diceLog.length > 50) this.diceLog.pop();
        },
        setDockMode(mode) { this.trayDockMode = mode; if(mode === 'float') { this.trayPosition = { x: window.innerWidth - 350, y: window.innerHeight - 500 }; this.ensureTrayOnScreen(); } },
        startDragTray(e) {
            if(this.isMobile || this.trayDockMode !== 'float') return;
            if(e.target.closest('button') || e.target.closest('input')) return;
            this.isDraggingTray = true;
            this.dragOffset.x = e.clientX - this.trayPosition.x;
            this.dragOffset.y = e.clientY - this.trayPosition.y;
            const moveHandler = (ev) => { if(!this.isDraggingTray) return; this.trayPosition.x = ev.clientX - this.dragOffset.x; this.trayPosition.y = ev.clientY - this.dragOffset.y; };
            const upHandler = () => { this.isDraggingTray = false; document.removeEventListener('mousemove', moveHandler); document.removeEventListener('mouseup', upHandler); };
            document.addEventListener('mousemove', moveHandler); document.addEventListener('mouseup', upHandler);
        },
        ensureTrayOnScreen() {
            if(this.isMobile || this.trayDockMode !== 'float') return;
            this.trayPosition.x = Math.max(10, Math.min(window.innerWidth - 320, this.trayPosition.x));
            this.trayPosition.y = Math.max(60, Math.min(window.innerHeight - 400, this.trayPosition.y));
        },

        // Export/Import
        exportData() { window.UTILS.exportJSON(this.chars); this.notify('Backup baixado.', 'success'); },
        triggerFileImport() { document.getElementById('import-file').click(); },
        processImport(e) { window.UTILS.readJSON(e.target.files[0], (d, err) => { if(err) return this.notify('Erro arquivo.', 'error'); this.chars = {...this.chars, ...d}; this.updateAgentCount(); this.saveLocal(); this.unsavedChanges = true; this.notify('Importado!', 'success'); this.configModal = false; }); },
        updateAgentCount() { this.agentCount = Object.keys(this.chars).length; },

        // Auth & Helpers
        doSocialAuth(p) { this.supabase.auth.signInWithOAuth({provider:p, options:{redirectTo:window.location.origin}}); },
        askLogout() { this.askConfirm('SAIR?', 'Cache local será limpo.', 'warn', () => { localStorage.removeItem('zenite_cached_db'); this.supabase.auth.signOut(); window.location.reload(); }); },
        enterGuest() { this.isGuest=true; this.loadLocal('zenite_guest_db'); },
        askDeleteChar(id) { this.askConfirm('ELIMINAR?', 'Irreversível.', 'danger', () => { delete this.chars[id]; this.saveLocal(); if(!this.isGuest) this.syncCloud(true); this.updateAgentCount(); this.notify('Deletado.', 'success'); }); },
        askHardReset() { this.askConfirm('LIMPAR TUDO?', 'Apaga cache local.', 'danger', () => { localStorage.clear(); window.location.reload(); }); },
        askConfirm(title, desc, type, action) { this.confirmData = { title, desc, type, action }; this.confirmOpen = true; }, 
        confirmYes() { if (this.confirmData.action) this.confirmData.action(); this.confirmOpen = false; },
        attemptGoBack() { if (this.unsavedChanges && !this.isGuest) { this.triggerShake(); this.notify("Salve antes de sair!", "warn"); return; } this.saveAndExit(); },
        saveAndExit(fromHistory = false) { if(this.char && this.activeCharId) { this.chars[this.activeCharId] = JSON.parse(JSON.stringify(this.char)); this.updateAgentCount(); } this.saveLocal(); if (!this.isGuest && this.unsavedChanges) this.syncCloud(true); this.diceTrayOpen = false; this.currentView = 'dashboard'; this.activeCharId = null; this.char = null; if (!fromHistory && window.location.hash === '#sheet') { history.back(); } },
        toggleRevertMode() { this.revertConfirmMode = !this.revertConfirmMode; },
        performRevert() { this.loadLocal(this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db'); this.loadCharacter(this.activeCharId, true); this.notify("Revertido!", "success"); this.revertConfirmMode = false; },
        triggerShake() { this.shakeAlert = true; setTimeout(() => this.shakeAlert = false, 300); },
        
        handleLogoClick() { this.logoClickCount++; if(this.logoClickCount >= 5){ this.systemFailure=true; if(window.SFX) window.SFX.play('error'); } clearTimeout(this.logoClickTimer); this.logoClickTimer = setTimeout(()=>this.logoClickCount=0, 2000); },
        handleKeys(e) { if(e.key.toLowerCase()==='escape') this.diceTrayOpen = false; }
    };
}