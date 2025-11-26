// CONFIGURAÇÃO SUPABASE
const SUPABASE_URL = 'https://pwjoakajtygmbpezcrix.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_ULe02tKpa38keGvz8bEDIw_mJJaBK6j';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const MAX_AGENTS = 30;

function zeniteSystem() {
    return {
        // --- ESTADO GLOBAL ---
        systemLoading: true,
        user: null,
        isGuest: false,
        
        // --- MODAIS & UI ---
        authInput: { email: '', pass: '' },
        authMode: 'login',
        authLoading: false,
        authMsg: '',
        authMsgType: '',
        
        confirmOpen: false, confirmTitle: '', confirmDesc: '', confirmAction: null, confirmType: 'danger',

        // --- DADOS & SYNC ---
        chars: {},
        activeCharId: null,
        char: null,
        agentCount: 0,
        unsavedChanges: false,
        isSyncing: false,
        currentView: 'dashboard',

        // --- UI ---
        activeTab: 'profile',
        logisticsTab: 'inventory',
        notifications: [],
        configModal: false,
        
        // --- DICE ---
        showDiceLog: false, diceLog: [], lastRoll: '--', lastNatural: 0, lastFaces: 0, diceMod: 0,

        // --- WIZARD & EXTRAS ---
        wizardOpen: false, wizardStep: 1, wizardData: { class: '', attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} }, wizardPoints: 8, wizardFocusAttr: '',
        cropperOpen: false, cropperInstance: null,
        archetypes: [
            { class: 'Titã', icon: 'fa-solid fa-shield-halved', focus: 'for', color: 'text-rose-500', desc: 'Resiliência e força bruta.' },
            { class: 'Estrategista', icon: 'fa-solid fa-chess', focus: 'int', color: 'text-cyan-500', desc: 'Análise tática e liderança.' },
            { class: 'Infiltrador', icon: 'fa-solid fa-user-ninja', focus: 'agi', color: 'text-emerald-500', desc: 'Furtividade e precisão.' },
            { class: 'Controlador', icon: 'fa-solid fa-hand-spock', focus: 'pod', color: 'text-violet-500', desc: 'Manipulador de energia.' },
            { class: 'Psíquico', icon: 'fa-solid fa-brain', focus: 'von', color: 'text-amber-500', desc: 'Domínio mental.' }
        ],

        // --- INICIALIZAÇÃO ---
        async initSystem() {
            const isGuestStore = localStorage.getItem('zenite_is_guest') === 'true';
            
            if (isGuestStore) {
                this.isGuest = true;
                this.loadLocalData('zenite_guest_db');
                this.sanitizeData();
                this.systemLoading = false;
            } else {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    this.user = session.user;
                    await this.fetchData();
                }
                this.systemLoading = false;
            }

            supabase.auth.onAuthStateChange(async (event, session) => {
                if (event === 'SIGNED_IN' && session) {
                    this.user = session.user;
                    this.isGuest = false;
                    localStorage.removeItem('zenite_is_guest');
                    await this.fetchData();
                    if(window.location.hash) history.replaceState(null, null, ' ');
                } else if (event === 'SIGNED_OUT') {
                    this.user = null;
                    this.chars = {};
                    this.currentView = 'dashboard';
                }
            });

            this.$watch('char', (val) => {
                if (val && this.activeCharId) {
                    this.chars[this.activeCharId] = JSON.parse(JSON.stringify(val));
                    const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db';
                    localStorage.setItem(key, JSON.stringify(this.chars));
                    if (!this.isGuest) this.unsavedChanges = true;
                    if(this.activeTab === 'profile') this.updateRadarChart();
                }
            }, { deep: true });

            setInterval(() => {
                if (this.user && this.unsavedChanges && !this.isSyncing) this.syncCloud(true);
            }, 60000);
        },

        // --- DADOS & SYNC ---
        async fetchData() {
            if (!this.user) return;
            let { data, error } = await supabase.from('profiles').select('data').eq('id', this.user.id).single();
            if (error && error.code === 'PGRST116') {
                await supabase.from('profiles').insert([{ id: this.user.id, data: {} }]);
                data = { data: {} };
            }
            if (data) {
                let cloudData = {};
                if (Array.isArray(data.data)) data.data.forEach(c => { if(c && c.id) cloudData[c.id] = c; });
                else cloudData = data.data || {};
                this.chars = cloudData;
                this.sanitizeData();
                localStorage.setItem('zenite_cached_db', JSON.stringify(this.chars));
            }
        },
        async syncCloud(silent = false) {
            if (!this.user || this.isGuest || this.isSyncing) return;
            this.isSyncing = true;
            if(!silent) this.notify('Sincronizando...', 'info');
            if (this.char && this.activeCharId) this.chars[this.activeCharId] = this.char;
            try {
                const { error } = await supabase.from('profiles').upsert({ id: this.user.id, data: this.chars });
                if (error) throw error;
                this.unsavedChanges = false;
                if(!silent) this.notify('Sincronizado.', 'success');
            } catch (e) {
                if(!silent) this.notify('Erro de conexão.', 'error');
            } finally {
                this.isSyncing = false;
            }
        },

        // --- AUTH ---
        async doSocialAuth(provider) {
            this.authLoading = true;
            const { error } = await supabase.auth.signInWithOAuth({ provider: provider, options: { redirectTo: window.location.origin } });
            if (error) { this.notify('Erro: ' + error.message, 'error'); this.authLoading = false; }
        },
        async doAuth(action) {
            let email = this.authInput.email;
            if (!email.includes('@')) email += '@zenite.os'; 
            if(!email || (!this.authInput.pass && action !== 'reset')) return this.notify('Preencha os campos.', 'warn');
            this.authLoading = true;
            try {
                let error;
                if (action === 'login') { const { error: err } = await supabase.auth.signInWithPassword({ email, password: this.authInput.pass }); error = err; }
                else if (action === 'register') { const { error: err } = await supabase.auth.signUp({ email, password: this.authInput.pass }); error = err; if(!error) { this.notify('Conta criada!', 'success'); this.authMode = 'login'; return; } }
                if (error) throw error;
                if (action === 'login') { this.authInput = { email: '', pass: '' }; }
            } catch (e) { this.notify(e.message, 'error'); } finally { this.authLoading = false; }
        },
        askLogout() { this.askConfirm('DESCONECTAR?', 'Dados não salvos serão sincronizados.', 'warn', () => this.logout()); },
        async logout() { if(this.unsavedChanges) await this.syncCloud(true); await supabase.auth.signOut(); this.user = null; this.isGuest = false; this.chars = {}; this.char = null; this.activeCharId = null; localStorage.removeItem('zenite_cached_db'); localStorage.removeItem('zenite_is_guest'); this.currentView = 'dashboard'; },
        askSwitchToOnline() { this.askConfirm('FICAR ONLINE?', 'Você irá para o login. Dados Offline serão mantidos apenas neste PC.', 'info', () => { this.isGuest = false; localStorage.removeItem('zenite_is_guest'); this.chars = {}; this.currentView = 'dashboard'; }); },
        enterGuest() { this.isGuest = true; localStorage.setItem('zenite_is_guest', 'true'); this.loadLocalData('zenite_guest_db'); this.notify('Modo Offline.', 'success'); },
        
        // --- HELPERS ---
        sanitizeData() { if (!this.chars || typeof this.chars !== 'object') this.chars = {}; Object.keys(this.chars).forEach(key => { if (!this.chars[key] || !this.chars[key].id) delete this.chars[key]; }); this.updateAgentCount(); },
        loadLocalData(key) { const local = localStorage.getItem(key); if(local) { try { let parsed = JSON.parse(local); if (Array.isArray(parsed)) { this.chars = {}; parsed.forEach(c => { if(c && c.id) this.chars[c.id] = c; }); } else { this.chars = parsed || {}; } this.sanitizeData(); } catch(e) {} } },
        saveAndExit() { if (this.char && this.activeCharId) { this.chars[this.activeCharId] = JSON.parse(JSON.stringify(this.char)); this.updateAgentCount(); } const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db'; localStorage.setItem(key, JSON.stringify(this.chars)); if (!this.isGuest && this.unsavedChanges) this.syncCloud(true); this.currentView = 'dashboard'; this.activeCharId = null; this.char = null; },
        askDeleteChar(id) { this.askConfirm('ELIMINAR AGENTE?', 'Ação irreversível.', 'danger', () => this.deleteCharacter(id)); },
        deleteCharacter(id) { delete this.chars[id]; this.sanitizeData(); const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db'; localStorage.setItem(key, JSON.stringify(this.chars)); if(!this.isGuest) this.syncCloud(true); this.notify('Agente Eliminado.', 'success'); },
        askHardReset() { this.askConfirm('DELETAR TUDO?', 'Apaga cache local. Nuvem segura.', 'danger', () => { localStorage.removeItem('zenite_cached_db'); localStorage.removeItem('zenite_guest_db'); window.location.reload(); }); },
        updateAgentCount() { this.agentCount = Object.keys(this.chars).length; },
        loadCharacter(id) { if (!this.chars[id]) return this.notify('Erro: Ficha inexistente.', 'error'); this.activeCharId = id; this.char = JSON.parse(JSON.stringify(this.chars[id])); if(!this.char.inventory) this.char.inventory = { weapons:[], armor:[], gear:[], backpack: "", social: { people:[], objects:[] } }; if(!this.char.inventory.weapons) this.char.inventory.weapons = []; if(!this.char.inventory.armor) this.char.inventory.armor = []; if(!this.char.inventory.gear) this.char.inventory.gear = []; if(!this.char.inventory.social) this.char.inventory.social = { people:[], objects:[] }; if(!this.char.skills) this.char.skills = []; if(!this.char.powers) this.char.powers = { passive: '', active: '', techniques: [] }; if(!this.char.powers.techniques) this.char.powers.techniques = []; if(!this.char.stats) this.char.stats = { pv: {current:10, max:10}, pf: {current:10, max:10}, pdf: {current:10, max:10} }; if(!this.char.stats.pdf) this.char.stats.pdf = { current: 10, max: 10 }; this.currentView = 'sheet'; this.activeTab = 'profile'; setTimeout(() => this.updateRadarChart(), 100); },

        // --- MODAL ---
        askConfirm(title, desc, type, action) { this.confirmTitle = title; this.confirmDesc = desc; this.confirmType = type; this.confirmAction = action; this.confirmOpen = true; },
        confirmYes() { if (this.confirmAction) this.confirmAction(); this.confirmOpen = false; },

        // --- GAMEPLAY ---
        recalcDerivedStats() { if(!this.char) return; const c = this.char; const lvl = Math.max(1, parseInt(c.level)||1); const getV = (v) => parseInt(v)||0; const FOR = getV(c.attrs.for), AGI = getV(c.attrs.agi), INT = getV(c.attrs.int), VON = getV(c.attrs.von), POD = getV(c.attrs.pod); let maxPV=0, maxPF=0, maxPDF=0; if (c.class === 'Titã') { maxPV=(15+FOR)+((4+FOR)*(lvl-1)); maxPF=(12+POD)+((2+POD)*(lvl-1)); maxPDF=(10+VON)+((2+VON)*(lvl-1)); } else if (c.class === 'Estrategista') { maxPV=(12+FOR)+((2+FOR)*(lvl-1)); maxPF=(15+POD)+((4+POD)*(lvl-1)); maxPDF=(12+VON)+((2+VON)*(lvl-1)); } else if (c.class === 'Infiltrador') { maxPV=(12+FOR)+((2+FOR)*(lvl-1)); maxPF=(12+POD)+((2+POD)*(lvl-1)); maxPDF=(12+VON)+((3+VON)*(lvl-1)); } else if (c.class === 'Controlador') { maxPV=(12+FOR)+((2+FOR)*(lvl-1)); maxPF=(12+POD)+((2+POD)*(lvl-1)); maxPDF=(15+VON)+((4+VON)*(lvl-1)); } else if (c.class === 'Psíquico') { maxPV=(12+FOR)+((2+FOR)*(lvl-1)); maxPF=(13+POD)+((3+POD)*(lvl-1)); maxPDF=(14+VON)+((3+VON)*(lvl-1)); } else { maxPV=(12+FOR)+((2+FOR)*(lvl-1)); maxPF=(10+POD)+((2+POD)*(lvl-1)); maxPDF=(10+VON)+((2+VON)*(lvl-1)); } c.stats.pv.max = Math.max(5, maxPV); c.stats.pf.max = Math.max(5, maxPF); c.stats.pdf.max = Math.max(5, maxPDF); },
        modStat(type, val) { const stat = this.char.stats[type]; const oldVal = stat.current; stat.current = Math.min(Math.max(0, stat.current + val), stat.max); if(stat.current < oldVal && type==='pv') this.triggerFX('damage'); if(stat.current > oldVal) this.triggerFX('heal'); },
        modAttr(key, val) { const c = this.char.attrs[key]; if (val > 0 && c < 6) this.char.attrs[key]++; if (val < 0 && c > -1) this.char.attrs[key]--; this.recalcDerivedStats(); this.updateRadarChart(); },
        updateClassLogic() { this.recalcDerivedStats(); this.updateRadarChart(); },
        triggerFX(type) { const el = document.getElementById(type + '-overlay'); if(el) { el.style.opacity = '0.4'; setTimeout(() => el.style.opacity = '0', 200); } },
        addItem(cat) { const defs = { weapons: { name: 'Nova Arma', dmg: '1d6', range: 'C' }, armor: { name: 'Traje', def: '1', pen: '0' }, gear: { name: 'Item', desc: '', qty: 1 }, social_people: { name: 'Nome', role: 'Relação' }, social_objects: { name: 'Objeto', desc: 'Detalhes' } }; if(cat.startsWith('social_')) this.char.inventory.social[cat.split('_')[1]].push({...defs[cat]}); else this.char.inventory[cat].push({...defs[cat]}); },
        deleteItem(cat, idx, subcat=null) { if(subcat) this.char.inventory.social[subcat].splice(idx, 1); else this.char.inventory[cat].splice(idx, 1); },
        addSkill() { this.char.skills.push({ name: 'Nova Perícia', level: 1 }); }, deleteSkill(idx) { this.char.skills.splice(idx, 1); }, setSkillLevel(idx, lvl) { this.char.skills[idx].level = lvl; },
        addTechnique() { this.char.powers.techniques.push({ name: 'Nova Técnica', desc: 'Efeito...' }); }, deleteTechnique(idx) { this.char.powers.techniques.splice(idx, 1); },
        renderChart(id, attrs, color) { const ctx = document.getElementById(id); if (!ctx) return; const data = [attrs.for, attrs.agi, attrs.int, attrs.von, attrs.pod]; if (ctx.chart) { ctx.chart.data.datasets[0].data = data; ctx.chart.update(); return; } ctx.chart = new Chart(ctx, { type: 'radar', data: { labels: ['FOR', 'AGI', 'INT', 'VON', 'POD'], datasets: [{ data: data, backgroundColor: `rgba(${color}, 0.2)`, borderColor: `rgba(${color}, 1)`, borderWidth: 2, pointBackgroundColor: '#fff', pointRadius: 3 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { r: { min: -1, max: 6, ticks: { display: false }, grid: { color: 'rgba(255,255,255,0.05)' }, angleLines: { color: 'rgba(255,255,255,0.05)' }, pointLabels: { color: '#94a3b8', font: { size: 9, family: 'Orbitron' } } } }, plugins: { legend: { display: false } } } }); },
        updateRadarChart() { this.renderChart('radarChart', this.char.attrs, '14, 165, 233'); }, updateWizardChart() { this.renderChart('wizChart', this.wizardData.attrs, '255, 255, 255'); },
        
        // --- DICE LOG FIX (MOSTRAR MODIFICADOR) ---
        roll(sides) {
            const arr = new Uint32Array(1); window.crypto.getRandomValues(arr);
            const natural = (arr[0] % sides) + 1;
            const mod = parseInt(this.diceMod || 0);
            this.lastNatural = natural; this.lastFaces = sides;
            this.lastRoll = natural + mod;
            const time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
            
            // Formato: D20+3
            const formula = `D${sides}${mod !== 0 ? (mod > 0 ? '+' + mod : mod) : ''}`;
            
            this.diceLog.unshift({ id: Date.now(), time, formula, result: this.lastRoll, crit: natural===sides, fumble: natural===1 });
            if(this.diceLog.length>8) this.diceLog.pop();
        },

        openImageEditor() { document.getElementById('file-input').click(); }, initCropper(e) { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (evt) => { document.getElementById('crop-target').src = evt.target.result; this.cropperOpen = true; this.$nextTick(() => { if(this.cropperInstance) this.cropperInstance.destroy(); this.cropperInstance = new Cropper(document.getElementById('crop-target'), { aspectRatio: 1, viewMode: 1, guides: false, background: false, autoCropArea: 1 }); }); }; reader.readAsDataURL(file); }, applyCrop() { if(!this.cropperInstance) return; this.char.photo = this.cropperInstance.getCroppedCanvas({width: 300, height: 300}).toDataURL('image/jpeg', 0.8); this.cropperOpen = false; this.notify('Foto atualizada.', 'success'); },
        notify(msg, type='info') { const id = Date.now(); this.notifications.push({id, message: msg, type, dismissed: false}); setTimeout(() => { this.notifications = this.notifications.filter(n => n.id !== id); }, 3000); },
        
        // WIZARD & OTHERS
        openWizard() { if (this.agentCount >= MAX_AGENTS) return this.notify('Limite de agentes atingido.', 'error'); this.wizardOpen = true; this.wizardStep = 1; this.wizardData = { class: '', attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} }; this.wizardPoints = 8; },
        selectArchetype(arch) { this.wizardData.class = arch.class; this.wizardData.attrs = {for:-1, agi:-1, int:-1, von:-1, pod:-1}; this.wizardFocusAttr = arch.focus; this.wizardData.attrs[arch.focus] = 0; this.wizardStep = 2; this.wizardPoints = 8; setTimeout(() => this.updateWizardChart(), 50); },
        modWizardAttr(key, val) { const current = this.wizardData.attrs[key]; const isFocus = key === this.wizardFocusAttr; const min = isFocus ? 0 : -1; if (val > 0) { if (this.wizardPoints > 0 && current < 3) { this.wizardData.attrs[key]++; this.wizardPoints--; } } else { if (current > min) { this.wizardData.attrs[key]--; this.wizardPoints++; } } this.updateWizardChart(); },
        finishWizard() { const id = 'z_' + Date.now(); const tempChar = { class: this.wizardData.class, level: 1, attrs: this.wizardData.attrs, stats: { pv:{}, pf:{}, pdf:{} } }; const oldChar = this.char; this.char = tempChar; this.recalcDerivedStats(); this.char = oldChar; const newChar = { id: id, name: '', identity: '', class: this.wizardData.class, level: 1, photo: '', history: '', credits: 0, stats: { pv: { current: tempChar.stats.pv.max, max: tempChar.stats.pv.max }, pf: { current: tempChar.stats.pf.max, max: tempChar.stats.pf.max }, pdf: { current: tempChar.stats.pdf.max, max: tempChar.stats.pdf.max } }, attrs: {...this.wizardData.attrs}, inventory: { weapons: [], armor: [], gear: [], backpack: "", social: {people:[], objects:[]} }, skills: [], powers: { passive: '', active: '', trackName: '', techniques: [], lvl3: '', lvl6: '', lvl9: '', lvl10: '' } }; this.chars[id] = newChar; this.sanitizeData(); const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db'; localStorage.setItem(key, JSON.stringify(this.chars)); if(!this.isGuest) this.syncCloud(true); this.wizardOpen = false; this.loadCharacter(id); this.notify('Agente Inicializado.', 'success'); }
    }
}