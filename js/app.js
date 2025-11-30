/**
 * ZENITE OS - Core Controller (Corrected & Restored)
 * Version: v85.0-Koda-Redemption
 * Status: STABLE - All HTML bindings restored.
 */

function zeniteSystem() {
    return {
        // --- ESTADO GLOBAL & UI (Reativos) ---
        loading: true, 
        systemLoading: true, 
        loadingProgress: 0, 
        loadingText: 'BOOT',
        currentView: 'dashboard', 
        activeTab: 'profile', 
        logisticsTab: 'inventory',
        
        user: null, 
        isGuest: false, 
        userMenuOpen: false,
        authLoading: false, // Restaurado
        authMsg: '', 
        authMsgType: '',
        
        notifications: [], 
        confirmOpen: false, 
        confirmData: { title:'', desc:'', action:null, type:'danger' },
        
        // --- CURSOR REACTIVITY (Necessário para o HTML ler) ---
        cursorX: -100,
        cursorY: -100,
        isCursorHover: false,

        // --- DADOS ---
        chars: {}, 
        activeCharId: null, 
        char: null, 
        agentCount: 0, 
        searchQuery: '',
        
        // --- MODAIS ---
        configModal: false, 
        wizardOpen: false, 
        cropperOpen: false, 
        cropperInstance: null, 
        uploadContext: 'char',
        
        // --- WIDGETS ---
        diceTrayOpen: false, 
        trayDockMode: 'float', 
        trayPosition: { x: window.innerWidth - 350, y: window.innerHeight - 500 },
        isDraggingTray: false, 
        dragOffset: { x: 0, y: 0 }, 
        showDiceTip: false, 
        hasSeenDiceTip: false,
        diceLog: [], 
        lastRoll: '--', 
        diceMod: 0, 
        diceReason: '',

        // --- UX / EFEITOS ---
        isMobile: window.innerWidth < 768, 
        systemFailure: false, 
        logoClickCount: 0, 
        logoClickTimer: null,
        konamiBuffer: [],
        revertConfirmMode: false, 
        isReverting: false, 
        shakeAlert: false,
        
        // --- MÓDULOS EXTERNOS ---
        supabase: null, 
        netLink: null,
        
        // --- WIZARD DATA ---
        wizardStep: 1, 
        wizardPoints: 8, 
        wizardFocusAttr: '',
        wizardData: { class: '', name: '', identity: '', age: '', history: '', photo: null, attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} },

        // --- CONFIG ---
        settings: { mouseTrail: true, compactMode: false, performanceMode: false, crtMode: true, sfxEnabled: true, themeColor: 'cyan' },
        unsavedChanges: false, 
        isSyncing: false, 
        debouncedSave: null,

        // --- GETTERS ---
        get archetypes() { return (window.RPG && window.RPG.archetypes) ? window.RPG.archetypes : []; },
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
            console.log("Zenite: Redemption Boot...");
            this.loadingProgress = 10;
            
            // Timeout de segurança
            setTimeout(() => {
                if(this.systemLoading) {
                    console.warn("Zenite: Boot Timeout.");
                    this.systemLoading = false;
                }
            }, 8000);

            try {
                // 1. Configs & Libs
                if (window.supabase && window.CONFIG) {
                    this.supabase = window.supabase.createClient(window.CONFIG.SUPABASE_URL, window.CONFIG.SUPABASE_KEY);
                }
                if (window.netLinkSystem) this.netLink = window.netLinkSystem(this.supabase, null);
                this.debouncedSave = this.debounce(() => this.saveLocal(), 1000);

                // 2. Listeners & Engine Visual
                this.setupListeners();
                this.setupCursorEngine();
                this.setupWatchers(); // <--- RESTAURADO AQUI

                // 3. Carregar Dados
                this.loadingProgress = 50; 
                const guest = localStorage.getItem('zenite_is_guest') === 'true';
                
                if(guest) {
                    this.isGuest = true;
                    this.loadLocal('zenite_guest_db');
                } else {
                    this.loadLocal('zenite_cached_db');
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
                this.loadingText = 'READY';
                setTimeout(() => this.systemLoading = false, 500);

            } catch (err) {
                console.error("Zenite Critical Boot Error:", err);
                this.notify("Erro Crítico no Boot.", "error");
                this.systemLoading = false; 
            }
        },

        // =========================================================================
        // WATCHERS & LISTENERS (O QUE FALTAVA)
        // =========================================================================
        setupWatchers() {
            // Monitora mudanças no personagem para salvar
            this.$watch('char', (val) => {
                if (this.loadingChar || this.systemLoading || this.isReverting) return;
                if (val && this.activeCharId) {
                    this.chars[this.activeCharId] = JSON.parse(JSON.stringify(val));
                    if (!this.isGuest) { this.unsavedChanges = true; }
                    if(this.debouncedSave) this.debouncedSave();
                    if (this.activeTab === 'profile') this.updateRadarChart();
                }
            }, {deep: true});

            this.$watch('currentView', (val) => { if (val !== 'sheet') { this.diceTrayOpen = false; this.revertConfirmMode = false; } });
            this.$watch('user', () => this.updateVisualState());
            this.$watch('isGuest', () => this.updateVisualState());
        },

        setupListeners() {
            window.addEventListener('pageshow', (event) => { if (event.persisted) window.location.reload(); });
            window.addEventListener('resize', () => { this.isMobile = window.innerWidth < 768; this.ensureTrayOnScreen(); });
            
            // SFX Listeners
            let last = null;
            document.addEventListener('mouseover', (e) => {
                const t = e.target.closest('button, a, .cursor-pointer');
                if(t && t !== last && window.SFX) { window.SFX.play('hover'); last = t; }
                else if(!t) last = null;
            });
            document.addEventListener('click', (e) => { 
                if(e.target.closest('button, a') && window.SFX) window.SFX.play('click'); 
            });
        },

        setupCursorEngine() {
            // Atualiza as variáveis reativas do Alpine para o HTML ler
            document.addEventListener('mousemove', (e) => {
                this.cursorX = e.clientX; 
                this.cursorY = e.clientY;
                this.isCursorHover = e.target.closest('button, a, input, select, textarea, .cursor-pointer, .draggable-handle') !== null;
            });
        },

        handleKeys(e) {
            const key = e.key.toLowerCase();
            const konamiCode = ['arrowup','arrowup','arrowdown','arrowdown','arrowleft','arrowright','arrowleft','arrowright','b','a'];
            this.konamiBuffer.push(key);
            if (this.konamiBuffer.length > konamiCode.length) this.konamiBuffer.shift();
            if (JSON.stringify(this.konamiBuffer) === JSON.stringify(konamiCode)) {
                document.body.classList.toggle('theme-hacker');
                if(document.body.classList.contains('theme-hacker')) { 
                    if(window.SFX) window.SFX.play('save'); // Som sucesso
                    this.notify("HACKER MODE ENABLED", "success"); 
                } else { 
                    this.notify("SYSTEM NORMAL", "info"); 
                }
                this.konamiBuffer = [];
            }
        },

        // =========================================================================
        // AUTHENTICATION & LOGIN (RESTAURADOS)
        // =========================================================================
        enterGuest() {
            this.isGuest = true;
            localStorage.setItem('zenite_is_guest', 'true');
            this.loadLocal('zenite_guest_db');
        },

        doSocialAuth(provider) {
            if(!this.supabase) return this.notify("Erro de conexão.", "error");
            this.authLoading = true;
            this.authMsg = "Conectando...";
            this.supabase.auth.signInWithOAuth({ 
                provider, 
                options: { redirectTo: window.location.origin } 
            }).then(({error}) => { 
                if(error) { 
                    this.notify(error.message, 'error'); 
                    this.authLoading = false; 
                } 
            });
        },

        askLogout() { this.askConfirm('SAIR?', 'Dados pendentes serão salvos.', 'warn', () => this.logout()); },
        
        async logout() { 
            this.systemLoading = true; 
            if(this.unsavedChanges && !this.isGuest) { 
                try { await this.syncCloud(true); } catch(e) {} 
            } 
            localStorage.removeItem('zenite_cached_db'); 
            localStorage.removeItem('zenite_is_guest'); 
            if(this.supabase) await this.supabase.auth.signOut(); 
            window.location.reload(); 
        },

        askSwitchToOnline() { 
            this.askConfirm('FICAR ONLINE?', 'Ir para login.', 'info', () => { 
                this.isGuest = false; 
                localStorage.removeItem('zenite_is_guest'); 
                window.location.reload(); 
            }); 
        },

        // =========================================================================
        // RPG LOGIC
        // =========================================================================
        loadCharacter(id) {
            if(!this.chars[id]) return;
            if(!window.RPG) return this.notify("Módulo RPG offline.", "error");

            this.char = JSON.parse(JSON.stringify(this.chars[id])); 
            this.char = window.RPG.recalcStats(this.char);
            
            // Garante inventário
            if(!this.char.inventory) this.char.inventory = { weapons:[], armor:[], gear:[], backpack: "", social: { people:[], objects:[]} };
            if(!this.char.inventory.social) this.char.inventory.social = { people:[], objects:[]};

            this.activeCharId = id;
            this.currentView = 'sheet';
            this.activeTab = 'profile';
            if(window.SFX) window.SFX.play('click');
            
            this.$nextTick(() => this.updateRadarChart());
        },

        finishWizard() {
            if(!this.wizardData.name) return this.notify("Nome obrigatório!", "warn");
            const id = 'z_' + Date.now();
            
            let newChar = window.RPG.createBlankChar(id, this.wizardData);
            newChar = window.RPG.recalcStats(newChar);
            
            this.chars[id] = newChar;
            this.saveAndExit(true); 
            this.loadCharacter(id);
            this.notify('Agente Criado.', 'success');
        },

        recalcDerivedStats() {
            if(!this.char || !window.RPG) return;
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
        
        modStat(stat, val) {
            if(!this.char || !this.char.stats[stat]) return;
            const s = this.char.stats[stat];
            s.current = Math.max(0, Math.min(s.max, s.current + val));
        },

        // =========================================================================
        // VISUAL & THEME
        // =========================================================================
        applyTheme(color) {
            const map = { 'cyan': '#0ea5e9', 'purple': '#d946ef', 'gold': '#eab308' };
            const hex = map[color] || map['cyan'];
            document.documentElement.style.setProperty('--neon-core', hex);
            const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
            document.documentElement.style.setProperty('--neon-rgb', `${r},${g},${b}`);
        },

        toggleSetting(key, val=null) {
            if(val !== null) this.settings[key] = val; else this.settings[key] = !this.settings[key];
            if(key === 'themeColor') this.applyTheme(this.settings[key]);
            if(key === 'sfxEnabled' && window.SFX) window.SFX.toggle(this.settings[key]);
            this.updateVisualState();
            this.saveLocal();
        },

        updateVisualState() {
            document.body.classList.toggle('crt-mode', this.settings.crtMode);
            document.body.classList.toggle('custom-cursor-active', this.settings.mouseTrail && !this.isMobile);
        },

        handleLogoClick() {
            clearTimeout(this.logoClickTimer); 
            this.logoClickCount++;
            if (this.logoClickCount >= 5) {
                this.logoClickCount = 0;
                this.triggerSystemFailure();
                return;
            }
            this.logoClickTimer = setTimeout(() => { this.logoClickCount = 0; }, 2000);
            
            if (!this.systemFailure) {
                 if (!document.fullscreenElement) { document.documentElement.requestFullscreen().catch(()=>{}); } 
                 else if (document.exitFullscreen) { document.exitFullscreen(); }
            }
        },

        triggerSystemFailure() {
            if(window.SFX) window.SFX.play('glitch'); // Supondo que exista ou fallback
            this.systemFailure = true; 
        },

        // =========================================================================
        // PERSISTÊNCIA
        // =========================================================================
        loadLocal(key) {
            const local = localStorage.getItem(key);
            if(local) {
                try {
                    const parsed = JSON.parse(local);
                    if(parsed.config) this.settings = {...this.settings, ...parsed.config};
                    if(parsed.trayPos) this.trayPosition = parsed.trayPos;
                    if(parsed.hasSeenTip !== undefined) this.hasSeenDiceTip = parsed.hasSeenTip;
                    Object.keys(parsed).forEach(k => { if(parsed[k]?.id) this.chars[k] = parsed[k]; });
                } catch(e) { console.error("Erro Load", e); }
            }
        },

        saveLocal() {
            const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db';
            const payload = { ...this.chars, config: this.settings, trayPos: this.trayPosition, hasSeenTip: this.hasSeenDiceTip };
            localStorage.setItem(key, JSON.stringify(payload));
        },

        async syncCloud(silent=false) {
            if(!this.user || this.isGuest || !this.unsavedChanges) return;
            this.isSyncing = true; 
            if(!silent) this.notify('Sincronizando...', 'info');
            try {
                const payload = { ...this.chars, config: this.settings, hasSeenTip: this.hasSeenDiceTip };
                await this.supabase.from('profiles').upsert({ id: this.user.id, data: payload });
                this.unsavedChanges = false;
                if(!silent && window.SFX) { this.notify('Salvo na Nuvem!', 'success'); window.SFX.play('save'); }
            } catch(e) { if(!silent) this.notify('Erro Sync.', 'error'); } 
            finally { this.isSyncing = false; }
        },

        // =========================================================================
        // UTILS WRAPPERS & UI
        // =========================================================================
        exportData() { if(window.UTILS) window.UTILS.exportJSON(this.chars, 'zenite_bkp.json'); },
        triggerImport() { document.getElementById('import-file').click(); },
        
        processImport(e) { 
            if(!window.UTILS) return;
            window.UTILS.readJSON(e.target.files[0], (data) => {
                if(!data) return this.notify('Erro Arquivo', 'error');
                this.chars = {...this.chars, ...data};
                this.saveLocal();
                this.updateAgentCount(); // Added
                this.notify('Importado!', 'success');
                this.configModal = false;
            });
        },
        
        openImageEditor(context = 'sheet') { this.uploadContext = context; document.getElementById('file-input').click(); }, 
        
        initCropper(e) { 
            if(!window.UTILS) return;
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
            if(!window.UTILS) return;
            const img = window.UTILS.getCroppedImage(this.cropperInstance);
            if(this.uploadContext === 'wizard') this.wizardData.photo = img;
            else if(this.char) this.char.photo = img;
            this.cropperOpen = false;
        },

        updateRadarChart() {
            if(!this.char || !window.UTILS) return;
            const d = [this.char.attrs.for, this.char.attrs.agi, this.char.attrs.int, this.char.attrs.von, this.char.attrs.pod];
            window.UTILS.renderChart('radarChart', d);
        },
        updateWizardChart() {
            if(!window.UTILS) return;
            const d = [this.wizardData.attrs.for, this.wizardData.attrs.agi, this.wizardData.attrs.int, this.wizardData.attrs.von, this.wizardData.attrs.pod];
            window.UTILS.renderChart('wizChart', d, true);
        },

        roll(sides) {
            if(window.SFX) window.SFX.play('click');
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

        // --- HELPER FUNCTIONS ---
        notify(msg, type='info') { 
            const id = Date.now(); 
            this.notifications.push({id, message: msg, type}); 
            setTimeout(() => this.notifications = this.notifications.filter(n=>n.id!==id), 3000); 
        },
        
        debounce(func, wait) { let t; return function(...args){ clearTimeout(t); t = setTimeout(()=>func.apply(this,args), wait); }; },
        
        updateAgentCount() { this.agentCount = Object.keys(this.chars).length; },
        
        saveAndExit(silent=false) {
            if(this.unsavedChanges && !this.isGuest && !silent) return this.notify("Salve antes de sair!", "warn");
            this.saveLocal();
            if(!this.isGuest && this.unsavedChanges) this.syncCloud(true);
            this.currentView = 'dashboard';
            this.activeCharId = null;
        },
        
        attemptGoBack() { if (this.unsavedChanges && !this.isGuest) { this.triggerShake(); this.notify("Salve ou descarte antes de sair.", "warn"); return; } this.saveAndExit(); },
        triggerShake() { this.shakeAlert = true; setTimeout(() => this.shakeAlert = false, 300); },
        
        // --- FUNÇÕES DE UI SIMPLES ---
        openWizard() { this.wizardStep=1; this.wizardPoints=8; this.wizardOpen=true; this.wizardData={class:'', attrs:{for:-1,agi:-1,int:-1,von:-1,pod:-1}}; },
        
        selectArchetype(a) { 
            this.wizardData.class = a.class; 
            this.wizardData.attrs = {for:-1, agi:-1, int:-1, von:-1, pod:-1}; 
            this.wizardData.attrs[a.focus] = 0; 
            this.wizardFocusAttr = a.focus; 
            this.wizardStep = 2; 
            this.$nextTick(() => { this.updateWizardChart(); }); 
        },

        modWizardAttr(k,v) { 
            const curr = this.wizardData.attrs[k];
            if(v>0 && this.wizardPoints>0 && curr<3) { this.wizardData.attrs[k]++; this.wizardPoints--; }
            if(v<0 && curr > (k===this.wizardFocusAttr?0:-1)) { this.wizardData.attrs[k]--; this.wizardPoints++; }
            this.updateWizardChart();
        },
        
        askDeleteChar(id) { this.confirmData={title:'DELETAR?', desc:'Irreversível.', type:'danger', action:()=>{ delete this.chars[id]; this.saveLocal(); this.updateAgentCount(); }}; this.confirmOpen=true; },
        confirmYes() { if(this.confirmData.action) this.confirmData.action(); this.confirmOpen=false; },
        askHardReset() { this.askConfirm('LIMPAR TUDO?', 'Apaga cache local.', 'danger', () => { localStorage.clear(); window.location.reload(); }); },
        askConfirm(title, desc, type, action) { this.confirmData = { title, desc, type, action }; this.confirmOpen = true; },
        
        // Inventory
        addItem(cat) { 
            const item={name:'Item', qty:1, dmg:'1d6', range:'C', def:'1', pen:'0'}; 
            if(cat.includes('_')) this.char.inventory.social[cat.split('_')[1]].push(item); 
            else this.char.inventory[cat].push(item); 
        },
        deleteItem(cat,i,sub) { if(sub) this.char.inventory.social[sub].splice(i,1); else this.char.inventory[cat].splice(i,1); },
        addSkill() { this.char.skills.push({name:'Nova Perícia', level:1}); }, 
        deleteSkill(idx) { this.char.skills.splice(idx,1); }, 
        setSkillLevel(idx, l) { this.char.skills[idx].level = l; },
        addTechnique() { this.char.powers.techniques.push({name:'Técnica', desc:''}); }, 
        deleteTechnique(idx) { this.char.powers.techniques.splice(idx,1); },

        // Tray Drag
        toggleDiceTray() {
            if (this.isReverting) return;
            this.diceTrayOpen = !this.diceTrayOpen;
            if(this.diceTrayOpen) {
                if(!this.hasSeenDiceTip) { this.hasSeenDiceTip = true; this.saveLocal(); }
                this.showDiceTip = false; this.ensureTrayOnScreen();
            }
        },
        setDockMode(mode) {
            this.trayDockMode = mode;
            if(mode === 'float') { this.trayPosition = { x: window.innerWidth - 350, y: window.innerHeight - 500 }; this.ensureTrayOnScreen(); }
        },
        startDragTray(e) {
            if(this.isMobile || this.trayDockMode !== 'float') return;
            if(e.target.closest('button') || e.target.closest('input')) return;
            this.isDraggingTray = true;
            this.dragOffset.x = e.clientX - this.trayPosition.x;
            this.dragOffset.y = e.clientY - this.trayPosition.y;
            const moveHandler = (ev) => { if(!this.isDraggingTray) return; this.trayPosition.x = ev.clientX - this.dragOffset.x; this.trayPosition.y = ev.clientY - this.dragOffset.y; };
            const upHandler = () => { this.isDraggingTray = false; document.removeEventListener('mousemove', moveHandler); document.removeEventListener('mouseup', upHandler); };
            document.addEventListener('mousemove', moveHandler); document.addEventListener('mouseup', upHandler);
        },
        ensureTrayOnScreen() {
            if(this.isMobile || this.trayDockMode !== 'float') return;
            this.trayPosition.x = Math.max(10, Math.min(window.innerWidth - 320, this.trayPosition.x));
            this.trayPosition.y = Math.max(60, Math.min(window.innerHeight - 400, this.trayPosition.y));
        },
        toggleRevertMode() { this.revertConfirmMode = !this.revertConfirmMode; if(this.revertConfirmMode) this.diceTrayOpen = false; },
        performRevert() {
            this.isReverting = true; 
            this.diceTrayOpen = false; 
            this.revertConfirmMode = false;
            document.body.classList.add('animating-out'); 
            document.body.classList.add('interaction-lock');
            if(window.SFX) window.SFX.play('discard');
            setTimeout(async () => {
                try {
                    if(this.isGuest) { this.loadLocal('zenite_guest_db'); } else { this.loadLocal('zenite_cached_db'); await this.fetchCloud(); }
                    if(this.activeCharId && this.chars[this.activeCharId]) { this.loadCharacter(this.activeCharId); } else { this.currentView = 'dashboard'; this.char = null; }
                    this.unsavedChanges = false;
                    document.body.classList.remove('animating-out'); document.body.classList.add('animating-in');
                    this.notify('Dados restaurados.', 'success');
                    setTimeout(() => { document.body.classList.remove('animating-in'); document.body.classList.remove('interaction-lock'); this.isReverting = false; }, 400);
                } catch (e) {
                    console.error("Revert Error:", e); 
                    this.notify("Erro na restauração.", "error");
                    document.body.classList.remove('animating-out'); document.body.classList.remove('interaction-lock'); this.isReverting = false;
                }
            }, 300);
        }
    };
}