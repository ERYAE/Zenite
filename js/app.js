/**
 * ZENITE OS - Core Application (Estável + Modular + NetLink)
 * Baseado na versão estável v75, adaptado para módulos externos.
 */

// Debounce para evitar salvar a cada tecla
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function zeniteSystem() {
    return {
        // --- ESTADOS DO SISTEMA ---
        systemLoading: true, 
        loadingProgress: 0, 
        loadingText: 'BOOT',
        loadingChar: false, 
        
        // --- DADOS DO USUÁRIO ---
        user: null, 
        isGuest: false, 
        chars: {}, 
        activeCharId: null, 
        char: null, 
        agentCount: 0,
        
        // --- NAVEGAÇÃO ---
        currentView: 'dashboard', // dashboard, sheet, campaign_lobby, campaign_panel
        activeTab: 'profile', 
        logisticsTab: 'inventory', 
        searchQuery: '',
        
        // --- UI & WIDGETS ---
        notifications: [], 
        userMenuOpen: false, 
        authLoading: false, 
        authMsg: '', 
        authMsgType: '',
        
        // Dice Tray
        diceTrayOpen: false, 
        trayDockMode: 'float', 
        trayPosition: { x: window.innerWidth - 350, y: window.innerHeight - 500 },
        isDraggingTray: false, 
        dragOffset: { x: 0, y: 0 },
        showDiceTip: false, 
        hasSeenDiceTip: false,
        diceLog: [], 
        lastRoll: '--', 
        lastNatural: 0, 
        lastFaces: 20, 
        diceMod: 0, 
        diceReason: '',
        
        // Efeitos & UX
        cursorX: -100, cursorY: -100, isCursorHover: false,
        isMobile: window.innerWidth < 768,
        systemFailure: false, 
        logoClickCount: 0, 
        logoClickTimer: null, 
        konamiBuffer: [],
        
        // Modais
        configModal: false, 
        wizardOpen: false, 
        cropperOpen: false, 
        cropperInstance: null, 
        uploadContext: 'char',
        confirmOpen: false, 
        confirmData: { title:'', desc:'', action:null, type:'danger' },
        
        // Wizard (Criação)
        wizardStep: 1, 
        wizardPoints: 8, 
        wizardData: { class: '', name: '', identity: '', age: '', history: '', photo: null, attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} }, 
        wizardFocusAttr: '',
        
        // Configurações
        settings: { mouseTrail: true, compactMode: false, performanceMode: false, crtMode: true, sfxEnabled: true, themeColor: 'cyan' },
        
        // Controle de Save/Sync
        unsavedChanges: false, 
        isSyncing: false, 
        saveStatus: 'idle', 
        supabase: null, 
        debouncedSaveFunc: null,
        
        // --- MÓDULO NETLINK (CAMPANHA) ---
        netLink: null,
        campaigns: [], // Cache local para a UI ler

        // --- GETTERS ---
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

        // =========================================================================
        // INICIALIZAÇÃO (Igual à versão estável)
        // =========================================================================
        async initSystem() {
            this.loadingProgress = 10; 
            this.loadingText = 'CORE SYSTEM';
            
            // Timeout de segurança (para não travar no boot)
            setTimeout(() => { if(this.systemLoading) this.systemLoading = false; }, 8000);
            
            window.addEventListener('beforeunload', (e) => { 
                if (this.unsavedChanges && !this.isGuest) { e.preventDefault(); e.returnValue = 'Alterações pendentes.'; } 
            });

            try {
                // 1. Supabase
                await new Promise(r => setTimeout(r, 300));
                if (typeof window.supabase !== 'undefined' && window.CONFIG) {
                    this.supabase = window.supabase.createClient(window.CONFIG.SUPABASE_URL, window.CONFIG.SUPABASE_KEY, {
                        auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
                    });
                }
                
                // 2. NetLink (As Novas Funções)
                if (window.netLinkSystem) {
                    this.netLink = window.netLinkSystem(this.supabase, null);
                }

                this.loadingProgress = 30; 
                this.loadingText = 'AUTHENTICATING';
                this.debouncedSaveFunc = debounce(() => { this.saveLocal(); }, 1000);
                
                // 3. Listeners
                this.setupListeners(); 
                this.setupCursorEngine(); 
                this.setupWatchers();

                // 4. Carregar Dados
                this.loadingProgress = 50; 
                this.loadingText = 'LOADING CACHE';
                const isGuest = localStorage.getItem('zenite_is_guest') === 'true';
                
                if (isGuest) { 
                    this.isGuest = true; 
                    this.loadLocal('zenite_guest_db'); 
                } else {
                    this.loadLocal('zenite_cached_db'); // Base estável antiga
                    if(this.supabase) {
                        try {
                            const { data: { session } } = await this.supabase.auth.getSession();
                            if (session) { 
                                this.user = session.user; 
                                
                                // Conecta User no NetLink
                                if(this.netLink) {
                                    this.netLink.user = this.user;
                                    await this.netLink.init();
                                    // Sincroniza campanhas para a UI
                                    this.campaigns = this.netLink.campaigns;
                                }

                                this.loadingText = 'SYNCING CLOUD'; 
                                this.loadingProgress = 70; 
                                await this.fetchCloud(); 
                            }
                        } catch(e) { this.notify("Modo Offline", "warn"); }
                        
                        this.supabase.auth.onAuthStateChange(async (event, session) => {
                            if (event === 'SIGNED_IN' && session) { 
                                if (this.user?.id === session.user.id) return; 
                                this.user = session.user; 
                                
                                if(this.netLink) {
                                    this.netLink.user = this.user;
                                    await this.netLink.init();
                                    this.campaigns = this.netLink.campaigns;
                                }

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

                this.loadingProgress = 90; 
                this.loadingText = 'APPLYING THEME';
                this.applyTheme(this.settings.themeColor);
                if(this.settings.compactMode && this.isMobile) document.body.classList.add('compact-mode');
                if(this.settings.performanceMode) document.body.classList.add('performance-mode');
                
                if(window.SFX) window.SFX.toggle(this.settings.sfxEnabled);
                this.updateVisualState();
                
                this.updateAgentCount();
                
                setInterval(() => { if (this.user && this.unsavedChanges && !this.isSyncing) this.syncCloud(true); }, 180000);
                
                this.loadingProgress = 100; 
                this.loadingText = 'READY';
                setTimeout(() => { this.systemLoading = false; }, 500);

            } catch (err) { 
                console.error("Boot Error:", err); 
                this.notify("Erro na inicialização.", "error"); 
                this.systemLoading = false; 
            }
        },

        // =========================================================================
        // NETLINK INTERFACE (NOVAS FUNÇÕES)
        // =========================================================================
        async createCampaignUI() {
            const name = prompt("Nome da Campanha:");
            if(!name) return;
            if(this.netLink) {
                await this.netLink.createCampaign(name);
                this.campaigns = this.netLink.campaigns; // Atualiza UI
                this.notify("Campanha criada!", "success");
            }
        },

        async joinCampaignUI() {
            const code = prompt("Código da Campanha (Ex: NET-XK92):");
            if(!code) return;
            if(this.netLink) {
                await this.netLink.joinCampaign(code);
                this.campaigns = this.netLink.campaigns; // Atualiza UI
                this.notify("Entrou na campanha!", "success");
            }
        },

        async openCampaign(id) {
            if(this.netLink) {
                await this.netLink.enterCampaign(id);
                this.currentView = 'campaign_panel';
            }
        },

        // =========================================================================
        // FUNÇÕES BÁSICAS (Restauradas da versão estável)
        // =========================================================================
        setupListeners() {
            window.addEventListener('pageshow', (event) => { if (event.persisted) window.location.reload(); });
            window.addEventListener('resize', () => { this.isMobile = window.innerWidth < 768; this.ensureTrayOnScreen(); });
            window.addEventListener('popstate', (event) => {
                if (this.currentView === 'sheet' && this.unsavedChanges && !this.isGuest) { history.pushState(null, null, location.href); this.triggerShake(); this.notify("Salve antes de sair!", "warn"); return; }
                if (this.currentView === 'sheet' || this.wizardOpen || this.configModal) { if(this.currentView === 'sheet') this.saveAndExit(true); this.wizardOpen = false; this.configModal = false; this.cropperOpen = false; }
            });
            
            // SFX Listeners
            let lastHovered = null;
            document.addEventListener('click', (e) => { 
                if(e.target.closest('button, a, .cursor-pointer') && window.SFX) window.SFX.play('click'); 
            });
            document.addEventListener('mouseover', (e) => {
                const target = e.target.closest('button, a, .cursor-pointer');
                if (target && target !== lastHovered && window.SFX) {
                    window.SFX.play('hover');
                    lastHovered = target;
                } else if (!target) {
                    lastHovered = null;
                }
            });
        },

        setupCursorEngine() {
            const trail = document.getElementById('mouse-trail');
            if (!window.matchMedia("(pointer: fine)").matches) { if(trail) trail.style.display = 'none'; return; }
            
            document.addEventListener('mousemove', (e) => { 
                this.cursorX = e.clientX; 
                this.cursorY = e.clientY;
                if(this.settings.mouseTrail && !this.isMobile) { 
                    this.isCursorHover = e.target.closest('button, a, input, select, textarea, .cursor-pointer, .draggable-handle') !== null; 
                }
            });
            
            const renderLoop = () => {
                if (!trail) return;
                const isAuthenticated = this.user || this.isGuest;
                if (isAuthenticated && this.settings.mouseTrail && !this.settings.performanceMode && !this.isMobile) {
                    trail.style.display = 'block'; 
                    trail.style.transform = `translate3d(${this.cursorX}px, ${this.cursorY}px, 0)`; 
                    if(this.isCursorHover) trail.classList.add('hover-active'); else trail.classList.remove('hover-active');
                    if(trail.style.opacity === '0') trail.style.opacity = '1';
                } else { 
                    trail.style.display = 'none'; 
                }
                requestAnimationFrame(renderLoop);
            };
            renderLoop();
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
            this.$watch('user', () => this.updateVisualState());
            this.$watch('isGuest', () => this.updateVisualState());
        },

        handleKeys(e) {
            const key = e.key.toLowerCase();
            const konamiCode = ['arrowup','arrowup','arrowdown','arrowdown','arrowleft','arrowright','arrowleft','arrowright','b','a'];
            this.konamiBuffer.push(key);
            if (this.konamiBuffer.length > konamiCode.length) this.konamiBuffer.shift();
            if (JSON.stringify(this.konamiBuffer) === JSON.stringify(konamiCode)) {
                document.body.classList.toggle('theme-hacker');
                if(document.body.classList.contains('theme-hacker')) { 
                    if(window.SFX) window.SFX.play('success'); 
                    this.notify("SYSTEM OVERRIDE: HACKER MODE", "success"); 
                } else { 
                    if(window.SFX) window.SFX.play('click'); 
                    this.notify("SYSTEM NORMAL", "info"); 
                }
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
                 if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch(()=>{}); } 
                 else if (document.exitFullscreen) { document.exitFullscreen(); }
            }
        },

        triggerSystemFailure() {
            if(window.SFX) window.SFX.play('glitch');
            if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch((err) => {}); }
            this.systemFailure = true; 
        },

        // --- PERSISTÊNCIA ---
        loadLocal(key) {
            const local = localStorage.getItem(key);
            if(local) {
                try {
                    const parsed = JSON.parse(local);
                    if(parsed.config) this.settings = { ...this.settings, ...parsed.config };
                    if(parsed.trayPos) this.trayPosition = parsed.trayPos;
                    if(parsed.hasSeenTip !== undefined) this.hasSeenDiceTip = parsed.hasSeenTip;
                    const validChars = {};
                    Object.keys(parsed).forEach(k => { if(!['config','trayPos','hasSeenTip'].includes(k) && parsed[k]?.id) validChars[k] = parsed[k]; });
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

        async fetchCloud() {
            if (!this.user || !this.supabase) return;
            try {
                let { data, error } = await this.supabase.from('profiles').select('data').eq('id', this.user.id).single();
                if (error && error.code === 'PGRST116') { await this.supabase.from('profiles').insert([{ id: this.user.id, data: { config: this.settings } }]); data = { data: { config: this.settings } }; }
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
                if(!silent && window.SFX) { this.notify('Salvo!', 'success'); window.SFX.play('save'); }
            } catch (e) { this.saveStatus = 'error'; if(!silent) this.notify('Erro ao salvar.', 'error'); } finally { this.isSyncing = false; }
        },

        // --- RPG & WIZARD (Usando módulos externos agora) ---
        openWizard() { 
            if(this.agentCount >= (window.CONFIG ? window.CONFIG.MAX_AGENTS : 30)) return this.notify('Limite atingido.', 'error'); 
            this.wizardStep = 1; this.wizardPoints = 8; 
            this.wizardData = { class: '', name: '', identity: '', age: '', history: '', photo: null, attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} }; 
            this.wizardFocusAttr = ''; 
            history.pushState({ modal: 'wizard' }, "Wizard", "#new"); 
            this.wizardOpen = true; 
        },
        
        selectArchetype(a) { 
            this.wizardData.class = a.class; 
            this.wizardData.attrs = {for:-1, agi:-1, int:-1, von:-1, pod:-1}; 
            this.wizardData.attrs[a.focus] = 0; 
            this.wizardFocusAttr = a.focus; 
            this.wizardStep = 2; 
            this.$nextTick(() => { this.updateWizardChart(); }); 
        },
        
        modWizardAttr(k,v) { 
            const c = this.wizardData.attrs[k]; 
            const f = k === this.wizardFocusAttr; 
            if(v>0 && this.wizardPoints>0 && c<3) { this.wizardData.attrs[k]++; this.wizardPoints--; this.updateWizardChart(); } 
            if(v<0 && c>(f?0:-1)) { this.wizardData.attrs[k]--; this.wizardPoints++; this.updateWizardChart(); } 
        },
        
        finishWizard() {
            if(!this.wizardData.name) { this.notify("Codinome obrigatório!", "warn"); return; }
            if(!window.RPG) return this.notify("Módulo RPG não carregado!", "error");

            const id = 'z_'+Date.now(); 
            // Usa o módulo externo
            let newChar = window.RPG.createBlankChar(id, this.wizardData);
            newChar = window.RPG.recalcStats(newChar);

            this.chars[id] = newChar; 
            this.updateAgentCount(); 
            this.saveLocal(); 
            if(!this.isGuest) { this.unsavedChanges = true; this.syncCloud(true); }
            this.wizardOpen = false; 
            history.replaceState({ view: 'sheet', id: id }, "Ficha", "#sheet"); 
            this.loadCharacter(id, true); 
            this.notify('Agente Inicializado.', 'success');
        },

        loadCharacter(id, skipPush = false) {
             if(!this.chars[id]) return this.notify('Erro ao carregar.', 'error');
            if (!skipPush) history.pushState({ view: 'sheet', id: id }, "Ficha", "#sheet");
            this.loadingChar = true; this.activeCharId = id; this.diceTrayOpen = false; 
            requestAnimationFrame(() => {
                this.char = JSON.parse(JSON.stringify(this.chars[id]));
                if(window.RPG) this.char = window.RPG.recalcStats(this.char);
                if(!this.char.inventory) this.char.inventory = { weapons:[], armor:[], gear:[], backpack: "", social: { people:[], objects:[]} }; 
                
                this.currentView = 'sheet'; this.activeTab = 'profile'; this.diceTrayOpen = false; 
                if(!this.hasSeenDiceTip) setTimeout(() => this.showDiceTip = true, 1000);
                this.$nextTick(() => { this.updateRadarChart(); setTimeout(() => { this.loadingChar = false; this.unsavedChanges = false; }, 300); });
            });
         },

        recalcDerivedStats() { 
            if(!this.char || !window.RPG) return; 
            this.char = window.RPG.recalcStats(this.char);
            this.updateRadarChart();
        },

        modAttr(key, val) { 
            const c = this.char; 
            if ((val > 0 && c.attrs[key] < 6) || (val < 0 && c.attrs[key] > -1)) { 
                c.attrs[key] += val; 
                this.recalcDerivedStats(); 
            } 
        },
        
        modStat(stat, val) { 
            if(!this.char || !this.char.stats[stat]) return; 
            const s = this.char.stats[stat]; 
            s.current = Math.max(0, Math.min(s.max, s.current + val)); 
        },

        // --- AUTH & CONFIG ---
        askLogout() { this.askConfirm('SAIR?', 'Dados pendentes serão salvos.', 'warn', () => this.logout()); },
        async logout() { this.systemLoading = true; if(this.unsavedChanges && !this.isGuest) { try { await this.syncCloud(true); } catch(e) {} } localStorage.removeItem('zenite_cached_db'); localStorage.removeItem('zenite_is_guest'); if(this.supabase) await this.supabase.auth.signOut(); window.location.reload(); },
        askSwitchToOnline() { this.askConfirm('FICAR ONLINE?', 'Ir para login.', 'info', () => { this.isGuest = false; localStorage.removeItem('zenite_is_guest'); window.location.reload(); }); },
        enterGuest() { this.isGuest = true; localStorage.setItem('zenite_is_guest', 'true'); this.loadLocal('zenite_guest_db'); },
        doSocialAuth(provider) { if(!this.supabase) return this.notify("Erro de conexão.", "error"); this.authLoading = true; this.authMsg = "Conectando..."; this.supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } }).then(({error}) => { if(error) { this.notify(error.message, 'error'); this.authLoading = false; } }); },
        
        toggleSetting(key, val=null) {
            if(val !== null) { this.settings[key] = val; if(key === 'themeColor') this.applyTheme(val); } 
            else { 
                this.settings[key] = !this.settings[key]; 
                if(key === 'compactMode') { if(this.isMobile) document.body.classList.toggle('compact-mode', this.settings.compactMode); }
                if(key === 'performanceMode') document.body.classList.toggle('performance-mode', this.settings.performanceMode); 
                if(key === 'crtMode') this.updateVisualState();
                if(key === 'sfxEnabled' && window.SFX) window.SFX.toggle(this.settings.sfxEnabled);
            }
            this.updateVisualState(); this.saveLocal(); if(!this.isGuest && this.user) { this.unsavedChanges = true; this.syncCloud(true); }
        },
        
        applyTheme(color) {
            const root = document.documentElement; const map = { 'cyan': '#0ea5e9', 'purple': '#d946ef', 'gold': '#eab308' };
            const hex = map[color] || map['cyan']; const r = parseInt(hex.slice(1, 3), 16); const g = parseInt(hex.slice(3, 5), 16); const b = parseInt(hex.slice(5, 7), 16);
            root.style.setProperty('--neon-core', hex); root.style.setProperty('--neon-rgb', `${r}, ${g}, ${b}`); 
            const trail = document.getElementById('mouse-trail'); if(trail) trail.style.background = `radial-gradient(circle, rgba(${r}, ${g}, ${b}, 0.2), transparent 70%)`;
        },

        updateVisualState() {
            const isAuthenticated = this.user || this.isGuest;
            if (isAuthenticated && this.settings.mouseTrail && !this.settings.performanceMode && !this.isMobile) {
                document.body.classList.add('custom-cursor-active');
            } else {
                document.body.classList.remove('custom-cursor-active');
            }
            if (isAuthenticated && this.settings.crtMode) {
                document.body.classList.add('crt-mode');
            } else {
                document.body.classList.remove('crt-mode');
            }
        },

        // --- UTILS WRAPPERS ---
        askDeleteChar(id) { this.askConfirm('ELIMINAR?', 'Irreversível.', 'danger', () => { delete this.chars[id]; this.saveLocal(); if(!this.isGuest) this.syncCloud(true); this.updateAgentCount(); this.notify('Deletado.', 'success'); }); },
        askHardReset() { this.askConfirm('LIMPAR TUDO?', 'Apaga cache local.', 'danger', () => { localStorage.clear(); window.location.reload(); }); },
        askConfirm(title, desc, type, action) { this.confirmData = { title, desc, type, action }; this.confirmOpen = true; }, 
        confirmYes() { if (this.confirmData.action) this.confirmData.action(); this.confirmOpen = false; },
        
        // Charts & Images (Delegado para UTILS)
        updateRadarChart() { if(!this.char || !window.UTILS) return; const d = [this.char.attrs.for, this.char.attrs.agi, this.char.attrs.int, this.char.attrs.von, this.char.attrs.pod]; window.UTILS.renderChart('radarChart', d); },
        updateWizardChart() { if(!window.UTILS) return; const d = [this.wizardData.attrs.for, this.wizardData.attrs.agi, this.wizardData.attrs.int, this.wizardData.attrs.von, this.wizardData.attrs.pod]; window.UTILS.renderChart('wizChart', d, true); },
        
        openImageEditor(context = 'sheet') { this.uploadContext = context; document.getElementById('file-input').click(); }, 
        initCropper(e) { if(window.UTILS) window.UTILS.initCropper(e.target.files[0], 'crop-target', () => { this.cropperOpen = true; this.$nextTick(() => { if(this.cropperInstance) this.cropperInstance.destroy(); this.cropperInstance = new Cropper(document.getElementById('crop-target'), { aspectRatio: 1, viewMode: 1 }); }); }); document.getElementById('file-input').value = ''; }, 
        applyCrop() { 
            if(!window.UTILS) return;
            const result = window.UTILS.getCroppedImage(this.cropperInstance);
            if(!result) return;
            if (this.uploadContext === 'wizard') { this.wizardData.photo = result; } else if (this.char) { this.char.photo = result; } 
            this.cropperOpen = false; this.notify('Foto processada.', 'success'); 
        },
        exportData() { if(window.UTILS) window.UTILS.exportJSON(this.chars, 'zenite_bkp.json'); this.notify('Backup baixado.', 'success'); },
        triggerFileImport() { document.getElementById('import-file').click(); },
        processImport(e) { if(window.UTILS) window.UTILS.readJSON(e.target.files[0], (d, e) => { if(e) return this.notify('Erro arquivo.', 'error'); this.chars = {...this.chars, ...d}; this.updateAgentCount(); this.saveLocal(); this.unsavedChanges = true; this.notify('Importado!', 'success'); this.configModal = false; }); },

        // Helpers
        triggerShake() { this.shakeAlert = true; setTimeout(() => this.shakeAlert = false, 300); },
        attemptGoBack() { if (this.unsavedChanges && !this.isGuest) { this.triggerShake(); this.notify("Salve ou descarte antes de sair.", "warn"); return; } this.saveAndExit(); },
        saveAndExit(fromHistory = false) {
            if (this.unsavedChanges && !this.isGuest && !fromHistory) { this.triggerShake(); return; }
            if(this.char && this.activeCharId) { this.chars[this.activeCharId] = JSON.parse(JSON.stringify(this.char)); this.updateAgentCount(); } 
            this.saveLocal(); if (!this.isGuest && this.unsavedChanges) this.syncCloud(true); 
            this.diceTrayOpen = false; this.showDiceTip = false;
            this.currentView = 'dashboard'; this.activeCharId = null; this.char = null; 
            if (!fromHistory && window.location.hash === '#sheet') { history.back(); }
        },
        toggleRevertMode() { this.revertConfirmMode = !this.revertConfirmMode; if(this.revertConfirmMode) this.diceTrayOpen = false; },
        performRevert() {
            this.isReverting = true; this.diceTrayOpen = false; this.revertConfirmMode = false;
            document.body.classList.add('animating-out'); document.body.classList.add('interaction-lock');
            if(window.SFX) window.SFX.play('discard');
            setTimeout(async () => {
                try {
                    if(this.isGuest) { this.loadLocal('zenite_guest_db'); } else { this.loadLocal('zenite_cached_db'); await this.fetchCloud(); }
                    if(this.activeCharId && this.chars[this.activeCharId]) { this.char = JSON.parse(JSON.stringify(this.chars[this.activeCharId])); } else { this.currentView = 'dashboard'; this.char = null; }
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
        
        // Misc
        updateAgentCount() { this.agentCount = Object.keys(this.chars).length; },
        triggerFX(type) { const el = document.getElementById(type+'-overlay'); if(el) { el.style.opacity='0.4'; setTimeout(()=>el.style.opacity='0', 200); } },
        addItem(cat) { const defs = { weapons: { name: 'Arma', dmg: '1d6', range: 'C' }, armor: { name: 'Traje', def: '1', pen: '0' }, gear: { name: 'Item', desc: '', qty: 1 }, social_people: { name: 'Nome', role: 'Relação' }, social_objects: { name: 'Objeto', desc: 'Detalhes' } }; if(cat.startsWith('social_')) this.char.inventory.social[cat.split('_')[1]].push({...defs[cat]}); else this.char.inventory[cat].push({...defs[cat]}); },
        deleteItem(cat, i, sub=null) { if(sub) this.char.inventory.social[sub].splice(i,1); else this.char.inventory[cat].splice(i,1); },
        addSkill() { this.char.skills.push({name:'Nova Perícia', level:1}); }, deleteSkill(idx) { this.char.skills.splice(idx,1); }, setSkillLevel(idx, l) { this.char.skills[idx].level = l; },
        addTechnique() { this.char.powers.techniques.push({name:'Técnica', desc:''}); }, deleteTechnique(idx) { this.char.powers.techniques.splice(idx,1); },
        
        roll(s) { 
            if(window.SFX) window.SFX.play('click'); 
            const arr = new Uint32Array(1); window.crypto.getRandomValues(arr); 
            const n = (arr[0] % s) + 1; const m = parseInt(this.diceMod || 0); 
            this.lastNatural = n; this.lastFaces = s; this.lastRoll = n + m; 
            let formulaStr = `D${s}`; if (m !== 0) formulaStr += (m > 0 ? `+${m}` : `${m}`); 
            this.diceLog.unshift({id: Date.now(), time: new Date().toLocaleTimeString(), formula: formulaStr, result: n+m, crit: n===s, fumble: n===1, reason: this.diceReason}); 
            this.diceReason = ''; 
            if (this.isMobile && this.diceLog.length > 10) this.diceLog.pop(); else if (!this.isMobile && this.diceLog.length > 100) this.diceLog.pop(); 
        },
        notify(msg, type='info') { const id = Date.now(); this.notifications.push({id, message: msg, type}); setTimeout(() => { this.notifications = this.notifications.filter(n => n.id !== id); }, 3000); },
        
        // Tray UI
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
        }
    };
}