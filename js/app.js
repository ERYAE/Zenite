/**
 * ZENITE OS - Core Application
 * Version: v46.0-Architecture
 * Author: Zenite Dev Team
 * * Architecture: Service-Based Monolith (Alpine.js)
 * This structure mimics a modular environment. In a build step, 
 * these services would be separate files.
 */

const SUPABASE_URL = 'https://pwjoakajtygmbpezcrix.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_ULe02tKpa38keGvz8bEDIw_mJJaBK6j';

// Safe Supabase Init
const supabase = (typeof window.supabase !== 'undefined') 
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
      })
    : null;

const CONSTANTS = {
    MAX_AGENTS: 30,
    SAVE_INTERVAL: 180000, // 3 minutes
    TOAST_DURATION: 3000
};

function zeniteSystem() {
    return {
        // =========================================================================
        // STATE MANAGEMENT
        // =========================================================================
        state: {
            systemLoading: true,
            user: null,
            isGuest: false,
            loadingChar: false, // Lock mechanism
            
            // UI State
            currentView: 'dashboard',
            activeTab: 'profile',
            logisticsTab: 'inventory',
            userMenuOpen: false,
            diceTrayOpen: true,
            
            // Modals
            configModal: false,
            wizardOpen: false,
            cropperOpen: false,
            confirmOpen: false,
            
            // Feedback
            notifications: [],
            consoleOpen: false,
            sysLogs: [],
            
            // Auth
            authLoading: false,
            authMsg: '',
            
            // Data Sync
            unsavedChanges: false,
            isSyncing: false,
            saveStatus: 'idle'
        },

        // Data Models
        data: {
            chars: {},
            activeCharId: null,
            char: null,
            agentCount: 0,
            searchQuery: '',
            
            // Runtime Settings (Merged from Cloud)
            settings: {
                mouseTrail: true,
                compactMode: false,
                performanceMode: false,
                themeColor: 'cyan'
            }
        },

        // Temporary/Input Data
        inputs: {
            wizardStep: 1,
            wizardPoints: 8,
            wizardData: { class: '', attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} },
            diceMod: 0,
            lastRoll: '--',
            diceLog: []
        },

        // Static Definitions
        defs: {
            archetypes: [
                { class: 'Titã', icon: 'fa-solid fa-shield-halved', focus: 'for', color: 'text-rose-500', desc: 'Resiliência e força bruta.' },
                { class: 'Estrategista', icon: 'fa-solid fa-chess', focus: 'int', color: 'text-cyan-500', desc: 'Análise tática e liderança.' },
                { class: 'Infiltrador', icon: 'fa-solid fa-user-ninja', focus: 'agi', color: 'text-emerald-500', desc: 'Furtividade e precisão.' },
                { class: 'Controlador', icon: 'fa-solid fa-hand-spock', focus: 'pod', color: 'text-violet-500', desc: 'Manipulação de energia.' },
                { class: 'Psíquico', icon: 'fa-solid fa-brain', focus: 'von', color: 'text-amber-500', desc: 'Domínio mental.' }
            ]
        },

        // =========================================================================
        // CORE LIFECYCLE
        // =========================================================================
        async init() {
            this.Services.Logger.info(`SYSTEM BOOT: v46.0`);
            
            // 1. Critical Failsafe
            setTimeout(() => { if(this.state.systemLoading) this.state.systemLoading = false; }, 5000);
            
            // 2. Event Listeners
            window.addEventListener('pageshow', () => this.state.authLoading = false);
            window.addEventListener('beforeunload', (e) => {
                if (this.state.unsavedChanges && !this.state.isGuest) { e.preventDefault(); e.returnValue = ''; }
            });
            
            // 3. Cursor System
            this.Services.UI.initCursor();

            // 4. Data Loading Strategy
            const isGuest = localStorage.getItem('zenite_is_guest') === 'true';
            
            if (isGuest) {
                this.state.isGuest = true;
                this.Services.Data.loadLocal('zenite_guest_db');
                this.state.systemLoading = false;
            } else {
                // Optimistic UI: Load cache first
                this.Services.Data.loadLocal('zenite_cached_db');
                
                if(supabase) {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session) {
                        this.state.user = session.user;
                        await this.Services.Data.fetchCloud();
                    }
                    
                    // Auth State Listener
                    supabase.auth.onAuthStateChange(async (event, session) => {
                        if (event === 'TOKEN_REFRESHED') return;
                        if (event === 'SIGNED_IN' && session) {
                            if (this.state.user?.id === session.user.id) return;
                            this.state.user = session.user;
                            this.state.isGuest = false;
                            localStorage.removeItem('zenite_is_guest');
                            await this.Services.Data.fetchCloud();
                            // Restore settings theme immediately
                            this.Services.UI.applyTheme(this.data.settings.themeColor);
                        } else if (event === 'SIGNED_OUT') {
                            this.state.user = null;
                            this.data.chars = {};
                            this.state.currentView = 'dashboard';
                        }
                    });
                }
                this.state.systemLoading = false;
            }

            // 5. Watchers & Auto-Save
            this.$watch('data.char', (val) => this.Services.Data.onCharChange(val));
            setInterval(() => this.Services.Data.autoSave(), CONSTANTS.SAVE_INTERVAL);
            
            // Apply initial theme
            this.Services.UI.applyTheme(this.data.settings.themeColor);
        },

        // =========================================================================
        // SERVICES (MODULAR LOGIC)
        // =========================================================================
        Services: {
            
            // --- DATA SERVICE: Handle Storage, Sync & State ---
            Data: {
                loadLocal(key) {
                    const local = localStorage.getItem(key);
                    if(local) {
                        try {
                            const parsed = JSON.parse(local);
                            // Separate Config from Chars
                            if(parsed.config) {
                                zenite.data.settings = { ...zenite.data.settings, ...parsed.config };
                                delete parsed.config;
                            }
                            // Filter valid chars
                            const validChars = {};
                            Object.keys(parsed).forEach(k => { if(parsed[k]?.id) validChars[k] = parsed[k]; });
                            zenite.data.chars = validChars;
                            zenite.data.agentCount = Object.keys(validChars).length;
                        } catch(e) {}
                    }
                },

                async fetchCloud() {
                    if (!zenite.state.user || !supabase) return;
                    let { data, error } = await supabase.from('profiles').select('data').eq('id', zenite.state.user.id).single();
                    
                    if (error && error.code === 'PGRST116') {
                        await supabase.from('profiles').insert([{ id: zenite.state.user.id, data: {} }]);
                        data = { data: {} };
                    }

                    if (data) {
                        const cloudData = data.data || {};
                        
                        // Restore Settings
                        if(cloudData.config) {
                            zenite.data.settings = { ...zenite.data.settings, ...cloudData.config };
                            zenite.Services.UI.applyTheme(zenite.data.settings.themeColor);
                        }

                        // Smart Merge Chars
                        let merged = { ...zenite.data.chars };
                        let hasLocalOnly = false;
                        
                        Object.keys(cloudData).forEach(k => {
                            if(k !== 'config') merged[k] = cloudData[k];
                        });

                        // Detect local-only (unsaved) chars
                        Object.keys(zenite.data.chars).forEach(localId => {
                            if (!cloudData[localId] && localId !== 'config') {
                                merged[localId] = zenite.data.chars[localId];
                                hasLocalOnly = true;
                            }
                        });

                        zenite.data.chars = merged;
                        zenite.data.agentCount = Object.keys(merged).length;
                        this.saveLocal(); // Update Cache
                        
                        if (hasLocalOnly) {
                            zenite.state.unsavedChanges = true;
                            this.syncCloud(true);
                        }
                    }
                },

                async syncCloud(silent = false) {
                    const s = zenite.state;
                    if (!s.user || s.isGuest || !s.unsavedChanges || s.isSyncing || !supabase) return;
                    
                    s.isSyncing = true;
                    if(!silent) zenite.Services.UI.notify('Sincronizando...', 'info');

                    try {
                        // Prepare Payload: Chars + Config
                        const payload = { ...zenite.data.chars, config: zenite.data.settings };
                        
                        const { error } = await supabase.from('profiles').upsert({ 
                            id: s.user.id, 
                            data: payload 
                        });

                        if (error) throw error;
                        
                        s.unsavedChanges = false;
                        s.saveStatus = 'success';
                        if(!silent) zenite.Services.UI.notify('Salvo!', 'success');
                        setTimeout(() => { if(s.saveStatus === 'success') s.saveStatus = 'idle'; }, 2000);
                    } catch (e) {
                        s.saveStatus = 'error';
                        if(!silent) zenite.Services.UI.notify('Erro ao salvar.', 'error');
                        zenite.Services.Logger.error(e.message);
                    } finally {
                        s.isSyncing = false;
                    }
                },

                saveLocal() {
                    const key = zenite.state.isGuest ? 'zenite_guest_db' : 'zenite_cached_db';
                    const payload = { ...zenite.data.chars, config: zenite.data.settings };
                    localStorage.setItem(key, JSON.stringify(payload));
                },

                autoSave() {
                    if (zenite.state.user && zenite.state.unsavedChanges && !zenite.state.isSyncing) {
                        this.syncCloud(true);
                    }
                },

                onCharChange(val) {
                    if (zenite.state.loadingChar) return;
                    if (val && zenite.data.activeCharId) {
                        zenite.data.chars[zenite.data.activeCharId] = JSON.parse(JSON.stringify(val));
                        this.saveLocal();
                        if (!zenite.state.isGuest) {
                            zenite.state.unsavedChanges = true;
                            zenite.state.saveStatus = 'idle';
                        }
                        if (zenite.state.activeTab === 'profile') zenite.Services.UI.updateRadarChart();
                    }
                }
            },

            // --- UI SERVICE: Visuals, Themes, Interactions ---
            UI: {
                notify(msg, type='info') {
                    const id = Date.now();
                    zenite.state.notifications.push({id, message: msg, type});
                    setTimeout(() => {
                        zenite.state.notifications = zenite.state.notifications.filter(n => n.id !== id);
                    }, CONSTANTS.TOAST_DURATION);
                },

                initCursor() {
                    const trail = document.getElementById('mouse-trail');
                    if (!trail || !window.matchMedia("(pointer: fine)").matches) return;

                    document.addEventListener('mousemove', (e) => {
                        if(!zenite.data.settings.mouseTrail || zenite.data.settings.performanceMode) {
                            trail.style.opacity = '0';
                            document.body.classList.remove('custom-cursor-active');
                            return;
                        }

                        // Direct assignment for INSTANT feel
                        trail.style.left = (e.clientX - 8) + 'px'; // Center (w-4 = 16px / 2)
                        trail.style.top = (e.clientY - 8) + 'px';
                        trail.style.opacity = '1';
                        
                        document.body.classList.add('custom-cursor-active');

                        // Interactive hover check
                        const target = e.target;
                        if(target && (target.tagName === 'BUTTON' || target.tagName === 'A' || target.tagName === 'INPUT' || target.classList.contains('cursor-pointer'))) {
                            trail.classList.add('hover-active');
                        } else {
                            trail.classList.remove('hover-active');
                        }
                    });

                    document.addEventListener('mouseleave', () => trail.style.opacity = '0');
                },

                applyTheme(color) {
                    const root = document.documentElement;
                    const map = { 'cyan': '#0ea5e9', 'purple': '#d946ef', 'gold': '#eab308' };
                    const hex = map[color] || map['cyan'];
                    root.style.setProperty('--neon-core', hex);
                    
                    // Update Trail Color dynamically
                    const trail = document.getElementById('mouse-trail');
                    if(trail) trail.style.background = `radial-gradient(circle, ${hex}, transparent 70%)`;
                },

                updateRadarChart() {
                    const ctx = document.getElementById('radarChart');
                    if(!ctx || !zenite.data.char) return;
                    
                    const attrs = zenite.data.char.attrs;
                    const dataPoints = [attrs.for, attrs.agi, attrs.int, attrs.von, attrs.pod];
                    const color = getComputedStyle(document.documentElement).getPropertyValue('--neon-core').trim();
                    
                    // Simple hex to rgba conversion for chart
                    const hexToRgb = hex => {
                        const bigint = parseInt(hex.slice(1), 16);
                        return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255].join(',');
                    };
                    const rgb = hexToRgb(color);

                    if(ctx.chart) {
                        ctx.chart.data.datasets[0].data = dataPoints;
                        ctx.chart.data.datasets[0].borderColor = `rgba(${rgb}, 1)`;
                        ctx.chart.data.datasets[0].backgroundColor = `rgba(${rgb}, 0.2)`;
                        ctx.chart.update();
                    } else {
                        ctx.chart = new Chart(ctx, {
                            type: 'radar',
                            data: {
                                labels: ['FOR','AGI','INT','VON','POD'],
                                datasets: [{
                                    data: dataPoints,
                                    backgroundColor: `rgba(${rgb}, 0.2)`,
                                    borderColor: `rgba(${rgb}, 1)`,
                                    borderWidth: 2,
                                    pointBackgroundColor: '#fff',
                                    pointRadius: 3
                                }]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                scales: { r: { min: -1, max: 6, ticks: { display: false }, grid: { color: 'rgba(255,255,255,0.1)' } } },
                                plugins: { legend: { display: false } }
                            }
                        });
                    }
                }
            },

            // --- CALC SERVICE: Game Rules & Logic ---
            Calc: {
                recalcDerivedStats(char) {
                    if(!char) return;
                    
                    // 1. Snapshot Old Max
                    const old = {
                        pv: char.stats.pv.max || 0,
                        pf: char.stats.pf.max || 0,
                        pdf: char.stats.pdf.max || 0
                    };

                    // 2. Calculate New Max
                    const lvl = Math.max(1, parseInt(char.level)||1);
                    const getV = (v) => parseInt(v)||0;
                    const F = getV(char.attrs.for), P = getV(char.attrs.pod), V = getV(char.attrs.von);

                    const newMax = {
                        pv: Math.max(5, (12+F)+((2+F)*(lvl-1))),
                        pf: Math.max(5, (10+P)+((2+P)*(lvl-1))),
                        pdf: Math.max(5, (10+V)+((2+V)*(lvl-1)))
                    };

                    // 3. Apply Delta to Current (If Max increased, Current increases)
                    if (old.pv > 0) char.stats.pv.current = Math.max(0, char.stats.pv.current + (newMax.pv - old.pv));
                    if (old.pf > 0) char.stats.pf.current = Math.max(0, char.stats.pf.current + (newMax.pf - old.pf));
                    if (old.pdf > 0) char.stats.pdf.current = Math.max(0, char.stats.pdf.current + (newMax.pdf - old.pdf));

                    // 4. Set New Max
                    char.stats.pv.max = newMax.pv;
                    char.stats.pf.max = newMax.pf;
                    char.stats.pdf.max = newMax.pdf;
                }
            },
            
            Logger: {
                info(msg) { this.log(msg, 'info'); },
                error(msg) { this.log(msg, 'error'); },
                log(msg, type) {
                    const time = new Date().toLocaleTimeString();
                    zenite.state.sysLogs.unshift({time, msg, type});
                    if(zenite.state.sysLogs.length > 50) zenite.state.sysLogs.pop();
                    console.log(`[${type.toUpperCase()}] ${msg}`);
                }
            }
        },

        // =========================================================================
        // PUBLIC METHODS (Bound to UI)
        // =========================================================================
        
        // Getters Proxy
        get filteredChars() { 
            if (!this.data.searchQuery) return this.data.chars;
            const q = this.data.searchQuery.toLowerCase();
            const r = {};
            Object.keys(this.data.chars).forEach(id => {
                const c = this.data.chars[id];
                if((c.name && c.name.toLowerCase().includes(q)) || (c.class && c.class.toLowerCase().includes(q))) r[id]=c;
            });
            return r;
        },

        // Auth Bridge
        doSocialAuth(p) { 
            this.state.authLoading = true; 
            supabase.auth.signInWithOAuth({provider: p, options: {redirectTo: window.location.origin}})
                .then(({error}) => { if(error) { this.Services.UI.notify(error.message, 'error'); this.state.authLoading = false; } });
        },
        enterGuest() { 
            this.state.isGuest = true; 
            localStorage.setItem('zenite_is_guest', 'true'); 
            this.Services.Data.loadLocal('zenite_guest_db'); 
        },
        logout() {
            if(this.state.unsavedChanges && !this.state.isGuest) this.Services.Data.syncCloud(true);
            localStorage.removeItem('zenite_cached_db');
            localStorage.removeItem('zenite_is_guest');
            if(supabase) supabase.auth.signOut();
            window.location.reload();
        },

        // Character Actions
        loadCharacter(id) {
            if(!this.data.chars[id]) return;
            this.state.loadingChar = true; // Lock
            this.data.activeCharId = id;
            
            requestAnimationFrame(() => {
                this.data.char = JSON.parse(JSON.stringify(this.data.chars[id]));
                // Sanitize
                const c = this.data.char;
                if(!c.inventory) c.inventory = { weapons:[], armor:[], gear:[], backpack: "", social: { people:[], objects:[]} };
                if(!c.skills) c.skills = [];
                if(!c.powers) c.powers = { passive: '', active: '', techniques: [] };
                
                this.state.currentView = 'sheet';
                this.state.activeTab = 'profile';
                
                this.$nextTick(() => {
                    this.Services.UI.updateRadarChart();
                    setTimeout(() => { this.state.loadingChar = false; this.state.unsavedChanges = false; }, 300);
                });
            });
        },
        
        // Modifiers
        modStat(t, v) { 
            const s = this.data.char.stats[t]; 
            s.current = Math.min(Math.max(0, s.current + v), s.max); 
            if(v < 0) this.triggerFX('damage'); 
            if(v > 0) this.triggerFX('heal'); 
        },
        modAttr(key, val) {
            const c = this.data.char;
            if ((val > 0 && c.attrs[key] < 6) || (val < 0 && c.attrs[key] > -1)) {
                c.attrs[key] += val;
                this.Services.Calc.recalcDerivedStats(c);
                this.Services.UI.updateRadarChart();
            }
        },
        recalcDerivedStats() { this.Services.Calc.recalcDerivedStats(this.data.char); },
        
        // Utils
        triggerFX(type) { 
            const el = document.getElementById(type+'-overlay'); 
            if(el) { el.style.opacity='0.4'; setTimeout(()=>el.style.opacity='0', 200); } 
        },
        addItem(cat) {
            const defs = { weapons: { name: 'Arma', dmg: '1d6', range: 'C' }, armor: { name: 'Traje', def: '1', pen: '0' }, gear: { name: 'Item', desc: '', qty: 1 }, social_people: { name: 'Nome', role: 'Relação' }, social_objects: { name: 'Objeto', desc: 'Detalhes' } };
            if(cat.startsWith('social_')) this.data.char.inventory.social[cat.split('_')[1]].push({...defs[cat]});
            else this.data.char.inventory[cat].push({...defs[cat]});
        },
        deleteItem(cat, i, sub=null) { if(sub) this.data.char.inventory.social[sub].splice(i,1); else this.data.char.inventory[cat].splice(i,1); },
        
        // Settings Proxy
        toggleSetting(k, v=null) {
            if(v) {
                this.data.settings[k] = v;
                if(k === 'themeColor') this.Services.UI.applyTheme(v);
            } else {
                this.data.settings[k] = !this.data.settings[k];
                if(k === 'compactMode') document.body.classList.toggle('compact-mode', this.data.settings[k]);
                if(k === 'performanceMode') document.body.classList.toggle('performance-mode', this.data.settings[k]);
            }
            // Save Settings Immediately
            if(this.state.user && !this.state.isGuest) {
                this.state.unsavedChanges = true;
                this.Services.Data.syncCloud(true);
            }
        },
        
        // Dice
        roll(s) {
            const arr = new Uint32Array(1); window.crypto.getRandomValues(arr);
            const n = (arr[0] % s) + 1;
            const m = parseInt(this.inputs.diceMod || 0);
            this.inputs.lastRoll = n + m;
            this.inputs.diceLog.unshift({id: Date.now(), time: new Date().toLocaleTimeString(), formula: `D${s}`, result: n+m, crit: n===s, fumble: n===1});
            if(this.inputs.diceLog.length > 8) this.inputs.diceLog.pop();
        },

        // Wizard Proxy
        openWizard() { if(this.data.agentCount >= CONSTANTS.MAX_AGENTS) return this.Services.UI.notify('Limite atingido.','error'); this.state.wizardOpen=true; this.inputs.wizardStep=1; },
        selectArchetype(a) { this.inputs.wizardData.class=a.class; this.inputs.wizardData.attrs={for:-1,agi:-1,int:-1,von:-1,pod:-1}; this.inputs.wizardData.attrs[a.focus]=0; this.inputs.wizardFocusAttr=a.focus; this.inputs.wizardStep=2; },
        modWizardAttr(k,v) { const c = this.inputs.wizardData.attrs[k]; const isFocus = k===this.inputs.wizardFocusAttr; if(v>0 && this.inputs.wizardPoints>0 && c<3) { this.inputs.wizardData.attrs[k]++; this.inputs.wizardPoints--; } if(v<0 && c>(isFocus?0:-1)) { this.inputs.wizardData.attrs[k]--; this.inputs.wizardPoints++; } },
        finishWizard() {
            const id = 'z_'+Date.now();
            const base = { class: this.inputs.wizardData.class, level: 1, attrs: this.inputs.wizardData.attrs, stats: { pv:{}, pf:{}, pdf:{} } };
            // Calc initial stats
            const f = (v) => parseInt(v);
            const F=f(base.attrs.for), P=f(base.attrs.pod), V=f(base.attrs.von);
            const pv = 12+F, pf = 10+P, pdf = 10+V;
            
            const newChar = {
                id, name: '', identity: '', class: base.class, level: 1, photo: '', history: '', credits: 0,
                attrs: {...base.attrs},
                stats: { pv: {current: pv, max: pv}, pf: {current: pf, max: pf}, pdf: {current: pdf, max: pdf} },
                inventory: { weapons:[], armor:[], gear:[], backpack:"", social:{people:[], objects:[]} },
                skills: [], powers: { passive:'', active:'', techniques:[], lvl3:'', lvl6:'', lvl9:'', lvl10:'' }
            };
            this.data.chars[id] = newChar;
            this.Services.Data.saveLocal();
            if(!this.state.isGuest) { this.state.unsavedChanges = true; this.Services.Data.syncCloud(true); }
            this.state.wizardOpen = false;
            this.loadCharacter(id);
        },

        // Map to View
        get user() { return this.state.user; },
        set user(v) { this.state.user = v; },
        get isGuest() { return this.state.isGuest; },
        set isGuest(v) { this.state.isGuest = v; },
        get systemLoading() { return this.state.systemLoading; },
        get activeCharId() { return this.data.activeCharId; },
        get char() { return this.data.char; },
        set char(v) { this.data.char = v; },
        get agentCount() { return this.data.agentCount; },
        get settings() { return this.data.settings; },
        get diceLog() { return this.inputs.diceLog; },
        get lastRoll() { return this.inputs.lastRoll; },
        get consoleOpen() { return this.state.consoleOpen; },
        set consoleOpen(v) { this.state.consoleOpen = v; },
        get sysLogs() { return this.state.sysLogs; },
        
        // Expose simple UI state props directly
        ...['currentView', 'activeTab', 'logisticsTab', 'userMenuOpen', 'loadingChar', 'diceTrayOpen', 'authLoading', 'authMsg', 'notifications', 'configModal', 'confirmOpen', 'unsavedChanges', 'isSyncing', 'saveStatus', 'showDiceLog', 'wizardOpen', 'wizardStep', 'wizardData', 'wizardPoints', 'wizardFocusAttr', 'cropperOpen'].reduce((acc, key) => {
            Object.defineProperty(acc, key, {
                get() { return this.state[key] || this.inputs[key]; },
                set(v) { if(key in this.state) this.state[key] = v; else this.inputs[key] = v; }
            });
            return acc;
        }, {})
    };
}

// Initialize global scope for compatibility
const zenite = zeniteSystem();