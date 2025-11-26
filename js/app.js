const MAX_AGENTS = 30;
const APP_VERSION = 'v17.2-Modular';

function zeniteSystem() {
    return {
        // --- AUTH STATE ---
        authToken: localStorage.getItem('zenite_token') || null,
        isGuest: localStorage.getItem('zenite_is_guest') === 'true',
        authInput: { user: '', pass: '', key: '', newPass: '' }, 
        authMode: 'login', 
        authLoading: false,
        authMsg: '',
        authMsgType: '',

        // --- APP STATE ---
        currentView: 'dashboard',
        chars: {},
        activeCharId: null,
        char: null, 
        
        // --- UI ---
        activeTab: 'profile',
        logisticsTab: 'inventory',
        notifications: [],
        configModal: false,
        
        // --- DICE ---
        showDiceLog: false,
        diceLog: [],
        lastRoll: '--',
        lastNatural: 0,
        lastFaces: 0,
        diceMod: 0,

        // --- WIZARD ---
        wizardOpen: false,
        wizardStep: 1,
        wizardData: { class: '', attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} },
        wizardPoints: 8,
        wizardFocusAttr: '',

        // --- CROPPER ---
        cropperOpen: false,
        cropperInstance: null,

        // --- META ---
        agentCount: 0,

        // --- ARCHETYPES ---
        archetypes: [
            { class: 'Titã', desc: 'Resiliência e força bruta.', icon: 'fa-solid fa-shield-halved', focus: 'for', color: 'text-rose-500' },
            { class: 'Estrategista', desc: 'Análise tática e liderança.', icon: 'fa-solid fa-chess', focus: 'int', color: 'text-cyan-500' },
            { class: 'Infiltrador', desc: 'Furtividade e precisão.', icon: 'fa-solid fa-user-ninja', focus: 'agi', color: 'text-emerald-500' },
            { class: 'Controlador', desc: 'Manipulação de energia.', icon: 'fa-solid fa-hand-spock', focus: 'pod', color: 'text-violet-500' },
            { class: 'Psíquico', desc: 'Domínio mental.', icon: 'fa-solid fa-brain', focus: 'von', color: 'text-amber-500' }
        ],

        initSystem() {
            if (this.isGuest) {
                this.loadLocalData('zenite_guest_db');
                this.notify('Modo Offline Ativo', 'warn');
            } else if (this.authToken) {
                this.fetchData().catch(() => this.loadLocalData('zenite_cached_db'));
            }

            this.sanitizeData();

            this.$watch('char', (val) => {
                if (val && this.activeCharId) {
                    this.chars[this.activeCharId] = JSON.parse(JSON.stringify(val));
                    const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db';
                    localStorage.setItem(key, JSON.stringify(this.chars));
                    if(this.activeTab === 'profile') this.updateRadarChart();
                }
            }, { deep: true });

            setInterval(() => {
                if (!this.isGuest && this.authToken) {
                    this.notify('⚠ Lembrete: Salve na Nuvem!', 'warn');
                }
            }, 300000);
        },

        sanitizeData() {
            if (!this.chars || typeof this.chars !== 'object') this.chars = {};
            Object.keys(this.chars).forEach(key => {
                if (!this.chars[key] || !this.chars[key].id) delete this.chars[key];
            });
            this.updateAgentCount();
        },

        updateAgentCount() { this.agentCount = Object.keys(this.chars).length; },

        loadLocalData(key) {
            const local = localStorage.getItem(key);
            if(local) {
                try { 
                    const parsed = JSON.parse(local);
                    if (Array.isArray(parsed)) {
                        this.chars = {};
                        parsed.forEach(c => { if(c && c.id) this.chars[c.id] = c; });
                    } else {
                        this.chars = parsed || {};
                    }
                    this.sanitizeData();
                } catch(e) { this.chars = {}; }
            }
        },

        enterGuest() {
            this.isGuest = true;
            this.authToken = 'guest';
            localStorage.setItem('zenite_is_guest', 'true');
            localStorage.setItem('zenite_token', 'guest');
            this.loadLocalData('zenite_guest_db');
            this.notify('Modo Offline.', 'success');
        },

        async doAuth(action) {
            if(!this.authInput.user) return this.authMsg = 'Falta usuário.';
            this.authLoading = true;
            this.authMsg = 'Processando...';
            
            let payload = { action, username: this.authInput.user };
            if (action === 'login') payload.password = this.authInput.pass;
            else if (action === 'register') { payload.password = this.authInput.pass; payload.recovery_key = this.authInput.key; }
            else if (action === 'reset') { payload.recovery_key = this.authInput.key; payload.new_password = this.authInput.newPass; }

            try {
                const req = await fetch('/api/auth', { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload) 
                });
                const res = await req.json();
                
                if (req.status !== 200) throw new Error(res.error || 'Erro.');

                if (action === 'register' || action === 'reset') {
                    this.authMsg = action === 'reset' ? 'Senha alterada!' : 'Conta criada!';
                    this.authMsgType = 'success';
                    this.authMode = 'login';
                } else {
                    this.isGuest = false;
                    localStorage.removeItem('zenite_is_guest');
                    this.authToken = res.token;
                    localStorage.setItem('zenite_token', res.token);
                    
                    this.chars = res.data || {};
                    if(Array.isArray(this.chars)) {
                        let temp = {}; this.chars.forEach(c => temp[c.id] = c); this.chars = temp;
                    }
                    
                    localStorage.setItem('zenite_cached_db', JSON.stringify(this.chars));
                    this.sanitizeData();
                    this.authMsg = '';
                    this.authInput = { user: '', pass: '', key: '', newPass: '' };
                }
            } catch (e) {
                this.authMsg = e.message;
                this.authMsgType = 'error';
            } finally {
                this.authLoading = false;
            }
        },

        logout() {
            if (confirm("Sair do sistema?")) {
                this.authToken = null;
                this.isGuest = false;
                localStorage.removeItem('zenite_token');
                localStorage.removeItem('zenite_is_guest');
                this.chars = {};
                this.char = null;
                this.activeCharId = null;
                this.currentView = 'dashboard';
            }
        },

        async fetchData() {
            try {
                const req = await fetch('/api/data', { headers: { 'Authorization': `Bearer ${this.authToken}` } });
                if(req.status === 401) return this.logout();
                const data = await req.json();
                
                if(Array.isArray(data)) {
                    this.chars = {};
                    data.forEach(c => { if(c && c.id) this.chars[c.id] = c; });
                } else {
                    this.chars = data || {};
                }
                localStorage.setItem('zenite_cached_db', JSON.stringify(this.chars));
                this.sanitizeData();
            } catch(e) { console.error(e); }
        },

        async syncCloud() {
            if (this.isGuest) return this.notify('Modo Offline: Salvo localmente.', 'info');
            if (!this.authToken) return;

            this.notify('Sincronizando...', 'info');
            try {
                if (this.char && this.activeCharId) this.chars[this.activeCharId] = this.char;
                
                await fetch('/api/data', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${this.authToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data: this.chars })
                });
                this.notify('Salvo na Nuvem.', 'success');
            } catch(e) {
                this.notify('Erro de conexão.', 'error');
            }
        },

        loadCharacter(id) {
            if (!this.chars[id]) return this.notify('Erro: Ficha corrompida.', 'error');
            this.activeCharId = id;
            this.char = JSON.parse(JSON.stringify(this.chars[id]));
            
            // Migrations
            if(!this.char.inventory) this.char.inventory = { weapons:[], armor:[], gear:[], backpack: "", social: { people:[], objects:[] } };
            if(!this.char.inventory.weapons) this.char.inventory.weapons = [];
            if(!this.char.inventory.armor) this.char.inventory.armor = [];
            if(!this.char.inventory.gear) this.char.inventory.gear = [];
            if(!this.char.inventory.social) this.char.inventory.social = { people:[], objects:[] };
            if(!this.char.skills) this.char.skills = [];
            if(!this.char.powers) this.char.powers = { passive: '', active: '', techniques: [] };
            if(!this.char.powers.techniques) this.char.powers.techniques = [];
            if(!this.char.stats) this.char.stats = { pv: {current:10, max:10}, pf: {current:10, max:10}, pdf: {current:10, max:10} };
            if(!this.char.stats.pdf) this.char.stats.pdf = { current: 10, max: 10 };

            this.currentView = 'sheet';
            this.activeTab = 'profile';
            setTimeout(() => this.updateRadarChart(), 100);
        },

        deleteCharacter(id) {
            if (window.confirm('Excluir agente permanentemente?')) {
                delete this.chars[id];
                this.sanitizeData();
                const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db';
                localStorage.setItem(key, JSON.stringify(this.chars));
                if(!this.isGuest) this.syncCloud();
                this.notify('Agente eliminado.', 'success');
            }
        },

        recalcDerivedStats() {
            if(!this.char) return;
            const c = this.char;
            const lvl = Math.min(10, Math.max(1, parseInt(c.level) || 1));
            c.level = lvl;
            const getV = (v) => parseInt(v) || 0;
            const FOR = getV(c.attrs.for);
            const AGI = getV(c.attrs.agi);
            const INT = getV(c.attrs.int);
            const VON = getV(c.attrs.von);
            const POD = getV(c.attrs.pod);
            let maxPV = 0, maxPF = 0, maxPDF = 0;

            if (c.class === 'Titã') { maxPV = (15 + FOR) + ((4 + FOR) * (lvl - 1)); maxPF = (12 + POD) + ((2 + POD) * (lvl - 1)); maxPDF = (10 + VON) + ((2 + VON) * (lvl - 1)); } 
            else if (c.class === 'Estrategista') { maxPV = (12 + FOR) + ((2 + FOR) * (lvl - 1)); maxPF = (15 + POD) + ((4 + POD) * (lvl - 1)); maxPDF = (12 + VON) + ((2 + VON) * (lvl - 1)); } 
            else if (c.class === 'Infiltrador') { maxPV = (12 + FOR) + ((2 + FOR) * (lvl - 1)); maxPF = (12 + POD) + ((2 + POD) * (lvl - 1)); maxPDF = (12 + VON) + ((3 + VON) * (lvl - 1)); } 
            else if (c.class === 'Controlador') { maxPV = (12 + FOR) + ((2 + FOR) * (lvl - 1)); maxPF = (12 + POD) + ((2 + POD) * (lvl - 1)); maxPDF = (15 + VON) + ((4 + VON) * (lvl - 1)); } 
            else if (c.class === 'Psíquico') { maxPV = (12 + FOR) + ((2 + FOR) * (lvl - 1)); maxPF = (13 + POD) + ((3 + POD) * (lvl - 1)); maxPDF = (14 + VON) + ((3 + VON) * (lvl - 1)); } 
            else { maxPV = (12 + FOR) + ((2 + FOR) * (lvl - 1)); maxPF = (10 + POD) + ((2 + POD) * (lvl - 1)); maxPDF = (10 + VON) + ((2 + VON) * (lvl - 1)); }

            c.stats.pv.max = Math.max(5, maxPV);
            c.stats.pf.max = Math.max(5, maxPF);
            c.stats.pdf.max = Math.max(5, maxPDF);
        },

        modStat(type, val) {
            const stat = this.char.stats[type];
            const oldVal = stat.current;
            stat.current = Math.min(Math.max(0, stat.current + val), stat.max);
            if (stat.current < oldVal && type === 'pv') this.triggerFX('damage');
            if (stat.current > oldVal) this.triggerFX('heal');
        },

        modAttr(key, val) {
            const current = this.char.attrs[key];
            if (val > 0 && current < 6) this.char.attrs[key]++;
            if (val < 0 && current > -1) this.char.attrs[key]--;
            this.recalcDerivedStats();
            this.updateRadarChart();
        },

        updateClassLogic() {
            const arch = this.archetypes.find(a => a.class === this.char.class);
            if (arch && this.char.attrs[arch.focus] < 0) this.char.attrs[arch.focus] = 0;
            this.recalcDerivedStats();
            this.updateRadarChart();
        },

        triggerFX(type) {
            const el = document.getElementById(type + '-overlay');
            if(el) { el.style.opacity = '0.4'; setTimeout(() => el.style.opacity = '0', 200); }
        },

        openWizard() {
            if (this.agentCount >= MAX_AGENTS) return this.notify('Limite de agentes atingido.', 'error');
            this.wizardOpen = true;
            this.wizardStep = 1;
            this.wizardData = { class: '', attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} };
            this.wizardPoints = 8;
        },
        selectArchetype(arch) {
            this.wizardData.class = arch.class;
            this.wizardData.attrs = {for:-1, agi:-1, int:-1, von:-1, pod:-1};
            this.wizardFocusAttr = arch.focus;
            this.wizardData.attrs[arch.focus] = 0;
            this.wizardStep = 2;
            this.wizardPoints = 8;
            setTimeout(() => this.updateWizardChart(), 50);
        },
        modWizardAttr(key, val) {
            const current = this.wizardData.attrs[key];
            const isFocus = key === this.wizardFocusAttr;
            if (val > 0 && this.wizardPoints > 0 && current < 3) { this.wizardData.attrs[key]++; this.wizardPoints--; }
            if (val < 0 && current > (isFocus ? 0 : -1)) { this.wizardData.attrs[key]--; this.wizardPoints++; }
            this.updateWizardChart();
        },
        finishWizard() {
            const id = 'z_' + Date.now();
            const tempChar = { class: this.wizardData.class, level: 1, attrs: this.wizardData.attrs, stats: { pv:{}, pf:{}, pdf:{} } };
            const oldChar = this.char; this.char = tempChar; this.recalcDerivedStats(); this.char = oldChar; 

            const newChar = {
                id: id, name: '', identity: '', class: this.wizardData.class, level: 1, photo: '', history: '', credits: 0,
                stats: {
                    pv: { current: tempChar.stats.pv.max, max: tempChar.stats.pv.max },
                    pf: { current: tempChar.stats.pf.max, max: tempChar.stats.pf.max },
                    pdf: { current: tempChar.stats.pdf.max, max: tempChar.stats.pdf.max }
                },
                attrs: {...this.wizardData.attrs},
                inventory: { weapons: [], armor: [], gear: [], backpack: "", social: {people:[], objects:[]} },
                skills: [], powers: { passive: '', active: '', techniques: [], lvl3:'', lvl6:'', lvl9:'', lvl10:'' }
            };
            
            this.chars[id] = newChar;
            this.sanitizeData();
            const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db';
            localStorage.setItem(key, JSON.stringify(this.chars));
            this.wizardOpen = false;
            this.loadCharacter(id);
            this.notify('Agente Inicializado.', 'success');
        },

        addItem(cat) {
            const defs = {
                weapons: { name: 'Nova Arma', dmg: '1d6', range: 'C' },
                armor: { name: 'Traje', def: '1', pen: '0' },
                gear: { name: 'Item', desc: '', qty: 1 },
                social_people: { name: 'Nome', role: 'Relação' },
                social_objects: { name: 'Objeto', desc: 'Detalhes' }
            };
            if(cat.startsWith('social_')) {
                this.char.inventory.social[cat.split('_')[1]].push({...defs[cat]});
            } else {
                this.char.inventory[cat].push({...defs[cat]});
            }
        },
        deleteItem(cat, idx, subcat=null) {
            if(subcat) this.char.inventory.social[subcat].splice(idx, 1);
            else this.char.inventory[cat].splice(idx, 1);
        },

        addSkill() { this.char.skills.push({ name: 'Nova Perícia', level: 1 }); },
        deleteSkill(idx) { this.char.skills.splice(idx, 1); },
        setSkillLevel(idx, lvl) { this.char.skills[idx].level = lvl; },
        addTechnique() { this.char.powers.techniques.push({ name: 'Nova Técnica', desc: 'Efeito...' }); },
        deleteTechnique(idx) { this.char.powers.techniques.splice(idx, 1); },

        renderChart(id, attrs, color) {
            const ctx = document.getElementById(id);
            if (!ctx) return;
            const data = [attrs.for, attrs.agi, attrs.int, attrs.von, attrs.pod];
            if (ctx.chart) { ctx.chart.data.datasets[0].data = data; ctx.chart.update(); return; }
            ctx.chart = new Chart(ctx, {
                type: 'radar',
                data: {
                    labels: ['FOR', 'AGI', 'INT', 'VON', 'POD'],
                    datasets: [{ data: data, backgroundColor: `rgba(${color}, 0.2)`, borderColor: `rgba(${color}, 1)`, borderWidth: 2, pointBackgroundColor: '#fff', pointRadius: 3 }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: { r: { min: -1, max: 6, ticks: { display: false }, grid: { color: 'rgba(255,255,255,0.05)' }, angleLines: { color: 'rgba(255,255,255,0.05)' }, pointLabels: { color: '#94a3b8', font: { size: 9, family: 'Orbitron' } } } },
                    plugins: { legend: { display: false } }
                }
            });
        },
        updateRadarChart() { this.renderChart('radarChart', this.char.attrs, '14, 165, 233'); },
        updateWizardChart() { this.renderChart('wizChart', this.wizardData.attrs, '255, 255, 255'); },

        roll(sides) {
            const arr = new Uint32Array(1);
            window.crypto.getRandomValues(arr);
            const natural = (arr[0] % sides) + 1;
            this.lastNatural = natural; this.lastFaces = sides;
            this.lastRoll = natural + parseInt(this.diceMod || 0);
            const time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
            this.diceLog.unshift({ id: Date.now(), time, formula: `D${sides}${this.diceMod>=0?'+':''}${this.diceMod}`, natural, result: this.lastRoll, crit: natural===sides, fumble: natural===1 });
            if(this.diceLog.length>8) this.diceLog.pop();
        },

        openImageEditor() { document.getElementById('file-input').click(); },
        initCropper(e) {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                document.getElementById('crop-target').src = evt.target.result;
                this.cropperOpen = true;
                this.$nextTick(() => {
                    if(this.cropperInstance) this.cropperInstance.destroy();
                    this.cropperInstance = new Cropper(document.getElementById('crop-target'), { aspectRatio: 1, viewMode: 1, guides: false, background: false, autoCropArea: 1 });
                });
            };
            reader.readAsDataURL(file);
        },
        applyCrop() {
            if(!this.cropperInstance) return;
            this.char.photo = this.cropperInstance.getCroppedCanvas({width: 300, height: 300}).toDataURL('image/jpeg', 0.8);
            this.cropperOpen = false;
            this.notify('Foto atualizada.', 'success');
        },

        notify(msg, type='info') {
            const id = Date.now();
            this.notifications.push({id, message: msg, type, dismissed: false});
            setTimeout(() => { this.notifications = this.notifications.filter(n => n.id !== id); }, 3000);
        },
        exportData() {
            const str = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.chars));
            const a = document.createElement('a'); a.href = str; a.download = `zenite_bkp_${Date.now()}.json`; a.click();
        },
        importData(e) {
            const file = e.target.files[0]; if(!file) return;
            const r = new FileReader();
            r.onload = (evt) => {
                try { 
                    this.chars = JSON.parse(evt.target.result); 
                    const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db';
                    localStorage.setItem(key, JSON.stringify(this.chars));
                    this.notify('Backup restaurado.', 'success'); this.configModal = false; location.reload(); } 
                catch(err) { this.notify('Arquivo inválido.', 'error'); }
            };
            r.readAsText(file);
        },
        hardReset() {
            if (window.confirm('PERIGO: RESETAR O SISTEMA INTEIRO?')) {
                localStorage.removeItem('zenite_cached_db');
                localStorage.removeItem('zenite_guest_db');
                window.location.reload();
            }
        }
    }
}
