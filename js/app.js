const SUPABASE_URL = 'https://pwjoakajtygmbpezcrix.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_ULe02tKpa38keGvz8bEDIw_mJJaBK6j';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const MAX_AGENTS = 30;
const APP_VERSION = 'v25.0-Polished';

function zeniteSystem() {
    return {
        // --- AUTH & LOAD ---
        systemLoading: true,
        user: null,
        isGuest: false,
        userMenuOpen: false, // Novo menu de perfil
        
        // --- LOGIN FORM ---
        authInput: { email: '', pass: '', key: '', newPass: '' }, 
        authMode: 'login', authLoading: false, authMsg: '', authMsgType: '',

        // --- SYNC ENGINE ---
        unsavedChanges: false,
        isSyncing: false,
        saveStatus: 'idle', // idle, success, error

        // --- UI STATES ---
        currentView: 'dashboard',
        activeTab: 'profile',
        logisticsTab: 'inventory',
        configModal: false,
        
        // --- MODAL CONFIRM ---
        confirmOpen: false, confirmTitle: '', confirmDesc: '', confirmAction: null, confirmType: 'danger',

        // --- DATA ---
        chars: {}, activeCharId: null, char: null, agentCount: 0,
        
        // --- EXTRAS ---
        showDiceLog: false, diceLog: [], lastRoll: '--', lastNatural: 0, lastFaces: 0, diceMod: 0,
        wizardOpen: false, wizardStep: 1, wizardData: { class: '', attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} }, wizardPoints: 8, wizardFocusAttr: '',
        cropperOpen: false, cropperInstance: null,
        archetypes: [
            { class: 'Titã', icon: 'fa-solid fa-shield-halved', focus: 'for', color: 'text-rose-500', desc: 'Resiliência e força bruta.' },
            { class: 'Estrategista', icon: 'fa-solid fa-chess', focus: 'int', color: 'text-cyan-500', desc: 'Análise tática e liderança.' },
            { class: 'Infiltrador', icon: 'fa-solid fa-user-ninja', focus: 'agi', color: 'text-emerald-500', desc: 'Furtividade e precisão.' },
            { class: 'Controlador', icon: 'fa-solid fa-hand-spock', focus: 'pod', color: 'text-violet-500', desc: 'Manipulação de energia.' },
            { class: 'Psíquico', icon: 'fa-solid fa-brain', focus: 'von', color: 'text-amber-500', desc: 'Domínio mental.' }
        ],

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
                    
                    if (!this.isGuest) {
                        this.unsavedChanges = true;
                        this.saveStatus = 'idle'; // Reseta status visual
                    }
                    if(this.activeTab === 'profile') this.updateRadarChart();
                }
            }, { deep: true });

            // Smart Auto-Sync (60s)
            setInterval(() => { if (this.user && this.unsavedChanges && !this.isSyncing) this.syncCloud(true); }, 60000);
            window.addEventListener('beforeunload', () => { if (this.user && this.unsavedChanges) this.syncCloud(true); });
        },

        // --- SYNC ROBUSTO ---
        async syncCloud(silent = false) {
            if (!this.user || this.isGuest || this.isSyncing) return;
            
            this.isSyncing = true;
            if(!silent) this.notify('Sincronizando...', 'info');

            // Timeout de segurança (15s)
            const timeout = setTimeout(() => {
                if(this.isSyncing) {
                    this.isSyncing = false;
                    this.saveStatus = 'error';
                    if(!silent) this.notify('Tempo limite excedido.', 'error');
                }
            }, 15000);

            try {
                if (this.char && this.activeCharId) this.chars[this.activeCharId] = this.char;
                
                const { error } = await supabase.from('profiles').upsert({ id: this.user.id, data: this.chars });
                
                clearTimeout(timeout);
                if (error) throw error;
                
                this.unsavedChanges = false;
                this.saveStatus = 'success'; // Visual verde
                setTimeout(() => this.saveStatus = 'idle', 2000); // Volta ao normal após 2s
                
                if(!silent) this.notify('Dados Salvos.', 'success');
            } catch (e) {
                clearTimeout(timeout);
                this.saveStatus = 'error';
                if(!silent) this.notify('Falha ao salvar.', 'error');
            } finally {
                this.isSyncing = false;
            }
        },

        async fetchData() {
            if (!this.user) return;
            let { data, error } = await supabase.from('profiles').select('data').eq('id', this.user.id).single();
            if (error && error.code === 'PGRST116') { await supabase.from('profiles').insert([{ id: this.user.id, data: {} }]); data = { data: {} }; }
            if (data) {
                let cloudData = {};
                if (Array.isArray(data.data)) data.data.forEach(c => { if(c && c.id) cloudData[c.id] = c; });
                else cloudData = data.data || {};
                this.chars = cloudData;
                this.sanitizeData();
                localStorage.setItem('zenite_cached_db', JSON.stringify(this.chars));
            }
        },

        // --- AUTH & SOCIAL ---
        async doSocialAuth(provider) {
            this.authLoading = true;
            this.systemLoading = true; // Ativa loader global para cobrir redirecionamento
            const { error } = await supabase.auth.signInWithOAuth({ provider: provider, options: { redirectTo: window.location.origin } });
            if (error) { this.notify('Erro: ' + error.message, 'error'); this.authLoading = false; this.systemLoading = false; }
        },

        async doAuth(action) {
            let email = this.authInput.email; if (!email.includes('@')) email += '@zenite.os'; 
            if(!email || (!this.authInput.pass && action !== 'reset')) return this.notify('Preencha os campos.', 'warn');
            this.authLoading = true;
            try {
                let error;
                if (action === 'login') { const { error: err } = await supabase.auth.signInWithPassword({ email, password: this.authInput.pass }); error = err; }
                else if (action === 'register') { const { error: err } = await supabase.auth.signUp({ email, password: this.authInput.pass }); error = err; if(!error) { this.notify('Conta criada!', 'success'); this.authMode = 'login'; return; } }
                if (error) throw error;
                if (action === 'login') this.authInput = { email: '', pass: '' };
            } catch (e) { this.notify(e.message, 'error'); } finally { this.authLoading = false; }
        },

        // LOGOUT REFORÇADO
        async logout() {
            // Tenta salvar antes
            if(this.unsavedChanges && !this.isGuest) await this.syncCloud(true);
            
            // Limpeza Local Imediata
            this.user = null;
            this.isGuest = false;
            this.chars = {};
            this.char = null;
            this.activeCharId = null;
            this.currentView = 'dashboard';
            localStorage.removeItem('zenite_cached_db');
            localStorage.removeItem('zenite_is_guest');
            
            // Limpeza Remota
            await supabase.auth.signOut();
            window.location.reload(); // Reload garante limpeza total da memória
        },

        askLogout() { this.askConfirm('DESCONECTAR?', 'Saindo da conta atual.', 'warn', () => this.logout()); },
        askSwitchToOnline() { this.askConfirm('FICAR ONLINE?', 'Ir para login. Dados offline continuam aqui.', 'info', () => { this.isGuest = false; localStorage.removeItem('zenite_is_guest'); window.location.reload(); }); },
        enterGuest() { this.isGuest = true; localStorage.setItem('zenite_is_guest', 'true'); this.loadLocalData('zenite_guest_db'); this.notify('Modo Offline.', 'success'); },
        askHardReset() { this.askConfirm('DELETAR TUDO?', 'Apaga dados do navegador.', 'danger', () => { localStorage.clear(); window.location.reload(); }); },

        // --- CORE LOGIC ---
        sanitizeData() { if (!this.chars || typeof this.chars !== 'object') this.chars = {}; Object.keys(this.chars).forEach(key => { if (!this.chars[key] || !this.chars[key].id) delete this.chars[key]; }); this.updateAgentCount(); },
        loadLocalData(key) { const local = localStorage.getItem(key); if(local) { try { let parsed = JSON.parse(local); if (Array.isArray(parsed)) { this.chars = {}; parsed.forEach(c => { if(c && c.id) this.chars[c.id] = c; }); } else { this.chars = parsed || {}; } this.sanitizeData(); } catch(e) {} } },
        saveAndExit() { if (this.char && this.activeCharId) { this.chars[this.activeCharId] = JSON.parse(JSON.stringify(this.char)); this.updateAgentCount(); } const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db'; localStorage.setItem(key, JSON.stringify(this.chars)); if (!this.isGuest && this.unsavedChanges) this.syncCloud(true); this.currentView = 'dashboard'; this.activeCharId = null; this.char = null; },
        askDeleteChar(id) { this.askConfirm('ELIMINAR AGENTE?', 'Ação irreversível.', 'danger', () => { delete this.chars[id]; this.sanitizeData(); const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db'; localStorage.setItem(key, JSON.stringify(this.chars)); if(!this.isGuest) this.syncCloud(true); this.notify('Agente Eliminado.', 'success'); }); },
        updateAgentCount() { this.agentCount = Object.keys(this.chars).length; },
        loadCharacter(id) { if (!this.chars[id]) return this.notify('Erro: Ficha inexistente.', 'error'); this.activeCharId = id; this.char = JSON.parse(JSON.stringify(this.chars[id])); if(!this.char.inventory) this.char.inventory = { weapons:[], armor:[], gear:[], backpack: "", social: { people:[], objects:[]} }; if(!this.char.skills) this.char.skills = []; if(!this.char.powers) this.char.powers = { passive: '', active: '', techniques: [] }; if(!this.char.stats) this.char.stats = { pv: {current:10, max:10}, pf: {current:10, max:10}, pdf: {current:10, max:10} }; this.currentView = 'sheet'; this.activeTab = 'profile'; setTimeout(() => this.updateRadarChart(), 100); },
        askConfirm(title, desc, type, action) { this.confirmTitle = title; this.confirmDesc = desc; this.confirmType = type; this.confirmAction = action; this.confirmOpen = true; }, confirmYes() { if (this.confirmAction) this.confirmAction(); this.confirmOpen = false; },

        // --- GAMEPLAY ---
        recalcDerivedStats() { if(!this.char) return; const c = this.char; const lvl = Math.max(1, parseInt(c.level)||1); const getV = (v) => parseInt(v)||0; const FOR = getV(c.attrs.for), POD = getV(c.attrs.pod), VON = getV(c.attrs.von); c.stats.pv.max = Math.max(5, (12+FOR)+((2+FOR)*(lvl-1))); c.stats.pf.max = Math.max(5, (10+POD)+((2+POD)*(lvl-1))); c.stats.pdf.max = Math.max(5, (10+VON)+((2+VON)*(lvl-1))); },
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
        roll(s) { const arr = new Uint32Array(1); window.crypto.getRandomValues(arr); const n = (arr[0] % s) + 1; const m = parseInt(this.diceMod || 0); this.lastNatural = n; this.lastFaces = s; this.lastRoll = n + m; const time = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}); const formula = `D${s}${m!==0?(m>0?'+'+m:m):''}`; this.diceLog.unshift({id:Date.now(), time, formula, result: this.lastRoll, crit: n===s, fumble: n===1}); if(this.diceLog.length>8) this.diceLog.pop(); },
        openImageEditor() { document.getElementById('file-input').click(); }, initCropper(e) { const file = e.target.files[0]; if(!file) return; const reader = new FileReader(); reader.onload = (evt) => { document.getElementById('crop-target').src = evt.target.result; this.cropperOpen = true; this.$nextTick(() => { if(this.cropperInstance) this.cropperInstance.destroy(); this.cropperInstance = new Cropper(document.getElementById('crop-target'), { aspectRatio: 1, viewMode: 1 }); }); }; reader.readAsDataURL(file); }, applyCrop() { if(!this.cropperInstance) return; this.char.photo = this.cropperInstance.getCroppedCanvas({width:300, height:300}).toDataURL('image/jpeg', 0.8); this.cropperOpen = false; this.notify('Foto salva.', 'success'); },
        notify(msg, type='info') { const id = Date.now(); this.notifications.push({id, message: msg, type}); setTimeout(() => { this.notifications = this.notifications.filter(n => n.id !== id); }, 3000); },
        exportData() { const str = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.chars)); const a = document.createElement('a'); a.href = str; a.download = `zenite_bkp_${Date.now()}.json`; a.click(); }
    }
}