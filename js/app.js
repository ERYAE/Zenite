/**
 * ZENITE OS - Core Application
 * Version: v47.0-Stable-Refactor
 * Architecture: Flat-Service Pattern (Alpine.js Compatible)
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
        // 1. STATE MANAGEMENT (Reactive Data)
        // =========================================================================
        
        // System
        systemLoading: true,
        loadingChar: false,
        consoleOpen: false,
        sysLogs: [],
        
        // User & Auth
        user: null,
        isGuest: false,
        userMenuOpen: false,
        authLoading: false, 
        authMsg: '', 
        
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
        
        // Settings (Persistent)
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
        // 3. INITIALIZATION
        // =========================================================================
        async initSystem() {
            // Failsafe: Garante que o loading suma mesmo se der erro
            setTimeout(() => { if(this.systemLoading) this.systemLoading = false; }, 4000);
            
            this.log(`SYSTEM INIT`, 'info');
            this.authLoading = false;

            // Setup Global Handlers
            this.setupCursor();
            this.setupWatchers();

            // Load Data Strategy
            const isGuest = localStorage.getItem('zenite_is_guest') === 'true';
            
            if (isGuest) {
                this.isGuest = true;
                this.loadLocal('zenite_guest_db');
                this.systemLoading = false;
            } else {
                this.loadLocal('zenite_cached_db'); // Optimistic Load
                
                if(supabase) {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session) {
                        this.user = session.user;
                        await this.fetchCloud();
                    }
                    
                    // Auth Listener
                    supabase.auth.onAuthStateChange(async (event, session) => {
                        if (event === 'TOKEN_REFRESHED') return;
                        if (event === 'SIGNED_IN' && session) {
                            if (this.user?.id === session.user.id) return;
                            this.user = session.user;
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
                this.systemLoading = false;
            }

            // Apply Settings
            this.applyTheme(this.settings.themeColor);
            if(this.settings.compactMode) document.body.classList.add('compact-mode');
            
            // Auto Save
            setInterval(() => { 
                if (this.user && this.unsavedChanges && !this.isSyncing) this.syncCloud(true);
            }, CONSTANTS.SAVE_INTERVAL);
        },

        // =========================================================================
        // 4. CORE SERVICES (UI, DATA, AUTH)
        // =========================================================================

        // --- UI & CURSOR ---
        setupCursor() {
            const trail = document.getElementById('mouse-trail');
            // Só ativa se não for touch
            if (!window.matchMedia("(pointer: fine)").matches) {
                if(trail) trail.style.display = 'none';
                return;
            }

            let mouseX = 0, mouseY = 0, trailX = 0, trailY = 0;
            
            document.addEventListener('mousemove', (e) => { 
                mouseX = e.clientX; 
                mouseY = e.clientY;
                
                // Interatividade do cursor
                const target = e.target;
                if(trail && target && (target.tagName === 'BUTTON' || target.tagName === 'A' || target.tagName === 'INPUT' || target.classList.contains('cursor-pointer'))) {
                    trail.classList.add('hover-active');
                } else if(trail) {
                    trail.classList.remove('hover-active');
                }
            });

            const animate = () => {
                if (this.settings.mouseTrail && !this.settings.performanceMode && trail) {
                    trailX += (mouseX - trailX) * 0.5; // Sem delay perceptível
                    trailY += (mouseY - trailY) * 0.5;
                    trail.style.transform = `translate(${trailX - 8}px, ${trailY - 8}px)`;
                    trail.style.opacity = '1';
                    document.body.classList.add('custom-cursor-active');
                } else {
                    if(trail) trail.style.opacity = '0';
                    document.body.classList.remove('custom-cursor-active');
                }
                requestAnimationFrame(animate);
            };
            animate();
        },

        setupWatchers() {
            this.$watch('char', (val) => {
                if (this.loadingChar) return;
                if (val && this.activeCharId) {
                    this.chars[this.activeCharId] = JSON.parse(JSON.stringify(val));
                    this.saveLocal(); // Local backup instantâneo
                    
                    if (!this.isGuest) { 
                        this.unsavedChanges = true; 
                        this.saveStatus = 'idle'; 
                    }
                    if (this.activeTab === 'profile') this.updateRadarChart();
                }
            }); // Removed { deep: true } usage and let Alpine handle it, or ensure shallow watch is sufficient if structure is replaced
             // Actually, for object mutation, deep watch is implicit in Alpine x-model, but explicit $watch needs {deep:true} for objects.
             // Adding back the deep config properly:
             this.$watch('char', (val) => {
                if (this.loadingChar) return;
                if (val && this.activeCharId) {
                   this.chars[this.activeCharId] = JSON.parse(JSON.stringify(val));
                   this.saveLocal();
                   if (!this.isGuest) { this.unsavedChanges = true; this.saveStatus = 'idle'; }
                   if (this.activeTab === 'profile') this.updateRadarChart();
                }
             }, {deep: true});
        },

        // --- DATA PERSISTENCE ---
        loadLocal(key) {
            const local = localStorage.getItem(key);
            if(local) {
                try {
                    const parsed = JSON.parse(local);
                    if(parsed.config) {
                        this.settings = { ...this.settings, ...parsed.config };
                        delete parsed.config;
                    }
                    // Clean chars
                    const validChars = {};
                    Object.keys(parsed).forEach(k => { if(parsed[k]?.id) validChars[k] = parsed[k]; });
                    this.chars = validChars;
                    this.agentCount = Object.keys(validChars).length;
                } catch(e) {}
            }
        },

        saveLocal() {
            const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db';
            const payload = { ...this.chars, config: this.settings };
            localStorage.setItem(key, JSON.stringify(payload));
        },

        async fetchCloud() {
            if (!this.user || !supabase) return;
            let { data, error } = await supabase.from('profiles').select('data').eq('id', this.user.id).single();
            
            if (error && error.code === 'PGRST116') {
                await supabase.from('profiles').insert([{ id: this.user.id, data: {} }]);
                data = { data: {} };
            }

            if (data) {
                const cloudData = data.data || {};
                
                // Load Settings
                if(cloudData.config) {
                    this.settings = { ...this.settings, ...cloudData.config };
                    this.applyTheme(this.settings.themeColor);
                    this.toggleSetting('compactMode', this.settings.compactMode);
                }

                // Merge Data
                let merged = { ...this.chars };
                let hasLocalOnly = false;
                
                Object.keys(cloudData).forEach(k => {
                    if(k !== 'config') merged[k] = cloudData[k];
                });

                // Keep unsaved local chars
                Object.keys(this.chars).forEach(localId => {
                    if (!cloudData[localId] && localId !== 'config') {
                        merged[localId] = this.chars[localId];
                        hasLocalOnly = true;
                    }
                });

                this.chars = merged;
                this.agentCount = Object.keys(merged).length;
                this.saveLocal();
                
                if (hasLocalOnly) {
                    this.unsavedChanges = true;
                    this.syncCloud(true);
                }
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
                if(!silent) this.notify('Salvo!', 'success');
                setTimeout(() => { if(this.saveStatus === 'success') this.saveStatus = 'idle'; }, 2000);
            } catch (e) {
                this.saveStatus = 'error';
                if(!silent) this.notify('Erro ao salvar.', 'error');
            } finally {
                this.isSyncing = false;
            }
        },

        // --- LOGIC & CALCULATIONS ---
        recalcDerivedStats() { 
            if(!this.char) return; 
            const c = this.char; 
            
            // 1. Old Max
            const oldPv = c.stats.pv.max || 0;
            const oldPf = c.stats.pf.max || 0;
            const oldPdf = c.stats.pdf.max || 0;

            // 2. New Max
            const lvl = Math.max(1, parseInt(c.level)||1); 
            const getV = (v) => parseInt(v)||0; 
            const FOR = getV(c.attrs.for), POD = getV(c.attrs.pod), VON = getV(c.attrs.von); 
            
            const newPv = Math.max(5, (12+FOR)+((2+FOR)*(lvl-1))); 
            const newPf = Math.max(5, (10+POD)+((2+POD)*(lvl-1))); 
            const newPdf = Math.max(5, (10+VON)+((2+VON)*(lvl-1))); 

            // 3. Apply Delta (Smart Update)
            if (oldPv > 0) c.stats.pv.current = Math.max(0, c.stats.pv.current + (newPv - oldPv));
            if (oldPf > 0) c.stats.pf.current = Math.max(0, c.stats.pf.current + (newPf - oldPf));
            if (oldPdf > 0) c.stats.pdf.current = Math.max(0, c.stats.pdf.current + (newPdf - oldPdf));

            // 4. Update Max
            c.stats.pv.max = newPv;
            c.stats.pf.max = newPf;
            c.stats.pdf.max = newPdf;
        },

        modAttr(key, val) {
            const c = this.char;
            if ((val > 0 && c.attrs[key] < 6) || (val < 0 && c.attrs[key] > -1)) {
                c.attrs[key] += val;
                this.recalcDerivedStats(); // Trigger recalc on attr change
                this.updateRadarChart();
            }
        },

        // =========================================================================
        // 5. ACTIONS & HELPERS
        // =========================================================================
        
        // UI Actions
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
            // Save settings changes
            if(!this.isGuest && this.user) {
                this.unsavedChanges = true;
                this.syncCloud(true);
            }
        },

        applyTheme(color) {
            const root = document.documentElement;
            const map = { 'cyan': '#0ea5e9', 'purple': '#d946ef', 'gold': '#eab308' };
            root.style.setProperty('--neon-core', map[color] || map['cyan']);
            // Update trail color immediately
            const trail = document.getElementById('mouse-trail');
            if(trail) trail.style.background = `radial-gradient(circle, ${map[color] || map['cyan']}, transparent 70%)`;
        },

        toggleFullscreen() {
            if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch(()=>{}); } 
            else if (document.exitFullscreen) { document.exitFullscreen(); }
        },

        // Diagnostics
        handleKeys(e) {
            if (e.ctrlKey && e.shiftKey && e.key === 'D') { e.preventDefault(); this.toggleSystemLog(); }
        },
        log(msg, type='info') {
            const time = new Date().toLocaleTimeString();
            this.sysLogs.unshift({time, msg, type});
            if(this.sysLogs.length > 50) this.sysLogs.pop();
            // Avoid console spam if consoleOpen is false to save performance? No, keep for debug.
            console.log(`[${type.toUpperCase()}] ${msg}`);
        },

        // Auth Actions
        async logout() {
            this.systemLoading = true;
            if(this.unsavedChanges && !this.isGuest) { try { await this.syncCloud(true); } catch(e) {} }
            localStorage.removeItem('zenite_cached_db');
            localStorage.removeItem('zenite_is_guest');
            if(supabase) await supabase.auth.signOut();
            window.location.reload();
        },
        
        askLogout() { this.askConfirm('SAIR?', 'Dados pendentes serão salvos.', 'warn', () => this.logout()); },
        askSwitchToOnline() { this.askConfirm('FICAR ONLINE?', 'Ir para login.', 'info', () => { this.isGuest = false; localStorage.removeItem('zenite_is_guest'); window.location.reload(); }); },
        enterGuest() { this.isGuest = true; localStorage.setItem('zenite_is_guest', 'true'); this.loadLocal('zenite_guest_db'); },

        doSocialAuth(provider) {
            if(!supabase) return;
            this.authLoading = true;
            supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } })
                .then(({error}) => { if(error) { this.notify(error.message, 'error'); this.authLoading = false; } });
        },

        // Character Management
        saveAndExit() { 
            if(this.char && this.activeCharId) { 
                this.chars[this.activeCharId] = JSON.parse(JSON.stringify(this.char)); 
                this.agentCount = Object.keys(this.chars).length;
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
            
            // Frame delay for UI responsiveness
            requestAnimationFrame(() => {
                this.char = JSON.parse(JSON.stringify(this.chars[id]));
                // Defaults
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

        askDeleteChar(id) { this.askConfirm('ELIMINAR?', 'Irreversível.', 'danger', () => { delete this.chars[id]; this.saveLocal(); if(!this.isGuest) this.syncCloud(true); this.agentCount = Object.keys(this.chars).length; this.notify('Deletado.', 'success'); }); },
        askHardReset() { this.askConfirm('LIMPAR TUDO?', 'Apaga cache local.', 'danger', () => { localStorage.clear(); window.location.reload(); }); },
        askConfirm(title, desc, type, action) { this.confirmData = { title, desc, type, action }; this.confirmOpen = true; }, 
        confirmYes() { if (this.confirmData.action) this.confirmData.action(); this.confirmOpen = false; },

        // Stat Modifiers
        modStat(type, val) { if(!this.char) return; const s = this.char.stats[type]; const old = s.current; s.current = Math.min(Math.max(0, s.current + val), s.max); if(val < 0) this.triggerFX('damage'); if(val > 0) this.triggerFX('heal'); },
        triggerFX(type) { const el = document.getElementById(type+'-overlay'); if(el) { el.style.opacity='0.4'; setTimeout(()=>el.style.opacity='0', 200); } },

        // Charts & Visuals
        updateRadarChart() {
            const ctx = document.getElementById('radarChart');
            if(!ctx || !this.char) return;
            const d = [this.char.attrs.for, this.char.attrs.agi, this.char.attrs.int, this.char.attrs.von, this.char.attrs.pod];
            const color = getComputedStyle(document.documentElement).getPropertyValue('--neon-core').trim();
            const hexToRgb = hex => [(parseInt(hex.slice(1), 16) >> 16) & 255, (parseInt(hex.slice(1), 16) >> 8) & 255, parseInt(hex.slice(1), 16) & 255].join(',');
            const rgb = hexToRgb(color);

            if(ctx.chart) {
                ctx.chart.data.datasets[0].data = d;
                ctx.chart.data.datasets[0].borderColor = `rgba(${rgb}, 1)`;
                ctx.chart.data.datasets[0].backgroundColor = `rgba(${rgb}, 0.2)`;
                ctx.chart.update();
            } else {
                ctx.chart = new Chart(ctx, {
                    type: 'radar',
                    data: { labels: ['FOR','AGI','INT','VON','POD'], datasets: [{ data: d, backgroundColor: `rgba(${rgb}, 0.2)`, borderColor: `rgba(${rgb}, 1)`, borderWidth: 2, pointBackgroundColor: '#fff', pointRadius: 3 }] },
                    options: { responsive: true, maintainAspectRatio: false, scales: { r: { min: -1, max: 6, ticks: { display: false }, grid: { color: 'rgba(255,255,255,0.1)' } } }, plugins: { legend: { display: false } } }
                });
            }
        },

        // Wizard
        openWizard() { if(this.agentCount >= CONSTANTS.MAX_AGENTS) return this.notify('Limite atingido.', 'error'); this.wizardOpen=true; this.wizardStep=1; },
        selectArchetype(a) { this.wizardData.class=a.class; this.wizardData.attrs={for:-1,agi:-1,int:-1,von:-1,pod:-1}; this.wizardData.attrs[a.focus]=0; this.wizardFocusAttr=a.focus; this.wizardStep=2; },
        modWizardAttr(k,v) { const c=this.wizardData.attrs[k]; const f=k===this.wizardFocusAttr; if(v>0 && this.wizardPoints>0 && c<3) { this.wizardData.attrs[k]++; this.wizardPoints--; } if(v<0 && c>(f?0:-1)) { this.wizardData.attrs[k]--; this.wizardPoints++; } },
        finishWizard() {
            const id = 'z_'+Date.now();
            const base = { class: this.wizardData.class, level: 1, attrs: this.wizardData.attrs, stats: { pv:{}, pf:{}, pdf:{} } };
            // Calc Initial Stats using same logic
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
            this.saveLocal();
            if(!this.isGuest) { this.unsavedChanges = true; this.syncCloud(true); }
            this.wizardOpen = false;
            this.loadCharacter(id);
            this.notify('Agente Inicializado.', 'success');
        },
        
        // Items
        addItem(cat) { const defs = { weapons: { name: 'Arma', dmg: '1d6', range: 'C' }, armor: { name: 'Traje', def: '1', pen: '0' }, gear: { name: 'Item', desc: '', qty: 1 }, social_people: { name: 'Nome', role: 'Relação' }, social_objects: { name: 'Objeto', desc: 'Detalhes' } }; if(cat.startsWith('social_')) this.char.inventory.social[cat.split('_')[1]].push({...defs[cat]}); else this.char.inventory[cat].push({...defs[cat]}); },
        deleteItem(cat, i, sub=null) { if(sub) this.char.inventory.social[sub].splice(i,1); else this.char.inventory[cat].splice(i,1); },
        
        // Skills
        addSkill() { this.char.skills.push({name:'Nova Perícia', level:1}); }, deleteSkill(idx) { this.char.skills.splice(idx,1); }, setSkillLevel(idx, l) { this.char.skills[idx].level = l; },
        addTechnique() { this.char.powers.techniques.push({name:'Técnica', desc:''}); }, deleteTechnique(idx) { this.char.powers.techniques.splice(idx,1); },

        // Dice
        roll(s) {
            const arr = new Uint32Array(1); window.crypto.getRandomValues(arr);
            const n = (arr[0] % s) + 1;
            const m = parseInt(this.diceMod || 0);
            this.lastRoll = n + m;
            this.diceLog.unshift({id: Date.now(), time: new Date().toLocaleTimeString(), formula: `D${s}`, result: n+m, crit: n===s, fumble: n===1});
            if(this.diceLog.length > 8) this.diceLog.pop();
            this.log(`Rolou D${s}: ${this.lastRoll}`, 'info');
        },

        // Helpers
        notify(msg, type='info') { const id = Date.now(); this.notifications.push({id, message: msg, type}); setTimeout(() => { this.notifications = this.notifications.filter(n => n.id !== id); }, 3000); this.log(msg, type); },
        openImageEditor() { document.getElementById('file-input').click(); }, 
        initCropper(e) { const file = e.target.files[0]; if(!file) return; const reader = new FileReader(); reader.onload = (evt) => { document.getElementById('crop-target').src = evt.target.result; this.cropperOpen = true; this.$nextTick(() => { if(this.cropperInstance) this.cropperInstance.destroy(); this.cropperInstance = new Cropper(document.getElementById('crop-target'), { aspectRatio: 1, viewMode: 1 }); }); }; reader.readAsDataURL(file); }, 
        applyCrop() { if(!this.cropperInstance) return; this.char.photo = this.cropperInstance.getCroppedCanvas({width:300, height:300}).toDataURL('image/jpeg', 0.8); this.cropperOpen = false; this.notify('Foto salva.', 'success'); },
        exportData() { const s = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.chars)); const a = document.createElement('a'); a.href = s; a.download = `zenite_bkp.json`; a.click(); a.remove(); this.notify('Backup baixado.', 'success'); },
        triggerFileImport() { document.getElementById('import-file').click(); },
        processImport(e) { const f = e.target.files[0]; if(!f) return; const r = new FileReader(); r.onload = (evt) => { try { const d = JSON.parse(evt.target.result); this.chars = {...this.chars, ...d}; this.sanitizeData(); this.saveLocal(); this.unsavedChanges = true; this.notify('Importado!', 'success'); this.configModal = false; if(this.currentView === 'dashboard') this.updateAgentCount(); } catch(e){ this.notify('Erro arquivo.', 'error'); } }; r.readAsText(f); }
    };
}