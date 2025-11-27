/**
 * ZENITE OS - Core Application
 * Version: v46.0-Architecture
 * * Architecture Note:
 * This file is structured into internal "Services" to simulate modularity.
 * In a future build step (Vite/Webpack), these objects can be moved to separate .js files.
 */

const SUPABASE_URL = 'https://pwjoakajtygmbpezcrix.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_ULe02tKpa38keGvz8bEDIw_mJJaBK6j';

// Initialize Supabase Client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});

const CONSTANTS = {
    MAX_AGENTS: 30,
    VERSION: 'v46.0-Arc',
    SAVE_INTERVAL: 180000, // 3 min
    TOAST_DURATION: 3000
};

function zeniteSystem() {
    return {
        // =========================================================================
        // GLOBAL STATE
        // =========================================================================
        systemLoading: true,
        user: null,
        isGuest: false,
        userMenuOpen: false,
        loadingChar: false,
        diceTrayOpen: true,
        
        // Settings & Diagnostics
        consoleOpen: false,
        sysLogs: [],
        searchQuery: '',
        
        // Default Settings (Will be overwritten by Cloud/Local data)
        settings: {
            mouseTrail: true,
            compactMode: false,
            performanceMode: false,
            themeColor: 'cyan' // 'cyan', 'purple', 'gold'
        },

        // Auth UI State
        authLoading: false, 
        authMsg: '', 
        authMsgType: '',

        // Data Sync State
        unsavedChanges: false, 
        isSyncing: false, 
        saveStatus: 'idle',

        // Data Models
        chars: {}, 
        activeCharId: null, 
        char: null, 
        agentCount: 0,
        
        // UI Navigation
        currentView: 'dashboard', 
        activeTab: 'profile', 
        logisticsTab: 'inventory',
        
        // Modals & Notifications
        notifications: [], 
        configModal: false,
        confirmOpen: false, 
        confirmData: { title:'', desc:'', action:null, type:'danger' },

        // Gameplay Tools
        showDiceLog: false, 
        diceLog: [], 
        lastRoll: '--', 
        lastNatural: 0, 
        lastFaces: 0, 
        diceMod: 0,
        
        // Wizard (New Char)
        wizardOpen: false, 
        wizardStep: 1, 
        wizardData: { class: '', attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} }, 
        wizardPoints: 8, 
        wizardFocusAttr: '',
        
        // Image Editor
        cropperOpen: false, 
        cropperInstance: null,

        // Static Data
        archetypes: [
            { class: 'Titã', icon: 'fa-solid fa-shield-halved', focus: 'for', color: 'text-rose-500', desc: 'Resiliência e força bruta.' },
            { class: 'Estrategista', icon: 'fa-solid fa-chess', focus: 'int', color: 'text-cyan-500', desc: 'Análise tática e liderança.' },
            { class: 'Infiltrador', icon: 'fa-solid fa-user-ninja', focus: 'agi', color: 'text-emerald-500', desc: 'Furtividade e precisão.' },
            { class: 'Controlador', icon: 'fa-solid fa-hand-spock', focus: 'pod', color: 'text-violet-500', desc: 'Manipulação de energia.' },
            { class: 'Psíquico', icon: 'fa-solid fa-brain', focus: 'von', color: 'text-amber-500', desc: 'Domínio mental.' }
        ],

        // =========================================================================
        // COMPUTED PROPERTIES
        // =========================================================================
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
        // INITIALIZATION & LIFECYCLE
        // =========================================================================
        async initSystem() {
            this.log(`SYSTEM BOOT: ${CONSTANTS.VERSION}`, 'info');
            this.authLoading = false;
            
            this.setupGlobalHandlers();
            this.setupCursor();

            // Fail-safe load
            setTimeout(() => { if(this.systemLoading) this.systemLoading = false; }, 4000);

            // Handle Auth Redirects
            if (window.location.hash && window.location.hash.includes('error=')) {
                this.notify('Login cancelado ou falhou.', 'warn');
                history.replaceState(null, null, ' ');
            }

            // Determine User State
            const isGuestStore = localStorage.getItem('zenite_is_guest') === 'true';
            
            if (isGuestStore) {
                this.isGuest = true;
                this.loadLocalData('zenite_guest_db');
                this.systemLoading = false;
            } else {
                // Try Load Cache First (Optimistic UI)
                this.loadLocalData('zenite_cached_db');
                
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    this.user = session.user;
                    await this.fetchData(); // Cloud Sync & Merge
                }
                this.systemLoading = false;
            }

            this.setupAuthListener();
            this.setupAutoSave();
            this.setupWatchers();
        },

        // =========================================================================
        // SERVICES (MODULAR LOGIC)
        // =========================================================================

        setupGlobalHandlers() {
            // Error Trap
            window.onerror = (msg, url, line) => {
                if (msg === 'Script error.' || msg.includes('Script error')) return true; // Ignore CORS noise
                this.log(`JS ERROR: ${msg} @ L${line}`, 'error'); 
                return false; 
            };
            window.onunhandledrejection = (e) => { 
                if (e.reason?.message?.includes('ResizeObserver')) return; // Ignore layout noise
                this.log(`ASYNC ERROR: ${e.reason}`, 'error'); 
            };

            // Back Button Fix (State Consistency)
            window.addEventListener('pageshow', (event) => {
                this.authLoading = false;
                // Se a página foi carregada do cache (botão voltar), força reload para garantir estado limpo
                if (event.persisted) {
                    window.location.reload();
                }
            });

            // Prevent Unsaved Exit
            window.addEventListener('beforeunload', (e) => {
                if (this.unsavedChanges && !this.isGuest) { 
                    e.preventDefault(); 
                    e.returnValue = 'Alterações pendentes.'; 
                }
            });
        },

        setupCursor() {
            const trail = document.getElementById('mouse-trail');
            
            // Disable on Touch Devices entirely
            if (!window.matchMedia("(pointer: fine)").matches) {
                if(trail) trail.style.display = 'none';
                return;
            }

            // Mouse Move Handler
            document.addEventListener('mousemove', (e) => { 
                if (!this.settings.mouseTrail || this.settings.performanceMode) return;
                
                // Direct Follow (No delay for main cursor feel)
                if (trail) {
                    trail.style.left = e.clientX + 'px';
                    trail.style.top = e.clientY + 'px';
                    trail.style.opacity = '1';
                    
                    // Interactive State
                    const target = e.target;
                    const isClickable = target.closest('button, a, input, select, textarea, .cursor-pointer');
                    
                    if (isClickable) {
                        trail.classList.add('hover-active');
                        document.body.classList.add('custom-cursor-hover');
                    } else {
                        trail.classList.remove('hover-active');
                        document.body.classList.remove('custom-cursor-hover');
                    }
                    
                    document.body.classList.add('custom-cursor-active');
                }
            });

            // Hide when leaving window
            document.addEventListener('mouseleave', () => {
                if(trail) trail.style.opacity = '0';
            });
        },

        setupAuthListener() {
            supabase.auth.onAuthStateChange(async (event, session) => {
                if (event === 'TOKEN_REFRESHED') return;
                
                if (event === 'SIGNED_IN' && session) {
                    if (this.user && this.user.id === session.user.id) return; // Already loaded
                    this.systemLoading = true;
                    this.user = session.user;
                    this.isGuest = false;
                    localStorage.removeItem('zenite_is_guest');
                    await this.fetchData();
                    this.systemLoading = false;
                    if(window.location.hash) history.replaceState(null, null, ' ');
                } else if (event === 'SIGNED_OUT') {
                    this.user = null;
                    this.chars = {};
                    this.currentView = 'dashboard';
                    this.systemLoading = false;
                }
            });
        },

        setupWatchers() {
            // Main Character Watcher
            this.$watch('char', (val) => {
                if (this.loadingChar) return; // Prevent change detection during load
                
                if (val && this.activeCharId) {
                    this.chars[this.activeCharId] = JSON.parse(JSON.stringify(val));
                    
                    // Local Backup Immediate
                    const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db';
                    localStorage.setItem(key, JSON.stringify(this.chars));
                    
                    if (!this.isGuest) { 
                        this.unsavedChanges = true; 
                        this.saveStatus = 'idle'; 
                    }
                    
                    if (this.activeTab === 'profile') this.updateRadarChart();
                }
            }, { deep: true });
        },

        setupAutoSave() {
            setInterval(() => { 
                if (this.user && this.unsavedChanges && !this.isSyncing) {
                    this.syncCloud(true);
                }
            }, CONSTANTS.SAVE_INTERVAL); 
        },

        // =========================================================================
        // DATA LOGIC (SYNC & MERGE)
        // =========================================================================
        
        async fetchData() { 
            if (!this.user) return; 
            
            let { data, error } = await supabase.from('profiles').select('data').eq('id', this.user.id).single(); 
            
            // Handle New User
            if (error && error.code === 'PGRST116') { 
                await supabase.from('profiles').insert([{ id: this.user.id, data: {} }]); 
                data = { data: {} }; 
            } 

            if (data) { 
                // Separate Config from Chars if we stored them together
                const rawData = data.data || {};
                
                // Load Settings if they exist
                if (rawData.config) {
                    this.settings = { ...this.settings, ...rawData.config };
                    this.applyTheme(this.settings.themeColor);
                    this.toggleSetting('compactMode', this.settings.compactMode); // Apply visual class
                    this.toggleSetting('performanceMode', this.settings.performanceMode);
                }

                // Chars are the rest of the object or under a key? Currently storing at root for simplicity
                // Assuming rawData IS the chars object for backward compatibility, but we should separate
                // Current structure: { charId: {...}, charId2: {...}, config: {...} }
                
                let cloudChars = {};
                Object.keys(rawData).forEach(key => {
                    if (key !== 'config') cloudChars[key] = rawData[key];
                });

                // Smart Merge Strategy
                let merged = { ...cloudChars };
                let hasLocalOnly = false;
                
                Object.keys(this.chars).forEach(localId => {
                    if (!merged[localId]) { 
                        merged[localId] = this.chars[localId]; 
                        hasLocalOnly = true; 
                    }
                });

                this.chars = merged;
                this.sanitizeData(); 
                
                // Update Cache
                localStorage.setItem('zenite_cached_db', JSON.stringify(this.chars)); 
                
                if (hasLocalOnly) { 
                    this.unsavedChanges = true; 
                    this.syncCloud(true); 
                }
            } 
        },

        async syncCloud(silent = false) {
            if (!this.user || this.isGuest || !this.unsavedChanges || this.isSyncing) return;
            
            this.isSyncing = true; 
            if(!silent) this.notify('Sincronizando...', 'info');
            
            try {
                // Update current char in master list
                if (this.char && this.activeCharId) {
                    this.chars[this.activeCharId] = JSON.parse(JSON.stringify(this.char));
                }

                // Prepare Payload: Chars + Settings
                const payload = JSON.parse(JSON.stringify(this.chars));
                payload.config = this.settings; // Inject settings into save data

                const { error } = await Promise.race([
                    supabase.from('profiles').upsert({ id: this.user.id, data: payload }), 
                    new Promise((_, r) => setTimeout(() => r(new Error('Timeout')), 10000))
                ]);

                if (error) throw error;
                
                this.unsavedChanges = false;
                this.saveStatus = 'success';
                if(!silent) this.notify('Salvo!', 'success');
                
                setTimeout(() => { if(this.saveStatus === 'success') this.saveStatus = 'idle'; }, 2000);
            } catch (e) { 
                this.saveStatus = 'error'; 
                if(!silent) this.notify('Erro no Save.', 'error'); 
            } finally { 
                this.isSyncing = false; 
            }
        },

        sanitizeData() { 
            if (!this.chars || typeof this.chars !== 'object') this.chars = {}; 
            Object.keys(this.chars).forEach(k => { 
                if (!this.chars[k] || !this.chars[k].id || k === 'config') {
                    if(k !== 'config') delete this.chars[k]; // Don't delete config key from memory if it exists loosely
                }
            }); 
            this.updateAgentCount(); 
        },

        loadLocalData(key) { 
            const local = localStorage.getItem(key); 
            if(local) { 
                try { 
                    let p = JSON.parse(local); 
                    // Filter out config from chars list for UI
                    this.chars = {};
                    Object.keys(p).forEach(k => {
                        if(k !== 'config' && p[k]?.id) this.chars[k] = p[k];
                    });
                    this.sanitizeData(); 
                } catch(e) {} 
            } 
        },

        // =========================================================================
        // CHARACTER LOGIC
        // =========================================================================
        
        loadCharacter(id) { 
            if (!this.chars[id]) return this.notify('Ficha inválida.', 'error'); 
            
            this.loadingChar = true; // Lock Save
            this.activeCharId = id; 
            
            // Optimized Render
            requestAnimationFrame(() => {
                this.char = JSON.parse(JSON.stringify(this.chars[id])); 
                
                // Initialize missing fields (Backward Compatibility)
                if(!this.char.inventory) this.char.inventory = { weapons:[], armor:[], gear:[], backpack: "", social: { people:[], objects:[]} }; 
                if(!this.char.skills) this.char.skills = []; 
                if(!this.char.powers) this.char.powers = { passive: '', active: '', techniques: [] }; 
                if(!this.char.stats) this.char.stats = { pv: {current:10, max:10}, pf: {current:10, max:10}, pdf: {current:10, max:10} }; 
                
                this.currentView = 'sheet'; 
                this.activeTab = 'profile'; 
                
                this.$nextTick(() => {
                    this.updateRadarChart();
                    // Small delay to ensure Alpine finished rendering inputs before unlocking change detection
                    setTimeout(() => { 
                        this.loadingChar = false; 
                        this.unsavedChanges = false; 
                    }, 300);
                });
            });
        },

        // SMART LEVEL UP
        recalcDerivedStats() { 
            if(!this.char) return; 
            const c = this.char; 
            
            // 1. Store Old Max Values
            const oldPv = c.stats.pv.max || 0;
            const oldPf = c.stats.pf.max || 0;
            const oldPdf = c.stats.pdf.max || 0;

            // 2. Calculate New Max Values
            const lvl = Math.max(1, parseInt(c.level)||1); 
            const getV = (v) => parseInt(v)||0; 
            const FOR = getV(c.attrs.for), POD = getV(c.attrs.pod), VON = getV(c.attrs.von); 
            
            // Formulas
            const newPv = Math.max(5, (12+FOR)+((2+FOR)*(lvl-1))); 
            const newPf = Math.max(5, (10+POD)+((2+POD)*(lvl-1))); 
            const newPdf = Math.max(5, (10+VON)+((2+VON)*(lvl-1))); 

            // 3. Apply Difference to Current Values (Smart Heal)
            // Only if max has increased/decreased, apply the delta to current
            if (oldPv > 0) c.stats.pv.current = Math.max(0, c.stats.pv.current + (newPv - oldPv));
            if (oldPf > 0) c.stats.pf.current = Math.max(0, c.stats.pf.current + (newPf - oldPf));
            if (oldPdf > 0) c.stats.pdf.current = Math.max(0, c.stats.pdf.current + (newPdf - oldPdf));

            // 4. Update Max
            c.stats.pv.max = newPv;
            c.stats.pf.max = newPf;
            c.stats.pdf.max = newPdf;
        },

        // ... [Standard Helpers: modStat, modAttr, addItem, etc. - kept identical for stability] ...
        modStat(type, val) { if(!this.char) return; const s = this.char.stats[type]; const old = s.current; s.current = Math.min(Math.max(0, s.current + val), s.max); if(s.current < old && type==='pv') this.triggerFX('damage'); if(s.current > old) this.triggerFX('heal'); },
        modAttr(key, val) { const c = this.char.attrs[key]; if (val > 0 && c < 6) this.char.attrs[key]++; if (val < 0 && c > -1) this.char.attrs[key]--; this.recalcDerivedStats(); this.updateRadarChart(); },
        updateClassLogic() { this.recalcDerivedStats(); this.updateRadarChart(); },
        triggerFX(type) { const el = document.getElementById(type + '-overlay'); if(el) { el.style.opacity = '0.4'; setTimeout(() => el.style.opacity = '0', 200); } },
        addItem(cat) { const defs = { weapons: { name: 'Nova Arma', dmg: '1d6', range: 'C' }, armor: { name: 'Traje', def: '1', pen: '0' }, gear: { name: 'Item', desc: '', qty: 1 }, social_people: { name: 'Nome', role: 'Relação' }, social_objects: { name: 'Objeto', desc: 'Detalhes' } }; if(cat.startsWith('social_')) this.char.inventory.social[cat.split('_')[1]].push({...defs[cat]}); else this.char.inventory[cat].push({...defs[cat]}); },
        deleteItem(cat, idx, sub=null) { if(sub) this.char.inventory.social[sub].splice(idx,1); else this.char.inventory[cat].splice(idx,1); },
        addSkill() { this.char.skills.push({name:'Nova Perícia', level:1}); }, deleteSkill(idx) { this.char.skills.splice(idx,1); }, setSkillLevel(idx, l) { this.char.skills[idx].level = l; },
        addTechnique() { this.char.powers.techniques.push({name:'Técnica', desc:''}); }, deleteTechnique(idx) { this.char.powers.techniques.splice(idx,1); },
        renderChart(id, attrs, color) { const ctx = document.getElementById(id); if(!ctx) return; const data = [attrs.for, attrs.agi, attrs.int, attrs.von, attrs.pod]; if(ctx.chart) { ctx.chart.data.datasets[0].data = data; ctx.chart.update(); return; } ctx.chart = new Chart(ctx, { type: 'radar', data: { labels: ['FOR','AGI','INT','VON','POD'], datasets: [{data, backgroundColor: `rgba(${color},0.2)`, borderColor: `rgba(${color},1)`, borderWidth: 2, pointBackgroundColor: '#fff', pointRadius: 3}] }, options: { responsive: true, maintainAspectRatio: false, scales: { r: { min: -1, max: 6, ticks: { display: false }, grid: { color: 'rgba(255,255,255,0.1)' } } }, plugins: { legend: { display: false } } } }); },
        updateRadarChart() { this.renderChart('radarChart', this.char.attrs, '14,165,233'); }, updateWizardChart() { this.renderChart('wizChart', this.wizardData.attrs, '255,255,255'); },
        roll(s) { const arr = new Uint32Array(1); window.crypto.getRandomValues(arr); const n = (arr[0] % s) + 1; const m = parseInt(this.diceMod || 0); this.lastNatural = n; this.lastFaces = s; this.lastRoll = n + m; const time = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}); const formula = `D${s}${m!==0?(m>0?'+'+m:m):''}`; this.diceLog.unshift({id:Date.now(), time, formula, result: this.lastRoll, crit: n===s, fumble: n===1}); if(this.diceLog.length>8) this.diceLog.pop(); this.log(`Rolou D${s}: ${this.lastRoll}`, 'info'); },
        
        // --- UI UTILS ---
        openImageEditor() { document.getElementById('file-input').click(); }, 
        initCropper(e) { const file = e.target.files[0]; if(!file) return; const reader = new FileReader(); reader.onload = (evt) => { document.getElementById('crop-target').src = evt.target.result; this.cropperOpen = true; this.$nextTick(() => { if(this.cropperInstance) this.cropperInstance.destroy(); this.cropperInstance = new Cropper(document.getElementById('crop-target'), { aspectRatio: 1, viewMode: 1 }); }); }; reader.readAsDataURL(file); }, 
        applyCrop() { if(!this.cropperInstance) return; this.char.photo = this.cropperInstance.getCroppedCanvas({width:300, height:300}).toDataURL('image/jpeg', 0.8); this.cropperOpen = false; this.notify('Foto salva.', 'success'); },
        notify(msg, type='info') { const id = Date.now(); this.notifications.push({id, message: msg, type, dismissed: false}); setTimeout(() => { this.notifications = this.notifications.filter(n => n.id !== id); }, 3000); this.log(msg, type); },
        
        // --- SETTINGS UI ---
        toggleSystemLog() { this.configModal = false; this.consoleOpen = !this.consoleOpen; },
        toggleSetting(key, val=null) {
            if(val !== null) {
                this.settings[key] = val;
                if(key === 'themeColor') this.applyTheme(val);
            } else {
                this.settings[key] = !this.settings[key];
                if(key === 'compactMode') document.body.classList.toggle('compact-mode', this.settings.compactMode);
                if(key === 'performanceMode') document.body.classList.toggle('performance-mode', this.settings.performanceMode);
            }
            // Save settings to cloud immediately
            if(!this.isGuest && this.user) {
                this.unsavedChanges = true;
                this.syncCloud(true);
            }
        },
        applyTheme(color) {
            const root = document.documentElement;
            const colors = { 'cyan': '#0ea5e9', 'purple': '#d946ef', 'gold': '#eab308' };
            root.style.setProperty('--neon-core', colors[color] || colors['cyan']);
        },
        toggleFullscreen() {
            if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch(() => {}); this.notify('Tela Cheia', 'info'); } 
            else { if (document.exitFullscreen) { document.exitFullscreen(); } }
        },

        // --- AUTH/DATA ---
        async logout() {
            this.systemLoading = true;
            if(this.unsavedChanges && !this.isGuest) { try { await this.syncCloud(true); } catch(e) {} }
            localStorage.removeItem('zenite_cached_db');
            localStorage.removeItem('zenite_is_guest');
            await supabase.auth.signOut();
            window.location.reload();
        },
        async doSocialAuth(provider) {
            this.authLoading = true;
            const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });
            if (error) { this.notify(error.message, 'error'); this.authLoading = false; }
        },
        
        // --- DATA MGMT ---
        askLogout() { this.askConfirm('SAIR?', 'Dados pendentes serão salvos.', 'warn', () => this.logout()); },
        askSwitchToOnline() { this.askConfirm('FICAR ONLINE?', 'Ir para login.', 'info', () => { this.isGuest = false; localStorage.removeItem('zenite_is_guest'); window.location.reload(); }); },
        enterGuest() { this.isGuest = true; localStorage.setItem('zenite_is_guest', 'true'); this.loadLocalData('zenite_guest_db'); this.sanitizeData(); },
        saveAndExit() { if(this.char && this.activeCharId) { this.chars[this.activeCharId] = JSON.parse(JSON.stringify(this.char)); this.updateAgentCount(); } const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db'; localStorage.setItem(key, JSON.stringify(this.chars)); if (!this.isGuest && this.unsavedChanges) this.syncCloud(true); this.currentView = 'dashboard'; this.activeCharId = null; this.char = null; },
        askDeleteChar(id) { this.askConfirm('ELIMINAR?', 'Irreversível.', 'danger', () => { delete this.chars[id]; this.sanitizeData(); const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db'; localStorage.setItem(key, JSON.stringify(this.chars)); if(!this.isGuest) this.syncCloud(true); this.notify('Deletado.', 'success'); }); },
        askHardReset() { this.askConfirm('LIMPAR TUDO?', 'Remove dados locais.', 'danger', () => { localStorage.clear(); window.location.reload(); }); },
        updateAgentCount() { this.agentCount = Object.keys(this.chars).length; },
        askConfirm(title, desc, type, action) { this.confirmTitle = title; this.confirmDesc = desc; this.confirmType = type; this.confirmAction = action; this.confirmOpen = true; }, confirmYes() { if (this.confirmAction) this.confirmAction(); this.confirmOpen = false; },
        
        // --- IMPORT/EXPORT ---
        exportData() { const s = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.chars)); const a = document.createElement('a'); a.href = s; a.download = `zenite_bkp.json`; a.click(); a.remove(); this.notify('Baixado!', 'success'); },
        triggerFileImport() { document.getElementById('import-file').click(); },
        processImport(e) { const f = e.target.files[0]; if(!f) return; const r = new FileReader(); r.onload = (evt) => { try { const d = JSON.parse(evt.target.result); this.chars = {...this.chars, ...d}; this.sanitizeData(); localStorage.setItem(this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db', JSON.stringify(this.chars)); this.unsavedChanges = true; this.notify('Importado!', 'success'); this.configModal = false; if(this.currentView === 'dashboard') this.updateAgentCount(); } catch(e){ this.notify('Erro arquivo.', 'error'); } }; r.readAsText(f); },
        
        // --- WIZARD ---
        openWizard() { if (this.agentCount >= MAX_AGENTS) return this.notify('Limite atingido.', 'error'); this.wizardOpen = true; this.wizardStep = 1; this.wizardData = { class: '', attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} }; this.wizardPoints = 8; }, selectArchetype(a) { this.wizardData.class = a.class; this.wizardData.attrs = {for:-1, agi:-1, int:-1, von:-1, pod:-1}; this.wizardFocusAttr = a.focus; this.wizardData.attrs[a.focus] = 0; this.wizardStep = 2; this.wizardPoints = 8; setTimeout(()=>this.updateWizardChart(),50); }, modWizardAttr(key, val) { const c = this.wizardData.attrs[key]; const isFocus = key === this.wizardFocusAttr; if (val > 0 && this.wizardPoints > 0 && c < 3) { this.wizardData.attrs[key]++; this.wizardPoints--; } if (val < 0 && c > (isFocus ? 0 : -1)) { this.wizardData.attrs[key]--; this.wizardPoints++; } this.updateWizardChart(); }, finishWizard() { const id = 'z_' + Date.now(); const tempChar = { class: this.wizardData.class, level: 1, attrs: this.wizardData.attrs, stats: { pv:{}, pf:{}, pdf:{} } }; const oldChar = this.char; this.char = tempChar; this.recalcDerivedStats(); this.char = oldChar; const newChar = { id: id, name: '', identity: '', class: this.wizardData.class, level: 1, photo: '', history: '', credits: 0, stats: { pv: { current: tempChar.stats.pv.max, max: tempChar.stats.pv.max }, pf: { current: tempChar.stats.pf.max, max: tempChar.stats.pf.max }, pdf: { current: tempChar.stats.pdf.max, max: tempChar.stats.pdf.max } }, attrs: {...this.wizardData.attrs}, inventory: { weapons: [], armor: [], gear: [], backpack: "", social: {people:[], objects:[]} }, skills: [], powers: { passive: '', active: '', techniques: [], lvl3:'', lvl6:'', lvl9:'', lvl10:'' } }; this.chars[id] = newChar; this.sanitizeData(); const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db'; localStorage.setItem(key, JSON.stringify(this.chars)); if(!this.isGuest) this.syncCloud(true); this.wizardOpen = false; this.loadCharacter(id); this.notify('Agente Inicializado.', 'success'); },
        handleKeys(e) { if (e.ctrlKey && e.shiftKey && e.key === 'D') { e.preventDefault(); this.toggleSystemLog(); } }
    }
}