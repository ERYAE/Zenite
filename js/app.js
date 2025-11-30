/**
 * ZENITE OS - Core Controller (Refatorado & Modular)
 * Version: v83.0-Koda-Clean
 */

function zeniteSystem() {
    return {
        // --- ESTADO GLOBAL & UI ---
        loading: true, systemLoading: true, loadingProgress: 0, loadingText: 'BOOT',
        currentView: 'dashboard', activeTab: 'profile', logisticsTab: 'inventory',
        user: null, isGuest: false, userMenuOpen: false,
        notifications: [], confirmOpen: false, confirmData: { title:'', desc:'', action:null, type:'danger' },
        
        // --- DADOS ---
        chars: {}, activeCharId: null, char: null, agentCount: 0, searchQuery: '',
        
        // --- MODAIS ---
        configModal: false, wizardOpen: false, cropperOpen: false, cropperInstance: null,
        
        // --- WIDGETS ---
        diceTrayOpen: false, trayDockMode: 'float', trayPosition: { x: window.innerWidth - 350, y: window.innerHeight - 500 },
        isDraggingTray: false, dragOffset: { x: 0, y: 0 }, showDiceTip: false, hasSeenDiceTip: false,
        diceLog: [], lastRoll: '--', diceMod: 0, diceReason: '',

        // --- UX / EFEITOS ---
        isMobile: window.innerWidth < 768, systemFailure: false, logoClickCount: 0, logoClickTimer: null,
        revertConfirmMode: false, isReverting: false, shakeAlert: false,
        
        // --- MÓDULOS EXTERNOS ---
        supabase: null, netLink: null,
        
        // --- WIZARD DATA ---
        wizardStep: 1, wizardPoints: 8, wizardFocusAttr: '',
        wizardData: { class: '', name: '', identity: '', age: '', history: '', photo: null, attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} },

        // --- CONFIG ---
        settings: { mouseTrail: true, compactMode: false, performanceMode: false, crtMode: true, sfxEnabled: true, themeColor: 'cyan' },
        unsavedChanges: false, isSyncing: false, debouncedSave: null,

        // --- GETTERS ---
        get archetypes() { return window.RPG.archetypes; },
        get filteredChars() {
            if (!this.searchQuery) return this.chars;
            const q = this.searchQuery.toLowerCase();
            const res = {};
            Object.keys(this.chars).forEach(id => {
                const c = this.chars[id];
                if ((c.name && c.name.toLowerCase().includes(q)) || (c.class && c.class.toLowerCase().includes(q))) res[id] = c;
            });
            return res;
        },

        // =========================================================================
        // BOOT SYSTEM
        // =========================================================================
        async initSystem() {
            console.log("Zenite: Modular Boot...");
            this.loadingProgress = 10;
            
            // 1. Configs & Libs
            if (window.supabase && window.CONFIG) {
                this.supabase = window.supabase.createClient(window.CONFIG.SUPABASE_URL, window.CONFIG.SUPABASE_KEY);
            }
            if (window.netLinkSystem) this.netLink = window.netLinkSystem(this.supabase, null);
            this.debouncedSave = this.debounce(() => this.saveLocal(), 1000);

            // 2. Listeners & Engine Visual
            this.setupListeners();
            this.setupCursorEngine();
            this.setupWatchers();

            // 3. Carregar Dados (Usando chave ANTIGA para recuperar dados)
            this.loadingProgress = 50; 
            const guest = localStorage.getItem('zenite_is_guest') === 'true';
            
            if(guest) {
                this.isGuest = true;
                this.loadLocal('zenite_guest_db');
            } else {
                this.loadLocal('zenite_cached_db'); // <--- SEUS DADOS ANTIGOS AQUI
                if(this.supabase) {
                    const { data: { session } } = await this.supabase.auth.getSession();
                    if(session) {
                        this.user = session.user;
                        if(this.netLink) { this.netLink.user = this.user; await this.netLink.init(); }
                        this.loadingText = 'CLOUD SYNC';
                        await this.fetchCloud();
                    }
                }
            }

            // 4. Aplica Configs Visuais
            this.applyTheme(this.settings.themeColor);
            if(window.SFX) window.SFX.toggle(this.settings.sfxEnabled);
            this.updateVisualState();
            this.updateAgentCount();

            // 5. Finaliza
            this.loadingProgress = 100;
            setTimeout(() => this.systemLoading = false, 500);
        },

        // =========================================================================
        // CONTROLLER LOGIC (O Maestro)
        // =========================================================================
        
        // --- RPG & FICHAS ---
        loadCharacter(id) {
            if(!this.chars[id]) return;
            this.char = JSON.parse(JSON.stringify(this.chars[id])); // Deep copy
            
            // Garante integridade usando o Módulo RPG
            this.char = window.RPG.recalcStats(this.char);
            if(!this.char.inventory) this.char.inventory = { weapons:[], armor:[], gear:[], backpack: "", social: { people:[], objects:[]} };
            
            this.activeCharId = id;
            this.currentView = 'sheet';
            this.activeTab = 'profile';
            window.SFX.play('click');
            
            // Renderiza gráfico (via Utils)
            this.$nextTick(() => this.updateRadarChart());
        },

        finishWizard() {
            if(!this.wizardData.name) return this.notify("Nome obrigatório!", "warn");
            const id = 'z_' + Date.now();
            
            // Cria via Módulo RPG
            let newChar = window.RPG.createBlankChar(id, this.wizardData);
            newChar = window.RPG.recalcStats(newChar);
            
            this.chars[id] = newChar;
            this.saveAndExit(true); // Salva e limpa wizard
            this.loadCharacter(id);
            this.notify('Agente Criado.', 'success');
        },

        recalcDerivedStats() {
            if(!this.char) return;
            this.char = window.RPG.recalcStats(this.char);
            this.updateRadarChart();
        },

        modAttr(key, val) {
            const c = this.char;
            if ((val > 0 && c.attrs[key] < 6) || (val < 0 && c.attrs[key] > -1)) {
                c.attrs[key] += val;
                this.recalcDerivedStats();
            }
        },

        // --- AUDIO & VISUAL ---
        applyTheme(color) {
            const map = { 'cyan': '#0ea5e9', 'purple': '#d946ef', 'gold': '#eab308' };
            const hex = map[color] || map['cyan'];
            document.documentElement.style.setProperty('--neon-core', hex);
            // Atualiza cor RGB para efeitos
            const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
            document.documentElement.style.setProperty('--neon-rgb', `${r},${g},${b}`);
        },

        toggleSetting(key, val=null) {
            if(val !== null) this.settings[key] = val; else this.settings[key] = !this.settings[key];
            if(key === 'themeColor') this.applyTheme(this.settings[key]);
            if(key === 'sfxEnabled') window.SFX.toggle(this.settings[key]);
            this.updateVisualState();
            this.saveLocal();
        },

        // --- PERSISTÊNCIA (DATA) ---
        loadLocal(key) {
            const local = localStorage.getItem(key);
            if(local) {
                try {
                    const parsed = JSON.parse(local);
                    if(parsed.config) this.settings = {...this.settings, ...parsed.config};
                    // Filtra apenas chars válidos
                    Object.keys(parsed).forEach(k => { if(parsed[k]?.id) this.chars[k] = parsed[k]; });
                } catch(e) { console.error("Erro Load", e); }
            }
        },

        saveLocal() {
            const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db';
            const payload = { ...this.chars, config: this.settings };
            localStorage.setItem(key, JSON.stringify(payload));
        },

        async syncCloud(silent=false) {
            if(!this.user || this.isGuest || !this.unsavedChanges) return;
            this.isSyncing = true; 
            if(!silent) this.notify('Sincronizando...', 'info');
            try {
                const payload = { ...this.chars, config: this.settings };
                await this.supabase.from('profiles').upsert({ id: this.user.id, data: payload });
                this.unsavedChanges = false;
                if(!silent) { this.notify('Salvo na Nuvem!', 'success'); window.SFX.play('save'); }
            } catch(e) { if(!silent) this.notify('Erro Sync.', 'error'); } 
            finally { this.isSyncing = false; }
        },

        // --- UTILS WRAPPERS ---
        exportData() { window.UTILS.exportJSON(this.chars, 'zenite_bkp.json'); },
        triggerImport() { document.getElementById('import-file').click(); },
        processImport(e) { 
            window.UTILS.readJSON(e.target.files[0], (data) => {
                if(!data) return this.notify('Erro Arquivo', 'error');
                this.chars = {...this.chars, ...data};
                this.saveLocal();
                this.notify('Importado com Sucesso!', 'success');
                this.configModal = false;
            });
        },
        
        initCropper(e) { 
            window.UTILS.initCropper(e.target.files[0], 'crop-target', () => {
                this.cropperOpen = true;
                this.$nextTick(() => { 
                    if(this.cropperInstance) this.cropperInstance.destroy();
                    this.cropperInstance = new Cropper(document.getElementById('crop-target'), { aspectRatio: 1 });
                });
            });
            e.target.value = '';
        },
        
        applyCrop() {
            const img = window.UTILS.getCroppedImage(this.cropperInstance);
            if(this.uploadContext === 'wizard') this.wizardData.photo = img;
            else if(this.char) this.char.photo = img;
            this.cropperOpen = false;
        },

        updateRadarChart() {
            if(!this.char) return;
            const d = [this.char.attrs.for, this.char.attrs.agi, this.char.attrs.int, this.char.attrs.von, this.char.attrs.pod];
            window.UTILS.renderChart('radarChart', d);
        },
        updateWizardChart() {
            const d = [this.wizardData.attrs.for, this.wizardData.attrs.agi, this.wizardData.attrs.int, this.wizardData.attrs.von, this.wizardData.attrs.pod];
            window.UTILS.renderChart('wizChart', d, true);
        },

        // --- DICE ROLLER ---
        roll(sides) {
            window.SFX.play('click');
            const result = Math.floor(Math.random() * sides) + 1;
            const total = result + parseInt(this.diceMod || 0);
            this.lastRoll = total;
            this.diceLog.unshift({ 
                time: new Date().toLocaleTimeString(), 
                formula: `D${sides}${this.diceMod ? '+'+this.diceMod : ''}`, 
                result: total, 
                crit: result === sides 
            });
        },

        // --- HELPER FUNCIONS (UI) ---
        notify(msg, type='info') { 
            const id = Date.now(); 
            this.notifications.push({id, message: msg, type}); 
            setTimeout(() => this.notifications = this.notifications.filter(n=>n.id!==id), 3000); 
        },
        debounce(func, wait) { let t; return function(...args){ clearTimeout(t); t = setTimeout(()=>func.apply(this,args), wait); }; },
        
        // --- NAVIGATION ---
        saveAndExit(silent=false) {
            if(this.unsavedChanges && !this.isGuest && !silent) return this.notify("Salve antes de sair!", "warn");
            this.saveLocal();
            if(!this.isGuest && this.unsavedChanges) this.syncCloud(true);
            this.currentView = 'dashboard';
            this.activeCharId = null;
        },
        
        // --- EVENT HANDLERS (Mouse, Keys, Drag) ---
        setupCursorEngine() {
            // Lógica visual do cursor (mantida aqui pois manipula DOM global)
            const trail = document.getElementById('mouse-trail');
            document.addEventListener('mousemove', (e) => {
                window.cursorX = e.clientX; window.cursorY = e.clientY;
                window.isCursorHover = e.target.closest('button, a, input, .cursor-pointer') !== null;
            });
            const loop = () => {
                if(trail && this.settings.mouseTrail && !this.isMobile) {
                    trail.style.transform = `translate3d(${window.cursorX}px, ${window.cursorY}px, 0)`;
                    trail.style.display = 'block';
                    if(window.isCursorHover) trail.classList.add('hover-active'); else trail.classList.remove('hover-active');
                } else if(trail) trail.style.display = 'none';
                requestAnimationFrame(loop);
            };
            loop();
        },

        setupListeners() {
            // SFX Hover
            let last = null;
            document.addEventListener('mouseover', (e) => {
                const t = e.target.closest('button, a, .cursor-pointer');
                if(t && t !== last) { window.SFX.play('hover'); last = t; }
                else if(!t) last = null;
            });
            // Click SFX
            document.addEventListener('click', (e) => { if(e.target.closest('button, a')) window.SFX.play('click'); });
        },

        // Métodos auxiliares simples
        updateAgentCount() { this.agentCount = Object.keys(this.chars).length; },
        updateVisualState() {
            document.body.classList.toggle('crt-mode', this.settings.crtMode);
            document.body.classList.toggle('custom-cursor-active', this.settings.mouseTrail && !this.isMobile);
        },
        fetchCloud() { return this.syncCloud(true); }, // Alias
        
        // Funções de UI simples
        openWizard() { this.wizardStep=1; this.wizardPoints=8; this.wizardOpen=true; this.wizardData={class:'', attrs:{for:-1,agi:-1,int:-1,von:-1,pod:-1}}; },
        modWizardAttr(k,v) { 
            const curr = this.wizardData.attrs[k];
            if(v>0 && this.wizardPoints>0 && curr<3) { this.wizardData.attrs[k]++; this.wizardPoints--; }
            if(v<0 && curr > (k===this.wizardFocusAttr?0:-1)) { this.wizardData.attrs[k]--; this.wizardPoints++; }
            this.updateWizardChart();
        },
        askDeleteChar(id) { this.confirmData={title:'DELETAR?', desc:'Irreversível.', type:'danger', action:()=>{ delete this.chars[id]; this.saveLocal(); this.updateAgentCount(); }}; this.confirmOpen=true; },
        confirmYes() { if(this.confirmData.action) this.confirmData.action(); this.confirmOpen=false; },
        addItem(cat) { const item={name:'Item', qty:1}; if(cat.includes('_')) this.char.inventory.social[cat.split('_')[1]].push(item); else this.char.inventory[cat].push(item); },
        deleteItem(cat,i,sub) { if(sub) this.char.inventory.social[sub].splice(i,1); else this.char.inventory[cat].splice(i,1); }
    };
}