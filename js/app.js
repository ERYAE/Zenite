const SUPABASE_URL = 'https://pwjoakajtygmbpezcrix.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_ULe02tKpa38keGvz8bEDIw_mJJaBK6j';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});
const MAX_AGENTS = 30;
const APP_VERSION = 'v45.1-LevelUp';

function zeniteSystem() {
    return {
        // --- STATE ---
        systemLoading: true,
        user: null,
        isGuest: false,
        userMenuOpen: false,
        loadingChar: false,
        diceTrayOpen: true,
        
        // --- SETTINGS & FILTERS ---
        consoleOpen: false,
        sysLogs: [],
        searchQuery: '', 
        settings: {
            mouseTrail: true,
            compactMode: false,
            performanceMode: false,
            themeColor: 'cyan'
        },

        // --- AUTH ---
        authLoading: false, authMsg: '', authMsgType: '',

        // --- SYNC ---
        unsavedChanges: false, isSyncing: false, saveStatus: 'idle',

        // --- DATA ---
        chars: {}, activeCharId: null, char: null, agentCount: 0,
        
        // --- UI ---
        currentView: 'dashboard', activeTab: 'profile', logisticsTab: 'inventory',
        notifications: [], configModal: false,
        confirmOpen: false, confirmTitle: '', confirmDesc: '', confirmAction: null, confirmType: 'danger',

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
            this.log(`ZENITE ${APP_VERSION} BOOT`, 'info');
            this.authLoading = false;
            
            // --- GLOBAL ERROR HANDLING ---
            window.onerror = (msg, url, line) => {
                if (msg === 'Script error.' || msg.includes('Script error')) return true;
                this.log(`ERR: ${msg} @ ${line}`, 'error'); 
                return false; 
            };
            window.onunhandledrejection = (e) => { 
                if (e.reason && e.reason.message && e.reason.message.includes('ResizeObserver')) return;
                this.log(`PROMISE: ${e.reason}`, 'error'); 
            };

            // --- CURSOR INTERATIVO (SPEED UP) ---
            const trail = document.getElementById('mouse-trail');
            let mouseX = 0, mouseY = 0, trailX = 0, trailY = 0;
            
            if (window.matchMedia("(pointer: fine)").matches) {
                document.addEventListener('mousemove', (e) => { 
                    mouseX = e.clientX; mouseY = e.clientY; 
                    if(trail) {
                        const target = e.target;
                        if(target && (target.tagName === 'BUTTON' || target.tagName === 'A' || target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA' || target.classList.contains('cursor-pointer'))) {
                            trail.classList.add('hover-active');
                        } else {
                            trail.classList.remove('hover-active');
                        }
                    }
                });
                
                const animateTrail = () => {
                    if (this.settings.mouseTrail && !this.settings.performanceMode && trail) {
                        // Aumentei o fator para 0.5 para reduzir o delay (mais responsivo)
                        trailX += (mouseX - trailX) * 0.5;
                        trailY += (mouseY - trailY) * 0.5;
                        trail.style.transform = `translate(${trailX - 8}px, ${trailY - 8}px)`;
                        trail.style.opacity = '1';
                        document.body.classList.add('custom-cursor-active');
                    } else {
                        if(trail) trail.style.opacity = '0';
                        document.body.classList.remove('custom-cursor-active');
                    }
                    requestAnimationFrame(animateTrail);
                };
                animateTrail();
            }

            window.addEventListener('pageshow', () => this.authLoading = false);
            window.addEventListener('beforeunload', (e) => {
                if (this.unsavedChanges && !this.isGuest) { e.preventDefault(); e.returnValue = 'Alterações pendentes.'; }
            });

            setTimeout(() => { if(this.systemLoading) this.systemLoading = false; }, 4000);

            if (window.location.hash && window.location.hash.includes('error=')) {
                this.notify('Login cancelado.', 'warn');
                history.replaceState(null, null, ' ');
            }

            const isGuestStore = localStorage.getItem('zenite_is_guest') === 'true';
            if (isGuestStore) {
                this.isGuest = true;
                this.loadLocalData('zenite_guest_db');
                this.sanitizeData();
                this.systemLoading = false;
            } else {
                this.loadLocalData('zenite_cached_db');
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    this.user = session.user;
                    await this.fetchData();
                }
                this.systemLoading = false;
            }

            supabase.auth.onAuthStateChange(async (event, session) => {
                if (event === 'TOKEN_REFRESHED') return;
                if (event === 'SIGNED_IN' && session) {
                    if (this.user && this.user.id === session.user.id) return;
                    this.systemLoading = true;
                    this.user = session.user;
                    this.isGuest = false;
                    localStorage.removeItem('zenite_is_guest');
                    this.loadLocalData('zenite_cached_db');
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

            this.$watch('char', (val) => {
                if (this.loadingChar) return;
                if (val && this.activeCharId) {
                    this.chars[this.activeCharId] = JSON.parse(JSON.stringify(val));
                    const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db';
                    localStorage.setItem(key, JSON.stringify(this.chars));
                    if (!this.isGuest) { this.unsavedChanges = true; this.saveStatus = 'idle'; }
                    if (this.activeTab === 'profile') this.updateRadarChart();
                }
            }, { deep: true });

            setInterval(() => { 
                if (this.user && this.unsavedChanges && !this.isSyncing) this.syncCloud(true);
            }, 180000); 
        },

        handleKeys(e) { if (e.ctrlKey && e.shiftKey && e.key === 'D') { e.preventDefault(); this.consoleOpen = !this.consoleOpen; } },
        log(msg, type='info') {
            const time = new Date().toLocaleTimeString();
            console.log(`[${type.toUpperCase()}] ${msg}`);
            this.sysLogs.unshift({time, msg, type});
            if(this.sysLogs.length > 50) this.sysLogs.pop();
        },
        toggleSystemLog() { this.consoleOpen = !this.consoleOpen; },
        toggleSetting(key, val=null) {
            if(val !== null) {
                this.settings[key] = val;
                if(key === 'themeColor') this.applyTheme(val);
            } else {
                this.settings[key] = !this.settings[key];
                if(key === 'compactMode') document.body.classList.toggle('compact-mode', this.settings.compactMode);
                if(key === 'performanceMode') document.body.classList.toggle('performance-mode', this.settings.performanceMode);
            }
        },
        applyTheme(color) {
            const root = document.documentElement;
            if(color === 'cyan') root.style.setProperty('--neon-core', '#0ea5e9');
            if(color === 'purple') root.style.setProperty('--neon-core', '#d946ef');
            if(color === 'gold') root.style.setProperty('--neon-core', '#eab308');
        },
        toggleFullscreen() {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
                this.notify('Modo Tela Cheia', 'info');
            } else {
                if (document.exitFullscreen) { document.exitFullscreen(); }
            }
        },

        exportData() {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.chars));
            const a = document.createElement('a'); a.href = dataStr; a.download = `zenite_bkp_${new Date().toISOString().slice(0,10)}.json`; a.click(); a.remove();
            this.notify('Backup baixado!', 'success');
        },
        triggerFileImport() { document.getElementById('import-file').click(); },
        processImport(e) {
            const file = e.target.files[0];
            if (!file) return;
            const r = new FileReader();
            r.onload = (evt) => {
                try {
                    const d = JSON.parse(evt.target.result);
                    if (typeof d === 'object') {
                        this.chars = { ...this.chars, ...d };
                        this.sanitizeData();
                        const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db';
                        localStorage.setItem(key, JSON.stringify(this.chars));
                        this.unsavedChanges = true;
                        if (!this.isGuest) this.syncCloud(true);
                        this.notify('Importado!', 'success');
                        this.configModal = false;
                        if(this.currentView === 'dashboard') this.updateAgentCount();
                    }
                } catch (err) { this.notify('Erro ao importar.', 'error'); }
            };
            r.readAsText(file);
        },

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

        async syncCloud(silent = false) {
            if (!this.user || this.isGuest || !this.unsavedChanges || this.isSyncing) return;
            this.isSyncing = true; 
            if(!silent) this.notify('Sincronizando...', 'info');
            try {
                if (this.char && this.activeCharId) this.chars[this.activeCharId] = JSON.parse(JSON.stringify(this.char));
                const payload = JSON.parse(JSON.stringify(this.chars));
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
            } finally { this.isSyncing = false; }
        },

        async fetchData() { 
            if (!this.user) return; 
            let { data, error } = await supabase.from('profiles').select('data').eq('id', this.user.id).single(); 
            if (error && error.code === 'PGRST116') { await supabase.from('profiles').insert([{ id: this.user.id, data: {} }]); data = { data: {} }; } 
            if (data) { 
                let cloudChars = data.data || {}; 
                if (Array.isArray(cloudChars)) { let o = {}; cloudChars.forEach(x => { if(x?.id) o[x.id] = x; }); cloudChars = o; } 
                let merged = { ...cloudChars };
                let hasLocalOnly = false;
                Object.keys(this.chars).forEach(localId => {
                    if (!merged[localId]) { merged[localId] = this.chars[localId]; hasLocalOnly = true; }
                });
                this.chars = merged;
                this.sanitizeData(); 
                localStorage.setItem('zenite_cached_db', JSON.stringify(this.chars)); 
                if (hasLocalOnly) { this.unsavedChanges = true; this.syncCloud(true); }
            } 
        },

        loadCharacter(id) { 
            if (!this.chars[id]) return this.notify('Ficha inválida.', 'error'); 
            this.loadingChar = true; 
            this.activeCharId = id; 
            requestAnimationFrame(() => {
                this.char = JSON.parse(JSON.stringify(this.chars[id])); 
                if(!this.char.inventory) this.char.inventory = { weapons:[], armor:[], gear:[], backpack: "", social: { people:[], objects:[]} }; 
                if(!this.char.skills) this.char.skills = []; 
                if(!this.char.powers) this.char.powers = { passive: '', active: '', techniques: [] }; 
                if(!this.char.stats) this.char.stats = { pv: {current:10, max:10}, pf: {current:10, max:10}, pdf: {current:10, max:10} }; 
                this.currentView = 'sheet'; 
                this.activeTab = 'profile'; 
                this.$nextTick(() => {
                    this.updateRadarChart();
                    setTimeout(() => { this.loadingChar = false; this.unsavedChanges = false; }, 300);
                });
            });
        },

        askLogout() { this.askConfirm('SAIR?', 'Dados pendentes serão salvos.', 'warn', () => this.logout()); },
        askSwitchToOnline() { this.askConfirm('FICAR ONLINE?', 'Ir para login.', 'info', () => { this.isGuest = false; localStorage.removeItem('zenite_is_guest'); window.location.reload(); }); },
        enterGuest() { this.isGuest = true; localStorage.setItem('zenite_is_guest', 'true'); this.loadLocalData('zenite_guest_db'); this.sanitizeData(); },
        sanitizeData() { if (!this.chars || typeof this.chars !== 'object') this.chars = {}; Object.keys(this.chars).forEach(k => { if (!this.chars[k] || !this.chars[k].id) delete this.chars[k]; }); this.updateAgentCount(); },
        loadLocalData(key) { const local = localStorage.getItem(key); if(local) { try { let p = JSON.parse(local); this.chars = Array.isArray(p) ? {} : (p || {}); if(Array.isArray(p)) p.forEach(c => {if(c?.id) this.chars[c.id]=c}); this.sanitizeData(); } catch(e) {} } },
        saveAndExit() { if(this.char && this.activeCharId) { this.chars[this.activeCharId] = JSON.parse(JSON.stringify(this.char)); this.updateAgentCount(); } const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db'; localStorage.setItem(key, JSON.stringify(this.chars)); if (!this.isGuest && this.unsavedChanges) this.syncCloud(true); this.currentView = 'dashboard'; this.activeCharId = null; this.char = null; },
        askDeleteChar(id) { this.askConfirm('ELIMINAR?', 'Irreversível.', 'danger', () => { delete this.chars[id]; this.sanitizeData(); const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db'; localStorage.setItem(key, JSON.stringify(this.chars)); if(!this.isGuest) this.syncCloud(true); this.notify('Deletado.', 'success'); }); },
        askHardReset() { this.askConfirm('LIMPAR TUDO?', 'Remove dados locais.', 'danger', () => { localStorage.clear(); window.location.reload(); }); },
        updateAgentCount() { this.agentCount = Object.keys(this.chars).length; },
        askConfirm(title, desc, type, action) { this.confirmTitle = title; this.confirmDesc = desc; this.confirmType = type; this.confirmAction = action; this.confirmOpen = true; }, confirmYes() { if (this.confirmAction) this.confirmAction(); this.confirmOpen = false; },
        
        // --- LEVEL UP LOGIC FIX ---
        recalcDerivedStats() { 
            if(!this.char) return; 
            const c = this.char; 
            
            // 1. Armazena máximos ANTIGOS
            const oldPv = c.stats.pv.max || 0;
            const oldPf = c.stats.pf.max || 0;
            const oldPdf = c.stats.pdf.max || 0;

            // 2. Calcula NOVOS máximos
            const lvl = Math.max(1, parseInt(c.level)||1); 
            const getV = (v) => parseInt(v)||0; 
            const FOR = getV(c.attrs.for), POD = getV(c.attrs.pod), VON = getV(c.attrs.von); 
            
            const newPv = Math.max(5, (12+FOR)+((2+FOR)*(lvl-1))); 
            const newPf = Math.max(5, (10+POD)+((2+POD)*(lvl-1))); 
            const newPdf = Math.max(5, (10+VON)+((2+VON)*(lvl-1))); 

            // 3. Aplica a Diferença (Delta) nos Atuais
            if (oldPv > 0) c.stats.pv.current += (newPv - oldPv);
            if (oldPf > 0) c.stats.pf.current += (newPf - oldPf);
            if (oldPdf > 0) c.stats.pdf.current += (newPdf - oldPdf);

            // 4. Atualiza os Máximos
            c.stats.pv.max = newPv;
            c.stats.pf.max = newPf;
            c.stats.pdf.max = newPdf;
            
            // Garante que não fique negativo
            c.stats.pv.current = Math.max(0, c.stats.pv.current);
            c.stats.pf.current = Math.max(0, c.stats.pf.current);
            c.stats.pdf.current = Math.max(0, c.stats.pdf.current);
        },
        
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
        openImageEditor() { document.getElementById('file-input').click(); }, initCropper(e) { const file = e.target.files[0]; if(!file) return; const reader = new FileReader(); reader.onload = (evt) => { document.getElementById('crop-target').src = evt.target.result; this.cropperOpen = true; this.$nextTick(() => { if(this.cropperInstance) this.cropperInstance.destroy(); this.cropperInstance = new Cropper(document.getElementById('crop-target'), { aspectRatio: 1, viewMode: 1 }); }); }; reader.readAsDataURL(file); }, applyCrop() { if(!this.cropperInstance) return; this.char.photo = this.cropperInstance.getCroppedCanvas({width:300, height:300}).toDataURL('image/jpeg', 0.8); this.cropperOpen = false; this.notify('Foto salva.', 'success'); },
        notify(msg, type='info') { const id = Date.now(); this.notifications.push({id, message: msg, type, dismissed: false}); setTimeout(() => { this.notifications = this.notifications.filter(n => n.id !== id); }, 3000); this.log(msg, type); },
        openWizard() { if (this.agentCount >= MAX_AGENTS) return this.notify('Limite atingido.', 'error'); this.wizardOpen = true; this.wizardStep = 1; this.wizardData = { class: '', attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} }; this.wizardPoints = 8; }, selectArchetype(a) { this.wizardData.class = a.class; this.wizardData.attrs = {for:-1, agi:-1, int:-1, von:-1, pod:-1}; this.wizardFocusAttr = a.focus; this.wizardData.attrs[a.focus] = 0; this.wizardStep = 2; this.wizardPoints = 8; setTimeout(()=>this.updateWizardChart(),50); }, modWizardAttr(key, val) { const c = this.wizardData.attrs[key]; const isFocus = key === this.wizardFocusAttr; if (val > 0 && this.wizardPoints > 0 && c < 3) { this.wizardData.attrs[key]++; this.wizardPoints--; } if (val < 0 && c > (isFocus ? 0 : -1)) { this.wizardData.attrs[key]--; this.wizardPoints++; } this.updateWizardChart(); }, finishWizard() { const id = 'z_' + Date.now(); const tempChar = { class: this.wizardData.class, level: 1, attrs: this.wizardData.attrs, stats: { pv:{}, pf:{}, pdf:{} } }; const oldChar = this.char; this.char = tempChar; this.recalcDerivedStats(); this.char = oldChar; const newChar = { id: id, name: '', identity: '', class: this.wizardData.class, level: 1, photo: '', history: '', credits: 0, stats: { pv: { current: tempChar.stats.pv.max, max: tempChar.stats.pv.max }, pf: { current: tempChar.stats.pf.max, max: tempChar.stats.pf.max }, pdf: { current: tempChar.stats.pdf.max, max: tempChar.stats.pdf.max } }, attrs: {...this.wizardData.attrs}, inventory: { weapons: [], armor: [], gear: [], backpack: "", social: {people:[], objects:[]} }, skills: [], powers: { passive: '', active: '', techniques: [], lvl3:'', lvl6:'', lvl9:'', lvl10:'' } }; this.chars[id] = newChar; this.sanitizeData(); const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db'; localStorage.setItem(key, JSON.stringify(this.chars)); if(!this.isGuest) this.syncCloud(true); this.wizardOpen = false; this.loadCharacter(id); this.notify('Agente Inicializado.', 'success'); }
    }
}