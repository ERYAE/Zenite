/**
 * ZENITE OS - Core Application
 * Version: v49.1-Hybrid-Fix
 * Changelog:
 * - UI Feedback: INSTANTÂNEO (Pop-up aparece na hora)
 * - Database Save: DEBOUNCED (Salva só quando para de digitar)
 * - Favicon: Lógica preparada para troca de tema
 */

const CONSTANTS = {
    MAX_AGENTS: 30,
    SAVE_INTERVAL: 180000, 
    TOAST_DURATION: 3000,
    // Em produção, nunca exponha chaves assim. Mas para seu MVP, segue o jogo.
    SUPABASE_URL: 'https://pwjoakajtygmbpezcrix.supabase.co',
    SUPABASE_KEY: 'sb_publishable_ULe02tKpa38keGvz8bEDIw_mJJaBK6j'
};

// Utilitário de Debounce (O "Freio" do salvamento)
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function zeniteSystem() {
    return {
        // --- ESTADOS DO SISTEMA ---
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
        
        // --- DADOS ---
        chars: {},
        activeCharId: null,
        char: null,
        agentCount: 0,
        currentView: 'dashboard',
        activeTab: 'profile',
        logisticsTab: 'inventory',
        searchQuery: '',
        
        // --- UI GERAL ---
        diceTrayOpen: true,
        showDiceLog: false,
        diceLog: [],
        lastRoll: '--',
        lastNatural: 0,
        lastFaces: 20,
        diceMod: 0,
        
        // --- MODAIS ---
        configModal: false,
        wizardOpen: false, 
        cropperOpen: false,
        confirmOpen: false,
        confirmData: { title:'', desc:'', action:null, type:'danger' },
        
        // --- WIZARD (Criação) ---
        wizardStep: 1,
        wizardPoints: 8,
        wizardData: { class: '', attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} },
        wizardFocusAttr: '',
        
        // --- CONFIGS ---
        settings: {
            mouseTrail: true,
            compactMode: false,
            performanceMode: false,
            themeColor: 'cyan'
        },
        
        // --- CONTROLE DE SALVAMENTO (Aqui está a mágica) ---
        unsavedChanges: false, // Controla o Pop-up "Discord Style"
        isSyncing: false,
        saveStatus: 'idle',

        // Services
        supabase: null,
        debouncedSaveFunc: null, // Variável para guardar a função com freio

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
            // Inicializa Supabase
            if (typeof window.supabase !== 'undefined') {
                this.supabase = window.supabase.createClient(CONSTANTS.SUPABASE_URL, CONSTANTS.SUPABASE_KEY, {
                    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
                });
            }

            // Inicializa a função de salvamento com "freio" (1 segundo)
            this.debouncedSaveFunc = debounce(() => {
                this.saveLocal();
                // Apenas loga ou faz algo leve, o indicador visual já foi ativado antes
                this.log('Auto-save local triggered', 'info');
            }, 1000);

            window.addEventListener('pageshow', (event) => { if (event.persisted) window.location.reload(); });
            
            this.handleFavicon(); // Verifica o tema ao iniciar
            // Escuta mudanças de tema no sistema (Dark/Light mode)
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.handleFavicon());

            this.log(`ZENITE OS v49.1 READY`);
            
            this.setupCursor();
            this.setupWatchers();

            const isGuest = localStorage.getItem('zenite_is_guest') === 'true';
            
            if (isGuest) {
                this.isGuest = true;
                this.loadLocal('zenite_guest_db');
                this.systemLoading = false;
            } else {
                this.loadLocal('zenite_cached_db');
                if(this.supabase) {
                    try {
                        const { data: { session } } = await this.supabase.auth.getSession();
                        if (session) {
                            this.user = session.user;
                            await this.fetchCloud();
                        }
                    } catch(e) {}
                    
                    this.supabase.auth.onAuthStateChange(async (event, session) => {
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
            
            // Backup periódico na nuvem (a cada 3 min)
            setInterval(() => { if (this.user && this.unsavedChanges && !this.isSyncing) this.syncCloud(true); }, CONSTANTS.SAVE_INTERVAL);
        },

        // --- LÓGICA DO FAVICON ---
        handleFavicon() {
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const link = document.getElementById('dynamic-favicon');
            if(link) {
                // Se você tiver as imagens, descomente a linha abaixo:
                link.href = isDark ? 'images/favicon-white.svg' : 'images/favicon-black.svg';
                
                // Dica: Se quiser testar, crie dois arquivos na pasta images.
            }
        },

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
                    const isInteractive = target.closest('button, a, input, select, textarea, .cursor-pointer');
                    if(isInteractive) {
                        trail.classList.add('hover-active');
                    } else {
                        trail.classList.remove('hover-active');
                    }
                }
                if (this.settings.mouseTrail) document.body.classList.add('custom-cursor-active');
            });
        },

        // --- WATCHERS CRÍTICOS (Aqui corrigimos o comportamento) ---
        setupWatchers() {
            this.$watch('char', (val) => {
                if (this.loadingChar) return;
                if (val && this.activeCharId) {
                    // 1. Atualiza o objeto principal na memória RAM (Instantâneo)
                    this.chars[this.activeCharId] = JSON.parse(JSON.stringify(val));
                    
                    // 2. Feedback Visual: "Ei, tem coisa não salva!" (Instantâneo)
                    if (!this.isGuest) { 
                        this.unsavedChanges = true; 
                        this.saveStatus = 'idle'; 
                    }

                    // 3. Salvar no HD: Espera um pouco para não travar (Debounce)
                    this.debouncedSaveFunc();
                    
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
                } catch(e) { console.error('Data Error'); }
            }
        },

        saveLocal() {
            const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db';
            const payload = { ...this.chars, config: this.settings };
            localStorage.setItem(key, JSON.stringify(payload));
        },

        async fetchCloud() {
            if (!this.user || !this.supabase) return;
            let { data, error } = await this.supabase.from('profiles').select('data').eq('id', this.user.id).single();
            if (error && error.code === 'PGRST116') {
                await this.supabase.from('profiles').insert([{ id: this.user.id, data: { config: this.settings } }]);
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
            if (!this.user || this.isGuest || !this.unsavedChanges || this.isSyncing || !this.supabase) return;
            this.isSyncing = true;
            if(!silent) this.notify('Sincronizando nuvem...', 'info');
            try {
                const payload = { ...this.chars, config: this.settings };
                const { error } = await this.supabase.from('profiles').upsert({ id: this.user.id, data: payload });
                if (error) throw error;
                
                // SUCESSO: Agora sim removemos o aviso visual
                this.unsavedChanges = false;
                this.saveStatus = 'success';
                if(!silent) this.notify('Salvo na nuvem!', 'success');
            } catch (e) {
                this.saveStatus = 'error';
                if(!silent) this.notify('Erro ao sincronizar.', 'error');
            } finally {
                this.isSyncing = false;
            }
        },

        // --- RESTO DO CÓDIGO (Lógica RPG, Dados, Charts - Mantido igual) ---
        updateAgentCount() { this.agentCount = Object.keys(this.chars).length; },

        recalcDerivedStats() { 
            if(!this.char) return; 
            const c = this.char;
            const cl = c.class || 'Titã';
            
            const oldPv = c.stats.pv.max || 0;
            const oldPf = c.stats.pf.max || 0;
            const oldPdf = c.stats.pdf.max || 0;

            const lvl = Math.max(1, parseInt(c.level)||1); 
            const get = (v) => parseInt(c.attrs[v]||0); 
            
            const config = {
                'Titã':        { pv: [15, 4], pf: [12, 2], pdf: [12, 2] },
                'Estrategista':{ pv: [12, 2], pf: [15, 4], pdf: [12, 2] },
                'Infiltrador': { pv: [12, 2], pf: [15, 4], pdf: [12, 3] },
                'Controlador': { pv: [12, 2], pf: [12, 2], pdf: [15, 4] },
                'Psíquico':    { pv: [12, 2], pf: [13, 3], pdf: [14, 3] }
            };
            
            const cfg = config[cl] || config['Titã'];

            const newPv = (cfg.pv[0] + get('for')) + ((cfg.pv[1] + get('for')) * (lvl - 1));
            const newPf = (cfg.pf[0] + get('pod')) + ((cfg.pf[1] + get('pod')) * (lvl - 1));
            const newPdf = (cfg.pdf[0] + get('von')) + ((cfg.pdf[1] + get('von')) * (lvl - 1));

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

        modStat(stat, val) {
            if(!this.char || !this.char.stats[stat]) return;
            const s = this.char.stats[stat];
            const newVal = Math.max(0, Math.min(s.max, s.current + val));
            s.current = newVal;
        },

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
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            root.style.setProperty('--neon-core', hex);
            root.style.setProperty('--neon-rgb', `${r}, ${g}, ${b}`); 
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
            if(this.supabase) await this.supabase.auth.signOut();
            window.location.reload();
        },
        askLogout() { this.askConfirm('SAIR?', 'Dados pendentes serão salvos.', 'warn', () => this.logout()); },
        askSwitchToOnline() { this.askConfirm('FICAR ONLINE?', 'Ir para login.', 'info', () => { this.isGuest = false; localStorage.removeItem('zenite_is_guest'); window.location.reload(); }); },
        enterGuest() { this.isGuest = true; localStorage.setItem('zenite_is_guest', 'true'); this.loadLocal('zenite_guest_db'); },
        doSocialAuth(provider) {
            if(!this.supabase) return this.notify("Erro de conexão.", "error");
            this.authLoading = true;
            this.authMsg = "Conectando...";
            this.supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } })
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

// --- FIXED CHART ANIMATIONS (FLUID MORPHING) ---
        _renderChart(id, data, isWizard=false) {
            const ctx = document.getElementById(id);
            if(!ctx) return;
            
            // Pega a cor atual do tema para manter consistência
            const color = getComputedStyle(document.documentElement).getPropertyValue('--neon-core').trim();
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);
            const rgb = `${r},${g},${b}`;

            // A MÁGICA ESTÁ AQUI:
            if (ctx.chart) {
                // Se o gráfico já existe, ATUALIZA apenas os valores e as cores.
                // O Chart.js vai calcular a interpolação (movimento) sozinho.
                ctx.chart.data.datasets[0].data = data;
                ctx.chart.data.datasets[0].backgroundColor = `rgba(${rgb}, 0.2)`;
                ctx.chart.data.datasets[0].borderColor = `rgba(${rgb}, 1)`;
                ctx.chart.update(); // Animação suave padrão do Chart.js
            } else {
                // Se não existe, CRIA do zero (só na primeira vez)
                ctx.chart = new Chart(ctx, {
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
                                min: -1, 
                                max: isWizard ? 4 : 6, 
                                ticks: { display: false }, 
                                grid: { color: 'rgba(255,255,255,0.1)' },
                                angleLines: { color: 'rgba(255,255,255,0.1)' }
                            } 
                        }, 
                        plugins: { legend: { display: false } },
                        // Configuração para deixar a transição "amanteigada"
                        transitions: {
                            active: {
                                animation: {
                                    duration: 600
                                }
                            }
                        }
                    }
                });
            }
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