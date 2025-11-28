/**
 * ZENITE OS - Core Application
 * Version: v57.0-Performance-Edition
 * Changelog:
 * - Removed: Genie Effect (Caused lag)
 * - Feat: Radar Chart Drag & Drop (-1 to 6 scale)
 * - Fix: Tray Animation Performance
 */

const CONSTANTS = {
    MAX_AGENTS: 30,
    SAVE_INTERVAL: 180000, 
    TOAST_DURATION: 3000,
    SUPABASE_URL: 'https://pwjoakajtygmbpezcrix.supabase.co',
    SUPABASE_KEY: 'sb_publishable_ULe02tKpa38keGvz8bEDIw_mJJaBK6j'
};

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
        systemLoading: true,
        loadingChar: false,
        notifications: [],
        user: null,
        isGuest: false,
        userMenuOpen: false,
        authLoading: false, authMsg: '', authMsgType: '',
        
        chars: {},
        activeCharId: null,
        char: null,
        agentCount: 0,
        currentView: 'dashboard',
        activeTab: 'profile',
        logisticsTab: 'inventory',
        searchQuery: '',
        
        diceTrayOpen: false,
        showDiceLog: false,
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
        isMobile: window.innerWidth < 768,
        
        configModal: false,
        wizardOpen: false, 
        cropperOpen: false,
        cropperInstance: null,
        uploadContext: 'char',

        confirmOpen: false,
        confirmData: { title:'', desc:'', action:null, type:'danger' },
        
        wizardStep: 1,
        wizardPoints: 8,
        wizardData: { class: '', name: '', identity: '', age: '', history: '', photo: null, attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} },
        wizardFocusAttr: '',
        
        settings: {
            mouseTrail: true,
            compactMode: false,
            performanceMode: false,
            themeColor: 'cyan'
        },
        
        unsavedChanges: false, isSyncing: false, saveStatus: 'idle',
        supabase: null, debouncedSaveFunc: null,
        
        // CHART STATE
        chartDrag: { isDragging: false, elementIndex: null, chartInstance: null },

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
                if ((c.name && c.name.toLowerCase().includes(q)) || (c.class && c.class.toLowerCase().includes(q))) {
                    result[id] = c;
                }
            });
            return result;
        },

        async initSystem() {
            setTimeout(() => { if(this.systemLoading) this.systemLoading = false; }, 5000);

            try {
                if (typeof window.supabase !== 'undefined') {
                    this.supabase = window.supabase.createClient(CONSTANTS.SUPABASE_URL, CONSTANTS.SUPABASE_KEY, {
                        auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
                    });
                }

                this.debouncedSaveFunc = debounce(() => { this.saveLocal(); }, 1000);

                window.addEventListener('pageshow', (event) => { if (event.persisted) window.location.reload(); });
                window.addEventListener('resize', () => {
                    this.isMobile = window.innerWidth < 768;
                    this.ensureTrayOnScreen();
                });
                window.addEventListener('popstate', (event) => {
                    if (this.currentView === 'sheet' || this.wizardOpen || this.configModal) {
                        if(this.currentView === 'sheet') this.saveAndExit(true); 
                        this.wizardOpen = false; this.configModal = false; this.cropperOpen = false;
                    }
                });

                // Global Mouse Up for Chart Dragging safety
                window.addEventListener('mouseup', () => { if(this.chartDrag.isDragging) this.stopChartDrag(); });
                window.addEventListener('touchend', () => { if(this.chartDrag.isDragging) this.stopChartDrag(); });

                this.setupCursorEngine(); 
                this.setupWatchers();

                const isGuest = localStorage.getItem('zenite_is_guest') === 'true';
                if (isGuest) {
                    this.isGuest = true; this.loadLocal('zenite_guest_db');
                } else {
                    this.loadLocal('zenite_cached_db');
                    if(this.supabase) {
                        try {
                            const { data: { session } } = await this.supabase.auth.getSession();
                            if (session) { this.user = session.user; await this.fetchCloud(); }
                        } catch(e) {}
                        
                        this.supabase.auth.onAuthStateChange(async (event, session) => {
                            if (event === 'SIGNED_IN' && session) {
                                if (this.user?.id === session.user.id) return;
                                this.user = session.user; this.isGuest = false;
                                localStorage.removeItem('zenite_is_guest'); await this.fetchCloud();
                            } else if (event === 'SIGNED_OUT') {
                                this.user = null; this.chars = {}; this.currentView = 'dashboard';
                            }
                        });
                    }
                }

                this.applyTheme(this.settings.themeColor);
                if(this.settings.compactMode) document.body.classList.add('compact-mode');
                if(this.settings.performanceMode) document.body.classList.add('performance-mode');
                
                this.updateCursorState();
                this.updateAgentCount();
                
                setInterval(() => { if (this.user && this.unsavedChanges && !this.isSyncing) this.syncCloud(true); }, CONSTANTS.SAVE_INTERVAL);

            } catch (err) { console.error("BOOT ERROR:", err); } finally { this.systemLoading = false; }
        },

        ensureTrayOnScreen() {
            if(this.isMobile || this.trayDockMode !== 'float') return;
            this.trayPosition.x = Math.max(10, Math.min(window.innerWidth - 320, this.trayPosition.x));
            this.trayPosition.y = Math.max(60, Math.min(window.innerHeight - 400, this.trayPosition.y));
        },

        updateCursorState() {
            if (this.settings.mouseTrail && !this.settings.performanceMode && !this.isMobile) {
                document.body.classList.add('custom-cursor-active');
            } else {
                document.body.classList.remove('custom-cursor-active');
            }
        },

        setupCursorEngine() {
            const trail = document.getElementById('mouse-trail');
            if (!window.matchMedia("(pointer: fine)").matches) { if(trail) trail.style.display = 'none'; return; }

            document.addEventListener('mousemove', (e) => { 
                cursorX = e.clientX; cursorY = e.clientY;
                if(this.settings.mouseTrail && !this.isMobile) {
                     isCursorHover = e.target.closest('button, a, input, select, textarea, .cursor-pointer, .draggable-handle') !== null;
                }
            });

            const renderLoop = () => {
                if (!trail) return;
                if (this.settings.mouseTrail && !this.settings.performanceMode && !this.isMobile) {
                    trail.style.display = 'block';
                    trail.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0)`; 
                    if(isCursorHover) trail.classList.add('hover-active'); 
                    else trail.classList.remove('hover-active');
                    if(trail.style.opacity === '0') trail.style.opacity = '1';
                } else {
                    trail.style.display = 'none';
                }
                renderRafId = requestAnimationFrame(renderLoop);
            };
            renderLoop();
        },

        toggleDiceTray() {
            this.diceTrayOpen = !this.diceTrayOpen;
            if(this.diceTrayOpen) {
                this.showDiceTip = false; this.hasSeenDiceTip = true; this.saveLocal();
                this.ensureTrayOnScreen();
            }
        },
        setDockMode(mode) {
            this.trayDockMode = mode;
            if(mode === 'float') {
                this.trayPosition = { x: window.innerWidth - 350, y: window.innerHeight - 500 };
                this.ensureTrayOnScreen();
            }
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

        setupWatchers() {
            this.$watch('char', (val) => {
                if (this.loadingChar) return;
                if (val && this.activeCharId) {
                    this.chars[this.activeCharId] = JSON.parse(JSON.stringify(val));
                    if (!this.isGuest) { this.unsavedChanges = true; this.saveStatus = 'idle'; }
                    this.debouncedSaveFunc();
                    // Chart update is handled manually in drag events, but we need it here for other inputs
                    if (this.activeTab === 'profile' && !this.chartDrag.isDragging) this.updateRadarChart();
                }
            }, {deep: true});
        },

        loadLocal(key) {
            const local = localStorage.getItem(key);
            if(local) {
                try {
                    const parsed = JSON.parse(local);
                    if(parsed.config) this.settings = { ...this.settings, ...parsed.config };
                    if(parsed.trayPos) this.trayPosition = parsed.trayPos;
                    if(parsed.hasSeenTip) this.hasSeenDiceTip = parsed.hasSeenTip;
                    const validChars = {};
                    Object.keys(parsed).forEach(k => { if(!['config','trayPos','hasSeenTip'].includes(k) && parsed[k]?.id) validChars[k] = parsed[k]; });
                    this.chars = validChars;
                    this.updateAgentCount();
                    this.diceTrayOpen = false;
                } catch(e) {}
            }
        },

        saveLocal() {
            const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db';
            const payload = { ...this.chars, config: this.settings, trayPos: this.trayPosition, hasSeenTip: this.hasSeenDiceTip, diceTrayOpen: false };
            localStorage.setItem(key, JSON.stringify(payload));
        },

        revertChanges() {
            this.askConfirm('DESFAZER?', 'Voltar ao último save?', 'mini', async () => {
                if(this.isGuest) { this.loadLocal('zenite_guest_db'); } else { this.loadLocal('zenite_cached_db'); await this.fetchCloud(); }
                this.diceTrayOpen = false;
                if(this.activeCharId && this.chars[this.activeCharId]) {
                    this.loadingChar = true;
                    this.char = JSON.parse(JSON.stringify(this.chars[this.activeCharId]));
                    this.$nextTick(() => { this.loadingChar = false; });
                }
                this.unsavedChanges = false;
                this.notify('Revertido.', 'success');
            });
        },

        async fetchCloud() {
            if (!this.user || !this.supabase) return;
            let { data, error } = await this.supabase.from('profiles').select('data').eq('id', this.user.id).single();
            if (error && error.code === 'PGRST116') {
                await this.supabase.from('profiles').insert([{ id: this.user.id, data: { config: this.settings } }]);
                data = { data: { config: this.settings } };
            }
            if (data && data.data) {
                const cloudData = data.data;
                if(cloudData.config) { this.settings = { ...this.settings, ...cloudData.config }; this.applyTheme(this.settings.themeColor); }
                let merged = { ...this.chars }; let hasLocalOnly = false;
                Object.keys(cloudData).forEach(k => { if(!['config'].includes(k)) merged[k] = cloudData[k]; });
                Object.keys(this.chars).forEach(localId => { if (!cloudData[localId] && localId !== 'config') { merged[localId] = this.chars[localId]; hasLocalOnly = true; } });
                this.chars = merged; this.updateAgentCount(); this.saveLocal();
                if (hasLocalOnly) { this.unsavedChanges = true; this.syncCloud(true); }
            }
        },
        async syncCloud(silent = false) {
             if (!this.user || this.isGuest || !this.unsavedChanges || this.isSyncing || !this.supabase) return;
            this.isSyncing = true; if(!silent) this.notify('Sincronizando...', 'info');
            try {
                const payload = { ...this.chars, config: this.settings };
                const { error } = await this.supabase.from('profiles').upsert({ id: this.user.id, data: payload });
                if (error) throw error;
                this.unsavedChanges = false; this.saveStatus = 'success'; if(!silent) this.notify('Salvo!', 'success');
            } catch (e) { this.saveStatus = 'error'; if(!silent) this.notify('Erro ao salvar.', 'error'); } finally { this.isSyncing = false; }
        },
        
        updateAgentCount() { this.agentCount = Object.keys(this.chars).length; },
        
        calculateBaseStats(className, levelStr, attrs) {
            const cl = className || 'Titã';
            const lvl = Math.max(1, parseInt(levelStr) || 1);
            const get = (v) => parseInt(attrs[v] || 0);
            const config = {
                'Titã':        { pv: [15, 4], pf: [12, 2], pdf: [12, 2] },
                'Estrategista':{ pv: [12, 2], pf: [15, 4], pdf: [12, 2] },
                'Infiltrador': { pv: [12, 2], pf: [15, 4], pdf: [12, 3] },
                'Controlador': { pv: [12, 2], pf: [12, 2], pdf: [15, 4] },
                'Psíquico':    { pv: [12, 2], pf: [13, 3], pdf: [14, 3] }
            };
            const cfg = config[cl] || config['Titã'];
            return {
                pv: (cfg.pv[0] + get('for')) + ((cfg.pv[1] + get('for')) * (lvl - 1)),
                pf: (cfg.pf[0] + get('pod')) + ((cfg.pf[1] + get('pod')) * (lvl - 1)),
                pdf: (cfg.pdf[0] + get('von')) + ((cfg.pdf[1] + get('von')) * (lvl - 1))
            };
        },

        recalcDerivedStats() { 
            if(!this.char) return; 
            const newStats = this.calculateBaseStats(this.char.class, this.char.level, this.char.attrs);
            const c = this.char;
            const diffPv = (c.stats.pv.max || newStats.pv) - c.stats.pv.current;
            const diffPf = (c.stats.pf.max || newStats.pf) - c.stats.pf.current;
            const diffPdf = (c.stats.pdf.max || newStats.pdf) - c.stats.pdf.current;
            c.stats.pv.max = newStats.pv; c.stats.pv.current = Math.max(0, newStats.pv - diffPv);
            c.stats.pf.max = newStats.pf; c.stats.pf.current = Math.max(0, newStats.pf - diffPf);
            c.stats.pdf.max = newStats.pdf; c.stats.pdf.current = Math.max(0, newStats.pdf - diffPdf);
        },

        modAttr(key, val) { const c = this.char; if ((val > 0 && c.attrs[key] < 6) || (val < 0 && c.attrs[key] > -1)) { c.attrs[key] += val; this.recalcDerivedStats(); this.updateRadarChart(); } },
        modStat(stat, val) { if(!this.char || !this.char.stats[stat]) return; const s = this.char.stats[stat]; s.current = Math.max(0, Math.min(s.max, s.current + val)); },

        openWizard() { 
            if(this.agentCount >= CONSTANTS.MAX_AGENTS) return this.notify('Limite atingido.', 'error');
            this.wizardStep = 1; this.wizardPoints = 8;
            this.wizardData = { class: '', name: '', identity: '', age: '', history: '', photo: null, attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} };
            this.wizardFocusAttr = '';
            history.pushState({ modal: 'wizard' }, "Wizard", "#new");
            this.wizardOpen = true; 
        },
        selectArchetype(a) { this.wizardData.class = a.class; this.wizardData.attrs = {for:-1, agi:-1, int:-1, von:-1, pod:-1}; this.wizardData.attrs[a.focus] = 0; this.wizardFocusAttr = a.focus; this.wizardStep = 2; this.$nextTick(() => { this.updateWizardChart(); }); },
        modWizardAttr(k,v) { const c = this.wizardData.attrs[k]; const f = k === this.wizardFocusAttr; if(v>0 && this.wizardPoints>0 && c<3) { this.wizardData.attrs[k]++; this.wizardPoints--; this.updateWizardChart(); } if(v<0 && c>(f?0:-1)) { this.wizardData.attrs[k]--; this.wizardPoints++; this.updateWizardChart(); } },
        
        finishWizard() {
            if(!this.wizardData.name) { this.notify("Codinome obrigatório!", "warn"); return; }
            const id = 'z_'+Date.now();
            const calculated = this.calculateBaseStats(this.wizardData.class, 1, this.wizardData.attrs);
            const newChar = {
                id, name: this.wizardData.name, identity: this.wizardData.identity, class: this.wizardData.class, level: 1, age: this.wizardData.age, 
                photo: this.wizardData.photo || '', history: this.wizardData.history, credits: 0, attrs: {...this.wizardData.attrs},
                stats: { pv: {current: calculated.pv, max: calculated.pv}, pf: {current: calculated.pf, max: calculated.pf}, pdf: {current: calculated.pdf, max: calculated.pdf} },
                inventory: { weapons:[], armor:[], gear:[], backpack:"", social:{people:[], objects:[]} },
                skills: [], powers: { passive:'', active:'', techniques:[], lvl3:'', lvl6:'', lvl9:'', lvl10:'' }
            };
            this.chars[id] = newChar; 
            this.updateAgentCount(); this.saveLocal();
            if(!this.isGuest) { this.unsavedChanges = true; this.syncCloud(true); }
            this.wizardOpen = false;
            history.replaceState({ view: 'sheet', id: id }, "Ficha", "#sheet");
            this.loadCharacter(id, true);
            this.notify('Agente Inicializado.', 'success');
        },
        
        toggleSetting(key, val=null) {
            if(val !== null) { this.settings[key] = val; if(key === 'themeColor') this.applyTheme(val); } 
            else { this.settings[key] = !this.settings[key]; 
                if(key === 'compactMode') document.body.classList.toggle('compact-mode', this.settings.compactMode);
                if(key === 'performanceMode') document.body.classList.toggle('performance-mode', this.settings.performanceMode);
            }
            this.updateCursorState(); 
            this.saveLocal(); if(!this.isGuest && this.user) { this.unsavedChanges = true; this.syncCloud(true); }
        },
        applyTheme(color) {
            const root = document.documentElement; const map = { 'cyan': '#0ea5e9', 'purple': '#d946ef', 'gold': '#eab308' };
            const hex = map[color] || map['cyan']; const r = parseInt(hex.slice(1, 3), 16); const g = parseInt(hex.slice(3, 5), 16); const b = parseInt(hex.slice(5, 7), 16);
            root.style.setProperty('--neon-core', hex); root.style.setProperty('--neon-rgb', `${r}, ${g}, ${b}`); 
            const trail = document.getElementById('mouse-trail'); if(trail) trail.style.background = `radial-gradient(circle, rgba(${r}, ${g}, ${b}, 0.2), transparent 70%)`;
        },
        toggleFullscreen() { if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch(()=>{}); } else if (document.exitFullscreen) { document.exitFullscreen(); } },
        handleKeys(e) { /* Console toggle removed */ },
        async logout() { this.systemLoading = true; if(this.unsavedChanges && !this.isGuest) { try { await this.syncCloud(true); } catch(e) {} } localStorage.removeItem('zenite_cached_db'); localStorage.removeItem('zenite_is_guest'); if(this.supabase) await this.supabase.auth.signOut(); window.location.reload(); },
        askLogout() { this.askConfirm('SAIR?', 'Dados pendentes serão salvos.', 'warn', () => this.logout()); },
        askSwitchToOnline() { this.askConfirm('FICAR ONLINE?', 'Ir para login.', 'info', () => { this.isGuest = false; localStorage.removeItem('zenite_is_guest'); window.location.reload(); }); },
        enterGuest() { this.isGuest = true; localStorage.setItem('zenite_is_guest', 'true'); this.loadLocal('zenite_guest_db'); },
        doSocialAuth(provider) { if(!this.supabase) return this.notify("Erro de conexão.", "error"); this.authLoading = true; this.authMsg = "Conectando..."; this.supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } }).then(({error}) => { if(error) { this.notify(error.message, 'error'); this.authLoading = false; } }); },
        
        saveAndExit(fromHistory = false) {
            if(this.char && this.activeCharId) { this.chars[this.activeCharId] = JSON.parse(JSON.stringify(this.char)); this.updateAgentCount(); } 
            this.saveLocal(); if (!this.isGuest && this.unsavedChanges) this.syncCloud(true); 
            this.diceTrayOpen = false; this.showDiceTip = false;
            this.currentView = 'dashboard'; this.activeCharId = null; this.char = null; 
            if (!fromHistory && window.location.hash === '#sheet') { history.back(); }
         },
        loadCharacter(id, skipPush = false) {
             if(!this.chars[id]) return this.notify('Erro ao carregar.', 'error');
            if (!skipPush) history.pushState({ view: 'sheet', id: id }, "Ficha", "#sheet");
            
            this.loadingChar = true; this.activeCharId = id;
            requestAnimationFrame(() => {
                this.char = JSON.parse(JSON.stringify(this.chars[id]));
                if(!this.char.inventory) this.char.inventory = { weapons:[], armor:[], gear:[], backpack: "", social: { people:[], objects:[]} }; 
                if(!this.char.age) this.char.age = ""; 
                this.currentView = 'sheet'; this.activeTab = 'profile';
                this.diceTrayOpen = false; 
                if(!this.hasSeenDiceTip) setTimeout(() => this.showDiceTip = true, 1000);
                this.$nextTick(() => { this.updateRadarChart(); setTimeout(() => { this.loadingChar = false; this.unsavedChanges = false; }, 300); });
            });
         },
        askDeleteChar(id) { this.askConfirm('ELIMINAR?', 'Irreversível.', 'danger', () => { delete this.chars[id]; this.saveLocal(); if(!this.isGuest) this.syncCloud(true); this.updateAgentCount(); this.notify('Deletado.', 'success'); }); },
        askHardReset() { this.askConfirm('LIMPAR TUDO?', 'Apaga cache local.', 'danger', () => { localStorage.clear(); window.location.reload(); }); },
        
        askConfirm(title, desc, type, action) { 
            this.confirmData = { title, desc, type, action }; 
            this.confirmOpen = true; 
        }, 
        confirmYes() { if (this.confirmData.action) this.confirmData.action(); this.confirmOpen = false; },

        // --- CHART DRAG LOGIC (God Mode) ---
        stopChartDrag() {
            if (!this.chartDrag.isDragging) return;
            this.chartDrag.isDragging = false;
            this.chartDrag.elementIndex = null;
            document.body.classList.remove('chart-grabbing');
            if (this.chartDrag.chartInstance) {
                this.chartDrag.chartInstance.update(); // Final full update
            }
        },

        handleChartMove(e, chart) {
            if (!this.chartDrag.isDragging || this.chartDrag.elementIndex === null) return;

            const canvas = chart.canvas;
            const rect = canvas.getBoundingClientRect();
            // Suporte para Mouse e Touch
            const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
            const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
            
            const x = clientX - rect.left;
            const y = clientY - rect.top;
            
            const scale = chart.scales.r;
            const dist = Math.sqrt(Math.pow(x - scale.xCenter, 2) + Math.pow(y - scale.yCenter, 2));
            
            // Calcula o valor baseado no raio (max 6, min -1)
            const maxDist = scale.getDistanceFromCenterForValue(6);
            
            // Lógica de projeção simples: distância linear
            let newVal = Math.round((dist / maxDist) * 6);
            newVal = Math.max(-1, Math.min(6, newVal)); // Clamp -1 to 6

            const keys = ['for','agi','int','von','pod'];
            const key = keys[this.chartDrag.elementIndex];
            
            if (this.char.attrs[key] !== newVal) {
                this.char.attrs[key] = newVal;
                // Atualiza dataset localmente para performance
                chart.data.datasets[0].data[this.chartDrag.elementIndex] = newVal;
                chart.update('none'); // Render update sem animação
                this.recalcDerivedStats(); // Atualiza stats derivados em tempo real
            }
        },

        _renderChart(id, data, isWizard=false) {
            const ctx = document.getElementById(id); if(!ctx) return;
            const color = getComputedStyle(document.documentElement).getPropertyValue('--neon-core').trim();
            const r = parseInt(color.slice(1, 3), 16); const g = parseInt(color.slice(3, 5), 16); const b = parseInt(color.slice(5, 7), 16); const rgb = `${r},${g},${b}`;
            
            const config = {
                type: 'radar',
                data: { 
                    labels: ['FOR','AGI','INT','VON','POD'], 
                    datasets: [{ 
                        data: data, 
                        backgroundColor: `rgba(${rgb}, 0.2)`, 
                        borderColor: `rgba(${rgb}, 1)`, 
                        borderWidth: 2, 
                        pointBackgroundColor: '#fff', 
                        pointRadius: 6, 
                        pointHoverRadius: 8,
                        pointHitRadius: 15 // Área de "pega" maior
                    }] 
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false, 
                    scales: { 
                        r: { 
                            min: -1, max: 6, // ESCALA FIXA -1 A 6
                            ticks: { display: false, stepSize: 1 }, 
                            grid: { color: 'rgba(255,255,255,0.1)', circular: false }, 
                            angleLines: { color: 'rgba(255,255,255,0.1)' },
                            pointLabels: { color: 'rgba(255,255,255,0.7)', font: { size: 10, family: 'Orbitron' } }
                        } 
                    }, 
                    plugins: { legend: { display: false } },
                    onHover: (e, el) => {
                        if (isWizard) return;
                        const canvas = e.chart.canvas;
                        canvas.style.cursor = el.length ? 'grab' : 'default';
                        if(this.chartDrag.isDragging) canvas.style.cursor = 'grabbing';
                    }
                }
            };

            if (!isWizard) {
                // DRAG LOGIC - LISTENERS
                // Chart.js não tem evento de drag nativo fácil, usamos HTML events no canvas
                // Mas precisamos anexar APENAS UMA VEZ
            }

            if (ctx.chart) { 
                ctx.chart.data.datasets[0].data = data; 
                ctx.chart.data.datasets[0].backgroundColor = `rgba(${rgb}, 0.2)`; 
                ctx.chart.data.datasets[0].borderColor = `rgba(${rgb}, 1)`; 
                ctx.chart.update(); 
            } 
            else { 
                ctx.chart = new Chart(ctx, config); 
                
                // EVENTOS MANUAIS PARA DRAG (Só adiciona se não for wizard e for novo gráfico)
                if(!isWizard) {
                    const canvas = ctx.chart.canvas;
                    
                    const startDrag = (e) => {
                        const points = ctx.chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, true);
                        if (points.length) {
                            this.chartDrag.isDragging = true;
                            this.chartDrag.elementIndex = points[0].index;
                            this.chartDrag.chartInstance = ctx.chart;
                            document.body.classList.add('chart-grabbing');
                            // Desabilita seleção de texto durante drag
                            e.preventDefault();
                        }
                    };

                    const moveDrag = (e) => this.handleChartMove(e, ctx.chart);
                    
                    canvas.addEventListener('mousedown', startDrag);
                    canvas.addEventListener('touchstart', startDrag, {passive: false});
                    
                    canvas.addEventListener('mousemove', moveDrag);
                    canvas.addEventListener('touchmove', moveDrag, {passive: false});
                }
            }
        },
        updateRadarChart() { if(!this.char) return; const d = [this.char.attrs.for, this.char.attrs.agi, this.char.attrs.int, this.char.attrs.von, this.char.attrs.pod]; this._renderChart('radarChart', d); },
        updateWizardChart() { const d = [this.wizardData.attrs.for, this.wizardData.attrs.agi, this.wizardData.attrs.int, this.wizardData.attrs.von, this.wizardData.attrs.pod]; this._renderChart('wizChart', d, true); },
        
        triggerFX(type) { const el = document.getElementById(type+'-overlay'); if(el) { el.style.opacity='0.4'; setTimeout(()=>el.style.opacity='0', 200); } },
        addItem(cat) { const defs = { weapons: { name: 'Arma', dmg: '1d6', range: 'C' }, armor: { name: 'Traje', def: '1', pen: '0' }, gear: { name: 'Item', desc: '', qty: 1 }, social_people: { name: 'Nome', role: 'Relação' }, social_objects: { name: 'Objeto', desc: 'Detalhes' } }; if(cat.startsWith('social_')) this.char.inventory.social[cat.split('_')[1]].push({...defs[cat]}); else this.char.inventory[cat].push({...defs[cat]}); },
        deleteItem(cat, i, sub=null) { if(sub) this.char.inventory.social[sub].splice(i,1); else this.char.inventory[cat].splice(i,1); },
        addSkill() { this.char.skills.push({name:'Nova Perícia', level:1}); }, deleteSkill(idx) { this.char.skills.splice(idx,1); }, setSkillLevel(idx, l) { this.char.skills[idx].level = l; },
        addTechnique() { this.char.powers.techniques.push({name:'Técnica', desc:''}); }, deleteTechnique(idx) { this.char.powers.techniques.splice(idx,1); },

        roll(s) {
            const arr = new Uint32Array(1); window.crypto.getRandomValues(arr);
            const n = (arr[0] % s) + 1;
            const m = parseInt(this.diceMod || 0);
            this.lastNatural = n; this.lastFaces = s; this.lastRoll = n + m;
            this.diceLog.unshift({id: Date.now(), time: new Date().toLocaleTimeString(), formula: `D${s}`, result: n+m, crit: n===s, fumble: n===1});
            if (this.isMobile) { if (this.diceLog.length > 10) this.diceLog.pop(); } else { if (this.diceLog.length > 100) this.diceLog.pop(); }
        },

        notify(msg, type='info') { const id = Date.now(); this.notifications.push({id, message: msg, type}); setTimeout(() => { this.notifications = this.notifications.filter(n => n.id !== id); }, 3000); },
        
        openImageEditor(context = 'sheet') { 
            this.uploadContext = context; 
            document.getElementById('file-input').click(); 
        }, 
        initCropper(e) { 
            const file = e.target.files[0]; if(!file) return; 
            const reader = new FileReader(); 
            reader.onload = (evt) => { 
                document.getElementById('crop-target').src = evt.target.result; 
                this.cropperOpen = true; 
                this.$nextTick(() => { 
                    if(this.cropperInstance) this.cropperInstance.destroy(); 
                    this.cropperInstance = new Cropper(document.getElementById('crop-target'), { aspectRatio: 1, viewMode: 1 }); 
                }); 
            }; 
            reader.readAsDataURL(file); 
            e.target.value = '';
        }, 
        applyCrop() { 
            if(!this.cropperInstance) return; 
            const result = this.cropperInstance.getCroppedCanvas({width:300, height:300}).toDataURL('image/jpeg', 0.8);
            if (this.uploadContext === 'wizard') { this.wizardData.photo = result; } else if (this.char) { this.char.photo = result; }
            this.cropperOpen = false; this.notify('Foto processada.', 'success'); 
        },
        
        exportData() { const s = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.chars)); const a = document.createElement('a'); a.href = s; a.download = `zenite_bkp.json`; a.click(); a.remove(); this.notify('Backup baixado.', 'success'); },
        triggerFileImport() { document.getElementById('import-file').click(); },
        processImport(e) { const f = e.target.files[0]; if(!f) return; const r = new FileReader(); r.onload = (evt) => { try { const d = JSON.parse(evt.target.result); this.chars = {...this.chars, ...d}; this.updateAgentCount(); this.saveLocal(); this.unsavedChanges = true; this.notify('Importado!', 'success'); this.configModal = false; } catch(e){ this.notify('Erro arquivo.', 'error'); } }; r.readAsText(f); }
    };
}