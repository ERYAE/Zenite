/**
 * ZENITE OS - Core Application
 * Version: v48.3-Refined
 * Fixes: Stats Calculation, Chart Animations, ModStats Buttons
 */

const SUPABASE_URL = 'https://pwjoakajtygmbpezcrix.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_ULe02tKpa38keGvz8bEDIw_mJJaBK6j';

const supabase = (typeof window.supabase !== 'undefined') 
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
      })
    : null;

const CONSTANTS = {
    MAX_AGENTS: 30,
    SAVE_INTERVAL: 180000, 
    TOAST_DURATION: 3000
};

function zeniteSystem() {
    return {
        // State
        systemLoading: true,
        loadingChar: false,
        consoleOpen: false,
        sysLogs: [],
        notifications: [],
        user: null,
        isGuest: false,
        userMenuOpen: false,
        authLoading: false, 
        authMsg: '', 
        authMsgType: '',
        
        // Data
        chars: {},
        activeCharId: null,
        char: null,
        agentCount: 0,
        currentView: 'dashboard',
        activeTab: 'profile',
        logisticsTab: 'inventory',
        searchQuery: '',
        
        // UI
        diceTrayOpen: true,
        showDiceLog: false,
        diceLog: [],
        lastRoll: '--',
        lastNatural: 0,
        lastFaces: 20,
        diceMod: 0,
        
        configModal: false,
        wizardOpen: false, 
        cropperOpen: false,
        confirmOpen: false,
        confirmData: { title:'', desc:'', action:null, type:'danger' },
        
        wizardStep: 1,
        wizardPoints: 8,
        wizardData: { class: '', attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} },
        wizardFocusAttr: '',
        
        settings: {
            mouseTrail: true,
            compactMode: false,
            performanceMode: false,
            themeColor: 'cyan'
        },
        
        unsavedChanges: false,
        isSyncing: false,
        saveStatus: 'idle',

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
            window.addEventListener('pageshow', (event) => { if (event.persisted) window.location.reload(); });
            this.log(`ZENITE OS v48.3 READY`);
            
            this.setupCursor();
            this.setupWatchers();

            const isGuest = localStorage.getItem('zenite_is_guest') === 'true';
            
            if (isGuest) {
                this.isGuest = true;
                this.loadLocal('zenite_guest_db');
                this.systemLoading = false;
            } else {
                this.loadLocal('zenite_cached_db');
                if(supabase) {
                    try {
                        const { data: { session } } = await supabase.auth.getSession();
                        if (session) {
                            this.user = session.user;
                            await this.fetchCloud();
                        }
                    } catch(e) {}
                    
                    supabase.auth.onAuthStateChange(async (event, session) => {
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

            this.applyTheme(this.settings.themeColor);
            if(this.settings.compactMode) document.body.classList.add('compact-mode');
            this.updateAgentCount();
            
            setInterval(() => { if (this.user && this.unsavedChanges && !this.isSyncing) this.syncCloud(true); }, CONSTANTS.SAVE_INTERVAL);
        },

        // Core Services
        setupCursor() {
            const trail = document.getElementById('mouse-trail');
            if (!window.matchMedia("(pointer: fine)").matches) {
                if(trail) trail.style.display = 'none';
                return;
            }
            document.addEventListener('mousemove', (e) => { 
                const trail = document.getElementById('mouse-trail');
                if(trail) {
                    trail.style.transform = `translate(${e.clientX - 8}px, ${e.clientY - 8}px)`; 
                    trail.style.opacity = '1';
                    const target = e.target;
                    if(target && (target.tagName === 'BUTTON' || target.tagName === 'A' || target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA' || target.classList.contains('cursor-pointer'))) {
                        trail.classList.add('hover-active');
                    } else {
                        trail.classList.remove('hover-active');
                    }
                }
                if (this.settings.mouseTrail) document.body.classList.add('custom-cursor-active');
            });
        },

        setupWatchers() {
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

        loadLocal(key) {
            const local = localStorage.getItem(key);
            if(local) {
                try {
                    const parsed = JSON.parse(local);
                    if(parsed.config) this.settings = { ...this.settings, ...parsed.config };
                    const validChars = {};
                    Object.keys(parsed).forEach(k => { if(k !== 'config' && parsed[k]?.id) validChars[k] = parsed[k]; });
                    this.chars = validChars;
                    this.updateAgentCount();
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
                await supabase.from('profiles').insert([{ id: this.user.id, data: { config: this.settings } }]);
                data = { data: { config: this.settings } };
            }
            if (data && data.data) {
                const cloudData = data.data;
                if(cloudData.config) {
                    this.settings = { ...this.settings, ...cloudData.config };
                    this.applyTheme(this.settings.themeColor);
                }
                let merged = { ...this.chars };
                let hasLocalOnly = false;
                Object.keys(cloudData).forEach(k => { if(k !== 'config') merged[k] = cloudData[k]; });
                Object.keys(this.chars).forEach(localId => {
                    if (!cloudData[localId] && localId !== 'config') { merged[localId] = this.chars[localId]; hasLocalOnly = true; }
                });
                this.chars = merged;
                this.updateAgentCount();
                this.saveLocal();
                if (hasLocalOnly) { this.unsavedChanges = true; this.syncCloud(true); }
            }
        },

        async syncCloud(silent = false) {
            if (!this.user || this.isGuest || !this.unsavedChanges || this.isSyncing || !supabase) return;
            this.isSyncing = true;
            if(!silent) this.notify('Sincronizando...', 'info');
            try {
                const payload = { ...this.chars, config: this.settings };
                const { error } = await supabase.from('profiles').upsert({ id: this.user.id, data: payload });
                if (error) throw error;
                this.unsavedChanges = false;
                this.saveStatus = 'success';
                if(!silent) this.notify('Salvo!', 'success');
            } catch (e) {
                this.saveStatus = 'error';
                if(!silent) this.notify('Erro ao salvar.', 'error');
            } finally {
                this.isSyncing = false;
            }
        },

        updateAgentCount() { this.agentCount = Object.keys(this.chars).length; },

        // --- FIXED STATS CALCULATION ---
        recalcDerivedStats() { 
            if(!this.char) return; 
            const c = this.char;
            const cl = c.class || 'Titã'; // Default to Titã
            
            const oldPv = c.stats.pv.max || 0;
            const oldPf = c.stats.pf.max || 0;
            const oldPdf = c.stats.pdf.max || 0;

            const lvl = Math.max(1, parseInt(c.level)||1); 
            const get = (v) => parseInt(c.attrs[v]||0); 
            
            // Map: PV=for, PF=pod (Control), PDF=von (Will)
            // Using user's strict numbers
            const config = {
                'Titã':        { pv: [15, 4], pf: [12, 2], pdf: [12, 2] },
                'Estrategista':{ pv: [12, 2], pf: [15, 4], pdf: [12, 2] },
                'Infiltrador': { pv: [12, 2], pf: [15, 4], pdf: [12, 3] },
                'Controlador': { pv: [12, 2], pf: [12, 2], pdf: [15, 4] },
                'Psíquico':    { pv: [12, 2], pf: [13, 3], pdf: [14, 3] }
            };
            
            const cfg = config[cl] || config['Titã'];

            // PV uses FOR
            const newPv = (cfg.pv[0] + get('for')) + ((cfg.pv[1] + get('for')) * (lvl - 1));
            // PF uses POD (Control)
            const newPf = (cfg.pf[0] + get('pod')) + ((cfg.pf[1] + get('pod')) * (lvl - 1));
            // PDF uses VON (Will)
            const newPdf = (cfg.pdf[0] + get('von')) + ((cfg.pdf[1] + get('von')) * (lvl - 1));

            // Apply Delta (Keep damage)
            if (oldPv > 0) c.stats.pv.current = Math.max(0, c.stats.pv.current + (newPv - oldPv)); else c.stats.pv.current = newPv;
            if (oldPf > 0) c.stats.pf.current = Math.max(0, c.stats.pf.current + (newPf - oldPf)); else c.stats.pf.current = newPf;
            if (oldPdf > 0) c.stats.pdf.current = Math.max(0, c.stats.pdf.current + (newPdf - oldPdf)); else c.stats.pdf.current = newPdf;

            c.stats.pv.max = newPv;
            c.stats.pf.max = newPf;
            c.stats.pdf.max = newPdf;
        },

        modAttr(key, val) {
            const c = this.char;
            if ((val > 0 && c.attrs[key] < 6) || (val < 0 && c.attrs[key] > -1)) {
                c.attrs[key] += val;
                this.recalcDerivedStats();
                this.updateRadarChart();
            }
        },

        // --- FIXED MODSTAT BUTTONS ---
        modStat(stat, val) {
            if(!this.char || !this.char.stats[stat]) return;
            const s = this.char.stats[stat];
            // Ensure we don't go below 0 or above max
            const newVal = Math.max(0, Math.min(s.max, s.current + val));
            s.current = newVal;
        },

        // Actions
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
            this.$nextTick(() => { this.updateWizardChart(); });
        },

        modWizardAttr(k,v) { 
            const c = this.wizardData.attrs[k]; 
            const f = k === this.wizardFocusAttr; 
            if(v>0 && this.wizardPoints>0 && c<3) { this.wizardData.attrs[k]++; this.wizardPoints--; this.updateWizardChart(); } 
            if(v<0 && c>(f?0:-1)) { this.wizardData.attrs[k]--; this.wizardPoints++; this.updateWizardChart(); } 
        },

        finishWizard() {
            const id = 'z_'+Date.now();
            const base = { class: this.wizardData.class, level: 1, attrs: this.wizardData.attrs };
            
            // Initial stats for level 1 using the same new logic
            // But simplified here, recalcDerivedStats will fix it on load
            const get = (k) => parseInt(base.attrs[k]);
            // Placeholder values, will be recalculated instantly on load
            const pv = 10, pf = 10, pdf = 10;
            
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
            
            if(!this.isGuest) { this.unsavedChanges = true; this.syncCloud(true); }
            
            this.wizardOpen = false;
            this.loadCharacter(id);
            // Trigger recalc to ensure correct HP/MP based on class
            this.$nextTick(() => this.recalcDerivedStats());
            this.notify('Agente Inicializado.', 'success');
        },
        
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
            this.saveLocal();
            if(!this.isGuest && this.user) { this.unsavedChanges = true; this.syncCloud(true); }
        },
        
        applyTheme(color) {
            const root = document.documentElement;
            const map = { 'cyan': '#0ea5e9', 'purple': '#d946ef', 'gold': '#eab308' };
            const hex = map[color] || map['cyan'];
            
            // Extract RGB for variable usage
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            
            root.style.setProperty('--neon-core', hex);
            root.style.setProperty('--neon-rgb', `${r}, ${g}, ${b}`); // NEW
            
            const trail = document.getElementById('mouse-trail');
            if(trail) trail.style.background = `radial-gradient(circle, ${hex}, transparent 70%)`;
        },
        
        toggleFullscreen() {
            if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch(()=>{}); } 
            else if (document.exitFullscreen) { document.exitFullscreen(); }
        },

        handleKeys(e) { if (e.ctrlKey && e.shiftKey && e.key === 'D') { e.preventDefault(); this.toggleSystemLog(); } },
        log(msg, type='info') {
            const time = new Date().toLocaleTimeString();
            this.sysLogs.unshift({time, msg, type});
            if(this.sysLogs.length > 50) this.sysLogs.pop();
            console.log(`[${type.toUpperCase()}] ${msg}`);
        },

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
            if(!supabase) return this.notify("Erro de conexão.", "error");
            this.authLoading = true;
            this.authMsg = "Conectando...";
            supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } })
                .then(({error}) => { if(error) { this.notify(error.message, 'error'); this.authLoading = false; } });
        },

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
                // Patch old chars
                if(!this.char.inventory) this.char.inventory = { weapons:[], armor:[], gear:[], backpack: "", social: { people:[], objects:[]} }; 
                
                this.currentView = 'sheet';
                this.activeTab = 'profile';
                this.$nextTick(() => {
                    this.updateRadarChart();
                    setTimeout(() => { this.loadingChar = false; this.unsavedChanges = false; }, 300);
                });
            });
        },

        askDeleteChar(id) { this.askConfirm('ELIMINAR?', 'Irreversível.', 'danger', () => { delete this.chars[id]; this.saveLocal(); if(!this.isGuest) this.syncCloud(true); this.updateAgentCount(); this.notify('Deletado.', 'success'); }); },
        askHardReset() { this.askConfirm('LIMPAR TUDO?', 'Apaga cache local.', 'danger', () => { localStorage.clear(); window.location.reload(); }); },
        askConfirm(title, desc, type, action) { this.confirmData = { title, desc, type, action }; this.confirmOpen = true; }, 
        confirmYes() { if (this.confirmData.action) this.confirmData.action(); this.confirmOpen = false; },

        // --- FIXED CHART ANIMATIONS ---
        _renderChart(id, data, isWizard=false) {
            const ctx = document.getElementById(id);
            if(!ctx) return;
            const color = getComputedStyle(document.documentElement).getPropertyValue('--neon-core').trim();
            // Simple hex parser to RGB for chart alpha
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);
            const rgb = `${r},${g},${b}`;

            if(ctx.chart) ctx.chart.destroy();
            
            ctx.chart = new Chart(ctx, {
                type: 'radar',
                data: { labels: ['FOR','AGI','INT','VON','POD'], datasets: [{ data: data, backgroundColor: `rgba(${rgb}, 0.2)`, borderColor: `rgba(${rgb}, 1)`, borderWidth: 2, pointBackgroundColor: '#fff', pointRadius: isWizard?4:3 }] },
                options: { 
                    responsive: true, maintainAspectRatio: false, 
                    scales: { 
                        r: { 
                            min: -1, max: isWizard?4:6, 
                            ticks: { display: false }, 
                            grid: { color: 'rgba(255,255,255,0.1)' },
                            angleLines: { color: 'rgba(255,255,255,0.1)' }
                        } 
                    }, 
                    plugins: { legend: { display: false } },
                    // Smooth Animation Logic
                    animation: { duration: 800, easing: 'easeInOutQuad' } 
                }
            });
        },

        updateRadarChart() {
            if(!this.char) return;
            const d = [this.char.attrs.for, this.char.attrs.agi, this.char.attrs.int, this.char.attrs.von, this.char.attrs.pod];
            this._renderChart('radarChart', d);
        },

        updateWizardChart() {
            const d = [this.wizardData.attrs.for, this.wizardData.attrs.agi, this.wizardData.attrs.int, this.wizardData.attrs.von, this.wizardData.attrs.pod];
            this._renderChart('wizChart', d, true);
        },
        
        triggerFX(type) { const el = document.getElementById(type+'-overlay'); if(el) { el.style.opacity='0.4'; setTimeout(()=>el.style.opacity='0', 200); } },
        addItem(cat) { const defs = { weapons: { name: 'Arma', dmg: '1d6', range: 'C' }, armor: { name: 'Traje', def: '1', pen: '0' }, gear: { name: 'Item', desc: '', qty: 1 }, social_people: { name: 'Nome', role: 'Relação' }, social_objects: { name: 'Objeto', desc: 'Detalhes' } }; if(cat.startsWith('social_')) this.char.inventory.social[cat.split('_')[1]].push({...defs[cat]}); else this.char.inventory[cat].push({...defs[cat]}); },
        deleteItem(cat, i, sub=null) { if(sub) this.char.inventory.social[sub].splice(i,1); else this.char.inventory[cat].splice(i,1); },
        addSkill() { this.char.skills.push({name:'Nova Perícia', level:1}); }, deleteSkill(idx) { this.char.skills.splice(idx,1); }, setSkillLevel(idx, l) { this.char.skills[idx].level = l; },
        addTechnique() { this.char.powers.techniques.push({name:'Técnica', desc:''}); }, deleteTechnique(idx) { this.char.powers.techniques.splice(idx,1); },

        roll(s) {
            const arr = new Uint32Array(1); window.crypto.getRandomValues(arr);
            const n = (arr[0] % s) + 1;
            const m = parseInt(this.diceMod || 0);
            this.lastNatural = n;
            this.lastFaces = s;
            this.lastRoll = n + m;
            this.diceLog.unshift({id: Date.now(), time: new Date().toLocaleTimeString(), formula: `D${s}`, result: n+m, crit: n===s, fumble: n===1});
            if(this.diceLog.length > 8) this.diceLog.pop();
            this.log(`Rolou D${s}: ${this.lastRoll}`, 'info');
        },

        notify(msg, type='info') { const id = Date.now(); this.notifications.push({id, message: msg, type}); setTimeout(() => { this.notifications = this.notifications.filter(n => n.id !== id); }, 3000); this.log(msg, type); },
        openImageEditor() { document.getElementById('file-input').click(); }, 
        initCropper(e) { const file = e.target.files[0]; if(!file) return; const reader = new FileReader(); reader.onload = (evt) => { document.getElementById('crop-target').src = evt.target.result; this.cropperOpen = true; this.$nextTick(() => { if(this.cropperInstance) this.cropperInstance.destroy(); this.cropperInstance = new Cropper(document.getElementById('crop-target'), { aspectRatio: 1, viewMode: 1 }); }); }; reader.readAsDataURL(file); }, 
        applyCrop() { if(!this.cropperInstance) return; this.char.photo = this.cropperInstance.getCroppedCanvas({width:300, height:300}).toDataURL('image/jpeg', 0.8); this.cropperOpen = false; this.notify('Foto salva.', 'success'); },
        exportData() { const s = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.chars)); const a = document.createElement('a'); a.href = s; a.download = `zenite_bkp.json`; a.click(); a.remove(); this.notify('Backup baixado.', 'success'); },
        triggerFileImport() { document.getElementById('import-file').click(); },
        processImport(e) { const f = e.target.files[0]; if(!f) return; const r = new FileReader(); r.onload = (evt) => { try { const d = JSON.parse(evt.target.result); this.chars = {...this.chars, ...d}; this.updateAgentCount(); this.saveLocal(); this.unsavedChanges = true; this.notify('Importado!', 'success'); this.configModal = false; } catch(e){ this.notify('Erro arquivo.', 'error'); } }; r.readAsText(f); }
    };
}