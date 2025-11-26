// ==========================================
// CONFIGURAÇÃO DO SUPABASE
// ==========================================
// Substitua pelas suas chaves reais
const SUPABASE_URL = 'https://pwjoakajtygmbpezcrix.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_ULe02tKpa38keGvz8bEDIw_mJJaBK6j';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const MAX_AGENTS = 30;
const APP_VERSION = 'v20.0-DataShield';

function zeniteSystem() {
    return {
        // --- AUTH ---
        user: null,
        isGuest: localStorage.getItem('zenite_is_guest') === 'true',
        authInput: { email: '', pass: '' },
        authMode: 'login',
        authLoading: false,
        authMsg: '',
        authMsgType: '',

        // --- SYSTEM STATE ---
        unsavedChanges: false,
        isSyncing: false,
        currentView: 'dashboard',
        
        // --- DATA ---
        chars: {},
        activeCharId: null,
        char: null,
        agentCount: 0,

        // --- UI ---
        activeTab: 'profile',
        logisticsTab: 'inventory',
        notifications: [],
        configModal: false,
        
        // --- GAME DATA ---
        showDiceLog: false, diceLog: [], lastRoll: '--', lastNatural: 0, lastFaces: 0, diceMod: 0,
        wizardOpen: false, wizardStep: 1, wizardData: { class: '', attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} }, wizardPoints: 8, wizardFocusAttr: '',
        cropperOpen: false, cropperInstance: null,
        archetypes: [
            { class: 'Titã', desc: 'Resiliência e força bruta.', icon: 'fa-solid fa-shield-halved', focus: 'for', color: 'text-rose-500' },
            { class: 'Estrategista', desc: 'Análise tática e liderança.', icon: 'fa-solid fa-chess', focus: 'int', color: 'text-cyan-500' },
            { class: 'Infiltrador', desc: 'Furtividade e precisão.', icon: 'fa-solid fa-user-ninja', focus: 'agi', color: 'text-emerald-500' },
            { class: 'Controlador', desc: 'Manipulação de energia.', icon: 'fa-solid fa-hand-spock', focus: 'pod', color: 'text-violet-500' },
            { class: 'Psíquico', desc: 'Domínio mental.', icon: 'fa-solid fa-brain', focus: 'von', color: 'text-amber-500' }
        ],

        // ==========================================
        // INICIALIZAÇÃO BLINDADA
        // ==========================================
        async initSystem() {
            // 1. CARREGA CACHE LOCAL IMEDIATAMENTE (Visual Instantâneo)
            // Isso garante que você vê suas fichas mesmo se a internet cair ou o login demorar
            this.loadLocalData('zenite_cached_db');

            // 2. Tenta restaurar a última ficha aberta
            const lastId = localStorage.getItem('zenite_last_char_id');
            if (lastId && this.chars[lastId]) {
                this.loadCharacter(lastId);
            }

            // 3. Listener de Auth (Login/Logout)
            supabase.auth.onAuthStateChange(async (event, session) => {
                if (event === 'SIGNED_IN' && session) {
                    this.user = session.user;
                    this.isGuest = false;
                    localStorage.removeItem('zenite_is_guest');
                    
                    // Limpa URL
                    if(window.location.hash && window.location.hash.includes('access_token')) {
                        window.history.replaceState({}, document.title, window.location.pathname);
                    }
                    
                    await this.fetchData(); // Sincroniza com a nuvem
                    this.notify('Conectado: ' + this.user.email, 'success');
                } else if (event === 'SIGNED_OUT') {
                    this.user = null;
                    this.chars = {};
                    this.char = null;
                    this.currentView = 'dashboard';
                }
            });

            // 4. Verifica Sessão Atual
            const { data: { session } } = await supabase.auth.getSession();
            if (this.isGuest) {
                this.loadLocalData('zenite_guest_db');
                this.notify('Modo Offline.', 'warn');
            } else if (session) {
                this.user = session.user;
                await this.fetchData();
            }

            // 5. Auto-Save Local (Sempre atualiza o cache do navegador)
            this.$watch('char', (val) => {
                if (val && this.activeCharId) {
                    this.chars[this.activeCharId] = JSON.parse(JSON.stringify(val));
                    const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db';
                    localStorage.setItem(key, JSON.stringify(this.chars));
                    if (!this.isGuest) this.unsavedChanges = true;
                    if(this.activeTab === 'profile') this.updateRadarChart();
                }
            }, { deep: true });

            // 6. Salvamento Periódico (Backup a cada 5 min)
            setInterval(() => {
                if (this.user && this.unsavedChanges && !this.isSyncing) {
                    this.syncCloud(true);
                }
            }, 300000);

            // 7. Salvamento ao Fechar (Tentativa final)
            window.addEventListener('beforeunload', () => {
                if (this.user && this.unsavedChanges) this.syncCloud(true);
            });
        },

        // ==========================================
        // SINCRONIZAÇÃO INTELIGENTE (SMART SYNC)
        // ==========================================
        async fetchData() {
            if (!this.user) return;
            
            // Baixa dados da nuvem
            let { data, error } = await supabase.from('profiles').select('data').eq('id', this.user.id).single();

            // Se for usuário novo, cria entrada
            if (error && error.code === 'PGRST116') {
                await supabase.from('profiles').insert([{ id: this.user.id, data: {} }]);
                data = { data: {} };
            }

            if (data) {
                let cloudData = {};
                // Tratamento de formato (Array vs Objeto)
                if (Array.isArray(data.data)) {
                    data.data.forEach(c => { if(c && c.id) cloudData[c.id] = c; });
                } else {
                    cloudData = data.data || {};
                }

                // LÓGICA DE PROTEÇÃO DE DADOS:
                // Se a Nuvem estiver vazia, MAS eu tenho dados locais no cache...
                // Significa que o save anterior falhou. NÃO APAGUE O LOCAL.
                const localCount = Object.keys(this.chars).length;
                const cloudCount = Object.keys(cloudData).length;

                if (cloudCount === 0 && localCount > 0) {
                    console.log("⚠️ Nuvem vazia detectada. Restaurando backup local...");
                    this.notify('Restaurando backup local...', 'warn');
                    // Força o envio dos dados locais para a nuvem
                    await this.syncCloud(true);
                } else {
                    // Caso normal: Nuvem tem dados, usamos a nuvem.
                    this.chars = cloudData;
                    localStorage.setItem('zenite_cached_db', JSON.stringify(this.chars));
                }
                
                this.sanitizeData();
            }
        },

        async syncCloud(silent = false) {
            if (!this.user || this.isGuest || this.isSyncing) return;
            
            this.isSyncing = true;
            if(!silent) this.notify('Salvando na Nuvem...', 'info');

            // Garante estado atual
            if (this.char && this.activeCharId) this.chars[this.activeCharId] = this.char;

            const { error } = await supabase
                .from('profiles')
                .upsert({ id: this.user.id, data: this.chars });

            this.isSyncing = false;

            if (error) {
                if(!silent) this.notify('Erro no Save: ' + error.message, 'error');
                // Se der erro, mantemos 'unsavedChanges' como true para tentar de novo depois
            } else {
                this.unsavedChanges = false;
                if(!silent) this.notify('Salvo com Sucesso.', 'success');
            }
        },

        // ==========================================
        // AUTHENTICATION
        // ==========================================
        async doGoogleAuth() {
            try {
                this.authLoading = true;
                const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: { redirectTo: window.location.origin }
                });
                if (error) throw error;
            } catch (e) {
                this.notify('Erro Google: ' + e.message, 'error');
                this.authLoading = false;
            }
        },

        async doAuth(action) {
            let email = this.authInput.email;
            if (!email.includes('@')) email = email + '@zenite.os';
            if(!email || !this.authInput.pass) return this.authMsg = 'Preencha dados.';
            
            this.authLoading = true;
            this.authMsg = 'Processando...';

            try {
                let error;
                if (action === 'login') {
                    const { error: err } = await supabase.auth.signInWithPassword({ email, password: this.authInput.pass });
                    error = err;
                } else if (action === 'register') {
                    const { error: err } = await supabase.auth.signUp({ email, password: this.authInput.pass });
                    error = err;
                    if(!error) {
                        this.authMsg = 'Conta criada! Faça login.';
                        this.authMsgType = 'success';
                        this.authMode = 'login';
                        this.authLoading = false;
                        return;
                    }
                }
                if (error) throw error;
                if (action === 'login') { this.authMsg = ''; this.authInput = { email: '', pass: '' }; }
            } catch (e) {
                this.authMsg = e.message;
                this.authMsgType = 'error';
            } finally {
                this.authLoading = false;
            }
        },

        logout() {
            if (confirm("Desconectar da Neural Link?")) {
                // Tenta salvar antes de sair
                if(this.unsavedChanges) this.syncCloud(true);
                
                supabase.auth.signOut();
                this.user = null;
                this.isGuest = false;
                this.chars = {};
                this.char = null;
                this.activeCharId = null;
                this.currentView = 'dashboard';
                
                // Limpa dados sensíveis
                localStorage.removeItem('zenite_cached_db');
                localStorage.removeItem('zenite_is_guest');
                localStorage.removeItem('zenite_last_char_id');
            }
        },

        enterGuest() {
            this.isGuest = true;
            localStorage.setItem('zenite_is_guest', 'true');
            this.loadLocalData('zenite_guest_db');
            this.notify('Modo Offline.', 'success');
        },

        // ==========================================
        // LÓGICA DO JOGO
        // ==========================================
        sanitizeData() {
            if (!this.chars || typeof this.chars !== 'object') this.chars = {};
            Object.keys(this.chars).forEach(key => { if (!this.chars[key] || !this.chars[key].id) delete this.chars[key]; });
            this.updateAgentCount();
        },
        updateAgentCount() { this.agentCount = Object.keys(this.chars).length; },
        
        loadLocalData(key) {
            const local = localStorage.getItem(key);
            if(local) {
                try { 
                    const parsed = JSON.parse(local);
                    // Mescla o que achou no cache com o estado atual, preferindo o cache se chars estiver vazio
                    if (Object.keys(this.chars).length === 0) {
                         this.chars = Array.isArray(parsed) ? {} : parsed || {};
                         if(Array.isArray(parsed)) parsed.forEach(c => { if(c && c.id) this.chars[c.id] = c; });
                    }
                    this.sanitizeData();
                } catch(e) { console.error('Erro ao ler cache', e); }
            }
        },

        loadCharacter(id) {
            if (!this.chars[id]) return this.notify('Erro: Ficha corrompida.', 'error');
            this.activeCharId = id;
            localStorage.setItem('zenite_last_char_id', id); // Salva onde parou
            
            this.char = JSON.parse(JSON.stringify(this.chars[id]));
            
            // Migrations / Garantia de Campos
            if(!this.char.inventory) this.char.inventory = { weapons:[], armor:[], gear:[], backpack: "", social: { people:[], objects:[] } };
            if(!this.char.inventory.weapons) this.char.inventory.weapons = [];
            if(!this.char.inventory.armor) this.char.inventory.armor = [];
            if(!this.char.inventory.gear) this.char.inventory.gear = [];
            if(!this.char.inventory.social) this.char.inventory.social = { people:[], objects:[] };
            if(!this.char.skills) this.char.skills = [];
            if(!this.char.powers) this.char.powers = { passive: '', active: '', techniques: [] };
            if(!this.char.stats) this.char.stats = { pv: {current:10, max:10}, pf: {current:10, max:10}, pdf: {current:10, max:10} };
            
            this.currentView = 'sheet';
            this.activeTab = 'profile';
            setTimeout(() => this.updateRadarChart(), 100);
        },

        deleteCharacter(id) {
            if (window.confirm('Excluir agente permanentemente?')) {
                delete this.chars[id];
                this.sanitizeData();
                
                // Atualiza Cache
                const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db';
                localStorage.setItem(key, JSON.stringify(this.chars));
                
                // CRÍTICO: Força sincronização imediata ao deletar
                if(!this.isGuest) this.syncCloud(true);
                
                this.notify('Agente eliminado.', 'success');
            }
        },

        // --- MANTEIGA DO PÃO (Stats, Wizard, Items, etc) ---
        // Funções padrão do sistema mantidas iguais
        recalcDerivedStats() {
            if(!this.char) return;
            const c = this.char;
            const lvl = Math.min(10, Math.max(1, parseInt(c.level) || 1));
            c.level = lvl;
            const getV = (v) => parseInt(v) || 0;
            const FOR = getV(c.attrs.for), AGI = getV(c.attrs.agi), INT = getV(c.attrs.int), VON = getV(c.attrs.von), POD = getV(c.attrs.pod);
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
                skills: [], powers: { passive: '', active: '', trackName: '', techniques: [], lvl3:'', lvl6:'', lvl9:'', lvl10:'' }
            };
            
            this.chars[id] = newChar;
            this.sanitizeData();
            
            // Atualiza Cache
            const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db';
            localStorage.setItem(key, JSON.stringify(this.chars));
            
            // CRÍTICO: Força sincronização imediata ao criar
            if(!this.isGuest) this.syncCloud(true);

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
            if(cat.startsWith('social_')) { this.char.inventory.social[cat.split('_')[1]].push({...defs[cat]}); } 
            else { this.char.inventory[cat].push({...defs[cat]}); }
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
                    if(!this.isGuest) this.syncCloud(true);
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