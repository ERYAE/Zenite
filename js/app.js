/**
 * ZENITE OS - Modular Core v2 (Fixed)
 */
import { CONSTANTS, supabase } from './modules/config.js';
import { debounce, rollDice, generateId } from './modules/utils.js';
import { playSFX, setSfxState } from './modules/audio.js';
import { ARCHETYPES, calculateStats, sanitizeChar, createEmptyChar } from './modules/rpg.js';
import { loadFromLocal, saveToLocal, syncWithSupabase, pushToSupabase } from './modules/cloud.js';
import { applyTheme, updateChart, initCursor } from './modules/ui.js';

function zeniteSystem() {
    return {
        // --- ESTADO ---
        systemLoading: true, loadingProgress: 0, loadingText: 'BOOT', systemFailure: false, // Renomeado para bater com HTML
        user: null, isGuest: false,
        currentView: 'dashboard', activeTab: 'profile', logisticsTab: 'inventory', searchQuery: '', // Renomeado para bater com HTML
        
        // --- DADOS ---
        chars: {}, activeCharId: null, char: null, agentCount: 0,
        unsavedChanges: false, isSyncing: false, saveStatus: 'idle', // Renomeado para bater com HTML
        
        // --- MODAIS E WIDGETS ---
        configModal: false, wizardOpen: false, cropperOpen: false, confirmOpen: false, 
        diceTrayOpen: false, trayDockMode: 'float', trayPosition: { x: 0, y: 0 }, isDraggingTray: false,
        diceLog: [], lastRoll: '--', lastNatural: 0, lastFaces: 20, diceMod: 0, diceReason: '', showDiceTip: false, hasSeenDiceTip: false,
        revertConfirmMode: false, isReverting: false, shakeAlert: false, isMobile: window.innerWidth < 768,
        
        // --- WIZARD ---
        wizardStep: 1, wizardPoints: 8, wizardNameError: false, wizardFocusAttr: '',
        wizardData: { class: '', name: '', identity: '', age: '', history: '', photo: null, attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} },
        
        // --- CONFIG ---
        settings: { mouseTrail: true, compactMode: false, crtMode: true, sfxEnabled: true, themeColor: 'cyan' },
        confirmData: { title:'', desc:'', action:null, type:'danger' },
        
        // --- EXTRAS ---
        minigameActive: false, minigameClicks: 5, minigamePos: {x:50, y:50}, logoClickCount: 0, logoClickTimer: null,
        isHackerMode: false, hackerModeUnlocked: false, konamiBuffer: [],
        
        // --- LISTAS ---
        archetypes: ARCHETYPES,
        notifications: [],
        authLoading: false, authMsg: '', authMsgType: '',
        userMenuOpen: false,
        uploadContext: 'char', cropperInstance: null,

        get filteredChars() { // Renomeado para bater com HTML
            if (!this.searchQuery) return this.chars;
            const q = this.searchQuery.toLowerCase();
            return Object.fromEntries(Object.entries(this.chars).filter(([_, c]) => 
                (c.name && c.name.toLowerCase().includes(q)) || (c.class && c.class.toLowerCase().includes(q))
            ));
        },

        // --- INICIALIZAÇÃO ---
        async initSystem() { // Renomeado para bater com o x-init do HTML
            this.loadingProgress = 10;
            this.trayPosition = { x: window.innerWidth - 350, y: window.innerHeight - 500 };
            
            // Audio & UX
            window.addEventListener('resize', () => { this.isMobile = window.innerWidth < 768; this.ensureTrayOnScreen(); });
            window.addEventListener('keydown', e => { if(e.key === 'Escape') this.handleEscKey(); });
            initCursor(() => this.settings.mouseTrail && !this.isMobile && !this.isGuest);
            
            // Debouncer
            this.debouncedSaveFunc = debounce(() => {
                saveToLocal(this.isGuest, { ...this.chars, config: this.settings, trayPos: this.trayPosition, hasSeenTip: this.hasSeenDiceTip });
            }, 1000);

            // Carregamento
            const isGuest = localStorage.getItem('zenite_is_guest') === 'true';
            this.loadingProgress = 50; this.loadingText = 'LOADING DATA';
            
            if (isGuest) this.enterGuest();
            else await this.initAuth();

            this.loadingProgress = 100; this.loadingText = 'READY';
            setTimeout(() => this.systemLoading = false, 500);

            // Watcher
            this.$watch('char', (val) => {
                if (!val || !this.activeCharId || this.systemLoading || this.isReverting) return;
                this.chars[this.activeCharId] = JSON.parse(JSON.stringify(val));
                if (!this.isGuest) this.unsavedChanges = true;
                this.debouncedSaveFunc();
                if (this.activeTab === 'profile') this.updateRadar();
            }, {deep: true});
        },

        async initAuth() {
            const local = loadFromLocal(false);
            if (local.config) this.applySettings(local.config);
            this.chars = local.chars;
            this.updateAgentCount();
            
            if (supabase) {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    this.user = session.user;
                    this.loadingText = 'SYNCING CLOUD';
                    await this.syncCloud(null, local);
                }

                supabase.auth.onAuthStateChange((evt, sess) => {
                    if (evt === 'SIGNED_IN' && sess && !this.user) window.location.reload();
                    if (evt === 'SIGNED_OUT') window.location.reload();
                });
            }
        },

        // --- SISTEMA E DADOS ---
        async syncCloud(evt = null, localData = null) {
            if (!this.user || !supabase) return;
            this.isSyncing = true;
            try {
                const local = localData || { chars: this.chars, config: this.settings };
                const res = await syncWithSupabase(this.user, local);
                
                this.chars = res.mergedData.chars;
                this.updateAgentCount();
                if(res.mergedData.config) this.applySettings(res.mergedData.config);
                
                if (res.shouldPush || this.unsavedChanges) {
                    await pushToSupabase(this.user, res.mergedData);
                    this.unsavedChanges = false; playSFX('save');
                }
                saveToLocal(false, res.mergedData);
            } catch(e) { console.error(e); this.notify('Erro Sync', 'error'); }
            this.isSyncing = false;
        },
        
        enterGuest() {
            this.isGuest = true;
            const data = loadFromLocal(true);
            this.chars = data.chars;
            this.updateAgentCount();
            if(data.config) this.applySettings(data.config);
        },
        
        applySettings(newCfg = null) {
            if(newCfg) this.settings = { ...this.settings, ...newCfg };
            applyTheme(this.settings.themeColor);
            setSfxState(this.settings.sfxEnabled);
            if(this.settings.crtMode) document.body.classList.add('crt-mode'); 
            else document.body.classList.remove('crt-mode');
            if(this.settings.compactMode && this.isMobile) document.body.classList.add('compact-mode');
        },

        toggleSetting(key, val=null) {
            if(val !== null) this.settings[key] = val; 
            else this.settings[key] = !this.settings[key];
            this.applySettings();
            this.unsavedChanges = !this.isGuest;
            this.debouncedSaveFunc();
        },

        // --- RPG ---
        loadCharacter(id) {
            if (!this.chars[id]) return;
            this.activeCharId = id;
            this.char = sanitizeChar(this.chars[id]);
            this.currentView = 'sheet'; this.activeTab = 'profile';
            if(!this.hasSeenDiceTip) setTimeout(() => this.showDiceTip = true, 1000);
            this.$nextTick(() => this.updateRadar());
        },
        
        recalcDerivedStats() {
            if (!this.char) return;
            const neo = calculateStats(this.char.class, this.char.level, this.char.attrs);
            ['pv','pf','pdf'].forEach(s => {
                const diff = this.char.stats[s].max - this.char.stats[s].current;
                this.char.stats[s].max = neo[s];
                this.char.stats[s].current = Math.max(0, neo[s] - diff);
            });
        },
        
        modAttr(k, v) {
            const c = this.char.attrs[k];
            if ((v > 0 && c < 6) || (v < 0 && c > -1)) {
                this.char.attrs[k] += v;
                this.recalcDerivedStats();
                this.updateRadar();
            }
        },
        
        modStat(stat, val) { 
            const s = this.char.stats[stat]; 
            s.current = Math.max(0, Math.min(s.max, s.current + val)); 
        },

        // --- WIZARD ---
        openWizard() {
            if(this.agentCount >= CONSTANTS.MAX_AGENTS) return this.notify('Limite!', 'error');
            this.wizardStep = 1; this.wizardPoints = 8; this.wizardData = createEmptyChar(); 
            this.wizardData.attrs = {for:-1, agi:-1, int:-1, von:-1, pod:-1};
            this.wizardFocusAttr = '';
            this.wizardOpen = true;
        },
        
        selectArchetype(a) {
            this.wizardData.class = a.class;
            this.wizardData.attrs = {for:-1, agi:-1, int:-1, von:-1, pod:-1};
            this.wizardData.attrs[a.focus] = 0;
            this.wizardFocusAttr = a.focus;
            this.wizardStep = 2;
            this.$nextTick(() => updateChart('wizChart', Object.values(this.wizardData.attrs), true));
        },
        
        modWizardAttr(k, v) {
            const cur = this.wizardData.attrs[k];
            const min = k === this.wizardFocusAttr ? 0 : -1;
            if (v > 0 && this.wizardPoints > 0 && cur < 3) { this.wizardData.attrs[k]++; this.wizardPoints--; }
            if (v < 0 && cur > min) { this.wizardData.attrs[k]--; this.wizardPoints++; }
            updateChart('wizChart', Object.values(this.wizardData.attrs), true);
        },
        
        finishWizard() {
            if(!this.wizardData.name) {
                this.wizardNameError = true; setTimeout(()=>this.wizardNameError=false, 500);
                return this.notify('Codinome obrigatório!', 'warn');
            }
            const id = generateId();
            const stats = calculateStats(this.wizardData.class, 1, this.wizardData.attrs);
            
            const newChar = sanitizeChar({ 
                id, ...this.wizardData, level: 1, credits: 0,
                stats: { 
                    pv: {current: stats.pv, max: stats.pv}, 
                    pf: {current: stats.pf, max: stats.pf}, 
                    pdf: {current: stats.pdf, max: stats.pdf} 
                }
            });
            
            this.chars[id] = newChar;
            this.updateAgentCount();
            this.debouncedSaveFunc();
            if(!this.isGuest) this.syncCloud();
            this.wizardOpen = false;
            this.loadCharacter(id);
            this.notify('Agente Inicializado.', 'success');
        },

        // --- DADOS E UTIL ---
        roll(d) {
            playSFX('click');
            const res = rollDice(d);
            const mod = parseInt(this.diceMod || 0);
            this.lastRoll = res + mod;
            this.lastNatural = res;
            this.lastFaces = d;
            this.diceLog.unshift({
                id: Date.now(),
                time: new Date().toLocaleTimeString(),
                formula: `D${d}${mod? (mod>0?'+'+mod:mod) : ''}`,
                result: res + mod,
                crit: res === d, fumble: res === 1,
                reason: this.diceReason
            });
            this.diceReason = '';
            if(this.diceLog.length > 20) this.diceLog.pop();
        },

        notify(msg, type='info') {
            const id = Date.now();
            this.notifications.push({id, message: msg, type});
            setTimeout(() => this.notifications = this.notifications.filter(n=>n.id!==id), 3000);
        },

        updateRadar() {
            if(!this.char) return;
            updateChart('radarChart', [this.char.attrs.for,this.char.attrs.agi,this.char.attrs.int,this.char.attrs.von,this.char.attrs.pod]);
        },
        
        updateAgentCount() { this.agentCount = Object.keys(this.chars).length; },
        
        // --- INTERFACE (Compatibilidade com HTML) ---
        handleEscKey() { 
            if(this.wizardOpen) this.wizardOpen=false; 
            else if(this.configModal) this.configModal=false;
            else if(this.currentView === 'sheet') this.attemptGoBack();
        },
        attemptGoBack() { 
            if(this.unsavedChanges && !this.isGuest) return this.notify("Salve antes de sair!", "warn"); 
            this.currentView = 'dashboard'; 
        },
        
        toggleDiceTray() { this.diceTrayOpen = !this.diceTrayOpen; if(this.diceTrayOpen) { this.hasSeenDiceTip=true; this.showDiceTip=false; this.ensureTrayOnScreen();} },
        setDockMode(m) { this.trayDockMode = m; if(m==='float') this.ensureTrayOnScreen(); },
        ensureTrayOnScreen() { if(this.trayDockMode === 'float') { this.trayPosition.x = Math.max(10, Math.min(window.innerWidth-320, this.trayPosition.x)); this.trayPosition.y = Math.max(60, Math.min(window.innerHeight-400, this.trayPosition.y)); }},
        startDragTray(e) { if(this.trayDockMode !== 'float') return; this.isDraggingTray = true; }, // Simplificado
        
        handleLogoClick() { 
            this.logoClickCount++; clearTimeout(this.logoClickTimer);
            if(this.logoClickCount >= 5) { this.systemFailure = true; playSFX('glitch'); }
            this.logoClickTimer = setTimeout(()=>this.logoClickCount=0, 400);
        },
        
        toggleHackerMode() { 
            this.isHackerMode = !this.isHackerMode; 
            if(this.isHackerMode) document.body.classList.add('theme-hacker');
            else document.body.classList.remove('theme-hacker');
        },
        
        startMinigame() { this.minigameActive = true; this.minigameClicks = 5; },
        hitMinigame() { 
            this.minigameClicks--; playSFX('click');
            this.minigamePos = {x: Math.random()*80+10, y: Math.random()*80+10};
            if(this.minigameClicks <= 0) { this.minigameActive = false; this.systemFailure = false; playSFX('success'); }
        },

        doSocialAuth(provider) {
            this.authLoading = true;
            supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });
        },
        
        askLogout() { this.askConfirm('SAIR?', 'Dados não salvos serão perdidos.', 'warn', async () => {
            await supabase.auth.signOut(); localStorage.clear(); window.location.reload();
        });},
        
        askSwitchToOnline() { this.askConfirm('ONLINE?', 'Ir para login.', 'info', () => {
            localStorage.removeItem('zenite_is_guest'); window.location.reload();
        });},
        
        askConfirm(title, desc, type, action) { this.confirmData = {title, desc, type, action}; this.confirmOpen = true; },
        confirmYes() { if(this.confirmData.action) this.confirmData.action(); this.confirmOpen = false; },
        askHardReset() { localStorage.clear(); window.location.reload(); },
        askDeleteChar(id) { delete this.chars[id]; this.updateAgentCount(); this.debouncedSaveFunc(); if(!this.isGuest) this.syncCloud(); },
        
        // Items & Skills
        addSkill() { this.char.skills.push({name:'Nova', level:1}); }, deleteSkill(i) { this.char.skills.splice(i,1); }, setSkillLevel(i,l) { this.char.skills[i].level = l; },
        addItem(cat) { this.char.inventory[cat].push({name:'Novo Item', dmg:'1d6', def:'1'}); }, deleteItem(cat, i) { this.char.inventory[cat].splice(i,1); },
        addTechnique() { this.char.powers.techniques.push({name:'Técnica', desc:''}); }, deleteTechnique(i) { this.char.powers.techniques.splice(i,1); },
        
        // Imagem
        openImageEditor(ctx) { this.uploadContext = ctx; document.getElementById('file-input').click(); },
        initCropper(e) { 
            const f = e.target.files[0]; 
            const r = new FileReader(); r.onload = (evt) => { document.getElementById('crop-target').src = evt.target.result; this.cropperOpen = true; };
            if(f) r.readAsDataURL(f);
        },
        applyCrop() { 
            // Mock de crop para simplicidade - em produção usar cropper.js result
            const img = document.getElementById('crop-target').src; 
            if(this.uploadContext === 'wizard') this.wizardData.photo = img; else this.char.photo = img;
            this.cropperOpen = false;
        },
        exportData() { /* Lógica de exportar JSON */ },
        triggerFileImport() { document.getElementById('import-file').click(); },
        processImport() { /* Lógica import */ }
    };
}

// Registro Seguro no Alpine
document.addEventListener('alpine:init', () => {
    Alpine.data('zeniteSystem', zeniteSystem);
});

// Fallback para caso o Alpine já tenha carregado (Race Condition fix)
if (typeof Alpine !== 'undefined') {
    Alpine.data('zeniteSystem', zeniteSystem);
}

// Expor para o global só por garantia (debug)
window.zeniteSystem = zeniteSystem;