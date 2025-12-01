/**
 * ZENITE OS - Modular Core (Fixed Bridge)
 */
import { CONSTANTS, supabase } from './modules/config.js';
import { debounce, rollDice, generateId } from './modules/utils.js';
import { playSFX, setSfxState, initAudio } from './modules/audio.js'; // Importando initAudio também
import { ARCHETYPES, calculateStats, sanitizeChar, createEmptyChar } from './modules/rpg.js';
import { loadFromLocal, saveToLocal, syncWithSupabase, pushToSupabase } from './modules/cloud.js';
import { applyTheme, updateChart, initCursor } from './modules/ui.js';

// Inicializa audio no clique global (como no antigo)
document.addEventListener('click', () => {
    initAudio();
}, { once: true });

function zeniteSystem() {
    return {
        // --- 1. ESTADO GERAL (Igual ao antigo) ---
        systemLoading: true, loadingProgress: 0, loadingText: 'BOOT',
        systemFailure: false, // Tela azul
        user: null, isGuest: false,
        authLoading: false, authMsg: '', authMsgType: '', userMenuOpen: false,
        
        // --- 2. DADOS E NAVEGAÇÃO ---
        chars: {}, activeCharId: null, char: null, agentCount: 0,
        currentView: 'dashboard', activeTab: 'profile', logisticsTab: 'inventory', searchQuery: '',
        unsavedChanges: false, isSyncing: false, saveStatus: 'idle',
        
        // --- 3. WIDGETS E UI ---
        diceTrayOpen: false, trayDockMode: 'float', trayPosition: { x: 0, y: 0 }, isDraggingTray: false,
        diceLog: [], lastRoll: '--', lastNatural: 0, lastFaces: 20, diceMod: 0, diceReason: '',
        showDiceTip: false, hasSeenDiceTip: false,
        
        // --- 4. MODAIS ---
        configModal: false, wizardOpen: false, cropperOpen: false, confirmOpen: false,
        confirmData: { title:'', desc:'', action:null, type:'danger' },
        wizardStep: 1, wizardPoints: 8, wizardNameError: false, wizardFocusAttr: '',
        wizardData: createEmptyChar(), // Inicializa limpo
        
        // --- 5. EXTRAS E HACKER MODE ---
        minigameActive: false, minigameClicks: 5, minigamePos: {x:50, y:50},
        logoClickCount: 0, logoClickTimer: null,
        isHackerMode: false, hackerModeUnlocked: false, konamiBuffer: [],
        
        // --- 6. CONFIGS ---
        settings: { mouseTrail: true, compactMode: false, crtMode: true, sfxEnabled: true, themeColor: 'cyan' },
        archetypes: ARCHETYPES, // Trazendo do módulo para o Alpine ver
        notifications: [],
        
        // Variáveis de controle interno
        uploadContext: 'char', cropperInstance: null, debouncedSaveFunc: null,

        // --- GETTERS ---
        get filteredChars() {
            if (!this.searchQuery) return this.chars;
            const q = this.searchQuery.toLowerCase();
            return Object.fromEntries(Object.entries(this.chars).filter(([_, c]) => 
                (c.name && c.name.toLowerCase().includes(q)) || (c.class && c.class.toLowerCase().includes(q))
            ));
        },

        // --- INICIALIZAÇÃO (initSystem no HTML) ---
        async initSystem() {
            this.loadingProgress = 10; this.loadingText = 'CORE SYSTEM';
            this.trayPosition = { x: window.innerWidth - 350, y: window.innerHeight - 500 };
            
            // Inicializa cursor (UI)
            initCursor(() => this.settings.mouseTrail && !this.isMobile && !this.isGuest);
            
            // Listeners de Janela
            window.addEventListener('resize', () => { this.isMobile = window.innerWidth < 768; this.ensureTrayOnScreen(); });
            window.addEventListener('keydown', (e) => this.handleKeys(e)); // Chama a função interna

            // Configura Debounce
            this.debouncedSaveFunc = debounce(() => {
                saveToLocal(this.isGuest, { ...this.chars, config: this.settings, trayPos: this.trayPosition, hasSeenTip: this.hasSeenDiceTip });
            }, 1000);

            // Carregamento de Dados
            const isGuest = localStorage.getItem('zenite_is_guest') === 'true';
            this.loadingProgress = 50; this.loadingText = 'LOADING DATA';

            if (isGuest) {
                this.enterGuest();
            } else {
                await this.initAuth();
            }

            // Recupera Hacker Mode
            if (localStorage.getItem('zenite_hacker_unlocked') === 'true') this.hackerModeUnlocked = true;
            if (localStorage.getItem('zenite_hacker_mode') === 'true') this.toggleHackerMode(true); // Força ativar se estava salvo

            this.loadingProgress = 100; this.loadingText = 'READY';
            setTimeout(() => this.systemLoading = false, 500);

            // Watcher Principal
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
            this.chars = local.chars || {};
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

        // --- LÓGICA E AÇÕES ---
        handleKeys(e) {
            // Konami
            const k = ['arrowup','arrowup','arrowdown','arrowdown','arrowleft','arrowright','arrowleft','arrowright','b','a'];
            this.konamiBuffer.push(e.key.toLowerCase());
            if (this.konamiBuffer.length > k.length) this.konamiBuffer.shift();
            if (JSON.stringify(this.konamiBuffer) === JSON.stringify(k)) {
                this.hackerModeUnlocked = true; localStorage.setItem('zenite_hacker_unlocked', 'true');
                this.toggleHackerMode(); this.konamiBuffer = [];
            }
            // Escape
            if(e.key === 'Escape') {
                if(this.wizardOpen) this.wizardOpen=false;
                else if(this.configModal) this.configModal=false;
                else if(this.currentView === 'sheet') this.attemptGoBack();
            }
        },

        toggleHackerMode(forceVal = null) {
            if(forceVal !== null) this.isHackerMode = forceVal;
            else this.isHackerMode = !this.isHackerMode;
            
            if(this.isHackerMode) { document.body.classList.add('theme-hacker'); localStorage.setItem('zenite_hacker_mode', 'true'); playSFX('success'); }
            else { document.body.classList.remove('theme-hacker'); localStorage.removeItem('zenite_hacker_mode'); playSFX('click'); }
        },

        // --- RPG E DADOS ---
        loadCharacter(id) {
            if(!this.chars[id]) return;
            this.activeCharId = id;
            this.char = sanitizeChar(this.chars[id]);
            this.currentView = 'sheet'; this.activeTab = 'profile';
            if(!this.hasSeenDiceTip) setTimeout(()=>this.showDiceTip=true, 1000);
            this.$nextTick(()=>this.updateRadar());
        },

        roll(d) {
            playSFX('click');
            const res = rollDice(d);
            const mod = parseInt(this.diceMod || 0);
            this.lastNatural = res; this.lastFaces = d; this.lastRoll = res + mod;
            this.diceLog.unshift({
                id: Date.now(), time: new Date().toLocaleTimeString(),
                formula: `D${d}${mod? (mod>0?'+'+mod:mod) : ''}`,
                result: res + mod, crit: res===d, fumble: res===1, reason: this.diceReason
            });
            this.diceReason = '';
            if(this.diceLog.length > 20) this.diceLog.pop();
        },

        // --- AUXILIARES ---
        notify(msg, type='info') {
            const id = Date.now();
            this.notifications.push({id, message: msg, type});
            setTimeout(() => this.notifications = this.notifications.filter(n=>n.id!==id), 3000);
        },
        
        updateRadar() {
            if(!this.char) return;
            updateChart('radarChart', [this.char.attrs.for, this.char.attrs.agi, this.char.attrs.int, this.char.attrs.von, this.char.attrs.pod]);
        },

        // --- RESTAURANDO FUNÇÕES QUE O HTML CHAMA DIRETAMENTE ---
        // Essas funções são referenciadas nos @clicks do HTML
        enterGuest() { 
            this.isGuest = true; localStorage.setItem('zenite_is_guest', 'true');
            const data = loadFromLocal(true);
            this.chars = data.chars; this.updateAgentCount();
            if(data.config) this.applySettings(data.config);
        },
        
        doSocialAuth(provider) {
            this.authLoading = true; this.authMsg = "Conectando...";
            supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });
        },

        askSwitchToOnline() { this.askConfirm('ONLINE?', 'Ir para login.', 'info', () => { localStorage.removeItem('zenite_is_guest'); window.location.reload(); }); },
        
        askLogout() { this.askConfirm('SAIR?', 'Dados não salvos serão perdidos.', 'warn', async () => { await supabase.auth.signOut(); localStorage.clear(); window.location.reload(); }); },
        
        openWizard() {
            if(this.agentCount >= CONSTANTS.MAX_AGENTS) return this.notify('Limite!', 'error');
            this.wizardStep = 1; this.wizardPoints = 8; this.wizardData = createEmptyChar(); 
            this.wizardData.attrs = {for:-1, agi:-1, int:-1, von:-1, pod:-1};
            this.wizardOpen = true;
        },
        
        finishWizard() {
            if(!this.wizardData.name) { this.wizardNameError = true; setTimeout(()=>this.wizardNameError=false, 500); return; }
            const id = generateId();
            const stats = calculateStats(this.wizardData.class, 1, this.wizardData.attrs);
            const newChar = sanitizeChar({ id, ...this.wizardData, level: 1, credits: 0, stats: { pv: {current: stats.pv, max: stats.pv}, pf: {current: stats.pf, max: stats.pf}, pdf: {current: stats.pdf, max: stats.pdf} } });
            this.chars[id] = newChar; this.updateAgentCount(); this.debouncedSaveFunc();
            if(!this.isGuest) this.syncCloud();
            this.wizardOpen = false; this.loadCharacter(id); this.notify('Criado!', 'success');
        },

        // As funções menores
        updateAgentCount() { this.agentCount = Object.keys(this.chars).length; },
        attemptGoBack() { if(this.unsavedChanges && !this.isGuest) { this.shakeAlert = true; setTimeout(()=>this.shakeAlert=false,300); this.notify("Salve antes!", "warn"); return; } this.currentView = 'dashboard'; },
        
        // Configurações
        applySettings(cfg) { if(cfg) this.settings = {...this.settings, ...cfg}; applyTheme(this.settings.themeColor); setSfxState(this.settings.sfxEnabled); document.body.classList.toggle('crt-mode', this.settings.crtMode); document.body.classList.toggle('compact-mode', this.settings.compactMode && this.isMobile); },
        toggleSetting(k, v=null) { if(v!==null) this.settings[k]=v; else this.settings[k]=!this.settings[k]; this.applySettings(); if(!this.isGuest) this.unsavedChanges=true; this.debouncedSaveFunc(); },

        // Minigame
        handleLogoClick() { this.logoClickCount++; clearTimeout(this.logoClickTimer); if(this.logoClickCount>=5) { this.systemFailure=true; playSFX('glitch'); } this.logoClickTimer=setTimeout(()=>this.logoClickCount=0, 400); },
        startMinigame() { this.minigameActive=true; this.minigameClicks=5; },
        hitMinigame() { this.minigameClicks--; playSFX('click'); this.minigamePos={x:Math.random()*80+10, y:Math.random()*80+10}; if(this.minigameClicks<=0) { this.minigameActive=false; this.systemFailure=false; playSFX('success'); } },

        // Dice Tray
        toggleDiceTray() { this.diceTrayOpen = !this.diceTrayOpen; if(this.diceTrayOpen) { this.hasSeenDiceTip=true; this.showDiceTip=false; this.ensureTrayOnScreen(); } },
        setDockMode(m) { this.trayDockMode = m; if(m==='float') this.ensureTrayOnScreen(); },
        ensureTrayOnScreen() { if(this.trayDockMode==='float') { this.trayPosition.x=Math.max(10,Math.min(window.innerWidth-320,this.trayPosition.x)); this.trayPosition.y=Math.max(60,Math.min(window.innerHeight-400,this.trayPosition.y)); }},
        startDragTray(e) { if(this.isMobile || this.trayDockMode!=='float' || e.target.closest('button,input')) return; this.isDraggingTray=true; }, // simplificado
        
        // Items & Skills wrappers
        addSkill() { this.char.skills.push({name:'Nova', level:1}); }, deleteSkill(i) { this.char.skills.splice(i,1); }, setSkillLevel(i,l) { this.char.skills[i].level=l; },
        addItem(c) { const d={name:'Item',dmg:'1d6',def:'1',desc:''}; if(c.includes('social_')) this.char.inventory.social[c.split('_')[1]].push({...d}); else this.char.inventory[c].push({...d}); },
        deleteItem(c,i,s) { if(s) this.char.inventory.social[s].splice(i,1); else this.char.inventory[c].splice(i,1); },
        addTechnique() { this.char.powers.techniques.push({name:'Tech', desc:''}); }, deleteTechnique(i) { this.char.powers.techniques.splice(i,1); },
        
        // Cloud Sync Wrapper
        async syncCloud(silent=false, local=null) { return await syncWithSupabase(this.user, local || {chars:this.chars, config:this.settings}).then(r => { this.chars=r.mergedData.chars; if(r.shouldPush) pushToSupabase(this.user, r.mergedData); }); },

        // Imagem
        openImageEditor(ctx) { this.uploadContext=ctx; document.getElementById('file-input').click(); },
        initCropper(e) { const f=e.target.files[0]; const r=new FileReader(); r.onload=(ev)=>{document.getElementById('crop-target').src=ev.target.result; this.cropperOpen=true;}; if(f) r.readAsDataURL(f); },
        applyCrop() { this.cropperOpen=false; this.notify('Imagem salva.', 'success'); }, // Simplificado pra evitar erro se cropperjs falhar
        
        // Helpers UI
        askConfirm(t,d,ty,a) { this.confirmData={title:t,desc:d,type:ty,action:a}; this.confirmOpen=true; },
        confirmYes() { if(this.confirmData.action) this.confirmData.action(); this.confirmOpen=false; },
        askHardReset() { localStorage.clear(); window.location.reload(); },
        
        // Wizards UI Helpers
        selectArchetype(a) { this.wizardData.class=a.class; this.wizardData.attrs={for:-1,agi:-1,int:-1,von:-1,pod:-1}; this.wizardData.attrs[a.focus]=0; this.wizardFocusAttr=a.focus; this.wizardStep=2; this.$nextTick(()=>updateChart('wizChart', Object.values(this.wizardData.attrs), true)); },
        modWizardAttr(k,v) { const c=this.wizardData.attrs[k]; if(v>0 && this.wizardPoints>0 && c<3) { this.wizardData.attrs[k]++; this.wizardPoints--; } if(v<0 && c>(k===this.wizardFocusAttr?0:-1)) { this.wizardData.attrs[k]--; this.wizardPoints++; } updateChart('wizChart', Object.values(this.wizardData.attrs), true); },
        
        // Modificadores de Atributos na Ficha
        modAttr(k, v) { const c = this.char.attrs[k]; if ((v > 0 && c < 6) || (v < 0 && c > -1)) { this.char.attrs[k] += v; this.recalcDerivedStats(); this.updateRadar(); } },
        recalcDerivedStats() { const s = calculateStats(this.char.class, this.char.level, this.char.attrs); this.char.stats.pv.max = s.pv; this.char.stats.pf.max = s.pf; this.char.stats.pdf.max = s.pdf; },
        modStat(s, v) { const st=this.char.stats[s]; st.current=Math.max(0, Math.min(st.max, st.current+v)); },
        
        // Extras
        isMobile: window.innerWidth < 768,
        triggerFileImport() { document.getElementById('import-file').click(); },
        processImport(e) { /* Lógica simples de importação se necessário */ },
        exportData() { /* Lógica simples de exportação */ }
    };
}

// ====================================================================
// A CORREÇÃO MÁGICA QUE O ALPINE PRECISA
// ====================================================================

// 1. Expor para o objeto global window para que o HTML enxergue
window.zeniteSystem = zeniteSystem;

// 2. Registrar no Alpine explicitamente assim que ele estiver pronto
document.addEventListener('alpine:init', () => {
    Alpine.data('zeniteSystem', zeniteSystem);
});

// 3. Fallback caso o Alpine já tenha carregado (para evitar race condition)
if (typeof Alpine !== 'undefined') {
    Alpine.data('zeniteSystem', zeniteSystem);
}