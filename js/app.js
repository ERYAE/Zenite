/**
 * ZENITE OS - Main Controller v80.0 (Clean Version)
 * Lógica central simplificada. Depende de: config.js, rpg.js, audio.js, utils.js, netlink.js
 */

function zeniteSystem() {
    return {
        // --- ESTADOS PRINCIPAIS ---
        systemLoading: true,
        loadingProgress: 0,
        loadingText: 'BOOT',
        user: null,
        isGuest: false,
        
        // --- DADOS ---
        chars: {},
        activeCharId: null,
        char: null, // Personagem atual
        agentCount: 0,
        
        // --- UI CONTROLS ---
        currentView: 'dashboard',
        activeTab: 'profile',
        logisticsTab: 'inventory',
        searchQuery: '',
        userMenuOpen: false,
        configModal: false,
        
        // --- MODULES & HELPERS ---
        netLink: null, // Instância do NetLink
        supabase: null,
        
        // --- LOGIN STATES ---
        authLoading: false,
        authMsg: '',
        authMsgType: '',

        // --- WIDGETS (Dados, Wizard, Etc) ---
        diceTrayOpen: false,
        diceLog: [],
        lastRoll: '--',
        diceMod: 0,
        diceReason: '',
        trayDockMode: 'float',
        trayPosition: { x: 100, y: 100 },
        
        // Wizard Data
        wizardOpen: false,
        wizardStep: 1,
        wizardPoints: 8,
        wizardData: { class: '', name: '', identity: '', age: '', history: '', photo: null, attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} },
        wizardFocusAttr: '',

        // Cropper
        cropperOpen: false,
        cropperInstance: null,
        uploadContext: 'char',

        // Confirm Modal
        confirmOpen: false,
        confirmData: { title:'', desc:'', action:null, type:'danger' },

        // Configs
        settings: {
            compactMode: false,
            themeColor: 'cyan',
            sfxEnabled: true,
            crtMode: false // Padrão desligado para não atrapalhar
        },

        // Flags de Estado
        unsavedChanges: false,
        isSyncing: false,
        
        // --- GETTERS ---
        get archetypes() { return RPG ? RPG.archetypes : []; },
        
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

        // ====================================================================
        // 1. INICIALIZAÇÃO (Onde tudo começa)
        // ====================================================================
        async initSystem() {
            console.log("Zenite OS: Booting...");
            
            // Safety Timeout (Se travar, libera a tela em 5s)
            setTimeout(() => { if(this.systemLoading) this.systemLoading = false; }, 5000);

            try {
                // Configura Supabase
                if (typeof window.supabase !== 'undefined' && typeof CONFIG !== 'undefined') {
                    this.supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
                }

                // Carrega configurações locais
                this.loadLocalData();
                
                // Aplica Tema
                this.applyTheme(this.settings.themeColor);
                if (this.settings.crtMode) document.body.classList.add('crt-mode');
                if (this.settings.sfxEnabled && typeof SFX !== 'undefined') SFX.toggle(true);

                // Verifica Sessão (Auth)
                await this.checkAuth();

                // Finaliza Boot
                this.loadingProgress = 100;
                setTimeout(() => { this.systemLoading = false; }, 500);
                
                console.log("Zenite OS: Online");

            } catch (err) {
                console.error("Boot Critical Failure:", err);
                this.loadingText = "ERROR: " + err.message;
                // Não desliga o loading para mostrar o erro
            }
        },

        async checkAuth() {
            const isGuest = localStorage.getItem('zenite_is_guest') === 'true';
            
            if (isGuest) {
                this.isGuest = true;
                this.loadLocalData('zenite_guest_db');
            } else if (this.supabase) {
                const { data: { session } } = await this.supabase.auth.getSession();
                if (session) {
                    this.user = session.user;
                    await this.fetchCloud();
                    
                    // Inicia NetLink se estiver logado
                    if (typeof netLinkSystem !== 'undefined') {
                        this.netLink = netLinkSystem(this.supabase, this.user);
                        this.netLink.init();
                    }
                }
                
                // Listener de Auth
                this.supabase.auth.onAuthStateChange(async (event, session) => {
                    if (event === 'SIGNED_IN' && session) {
                        this.user = session.user;
                        this.isGuest = false;
                        localStorage.removeItem('zenite_is_guest');
                        await this.fetchCloud();
                        if (this.netLink) this.netLink.init();
                    } else if (event === 'SIGNED_OUT') {
                        this.user = null;
                        this.chars = {};
                        this.currentView = 'dashboard';
                    }
                });
            }
        },

        // ====================================================================
        // 2. GERENCIAMENTO DE DADOS (Salvar/Carregar)
        // ====================================================================
        loadLocalData(key = 'zenite_cached_db') {
            const local = localStorage.getItem(key);
            if (local) {
                try {
                    const parsed = JSON.parse(local);
                    if (parsed.config) this.settings = { ...this.settings, ...parsed.config };
                    
                    // Filtra apenas os personagens
                    const validChars = {};
                    Object.keys(parsed).forEach(k => {
                        if (k !== 'config' && k !== 'trayPos' && parsed[k].id) {
                            validChars[k] = parsed[k];
                        }
                    });
                    this.chars = validChars;
                    this.updateAgentCount();
                } catch (e) { console.error("Erro ao ler cache", e); }
            }
        },

        saveLocal() {
            const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db';
            const payload = { ...this.chars, config: this.settings };
            localStorage.setItem(key, JSON.stringify(payload));
        },

        async fetchCloud() {
            if (!this.user || !this.supabase) return;
            // Lógica simples de sync: Nuvem ganha se existir, senão cria.
            const { data, error } = await this.supabase.from('profiles').select('data').eq('id', this.user.id).single();
            
            if (data && data.data) {
                // Merge cuidadoso
                const cloudData = data.data;
                if (cloudData.config) this.settings = { ...this.settings, ...cloudData.config };
                
                Object.keys(cloudData).forEach(k => {
                    if (k !== 'config') this.chars[k] = cloudData[k];
                });
                
                this.updateAgentCount();
                this.saveLocal();
                this.applyTheme(this.settings.themeColor);
            } else if (error && error.code === 'PGRST116') {
                // Perfil não existe, cria
                await this.supabase.from('profiles').insert([{ id: this.user.id, data: { config: this.settings } }]);
            }
        },

        async syncCloud(silent = false) {
            if (!this.user || this.isGuest || !this.unsavedChanges || this.isSyncing) return;
            this.isSyncing = true;
            if (!silent) this.notify("Salvando...", "info");
            
            try {
                const payload = { ...this.chars, config: this.settings };
                await this.supabase.from('profiles').upsert({ id: this.user.id, data: payload });
                this.unsavedChanges = false;
                if (!silent) {
                    this.notify("Salvo!", "success");
                    if (typeof SFX !== 'undefined') SFX.play('save');
                }
            } catch (e) {
                this.notify("Erro ao salvar na nuvem", "error");
            } finally {
                this.isSyncing = false;
            }
        },

        // ====================================================================
        // 3. LÓGICA DO PERSONAGEM (RPG & WIZARD)
        // ====================================================================
        loadCharacter(id) {
            if (!this.chars[id]) return;
            
            // Clone profundo para edição segura
            this.char = JSON.parse(JSON.stringify(this.chars[id]));
            this.activeCharId = id;
            this.currentView = 'sheet';
            
            // Garante integridade dos dados (campos novos)
            if (!this.char.inventory) this.char.inventory = { weapons:[], armor:[], gear:[], social:{people:[], objects:[]} };
            if (!this.char.powers) this.char.powers = { passive:'', active:'', techniques:[] };
            
            // Atualiza gráfico na próxima renderização
            this.$nextTick(() => {
                if (typeof UTILS !== 'undefined') this.updateRadarChart();
            });
        },

        saveAndExit() {
            if (this.char && this.activeCharId) {
                this.chars[this.activeCharId] = JSON.parse(JSON.stringify(this.char));
                this.updateAgentCount();
                this.saveLocal();
                if (!this.isGuest) {
                    this.unsavedChanges = true;
                    this.syncCloud();
                }
            }
            this.currentView = 'dashboard';
            this.char = null;
            this.activeCharId = null;
        },

        // --- WIZARD ---
        openWizard() {
            if (this.agentCount >= CONFIG.MAX_AGENTS) return this.notify("Limite de agentes!", "error");
            this.wizardStep = 1;
            this.wizardPoints = 8;
            this.wizardData = { class: '', name: '', identity: '', age: '', history: '', photo: null, attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} };
            this.wizardOpen = true;
        },

        selectArchetype(arch) {
            this.wizardData.class = arch.class;
            // Reseta atributos
            this.wizardData.attrs = {for:-1, agi:-1, int:-1, von:-1, pod:-1};
            this.wizardData.attrs[arch.focus] = 0;
            this.wizardFocusAttr = arch.focus;
            this.wizardStep = 2;
            this.$nextTick(() => this.updateWizardChart());
        },

        modWizardAttr(key, val) {
            const current = this.wizardData.attrs[key];
            const isFocus = key === this.wizardFocusAttr;
            
            if (val > 0 && this.wizardPoints > 0 && current < 3) {
                this.wizardData.attrs[key]++;
                this.wizardPoints--;
            } else if (val < 0 && current > (isFocus ? 0 : -1)) {
                this.wizardData.attrs[key]--;
                this.wizardPoints++;
            }
            this.updateWizardChart();
        },

        finishWizard() {
            if (!this.wizardData.name) return this.notify("Nome obrigatório!", "warn");
            
            const id = 'z_' + Date.now();
            // Usa o RPG.js para criar
            const newChar = RPG.createBlankChar(id, this.wizardData);
            
            this.chars[id] = newChar;
            this.updateAgentCount();
            this.saveLocal();
            if (!this.isGuest) this.syncCloud(true);
            
            this.wizardOpen = false;
            this.loadCharacter(id);
            this.notify("Agente criado!", "success");
        },

        // --- HELPERS RPG ---
        modAttr(key, val) {
            if (!this.char) return;
            const c = this.char;
            if ((val > 0 && c.attrs[key] < 6) || (val < 0 && c.attrs[key] > -1)) {
                c.attrs[key] += val;
                this.recalcStats();
                this.updateRadarChart();
            }
        },

        modStat(statKey, val) {
            if (!this.char || !this.char.stats[statKey]) return;
            const s = this.char.stats[statKey];
            s.current = Math.max(0, Math.min(s.max, s.current + val));
        },

        recalcStats() {
            // Chama a lógica do RPG.js
            const newStats = RPG.calculateDerived(this.char.class, this.char.level, this.char.attrs);
            const c = this.char;
            
            // Aplica mantendo o dano relativo
            ['pv', 'pf', 'pdf'].forEach(stat => {
                const diff = c.stats[stat].max - c.stats[stat].current;
                c.stats[stat].max = newStats[stat];
                c.stats[stat].current = Math.max(0, newStats[stat] - diff);
            });
        },

        // ====================================================================
        // 4. UTILITÁRIOS (Dice, UI, Config)
        // ====================================================================
        toggleSetting(key, val) {
            if (val !== undefined) this.settings[key] = val;
            else this.settings[key] = !this.settings[key];
            
            if (key === 'themeColor') this.applyTheme(this.settings.themeColor);
            if (key === 'crtMode') {
                if(this.settings.crtMode) document.body.classList.add('crt-mode');
                else document.body.classList.remove('crt-mode');
            }
            if (key === 'sfxEnabled' && typeof SFX !== 'undefined') SFX.toggle(this.settings.sfxEnabled);
            
            this.saveLocal();
            if (!this.isGuest) this.syncCloud(true);
        },

        applyTheme(colorName) {
            const colors = CONFIG.THEMES || {}; // Fallback seguro
            // Lógica de cores simplificada
            const map = { 'cyan': '#0ea5e9', 'purple': '#d946ef', 'gold': '#eab308' };
            const hex = map[colorName] || map['cyan'];
            document.documentElement.style.setProperty('--neon-core', hex);
            // RGB manual para opacidade
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            document.documentElement.style.setProperty('--neon-rgb', `${r}, ${g}, ${b}`);
        },

        // --- DICE ---
        toggleDiceTray() { this.diceTrayOpen = !this.diceTrayOpen; },
        
        roll(sides) {
            if (typeof SFX !== 'undefined') SFX.play('roll');
            const rollVal = Math.floor(Math.random() * sides) + 1;
            const total = rollVal + parseInt(this.diceMod || 0);
            
            const log = {
                id: Date.now(),
                time: new Date().toLocaleTimeString(),
                formula: `D${sides}` + (this.diceMod ? `+${this.diceMod}` : ''),
                result: total,
                crit: rollVal === sides,
                fumble: rollVal === 1,
                reason: this.diceReason
            };
            
            this.diceLog.unshift(log);
            this.lastRoll = total;
            this.diceReason = '';
            
            // Broadcast se estiver em campanha
            if (this.netLink && this.netLink.activeCampaign) {
                this.netLink.broadcastRoll(log);
            }
        },

        // --- IMAGES (CROPPER) ---
        initCropper(e) {
            const file = e.target.files[0];
            if(file && typeof UTILS !== 'undefined') {
                UTILS.initCropper(file, 'crop-target', () => {
                    this.cropperOpen = true;
                    this.$nextTick(() => {
                        if(this.cropperInstance) this.cropperInstance.destroy();
                        this.cropperInstance = new Cropper(document.getElementById('crop-target'), { aspectRatio: 1, viewMode: 1 });
                    });
                });
            }
        },

        applyCrop() {
            if(this.cropperInstance && typeof UTILS !== 'undefined') {
                const result = UTILS.getCroppedImage(this.cropperInstance);
                if (this.uploadContext === 'wizard') this.wizardData.photo = result;
                else if (this.char) this.char.photo = result;
                this.cropperOpen = false;
                this.notify("Imagem atualizada!", "success");
            }
        },

        // --- CHARTS ---
        updateRadarChart() { 
            if (this.char && typeof UTILS !== 'undefined') {
                UTILS.renderChart('radarChart', [
                    this.char.attrs.for, this.char.attrs.agi, this.char.attrs.int, this.char.attrs.von, this.char.attrs.pod
                ]); 
            }
        },
        
        updateWizardChart() {
            if (typeof UTILS !== 'undefined') {
                UTILS.renderChart('wizChart', [
                    this.wizardData.attrs.for, this.wizardData.attrs.agi, this.wizardData.attrs.int, this.wizardData.attrs.von, this.wizardData.attrs.pod
                ], true);
            }
        },

        // --- UI HELPERS ---
        notify(msg, type='info') {
            const id = Date.now();
            this.notifications.push({id, message: msg, type});
            setTimeout(() => { this.notifications = this.notifications.filter(n => n.id !== id); }, 3000);
        },
        
        updateAgentCount() { this.agentCount = Object.keys(this.chars).length; },
        
        addItem(cat) { 
            if(!this.char) return;
            const defs = { weapons: {name:'Arma', dmg:'1d6', range:'C'}, armor:{name:'Traje', def:'1'}, gear:{name:'Item', qty:1}, social_people:{name:'Nome', role:'Relação'}, social_objects:{name:'Objeto', desc:''} };
            if(cat.includes('social')) {
                this.char.inventory.social[cat.split('_')[1]].push({...defs[cat]});
            } else {
                this.char.inventory[cat].push({...defs[cat]});
            }
        },
        deleteItem(cat, idx, sub) {
            if(sub) this.char.inventory.social[sub].splice(idx, 1);
            else this.char.inventory[cat].splice(idx, 1);
        },
        
        // Auth Helpers
        askLogout() { if(confirm("Sair do sistema?")) this.logout(); },
        async logout() {
            localStorage.removeItem('zenite_cached_db');
            localStorage.removeItem('zenite_is_guest');
            if(this.supabase) await this.supabase.auth.signOut();
            window.location.reload();
        },
        enterGuest() {
            this.isGuest = true;
            localStorage.setItem('zenite_is_guest', 'true');
            this.loadLocalData('zenite_guest_db');
        },
        askDeleteChar(id) {
            if(confirm("Deletar agente? Isso é irreversível.")) {
                delete this.chars[id];
                this.saveLocal();
                if(!this.isGuest) this.syncCloud();
                this.updateAgentCount();
                this.notify("Agente deletado.");
            }
        },
        askSwitchToOnline() {
            if(confirm("Ir para o modo online? Seus dados offline não serão migrados automaticamente.")) {
                this.isGuest = false;
                localStorage.removeItem('zenite_is_guest');
                window.location.reload();
            }
        },
        doSocialAuth(provider) {
            this.authLoading = true;
            this.supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });
        }
    };
}