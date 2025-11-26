// ==========================================
// CONFIGURAÇÃO DO SUPABASE
// ==========================================
const SUPABASE_URL = 'https://pwjoakajtygmbpezcrix.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_ULe02tKpa38keGvz8bEDIw_mJJaBK6j';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const MAX_AGENTS = 30;
const APP_VERSION = 'v32.0-StableCore';

function zeniteSystem() {
    return {
        // --- ESTADO DO SISTEMA ---
        systemLoading: true, // Controla apenas o boot inicial
        isGuest: false,
        user: null,
        userMenuOpen: false,
        
        // --- LOGIN FORM ---
        authInput: { email: '', pass: '', key: '', newPass: '' }, 
        authMode: 'login', 
        authLoading: false, // Controla spinner dos botões
        authMsg: '', 
        authMsgType: '',

        // --- SYNC ENGINE ---
        unsavedChanges: false,
        isSyncing: false,
        saveStatus: 'idle',

        // --- DADOS DO JOGO ---
        chars: {}, activeCharId: null, char: null, agentCount: 0,
        
        // --- UI ---
        currentView: 'dashboard', activeTab: 'profile', logisticsTab: 'inventory',
        notifications: [], configModal: false,
        confirmOpen: false, confirmTitle: '', confirmDesc: '', confirmAction: null, confirmType: 'danger',

        // --- FERRAMENTAS ---
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

        // ============================================================
        // 1. INICIALIZAÇÃO BLINDADA
        // ============================================================
        async initSystem() {
            console.log(`ZENITE ${APP_VERSION} START`);

            // A. Correção do BFCache (Quando o usuário clica em "Voltar" do navegador)
            window.addEventListener('pageshow', (event) => {
                // Se a página foi restaurada do cache, destrava tudo
                if (event.persisted || performance.getEntriesByType("navigation")[0].type === "back_forward") {
                    console.log("Restored from cache - Unlocking UI");
                    this.systemLoading = false;
                    this.authLoading = false;
                }
            });

            // B. Timeout de Segurança (Se travar, libera em 4s)
            setTimeout(() => { 
                if(this.systemLoading) {
                    console.warn("Boot timeout - Forcing unlock");
                    this.systemLoading = false; 
                }
            }, 4000);

            // C. Verificação de URL (Erro de OAuth)
            if (window.location.hash && window.location.hash.includes('error=')) {
                this.notify('Login cancelado pelo provedor.', 'warn');
                history.replaceState(null, null, ' '); // Limpa URL
            }

            // D. Lógica de Boot
            try {
                const isGuestStore = localStorage.getItem('zenite_is_guest') === 'true';

                if (isGuestStore) {
                    // Modo Convidado
                    this.isGuest = true;
                    this.loadLocalData('zenite_guest_db');
                } else {
                    // Modo Online: Verifica Sessão
                    const { data: { session } } = await supabase.auth.getSession();
                    
                    if (session) {
                        this.user = session.user;
                        await this.fetchData(); // Carrega dados da nuvem
                    }
                }
            } catch (e) {
                console.error("Boot Error:", e);
                this.notify("Erro ao iniciar. Tente recarregar.", "error");
            } finally {
                // Sempre libera a tela no final
                this.systemLoading = false;
            }

            // E. Listeners de Eventos (Sem bloquear a tela)
            this.setupListeners();
        },

        setupListeners() {
            // Auth Listener (Login/Logout em tempo real)
            supabase.auth.onAuthStateChange(async (event, session) => {
                if (event === 'SIGNED_IN' && session) {
                    // Só ativa loading se for um login explícito, não refresh
                    if(!this.user) this.systemLoading = true; 
                    
                    this.user = session.user;
                    this.isGuest = false;
                    localStorage.removeItem('zenite_is_guest');
                    await this.fetchData();
                    
                    this.systemLoading = false;
                    if(window.location.hash) history.replaceState(null, null, ' '); // Limpa URL suja
                    
                } else if (event === 'SIGNED_OUT') {
                    this.user = null;
                    this.chars = {};
                    this.currentView = 'dashboard';
                }
            });

            // Auto-Save Local Watcher
            this.$watch('char', (val) => {
                if (val && this.activeCharId) {
                    // Deep Copy para quebrar referência
                    this.chars[this.activeCharId] = JSON.parse(JSON.stringify(val));
                    
                    const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db';
                    localStorage.setItem(key, JSON.stringify(this.chars));
                    
                    if (!this.isGuest) {
                        this.unsavedChanges = true;
                        if (this.saveStatus !== 'error') this.saveStatus = 'idle';
                    }
                    if(this.activeTab === 'profile') this.updateRadarChart();
                }
            }, { deep: true });

            // Sync Periódico (60s)
            setInterval(() => {
                if (this.user && this.unsavedChanges && !this.isSyncing) this.syncCloud(true);
            }, 60000);
        },

        // ============================================================
        // 2. DATA & SYNC
        // ============================================================
        async syncCloud(silent = false) {
            if (!this.user || this.isGuest || this.isSyncing) return;
            this.isSyncing = true;
            if(!silent) this.notify('Sincronizando...', 'info');
            
            // Timeout de 10s para não travar botão
            const timeout = new Promise((_, r) => setTimeout(() => r(new Error('Timeout')), 10000));

            try {
                // Garante que o char atual está no objeto principal
                if (this.char && this.activeCharId) {
                    this.chars[this.activeCharId] = JSON.parse(JSON.stringify(this.char));
                }
                const payload = JSON.parse(JSON.stringify(this.chars));

                // Race contra o timeout
                const { error } = await Promise.race([
                    supabase.from('profiles').upsert({ id: this.user.id, data: payload }),
                    timeout
                ]);

                if (error) throw error;

                this.unsavedChanges = false;
                this.saveStatus = 'success';
                if(!silent) this.notify('Salvo com Sucesso!', 'success');
                
                // Reseta visual do botão
                setTimeout(() => { if(this.saveStatus === 'success') this.saveStatus = 'idle'; }, 2000);

            } catch (e) {
                this.saveStatus = 'error';
                if(!silent) this.notify('Erro ao Salvar: ' + (e.message || 'Rede'), 'error');
            } finally {
                this.isSyncing = false;
            }
        },

        async fetchData() {
            if (!this.user) return;
            
            // Busca segura
            let { data, error } = await supabase.from('profiles').select('data').eq('id', this.user.id).single();

            // Se usuário não tem perfil, cria um vazio
            if (error && error.code === 'PGRST116') { 
                await supabase.from('profiles').insert([{ id: this.user.id, data: {} }]);
                data = { data: {} };
            }

            if (data) {
                let cloudData = data.data || {};
                // Migração de Array legado (caso exista)
                if (Array.isArray(cloudData)) { 
                    let c = {}; 
                    cloudData.forEach(x => { if(x?.id) c[x.id] = x; }); 
                    cloudData = c; 
                }
                this.chars = cloudData;
                this.sanitizeData(); // Limpa lixo
                localStorage.setItem('zenite_cached_db', JSON.stringify(this.chars));
            }
        },

        // ============================================================
        // 3. AUTHENTICATION
        // ============================================================
        async doSocialAuth(provider) {
            this.authLoading = true; 
            // NÃO ATIVAMOS systemLoading aqui. Deixamos o usuário ver o botão girando.
            // Isso evita travar a tela se o popup for bloqueado.
            
            const { error } = await supabase.auth.signInWithOAuth({ 
                provider, 
                options: { redirectTo: window.location.origin } 
            });
            
            if (error) { 
                this.notify('Erro: ' + error.message, 'error'); 
                this.authLoading = false; 
            }
        },

        async doAuth(action) {
            let email = this.authInput.email; if (!email.includes('@')) email += '@zenite.os';
            if(!email || (!this.authInput.pass && action !== 'reset')) return this.notify('Preencha os campos.', 'warn');
            
            this.authLoading = true;
            try {
                let error;
                if (action === 'login') { 
                    const { error: e } = await supabase.auth.signInWithPassword({ email, password: this.authInput.pass }); 
                    error = e; 
                }
                else if (action === 'register') { 
                    const { error: e } = await supabase.auth.signUp({ email, password: this.authInput.pass }); 
                    error = e; 
                    if(!error) { this.notify('Conta criada! Faça login.', 'success'); this.authMode = 'login'; return; } 
                }
                else if (action === 'reset') { 
                    const { error: e } = await supabase.auth.resetPasswordForEmail(email); 
                    error = e; 
                    if(!error) this.notify('Email enviado!', 'success'); 
                }
                
                if (error) throw error;
                if (action === 'login') this.authInput = { email: '', pass: '' };
            } catch (e) { 
                this.notify(e.message, 'error'); 
            } finally { 
                this.authLoading = false; 
            }
        },

        async logout() {
            if(this.unsavedChanges && !this.isGuest) await this.syncCloud(true);
            await supabase.auth.signOut();
            
            // Limpeza total
            this.user = null; 
            this.isGuest = false; 
            this.chars = {}; 
            this.char = null; 
            this.activeCharId = null;
            localStorage.removeItem('zenite_cached_db'); 
            localStorage.removeItem('zenite_is_guest');
            
            // Recarrega para garantir estado limpo
            window.location.reload();
        },

        // ============================================================
        // 4. UTILS & HELPERS
        // ============================================================
        askLogout() { this.askConfirm('SAIR DA CONTA?', 'Dados pendentes serão salvos.', 'warn', () => this.logout()); },
        askSwitchToOnline() { this.askConfirm('FICAR ONLINE?', 'Ir para login. Dados offline ficam aqui.', 'info', () => { this.isGuest = false; localStorage.removeItem('zenite_is_guest'); window.location.reload(); }); },
        enterGuest() { this.isGuest = true; localStorage.setItem('zenite_is_guest', 'true'); this.loadLocalData('zenite_guest_db'); this.notify('Modo Offline.', 'success'); },
        
        sanitizeData() { if (!this.chars || typeof this.chars !== 'object') this.chars = {}; Object.keys(this.chars).forEach(k => { if (!this.chars[k] || !this.chars[k].id) delete this.chars[k]; }); this.updateAgentCount(); },
        loadLocalData(key) { const local = localStorage.getItem(key); if(local) { try { let p = JSON.parse(local); this.chars = Array.isArray(p) ? {} : (p || {}); if(Array.isArray(p)) p.forEach(c => {if(c?.id) this.chars[c.id]=c}); this.sanitizeData(); } catch(e) {} } },
        saveAndExit() { if(this.char && this.activeCharId) { this.chars[this.activeCharId] = JSON.parse(JSON.stringify(this.char)); this.updateAgentCount(); } const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db'; localStorage.setItem(key, JSON.stringify(this.chars)); if (!this.isGuest && this.unsavedChanges) this.syncCloud(true); this.currentView = 'dashboard'; this.activeCharId = null; this.char = null; },
        askDeleteChar(id) { this.askConfirm('ELIMINAR AGENTE?', 'Ação irreversível.', 'danger', () => { delete this.chars[id]; this.sanitizeData(); const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db'; localStorage.setItem(key, JSON.stringify(this.chars)); if(!this.isGuest) this.syncCloud(true); this.notify('Deletado.', 'success'); }); },
        askHardReset() { this.askConfirm('DELETAR TUDO?', 'Apaga cache local.', 'danger', () => { localStorage.clear(); window.location.reload(); }); },
        updateAgentCount() { this.agentCount = Object.keys(this.chars).length; },
        
        loadCharacter(id) { 
            if (!this.chars[id]) return this.notify('Erro: Ficha inexistente.', 'error');
            this.activeCharId = id; 
            this.char = JSON.parse(JSON.stringify(this.chars[id]));
            
            // Inicializadores
            if(!this.char.inventory) this.char.inventory = { weapons:[], armor:[], gear:[], backpack: "", social: { people:[], objects:[]} };
            if(!this.char.skills) this.char.skills = [];
            if(!this.char.powers) this.char.powers = { passive: '', active: '', techniques: [] };
            if(!this.char.stats) this.char.stats = { pv: {current:10, max:10}, pf: {current:10, max:10}, pdf: {current:10, max:10} };
            
            // Fix Visual Null
            if(this.char.stats.pv.current == null) this.char.stats.pv.current = this.char.stats.pv.max || 10;
            if(this.char.stats.pf.current == null) this.char.stats.pf.current = this.char.stats.pf.max || 10;
            if(this.char.stats.pdf.current == null) this.char.stats.pdf.current = this.char.stats.pdf.max || 10;

            this.currentView = 'sheet'; 
            this.activeTab = 'profile'; 
            setTimeout(() => this.updateRadarChart(), 100);
        },

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
        notify(msg, type='info') { const id = Date.now(); this.notifications.push({id, message: msg, type, dismissed: false}); setTimeout(() => { this.notifications = this.notifications.filter(n => n.id !== id); }, 3000); },
        exportData() { const str = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.chars)); const a = document.createElement('a'); a.href = str; a.download = `zenite_bkp_${Date.now()}.json`; a.click(); },
        importData(e) { const file = e.target.files[0]; if(!file) return; const r = new FileReader(); r.onload = (evt) => { try { this.chars = JSON.parse(evt.target.result); const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db'; localStorage.setItem(key, JSON.stringify(this.chars)); if(!this.isGuest) this.syncCloud(true); this.notify('Backup restaurado.', 'success'); this.configModal = false; location.reload(); } catch(err) { this.notify('Arquivo inválido.', 'error'); } }; r.readAsText(file); },
        
        // Wizard
        openWizard() { if (this.agentCount >= MAX_AGENTS) return this.notify('Limite atingido.', 'error'); this.wizardOpen = true; this.wizardStep = 1; this.wizardData = { class: '', attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} }; this.wizardPoints = 8; },
        selectArchetype(a) { this.wizardData.class = a.class; this.wizardData.attrs = {for:-1, agi:-1, int:-1, von:-1, pod:-1}; this.wizardFocusAttr = a.focus; this.wizardData.attrs[a.focus] = 0; this.wizardStep = 2; this.wizardPoints = 8; setTimeout(()=>this.updateWizardChart(),50); },
        modWizardAttr(key, val) { const c = this.wizardData.attrs[key]; const isFocus = key === this.wizardFocusAttr; if (val > 0 && this.wizardPoints > 0 && c < 3) { this.wizardData.attrs[key]++; this.wizardPoints--; } if (val < 0 && c > (isFocus ? 0 : -1)) { this.wizardData.attrs[key]--; this.wizardPoints++; } this.updateWizardChart(); },
        finishWizard() { const id = 'z_' + Date.now(); const tempChar = { class: this.wizardData.class, level: 1, attrs: this.wizardData.attrs, stats: { pv:{}, pf:{}, pdf:{} } }; const oldChar = this.char; this.char = tempChar; this.recalcDerivedStats(); this.char = oldChar; const newChar = { id: id, name: '', identity: '', class: this.wizardData.class, level: 1, photo: '', history: '', credits: 0, stats: { pv: { current: tempChar.stats.pv.max, max: tempChar.stats.pv.max }, pf: { current: tempChar.stats.pf.max, max: tempChar.stats.pf.max }, pdf: { current: tempChar.stats.pdf.max, max: tempChar.stats.pdf.max } }, attrs: {...this.wizardData.attrs}, inventory: { weapons: [], armor: [], gear: [], backpack: "", social: {people:[], objects:[]} }, skills: [], powers: { passive: '', active: '', techniques: [], lvl3:'', lvl6:'', lvl9:'', lvl10:'' } }; this.chars[id] = newChar; this.sanitizeData(); const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db'; localStorage.setItem(key, JSON.stringify(this.chars)); if(!this.isGuest) this.syncCloud(true); this.wizardOpen = false; this.loadCharacter(id); this.notify('Agente Inicializado.', 'success'); },
        askConfirm(title, desc, type, action) { this.confirmTitle = title; this.confirmDesc = desc; this.confirmType = type; this.confirmAction = action; this.confirmOpen = true; }, confirmYes() { if (this.confirmAction) this.confirmAction(); this.confirmOpen = false; }
    }
}