/**
 * ZENITE OS - Main Controller v78.0
 * Debug & Stability Release
 */

// Fallback de Segurança se config.js falhar
if (typeof CONFIG === 'undefined') {
    console.warn("CONFIG not found. Using defaults.");
    var CONFIG = {
        MAX_AGENTS: 30,
        SAVE_INTERVAL: 180000,
        SUPABASE_URL: '', // Preencha se necessário
        SUPABASE_KEY: ''
    };
}

// Variáveis Globais
let cursorX = -100, cursorY = -100;
let isCursorHover = false;
let renderRafId = null;

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
        
        // MODULES
        netLink: null,
        
        // DATA
        chars: {}, activeCharId: null, char: null, agentCount: 0,
        currentView: 'dashboard', activeTab: 'profile', logisticsTab: 'inventory', searchQuery: '',
        
        // WIDGETS
        diceTrayOpen: false, trayDockMode: 'float', trayPosition: { x: window.innerWidth - 350, y: window.innerHeight - 500 },
        isDraggingTray: false, dragOffset: { x: 0, y: 0 },
        showDiceTip: false, hasSeenDiceTip: false,
        diceLog: [], lastRoll: '--', lastNatural: 0, lastFaces: 20, diceMod: 0, diceReason: '',
        
        // UX/SECRETS
        konamiBuffer: [], logoClickCount: 0, logoClickTimer: null, systemFailure: false,
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
            crtMode: true, sfxEnabled: true, themeColor: 'cyan'
        },
        
        unsavedChanges: false, isSyncing: false, saveStatus: 'idle', supabase: null, debouncedSaveFunc: null,

        // Getters Seguros
        get archetypes() { return (typeof RPG !== 'undefined') ? RPG.archetypes : []; },

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

        // --- BOOT ---
        async initSystem() {
            this.loadingProgress = 10; this.loadingText = 'CORE SYSTEM';
            setTimeout(() => { if(this.systemLoading) this.systemLoading = false; }, 8000);
            window.addEventListener('beforeunload', (e) => { if (this.unsavedChanges && !this.isGuest) { e.preventDefault(); e.returnValue = 'Alterações pendentes.'; } });

            try {
                await new Promise(r => setTimeout(r, 300));
                
                // Conexão Supabase Segura
                if (typeof window.supabase !== 'undefined' && CONFIG.SUPABASE_URL) {
                    this.supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, {
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
                                if(typeof netLinkSystem !== 'undefined') {
                                    this.netLink = netLinkSystem(this.supabase, this.user);
                                    this.netLink.init();
                                }
                            }
                        } catch(e) { console.warn("Auth check fail", e); }
                        
                        this.supabase.auth.onAuthStateChange(async (event, session) => {
                            if (event === 'SIGNED_IN' && session) { 
                                if (this.user?.id === session.user.id) return;
                                this.user = session.user; 
                                this.isGuest = false; 
                                localStorage.removeItem('zenite_is_guest'); 
                                await this.fetchCloud();
                                if(typeof netLinkSystem !== 'undefined') {
                                    this.netLink = netLinkSystem(this.supabase, this.user);
                                    this.netLink.init();
                                }
                            } else if (event === 'SIGNED_OUT') { 
                                this.user = null; this.chars = {}; this.currentView = 'dashboard'; 
                            }
                            this.updateVisualState();
                        });
                    }
                }

                this.loadingProgress = 90; this.loadingText = 'APPLYING THEME';
                this.applyTheme(this.settings.themeColor);
                if(this.settings.compactMode && this.isMobile) document.body.classList.add('compact-mode');
                if(this.settings.performanceMode) document.body.classList.add('performance-mode');
                
                if (typeof SFX !== 'undefined') SFX.toggle(this.settings.sfxEnabled);
                this.updateVisualState();
                
                this.updateAgentCount();
                setInterval(() => { if (this.user && this.unsavedChanges && !this.isSyncing) this.syncCloud(true); }, CONSTANTS.SAVE_INTERVAL);

                this.loadingProgress = 100; this.loadingText = 'READY';
                setTimeout(() => { this.systemLoading = false; }, 500);

            } catch (err) { 
                console.error("Boot Error:", err); 
                // Notifica o erro REAL para debugging
                this.notify("Erro: " + (err.message || "Falha na inicialização"), "error"); 
                this.systemLoading = false; 
            }
        },

        // --- CORE LOGIC ---
        recalcDerivedStats() { 
            if(!this.char || typeof RPG === 'undefined') return; 
            const newStats = RPG.calculateDerived(this.char.class, this.char.level, this.char.attrs);
            const c = this.char;
            const diffPv = (c.stats.pv.max || newStats.pv) - c.stats.pv.current;
            const diffPf = (c.stats.pf.max || newStats.pf) - c.stats.pf.current;
            const diffPdf = (c.stats.pdf.max || newStats.pdf) - c.stats.pdf.current;

            c.stats.pv.max = newStats.pv; c.stats.pv.current = Math.max(0, newStats.pv - diffPv);
            c.stats.pf.max = newStats.pf; c.stats.pf.current = Math.max(0, newStats.pf - diffPf);
            c.stats.pdf.max = newStats.pdf; c.stats.pdf.current = Math.max(0, newStats.pdf - diffPdf);
        },

        modAttr(key, val) { const c = this.char; if ((val > 0 && c.attrs[key] < 6) || (val < 0 && c.attrs[key] > -1)) { c.attrs[key] += val; this.recalcDerivedStats(); this.updateRadarChart(); } },

        finishWizard() {
            if(!this.wizardData.name) { this.notify("Codinome obrigatório!", "warn"); return; }
            if(typeof RPG === 'undefined') return this.notify("Erro: RPG Core missing", "error");
            
            const id = 'z_'+Date.now();
            const newChar = RPG.createBlankChar(id, this.wizardData);
            
            this.chars[id] = newChar; 
            this.updateAgentCount(); 
            this.saveLocal();
            if(!this.isGuest) { this.unsavedChanges = true; this.syncCloud(true); }
            this.wizardOpen = false; history.replaceState({ view: 'sheet', id: id }, "Ficha", "#sheet");
            this.loadCharacter(id, true);
            this.notify('Agente Inicializado.', 'success');
        },

        // --- FEATURES ---
        exportIdentityCard() {
            const element = document.querySelector('main'); 
            if(!element) return;
            this.notify("Gerando ID Card...", "info");
            if(typeof SFX !== 'undefined') SFX.play('click');
            html2canvas(element, {
                backgroundColor: '#050507', scale: 2, useCORS: true, ignoreElements: (el) => el.classList.contains('no-print')
            }).then(canvas => {
                const link = document.createElement('a');
                link.download = `ID_${this.char.name}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
                if(typeof SFX !== 'undefined') SFX.play('save');
                this.notify("ID Card exportado!", "success");
            });
        },

        roll(s) {
            if(typeof SFX !== 'undefined') SFX.play('roll');
            const arr = new Uint32Array(1); window.crypto.getRandomValues(arr); 
            const n = (arr[0] % s) + 1; const m = parseInt(this.diceMod || 0); 
            this.lastNatural = n; this.lastFaces = s; this.lastRoll = n + m;
            let formulaStr = `D${s}`; if (m !== 0) formulaStr += (m > 0 ? `+${m}` : `${m}`);
            const rollData = { id: Date.now(), time: new Date().toLocaleTimeString(), formula: formulaStr, result: n+m, crit: n===s, fumble: n===1, reason: this.diceReason };
            this.diceLog.unshift(rollData); this.diceReason = ''; 
            if (this.isMobile && this.diceLog.length > 10) this.diceLog.pop(); else if (!this.isMobile && this.diceLog.length > 100) this.diceLog.pop();
            if(this.netLink && this.netLink.activeCampaign) this.netLink.broadcastRoll(rollData);
        },

        // --- UI & LISTENERS ---
        setupListeners() {
            window.addEventListener('pageshow', (event) => { if (event.persisted) window.location.reload(); });
            window.addEventListener('resize', () => { this.isMobile = window.innerWidth < 768; this.ensureTrayOnScreen(); });
            window.addEventListener('popstate', (event) => {
                if (this.currentView === 'sheet' && this.unsavedChanges && !this.isGuest) { history.pushState(null, null, location.href); this.triggerShake(); this.notify("Salve antes de sair!", "warn"); return; }
                if (this.currentView === 'sheet' || this.wizardOpen || this.configModal) { if(this.currentView === 'sheet') this.saveAndExit(true); this.wizardOpen = false; this.configModal = false; this.cropperOpen = false; }
            });
            
            // SFX Listeners Inteligentes
            let lastHovered = null;
            document.addEventListener('click', (e) => { if(e.target.closest('button, a, .cursor-pointer')) { if(typeof SFX !== 'undefined') SFX.play('click'); } });
            document.addEventListener('mouseover', (e) => {
                const target = e.target.closest('button, a, .cursor-pointer');
                if (target && target !== lastHovered) {
                    if(typeof SFX !== 'undefined') SFX.play('hover');
                    lastHovered = target;
                } else if (!target) lastHovered = null;
            });
        },

        updateVisualState() {
            const isAuthenticated = this.user || this.isGuest;
            if (isAuthenticated && this.settings.mouseTrail && !this.settings.performanceMode && !this.isMobile) { document.body.classList.add('custom-cursor-active'); } else { document.body.classList.remove('custom-cursor-active'); }
            if (isAuthenticated && this.settings.crtMode) { document.body.classList.add('crt-mode'); } else { document.body.classList.remove('crt-mode'); }
            if(typeof SFX !== 'undefined') SFX.toggle(this.settings.sfxEnabled);
        },

        toggleSetting(key, val=null) {
            if(val !== null) { this.settings[key] = val; if(key === 'themeColor') this.applyTheme(val); } 
            else { 
                this.settings[key] = !this.settings[key]; 
                if(key === 'compactMode') { if(this.isMobile) document.body.classList.toggle('compact-mode', this.settings.compactMode); }
                if(key === 'performanceMode') document.body.classList.toggle('performance-mode', this.settings.performanceMode); 
            }
            this.updateVisualState(); this.saveLocal(); 
            if(!this.isGuest && this.user) { this.unsavedChanges = true; this.syncCloud(true); }
        },

        // --- SECRETS & SYSTEM ---
        handleKeys(e) {
            const key = e.key.toLowerCase();
            const konamiCode = ['arrowup','arrowup','arrowdown','arrowdown','arrowleft','arrowright','arrowleft','arrowright','b','a'];
            this.konamiBuffer.push(key);
            if (this.konamiBuffer.length > konamiCode.length) this.konamiBuffer.shift();
            if (JSON.stringify(this.konamiBuffer) === JSON.stringify(konamiCode)) {
                document.body.classList.toggle('theme-hacker');
                if(document.body.classList.contains('theme-hacker')) { 
                    if(typeof SFX !== 'undefined') SFX.play('success'); 
                    this.notify("SYSTEM OVERRIDE: HACKER MODE", "success"); 
                } else { 
                    if(typeof SFX !== 'undefined') SFX.play('click'); 
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
                 if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{});
                 else if (document.exitFullscreen) document.exitFullscreen();
            }
        },

        triggerSystemFailure() {
            if(typeof SFX !== 'undefined') SFX.play('glitch'); 
            if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch((err) => {});
            this.systemFailure = true; 
            setTimeout(() => { 
                this.systemFailure = false; 
                if(typeof SFX !== 'undefined') SFX.play('discard'); 
            }, 5000);
        },

        // --- HELPERS ---
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
                if(!silent) { this.notify('Salvo!', 'success'); if(typeof SFX !== 'undefined') SFX.play('save'); }
            } catch (e) { this.saveStatus = 'error'; if(!silent) this.notify('Erro ao salvar.', 'error'); } finally { this.isSyncing = false; }
        },
        
        updateAgentCount() { this.agentCount = Object.keys(this.chars).length; },
        applyTheme(color) {
            const root = document.documentElement; const map = { 'cyan': '#0ea5e9', 'purple': '#d946ef', 'gold': '#eab308' };
            const hex = map[color] || map['cyan']; const r = parseInt(hex.slice(1, 3), 16); const g = parseInt(hex.slice(3, 5), 16); const b = parseInt(hex.slice(5, 7), 16);
            root.style.setProperty('--neon-core', hex); root.style.setProperty('--neon-rgb', `${r}, ${g}, ${b}`); 
            const trail = document.getElementById('mouse-trail'); if(trail) trail.style.background = `radial-gradient(circle, rgba(${r}, ${g}, ${b}, 0.2), transparent 70%)`;
        },
        
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
        async performRevert() {
            this.isReverting = true; this.diceTrayOpen = false; this.revertConfirmMode = false;
            document.body.classList.add('animating-out'); document.body.classList.add('interaction-lock');
            if(typeof SFX !== 'undefined') SFX.play('discard');
            setTimeout(async () => {
                try {
                    if(this.isGuest) { this.loadLocal('zenite_guest_db'); } else { this.loadLocal('zenite_cached_db'); await this.fetchCloud(); }
                    if(this.activeCharId && this.chars[this.activeCharId]) { this.char = JSON.parse(JSON.stringify(this.chars[this.activeCharId])); } else { this.currentView = 'dashboard'; this.char = null; }
                    this.unsavedChanges = false;
                    document.body.classList.remove('animating-out'); document.body.classList.add('animating-in');
                    this.notify('Dados restaurados.', 'success');
                    setTimeout(() => { document.body.classList.remove('animating-in'); document.body.classList.remove('interaction-lock'); this.isReverting = false; }, 400);
                } catch (e) { console.error("Revert Error:", e); this.notify("Erro na restauração.", "error"); document.body.classList.remove('animating-out'); document.body.classList.remove('interaction-lock'); this.isReverting = false; }
            }, 300);
        },
        askLogout() { this.askConfirm('SAIR?', 'Dados pendentes serão salvos.', 'warn', () => this.logout()); },
        async logout() { this.systemLoading = true; if(this.unsavedChanges && !this.isGuest) { try { await this.syncCloud(true); } catch(e) {} } localStorage.removeItem('zenite_cached_db'); localStorage.removeItem('zenite_is_guest'); if(this.supabase) await this.supabase.auth.signOut(); window.location.reload(); },
        askSwitchToOnline() { this.askConfirm('FICAR ONLINE?', 'Ir para login.', 'info', () => { this.isGuest = false; localStorage.removeItem('zenite_is_guest'); window.location.reload(); }); },
        enterGuest() { this.isGuest = true; localStorage.setItem('zenite_is_guest', 'true'); this.loadLocal('zenite_guest_db'); },
        doSocialAuth(provider) { if(!this.supabase) return this.notify("Erro de conexão.", "error"); this.authLoading = true; this.authMsg = "Conectando..."; this.supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } }).then(({error}) => { if(error) { this.notify(error.message, 'error'); this.authLoading = false; } }); },
        askDeleteChar(id) { this.askConfirm('ELIMINAR?', 'Irreversível.', 'danger', () => { delete this.chars[id]; this.saveLocal(); if(!this.isGuest) this.syncCloud(true); this.updateAgentCount(); this.notify('Deletado.', 'success'); }); },
        askHardReset() { this.askConfirm('LIMPAR TUDO?', 'Apaga cache local.', 'danger', () => { localStorage.clear(); window.location.reload(); }); },
        askConfirm(title, desc, type, action) { this.confirmData = { title, desc, type, action }; this.confirmOpen = true; }, 
        confirmYes() { if (this.confirmData.action) this.confirmData.action(); this.confirmOpen = false; },
        openImageEditor(context = 'sheet') { this.uploadContext = context; document.getElementById('file-input').click(); }, 
        initCropper(e) { const file = e.target.files[0]; if(!file) return; const reader = new FileReader(); reader.onload = (evt) => { document.getElementById('crop-target').src = evt.target.result; this.cropperOpen = true; this.$nextTick(() => { if(this.cropperInstance) this.cropperInstance.destroy(); this.cropperInstance = new Cropper(document.getElementById('crop-target'), { aspectRatio: 1, viewMode: 1 }); }); }; reader.readAsDataURL(file); e.target.value = ''; }, 
        applyCrop() { if(!this.cropperInstance) return; const result = this.cropperInstance.getCroppedCanvas({width:300, height:300}).toDataURL('image/jpeg', 0.8); if (this.uploadContext === 'wizard') { this.wizardData.photo = result; } else if (this.char) { this.char.photo = result; } this.cropperOpen = false; this.notify('Foto processada.', 'success'); },
        exportData() { const s = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.chars)); const a = document.createElement('a'); a.href = s; a.download = `zenite_bkp.json`; a.click(); a.remove(); this.notify('Backup baixado.', 'success'); },
        triggerFileImport() { document.getElementById('import-file').click(); },
        processImport(e) { const f = e.target.files[0]; if(!f) return; const r = new FileReader(); r.onload = (evt) => { try { const d = JSON.parse(evt.target.result); this.chars = {...this.chars, ...d}; this.updateAgentCount(); this.saveLocal(); this.unsavedChanges = true; this.notify('Importado!', 'success'); this.configModal = false; } catch(e){ this.notify('Erro arquivo.', 'error'); } }; r.readAsText(f); },
        _renderChart(id, data, isWizard=false) { const ctx = document.getElementById(id); if(!ctx) return; const color = getComputedStyle(document.documentElement).getPropertyValue('--neon-core').trim(); const r = parseInt(color.slice(1, 3), 16); const g = parseInt(color.slice(3, 5), 16); const b = parseInt(color.slice(5, 7), 16); const rgb = `${r},${g},${b}`; if (ctx.chart) { ctx.chart.data.datasets[0].data = data; ctx.chart.data.datasets[0].backgroundColor = `rgba(${rgb}, 0.2)`; ctx.chart.data.datasets[0].borderColor = `rgba(${rgb}, 1)`; ctx.chart.update(); } else { ctx.chart = new Chart(ctx, { type: 'radar', data: { labels: ['FOR','AGI','INT','VON','POD'], datasets: [{ data: data, backgroundColor: `rgba(${rgb}, 0.2)`, borderColor: `rgba(${rgb}, 1)`, borderWidth: 2, pointBackgroundColor: '#fff', pointRadius: isWizard ? 4 : 3 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { r: { min: -1, max: isWizard ? 4 : 6, ticks: { display: false, stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.1)', circular: false }, angleLines: { color: 'rgba(255,255,255,0.1)' } } }, plugins: { legend: { display: false } }, transitions: { active: { animation: { duration: 600 } } } } }); } },
        updateRadarChart() { if(!this.char) return; const d = [this.char.attrs.for, this.char.attrs.agi, this.char.attrs.int, this.char.attrs.von, this.char.attrs.pod]; this._renderChart('radarChart', d); },
        updateWizardChart() { const d = [this.wizardData.attrs.for, this.wizardData.attrs.agi, this.wizardData.attrs.int, this.wizardData.attrs.von, this.wizardData.attrs.pod]; this._renderChart('wizChart', d, true); },
        modStat(stat, val) { if(!this.char || !this.char.stats[stat]) return; const s = this.char.stats[stat]; s.current = Math.max(0, Math.min(s.max, s.current + val)); },
        addItem(cat) { const defs = { weapons: { name: 'Arma', dmg: '1d6', range: 'C' }, armor: { name: 'Traje', def: '1', pen: '0' }, gear: { name: 'Item', desc: '', qty: 1 }, social_people: { name: 'Nome', role: 'Relação' }, social_objects: { name: 'Objeto', desc: 'Detalhes' } }; if(cat.startsWith('social_')) this.char.inventory.social[cat.split('_')[1]].push({...defs[cat]}); else this.char.inventory[cat].push({...defs[cat]}); },
        deleteItem(cat, i, sub=null) { if(sub) this.char.inventory.social[sub].splice(i,1); else this.char.inventory[cat].splice(i,1); },
        addSkill() { this.char.skills.push({name:'Nova Perícia', level:1}); }, deleteSkill(idx) { this.char.skills.splice(idx,1); }, setSkillLevel(idx, l) { this.char.skills[idx].level = l; },
        addTechnique() { this.char.powers.techniques.push({name:'Técnica', desc:''}); }, deleteTechnique(idx) { this.char.powers.techniques.splice(idx,1); },
        selectArchetype(a) { this.wizardData.class = a.class; this.wizardData.attrs = {for:-1, agi:-1, int:-1, von:-1, pod:-1}; this.wizardData.attrs[a.focus] = 0; this.wizardFocusAttr = a.focus; this.wizardStep = 2; this.$nextTick(() => { this.updateWizardChart(); }); },
        modWizardAttr(k,v) { const c = this.wizardData.attrs[k]; const f = k === this.wizardFocusAttr; if(v>0 && this.wizardPoints>0 && c<3) { this.wizardData.attrs[k]++; this.wizardPoints--; this.updateWizardChart(); } if(v<0 && c>(f?0:-1)) { this.wizardData.attrs[k]--; this.wizardPoints++; this.updateWizardChart(); } },
        notify(msg, type='info') { const id = Date.now(); this.notifications.push({id, message: msg, type}); setTimeout(() => { this.notifications = this.notifications.filter(n => n.id !== id); }, 3000); },
        triggerFX(type) { const el = document.getElementById(type+'-overlay'); if(el) { el.style.opacity='0.4'; setTimeout(()=>el.style.opacity='0', 200); } },
        setDockMode(mode) { this.trayDockMode = mode; if(mode === 'float') { this.trayPosition = { x: window.innerWidth - 350, y: window.innerHeight - 500 }; this.ensureTrayOnScreen(); } },
        startDragTray(e) { if(this.isMobile || this.trayDockMode !== 'float') return; if(e.target.closest('button') || e.target.closest('input')) return; this.isDraggingTray = true; this.dragOffset.x = e.clientX - this.trayPosition.x; this.dragOffset.y = e.clientY - this.trayPosition.y; const moveHandler = (ev) => { if(!this.isDraggingTray) return; this.trayPosition.x = ev.clientX - this.dragOffset.x; this.trayPosition.y = ev.clientY - this.dragOffset.y; }; const upHandler = () => { this.isDraggingTray = false; document.removeEventListener('mousemove', moveHandler); document.removeEventListener('mouseup', upHandler); }; document.addEventListener('mousemove', moveHandler); document.addEventListener('mouseup', upHandler); },
        ensureTrayOnScreen() { if(this.isMobile || this.trayDockMode !== 'float') return; this.trayPosition.x = Math.max(10, Math.min(window.innerWidth - 320, this.trayPosition.x)); this.trayPosition.y = Math.max(60, Math.min(window.innerHeight - 400, this.trayPosition.y)); },
        toggleDiceTray() { if (this.isReverting) return; this.diceTrayOpen = !this.diceTrayOpen; if(this.diceTrayOpen) { if(!this.hasSeenDiceTip) { this.hasSeenDiceTip = true; this.saveLocal(); } this.showDiceTip = false; this.ensureTrayOnScreen(); } },

        // MOUSE SETUP (Global & Blindado)
        setupCursorEngine() {
            const trail = document.getElementById('mouse-trail');
            if (!window.matchMedia("(pointer: fine)").matches) { if(trail) trail.style.display = 'none'; return; }
            document.addEventListener('mousemove', (e) => { 
                cursorX = e.clientX; cursorY = e.clientY;
                if(this.settings.mouseTrail && !this.isMobile) { isCursorHover = e.target.closest('button, a, input, select, textarea, .cursor-pointer, .draggable-handle') !== null; }
            });
            const renderLoop = () => {
                if (!trail) return;
                const isAuthenticated = this.user || this.isGuest;
                if (isAuthenticated && this.settings.mouseTrail && !this.settings.performanceMode && !this.isMobile) {
                    trail.style.display = 'block'; trail.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0)`; 
                    if(isCursorHover) trail.classList.add('hover-active'); else trail.classList.remove('hover-active');
                    if(trail.style.opacity === '0') trail.style.opacity = '1';
                } else { trail.style.display = 'none'; }
                renderRafId = requestAnimationFrame(renderLoop);
            };
            renderLoop();
        }
    };
}