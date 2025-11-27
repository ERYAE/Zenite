/**
 * ZENITE OS - Core Application
 * Version: v48.1-Stable
 * Architecture: Flat-Service Pattern (Refactored)
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
    SAVE_INTERVAL: 180000, // 3 min
    TOAST_DURATION: 3000
};

function zeniteSystem() {
    return {
        // =========================================================================
        // 1. STATE MANAGEMENT
        // =========================================================================
        
        // System
        systemLoading: true,
        loadingChar: false,
        consoleOpen: false,
        sysLogs: [],
        notifications: [],
        
        // User & Auth
        user: null,
        isGuest: false,
        userMenuOpen: false,
        authLoading: false, 
        authMsg: '', 
        authMsgType: '',
        
        // Data & Navigation
        chars: {},
        activeCharId: null,
        char: null,
        agentCount: 0,
        currentView: 'dashboard',
        activeTab: 'profile',
        logisticsTab: 'inventory',
        searchQuery: '',
        
        // UI Elements
        diceTrayOpen: true,
        showDiceLog: false,
        diceLog: [],
        lastRoll: '--',
        lastFaces: 20,
        diceMod: 0,
        
        // Modals
        configModal: false,
        wizardOpen: false, 
        cropperOpen: false,
        confirmOpen: false,
        confirmData: { title:'', desc:'', action:null, type:'danger' },
        
        // Wizard Temp Data
        wizardStep: 1,
        wizardPoints: 8,
        wizardData: { class: '', attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} },
        wizardFocusAttr: '',
        
        // Settings
        settings: {
            mouseTrail: true,
            compactMode: false,
            performanceMode: false,
            themeColor: 'cyan'
        },
        
        // Sync State
        unsavedChanges: false,
        isSyncing: false,
        saveStatus: 'idle',

        // Static Data
        archetypes: [
            { class: 'Titã', icon: 'fa-solid fa-shield-halved', focus: 'for', color: 'text-rose-500', desc: 'Resiliência e força bruta.' },
            { class: 'Estrategista', icon: 'fa-solid fa-chess', focus: 'int', color: 'text-cyan-500', desc: 'Análise tática e liderança.' },
            { class: 'Infiltrador', icon: 'fa-solid fa-user-ninja', focus: 'agi', color: 'text-emerald-500', desc: 'Furtividade e precisão.' },
            { class: 'Controlador', icon: 'fa-solid fa-hand-spock', focus: 'pod', color: 'text-violet-500', desc: 'Manipulação de energia.' },
            { class: 'Psíquico', icon: 'fa-solid fa-brain', focus: 'von', color: 'text-amber-500', desc: 'Domínio mental.' }
        ],

        // =========================================================================
        // 2. COMPUTED PROPERTIES
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
        // 3. INITIALIZATION (Critical Auth Fixes)
        // =========================================================================
        async initSystem() {
            this.log(`ZENITE CORE INIT...`);
            
            // 1. Setup PageShow for Cache Busting (Zombie State Fix)
            window.addEventListener('pageshow', (event) => {
                if (event.persisted) window.location.reload();
            });

            // 2. Setup Cursor
            this.setupCursor();
            this.setupWatchers();

            // 3. Auth & Data Flow
            const isGuest = localStorage.getItem('zenite_is_guest') === 'true';
            
            if (isGuest) {
                this.isGuest = true;
                this.loadLocal('zenite_guest_db');
                this.systemLoading = false;
            } else {
                // Optimistic Local Load
                this.loadLocal('zenite_cached_db'); 
                
                if(supabase) {
                    try {
                        // CRITICAL: Await session before turning off loader
                        const { data: { session }, error } = await supabase.auth.getSession();
                        
                        if (session) {
                            this.user = session.user;
                            this.isGuest = false;
                            localStorage.removeItem('zenite_is_guest');
                            await this.fetchCloud(); // Get fresh data
                        }
                        
                        // Listener for future changes
                        supabase.auth.onAuthStateChange(async (event, session) => {
                            if (event === 'TOKEN_REFRESHED') return;
                            if (event === 'SIGNED_IN' && session) {
                                if (this.user?.id === session.user.id) return;
                                this.user = session.user;
                                this.isGuest = false;
                                this.systemLoading = true; // Show loader during switch
                                await this.fetchCloud();
                                this.systemLoading = false;
                            } else if (event === 'SIGNED_OUT') {
                                this.user = null;
                                this.chars = {};
                                this.currentView = 'dashboard';
                                localStorage.removeItem('zenite_cached_db');
                            }
                        });

                    } catch(e) {
                        this.log('Supabase Init Error: ' + e.message, 'error');
                    }
                }
                
                this.systemLoading = false; // Safe to turn off loader now
            }

            // 4. Apply Initial Settings
            this.applyTheme(this.settings.themeColor);
            this.updateAgentCount();
            
            // 5. Auto Save Loop
            setInterval(() => { 
                if (this.user && this.unsavedChanges && !this.isSyncing) this.syncCloud(true);
            }, CONSTANTS.SAVE_INTERVAL);
        },

        // =========================================================================
        // 4. CORE SERVICES
        // =========================================================================

        // --- SERVICE: UI & CURSOR ---
        setupCursor() {
            const trail = document.getElementById('mouse-trail');
            if (!window.matchMedia("(pointer: fine)").matches) {
                if(trail) trail.style.display = 'none';
                return;
            }

            let mouseX = 0, mouseY = 0;
            
            // Direct event for instant response
            document.addEventListener('mousemove', (e) => { 
                mouseX = e.clientX; 
                mouseY = e.clientY;
                
                // Interactive Hover States
                const target = e.target;
                const isClickable = target.tagName === 'BUTTON' || target.tagName === 'A' || target.tagName === 'INPUT' || 
                                  target.tagName === 'SELECT' || target.tagName === 'TEXTAREA' || target.classList.contains('cursor-pointer');
                
                if(trail) {
                    // Direct position update for "Instant" feel
                    trail.style.left = mouseX + 'px';
                    trail.style.top = mouseY + 'px';
                    trail.style.opacity = '1';
                    
                    if(isClickable) trail.classList.add('hover-active');
                    else trail.classList.remove('hover-active');
                }
                
                // Add class to body to hide default cursor if needed
                if(this.settings.mouseTrail) document.body.classList.add('custom-cursor-active');
            });
        },

        setupWatchers() {
            this.$watch('char', (val) => {
                if (this.loadingChar) return;
                if (val && this.activeCharId) {
                    this.chars[this.activeCharId] = JSON.parse(JSON.stringify(val));
                    this.saveLocal();
                    if (!this.isGuest) { 
                        this.unsavedChanges = true; 
                        this.saveStatus = 'idle'; 
                    }
                    if (this.activeTab === 'profile') this.updateRadarChart();
                }
            }, {deep: true});
        },

        updateAgentCount() {
            this.agentCount = Object.keys(this.chars).length;
        },

        // --- SERVICE: DATA PERSISTENCE ---
        loadLocal(key) {
            const local = localStorage.getItem(key);
            if(local) {
                try {
                    const parsed = JSON.parse(local);
                    // Merge Config
                    if(parsed.config) {
                        this.settings = { ...this.settings, ...parsed.config };
                        this.applyTheme(this.settings.themeColor);
                        this.toggleSetting('compactMode', this.settings.compactMode);
                    }
                    // Extract Chars
                    const validChars = {};
                    Object.keys(parsed).forEach(k => { 
                        if(k !== 'config' && parsed[k]?.id) validChars[k] = parsed[k]; 
                    });
                    this.chars = validChars;
                    this.updateAgentCount();
                } catch(e) {
                    console.error("Cache corrupted", e);
                }
            }
        },

        saveLocal() {
            const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db';
            const payload = { ...this.chars, config: this.settings };
            localStorage.setItem(key, JSON.stringify(payload));
        },

        async fetchCloud() {
            if (!this.user || !supabase) return;
            
            // Fetch profile data
            let { data, error } = await supabase.from('profiles').select('data').eq('id', this.user.id).single();
            
            if (error && error.code === 'PGRST116') {
                // Profile doesn't exist, create it
                await supabase.from('profiles').insert([{ id: this.user.id, data: { config: this.settings } }]);
                data = { data: { config: this.settings } };
            }

            if (data && data.data) {
                const cloudData = data.data;
                
                // 1. Sync Settings
                if(cloudData.config) {
                    this.settings = { ...this.settings, ...cloudData.config };
                    this.applyTheme(this.settings.themeColor);
                }

                // 2. Merge Chars (Cloud wins, but keep local new ones)
                let merged = { ...this.chars }; 
                let hasLocalChanges = false;
                
                // Add Cloud Items to Map
                Object.keys(cloudData).forEach(k => {
                    if(k !== 'config') merged[k] = cloudData[k];
                });

                this.chars = merged;
                this.updateAgentCount();
                this.saveLocal();
            }
        },

        async syncCloud(silent = false) {
            if (!this.user || this.isGuest || !this.unsavedChanges || this.isSyncing || !supabase) return;
            
            this.isSyncing = true;
            if(!silent) this.notify('Sincronizando...', 'info');

            try {
                const payload = { ...this.chars, config: this.settings };
                const { error } = await supabase.from('profiles').upsert({ 
                    id: this.user.id, 
                    data: payload 
                });

                if (error) throw error;
                
                this.unsavedChanges = false;
                this.saveStatus = 'success';
                if(!silent) this.notify('Salvo na nuvem.', 'success');
            } catch (e) {
                this.saveStatus = 'error';
                if(!silent) this.notify('Erro ao salvar: ' + e.message, 'error');
            } finally {
                this.isSyncing = false;
            }
        },

        // --- SERVICE: LOGIC & MATH ---
        recalcDerivedStats() { 
            if(!this.char) return; 
            const c = this.char; 
            
            const oldPv = c.stats.pv.max || 0;
            const oldPf = c.stats.pf.max || 0;
            const oldPdf = c.stats.pdf.max || 0;

            const lvl = Math.max(1, parseInt(c.level)||1); 
            const getV = (v) => parseInt(v)||0; 
            const FOR = getV(c.attrs.for), POD = getV(c.attrs.pod), VON = getV(c.attrs.von); 
            
            // Formula
            const newPv = Math.max(5, (12+FOR)+((2+FOR)*(lvl-1))); 
            const newPf = Math.max(5, (10+POD)+((2+POD)*(lvl-1))); 
            const newPdf = Math.max(5, (10+VON)+((2+VON)*(lvl-1))); 

            // Apply Delta (Keep damage, just increase max)
            if (oldPv > 0) c.stats.pv.current = Math.max(0, c.stats.pv.current + (newPv - oldPv));
            else c.stats.pv.current = newPv;

            if (oldPf > 0) c.stats.pf.current = Math.max(0, c.stats.pf.current + (newPf - oldPf));
            else c.stats.pf.current = newPf;

            if (oldPdf > 0) c.stats.pdf.current = Math.max(0, c.stats.pdf.current + (newPdf - oldPdf));
            else c.stats.pdf.current = newPdf;

            c.stats.pv.max = newPv;
            c.stats.pf.max = newPf;
            c.stats.pdf.max = newPdf;
        },

        modAttr(key, val) {
            const c = this.char;
            const current = c.attrs[key];
            if ((val > 0 && current < 6) || (val < 0 && current > -1)) {
                c.attrs[key] += val;
                this.recalcDerivedStats();
                this.updateRadarChart();
            }
        },

        // =========================================================================
        // 5. ACTIONS
        // =========================================================================
        
        // --- WIZARD ACTIONS ---
        openWizard() { 
            if(this.agentCount >= CONSTANTS.MAX_AGENTS) return this.notify('Limite de agentes atingido.', 'error');
            
            this.wizardStep = 1;
            this.wizardPoints = 8;
            this.wizardData = { class: '', attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} };
            this.wizardFocusAttr = '';
            
            this.wizardOpen = true; 
        },

        selectArchetype(a) { 
            this.wizardData.class = a.class; 
            this.wizardData.attrs = {for:-1, agi:-1, int:-1, von:-1, pod:-1}; 
            this.wizardData.attrs[a.focus] = 0; 
            this.wizardFocusAttr = a.focus; 
            this.wizardStep = 2; 
            
            // Wait for DOM then Render Chart
            this.$nextTick(() => {
                this.updateWizardChart();
            });
        },

        modWizardAttr(k,v) { 
            const c = this.wizardData.attrs[k]; 
            const f = k === this.wizardFocusAttr; 
            
            // Increase
            if(v > 0 && this.wizardPoints > 0 && c < 3) { 
                this.wizardData.attrs[k]++; 
                this.wizardPoints--; 
                this.updateWizardChart();
            } 
            // Decrease
            if(v < 0 && c > (f?0:-1)) { 
                this.wizardData.attrs[k]--; 
                this.wizardPoints++; 
                this.updateWizardChart();
            } 
        },

        finishWizard() {
            const id = 'z_'+Date.now();
            const base = { class: this.wizardData.class, level: 1, attrs: this.wizardData.attrs };
            
            const getV = (v) => parseInt(v);
            const F=getV(base.attrs.for), P=getV(base.attrs.pod), V=getV(base.attrs.von);
            const pv = 12+F, pf = 10+P, pdf = 10+V;
            
            const newChar = {
                id, name: '', identity: '', class: base.class, level: 1, photo: '', history: '', credits: 0,
                attrs: {...base.attrs},
                stats: { pv: {current: pv, max: pv}, pf: {current: pf, max: pf}, pdf: {current: pdf, max: pdf} },
                inventory: { weapons:[], armor:[], gear:[], backpack:"", social:{people:[], objects:[]} },
                skills: [], powers: { passive:'', active:'', techniques:[], lvl3:'', lvl6:'', lvl9:'', lvl10:'' }
            };
            
            this.chars[id] = newChar;
            this.updateAgentCount();
            this.saveLocal();
            
            if(!this.isGuest) { 
                this.unsavedChanges = true; 
                this.syncCloud(true); 
            }
            
            this.wizardOpen = false;
            this.loadCharacter(id);
            this.notify('Agente Inicializado.', 'success');
        },
        
        // --- SETTINGS ACTIONS ---
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
            // Save settings immediately
            this.saveLocal();
            if(!this.isGuest && this.user) { this.unsavedChanges = true; this.syncCloud(true); }
        },
        applyTheme(color) {
            const root = document.documentElement;
            const map = { 'cyan': '#0ea5e9', 'purple': '#d946ef', 'gold': '#eab308' };
            const hex = map[color] || map['cyan'];
            root.style.setProperty('--neon-core', hex);
            
            // Adjust Trail
            const trail = document.getElementById('mouse-trail');
            if(trail) trail.style.background = `radial-gradient(circle, ${hex}, transparent 70%)`;
        },
        toggleFullscreen() {
            if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch(()=>{}); } 
            else if (document.exitFullscreen) { document.exitFullscreen(); }
        },

        // --- DIAGNOSTICS ---
        handleKeys(e) { if (e.ctrlKey && e.shiftKey && e.key === 'D') { e.preventDefault(); this.toggleSystemLog(); } },
        log(msg, type='info') {
            const time = new Date().toLocaleTimeString();
            this.sysLogs.unshift({time, msg, type});
            if(this.sysLogs.length > 50) this.sysLogs.pop();
            if(type==='error') console.error(msg);
            else console.log(`[${type.toUpperCase()}] ${msg}`);
        },

        // --- AUTH ACTIONS ---
        async logout() {
            this.systemLoading = true;
            if(this.unsavedChanges && !this.isGuest) { 
                try { await this.syncCloud(true); } catch(e) {} 
            }
            
            if(supabase) await supabase.auth.signOut();
            
            localStorage.removeItem('zenite_cached_db');
            localStorage.removeItem('zenite_is_guest');
            window.location.reload();
        },
        askLogout() { this.askConfirm('SAIR?', 'Dados pendentes serão salvos.', 'warn', () => this.logout()); },
        askSwitchToOnline() { this.askConfirm('FICAR ONLINE?', 'Você precisará fazer login.', 'info', () => { this.isGuest = false; localStorage.removeItem('zenite_is_guest'); window.location.reload(); }); },
        enterGuest() { this.isGuest = true; localStorage.setItem('zenite_is_guest', 'true'); this.loadLocal('zenite_guest_db'); },
        async doSocialAuth(provider) {
            if(!supabase) return this.notify("Erro de conexão.", "error");
            this.authLoading = true;
            this.authMsg = 'Redirecionando...';
            const {error} = await supabase.auth.signInWithOAuth({ 
                provider, 
                options: { redirectTo: window.location.origin } 
            });
            if(error) { 
                this.notify(error.message, 'error'); 
                this.authLoading = false; 
                this.authMsg = ''; 
            }
        },

        // --- CHARACTER SHEET ACTIONS ---
        saveAndExit() { 
            if(this.char && this.activeCharId) { 
                this.chars[this.activeCharId] = JSON.parse(JSON.stringify(this.char)); 
                this.updateAgentCount();
            } 
            this.saveLocal();
            if (!this.isGuest && this.unsavedChanges) this.syncCloud(true); 
            this.currentView = 'dashboard'; 
            this.activeCharId = null; 
            this.char = null; 
        },
        
        loadCharacter(id) {
            if(!this.chars[id]) return this.notify('Erro ao carregar.', 'error');
            this.loadingChar = true;
            this.activeCharId = id;
            
            requestAnimationFrame(() => {
                this.char = JSON.parse(JSON.stringify(this.chars[id]));
                // Ensure defaults exist for legacy saves
                const c = this.char;
                if(!c.inventory) c.inventory = { weapons:[], armor:[], gear:[], backpack: "", social: { people:[], objects:[]} }; 
                if(!c.skills) c.skills = []; 
                if(!c.powers) c.powers = { passive: '', active: '', techniques: [] }; 
                if(!c.stats) c.stats = { pv: {current:10, max:10}, pf: {current:10, max:10}, pdf: {current:10, max:10} }; 

                this.currentView = 'sheet';
                this.activeTab = 'profile';
                
                this.$nextTick(() => {
                    this.updateRadarChart();
                    setTimeout(() => { this.loadingChar = false; this.unsavedChanges = false; }, 300);
                });
            });
        },

        askDeleteChar(id) { 
            this.askConfirm('ELIMINAR?', 'Esta ação é irreversível.', 'danger', () => { 
                delete this.chars[id]; 
                this.updateAgentCount();
                this.saveLocal(); 
                if(!this.isGuest) this.syncCloud(true); 
                this.notify('Agente eliminado.', 'success'); 
            }); 
        },
        askHardReset() { this.askConfirm('LIMPAR TUDO?', 'Apaga cache local.', 'danger', () => { localStorage.clear(); window.location.reload(); }); },
        askConfirm(title, desc, type, action) { this.confirmData = { title, desc, type, action }; this.confirmOpen = true; }, 
        confirmYes() { if (this.confirmData.action) this.confirmData.action(); this.confirmOpen = false; },

        // --- CHARTS & VISUALS ---
        _generateChart(canvasId, data, isWizard=false) {
            const ctx = document.getElementById(canvasId);
            if(!ctx) return;
            
            const color = getComputedStyle(document.documentElement).getPropertyValue('--neon-core').trim();
            const hexToRgb = hex => {
                if(!hex) return '14, 165, 233'; // Fallback
                return [(parseInt(hex.slice(1), 16) >> 16) & 255, (parseInt(hex.slice(1), 16) >> 8) & 255, parseInt(hex.slice(1), 16) & 255].join(',');
            };
            const rgb = hexToRgb(color);

            // Destroy prev chart if exists to avoid overlay
            if(ctx.chartInstance) {
                ctx.chartInstance.destroy();
            }

            // Create new
            ctx.chartInstance = new Chart(ctx, {
                type: 'radar',
                data: { 
                    labels: ['FOR','AGI','INT','VON','POD'], 
                    datasets: [{ 
                        data: data, 
                        backgroundColor: `rgba(${rgb}, 0.2)`, 
                        borderColor: `rgba(${rgb}, 1)`, 
                        borderWidth: 2, 
                        pointBackgroundColor: '#fff', 
                        pointRadius: isWizard ? 4 : 3 
                    }] 
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false, 
                    scales: { 
                        r: { 
                            min: isWizard ? -1 : -1, 
                            max: isWizard ? 4 : 6, 
                            ticks: { display: false }, 
                            grid: { color: 'rgba(255,255,255,0.1)' },
                            angleLines: { color: 'rgba(255,255,255,0.1)' }
                        } 
                    }, 
                    plugins: { legend: { display: false } },
                    animation: isWizard ? { duration: 200 } : { duration: 1000 }
                }
            });
        },

        updateRadarChart() {
            if(!this.char) return;
            const d = [this.char.attrs.for, this.char.attrs.agi, this.char.attrs.int, this.char.attrs.von, this.char.attrs.pod];
            this._generateChart('radarChart', d);
        },

        updateWizardChart() {
            const d = [this.wizardData.attrs.for, this.wizardData.attrs.agi, this.wizardData.attrs.int, this.wizardData.attrs.von, this.wizardData.attrs.pod];
            this._generateChart('wizardChart', d, true);
        },
        
        // --- INVENTORY & SKILLS ---
        addItem(cat) { 
            const defs = { 
                weapons: { name: 'Arma', dmg: '1d6', range: 'C' }, 
                armor: { name: 'Traje', def: '1', pen: '0' }, 
                gear: { name: 'Item', desc: '', qty: 1 }, 
                social_people: { name: 'Nome', role: 'Relação' }, 
                social_objects: { name: 'Objeto', desc: 'Detalhes' } 
            }; 
            if(cat.startsWith('social_')) this.char.inventory.social[cat.split('_')[1]].push({...defs[cat]}); 
            else this.char.inventory[cat].push({...defs[cat]}); 
        },
        deleteItem(cat, i, sub=null) { 
            if(sub) this.char.inventory.social[sub].splice(i,1); 
            else this.char.inventory[cat].splice(i,1); 
        },
        addSkill() { this.char.skills.push({name:'Nova Perícia', level:1}); }, 
        deleteSkill(idx) { this.char.skills.splice(idx,1); }, 
        setSkillLevel(idx, l) { this.char.skills[idx].level = l; },
        addTechnique() { this.char.powers.techniques.push({name:'Técnica', desc:''}); }, 
        deleteTechnique(idx) { this.char.powers.techniques.splice(idx,1); },

        // --- DICE ROLLER ---
        roll(s) {
            const arr = new Uint32Array(1); 
            window.crypto.getRandomValues(arr);
            const n = (arr[0] % s) + 1;
            const m = parseInt(this.diceMod || 0);
            
            this.lastFaces = s;
            this.lastRoll = n + m;
            
            const rollObj = {
                id: Date.now(), 
                time: new Date().toLocaleTimeString(), 
                formula: `D${s}${m!==0 ? (m>0?'+'+m:m) : ''}`, 
                result: n+m, 
                crit: n===s, 
                fumble: n===1
            };
            
            this.diceLog.unshift(rollObj);
            if(this.diceLog.length > 20) this.diceLog.pop();
            this.log(`Rolou D${s}: ${rollObj.result}`, 'info');
        },

        // --- UTILS & FILES ---
        notify(msg, type='info') { 
            const id = Date.now(); 
            this.notifications.push({id, message: msg, type}); 
            setTimeout(() => { this.notifications = this.notifications.filter(n => n.id !== id); }, CONSTANTS.TOAST_DURATION); 
        },
        
        openImageEditor() { document.getElementById('file-input').click(); }, 
        
        initCropper(e) { 
            const file = e.target.files[0]; 
            if(!file) return; 
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
        }, 
        
        applyCrop() { 
            if(!this.cropperInstance) return; 
            this.char.photo = this.cropperInstance.getCroppedCanvas({width:300, height:300}).toDataURL('image/jpeg', 0.8); 
            this.cropperOpen = false; 
            this.notify('Foto salva.', 'success'); 
        },
        
        exportData() { 
            const s = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.chars)); 
            const a = document.createElement('a'); 
            a.href = s; 
            a.download = `zenite_bkp_${new Date().toISOString().slice(0,10)}.json`; 
            a.click(); 
            a.remove(); 
            this.notify('Backup baixado.', 'success'); 
        },
        
        triggerFileImport() { document.getElementById('import-file').click(); },
        
        processImport(e) { 
            const f = e.target.files[0]; 
            if(!f) return; 
            const r = new FileReader(); 
            r.onload = (evt) => { 
                try { 
                    const d = JSON.parse(evt.target.result); 
                    this.chars = {...this.chars, ...d}; 
                    this.updateAgentCount();
                    this.saveLocal(); 
                    this.unsavedChanges = true; 
                    this.notify('Importado com sucesso!', 'success'); 
                    this.configModal = false; 
                } catch(e){ 
                    this.notify('Arquivo inválido.', 'error'); 
                } 
            }; 
            r.readAsText(f); 
        }
    };
}