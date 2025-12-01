/**
 * ZENITE OS - Modular Core (Versão Corrigida para Compatibilidade Total)
 */
import { CONSTANTS, supabase } from './modules/config.js';
import { debounce, rollDice, generateId } from './modules/utils.js';
import { playSFX, setSfxState } from './modules/audio.js';
import { ARCHETYPES, calculateStats, sanitizeChar, createEmptyChar } from './modules/rpg.js';
import { loadFromLocal, saveToLocal, syncWithSupabase, pushToSupabase } from './modules/cloud.js';
import { applyTheme, updateChart, initCursor } from './modules/ui.js';

// Função principal do componente Alpine
function zeniteSystem() {
    return {
        // --- 1. ESTADO DO SISTEMA (Loading, Auth, Erros) ---
        systemLoading: true, 
        loadingProgress: 0, 
        loadingText: 'BOOT',
        systemFailure: false, // Usado na tela azul (BSOD)
        
        user: null, 
        isGuest: false,
        authLoading: false, 
        authMsg: '', 
        authMsgType: '',
        userMenuOpen: false,
        
        // --- 2. NAVEGAÇÃO E DADOS ---
        currentView: 'dashboard', 
        activeTab: 'profile', 
        logisticsTab: 'inventory', 
        searchQuery: '',
        
        chars: {}, 
        activeCharId: null, 
        char: null, 
        agentCount: 0,
        
        unsavedChanges: false, 
        isSyncing: false, 
        saveStatus: 'idle',
        
        // --- 3. UI, MODAIS E WIDGETS ---
        configModal: false, 
        wizardOpen: false, 
        cropperOpen: false, 
        confirmOpen: false, 
        confirmData: { title:'', desc:'', action:null, type:'danger' },
        
        diceTrayOpen: false, 
        trayDockMode: 'float', 
        trayPosition: { x: 0, y: 0 }, 
        isDraggingTray: false,
        showDiceTip: false, 
        hasSeenDiceTip: false,
        diceLog: [], 
        lastRoll: '--', 
        lastNatural: 0, 
        lastFaces: 20, 
        diceMod: 0, 
        diceReason: '',
        
        revertConfirmMode: false, 
        isReverting: false, 
        shakeAlert: false, 
        isMobile: window.innerWidth < 768,
        
        // --- 4. WIZARD (Criação de Personagem) ---
        wizardStep: 1, 
        wizardPoints: 8, 
        wizardNameError: false, 
        wizardFocusAttr: '',
        wizardData: { class: '', name: '', identity: '', age: '', history: '', photo: null, attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} },
        archetypes: ARCHETYPES, // Lista de classes
        
        // --- 5. CONFIGURAÇÕES & EXTRAS ---
        settings: { mouseTrail: true, compactMode: false, crtMode: true, sfxEnabled: true, themeColor: 'cyan' },
        
        // Minigame Hacker / Logo Click
        minigameActive: false, 
        minigameClicks: 5, 
        minigamePos: {x: 50, y: 50}, 
        logoClickCount: 0, 
        logoClickTimer: null,
        isHackerMode: false, 
        hackerModeUnlocked: false, 
        konamiBuffer: [],
        
        // Outros
        notifications: [],
        uploadContext: 'char', 
        cropperInstance: null,
        debouncedSaveFunc: null,

        // --- COMPUTED (Getters) ---
        get filteredChars() {
            if (!this.searchQuery) return this.chars;
            const q = this.searchQuery.toLowerCase();
            return Object.fromEntries(Object.entries(this.chars).filter(([_, c]) => 
                (c.name && c.name.toLowerCase().includes(q)) || (c.class && c.class.toLowerCase().includes(q))
            ));
        },

        // --- INICIALIZAÇÃO (Chamado pelo x-init) ---
        async initSystem() {
            this.loadingProgress = 10;
            this.trayPosition = { x: window.innerWidth - 350, y: window.innerHeight - 500 };
            
            // Listeners Globais
            window.addEventListener('resize', () => { 
                this.isMobile = window.innerWidth < 768; 
                this.ensureTrayOnScreen(); 
            });
            // O cursor precisa ser iniciado aqui
            initCursor(() => this.settings.mouseTrail && !this.isMobile && !this.isGuest);
            
            // Debounce para salvar
            this.debouncedSaveFunc = debounce(() => {
                saveToLocal(this.isGuest, { 
                    ...this.chars, 
                    config: this.settings, 
                    trayPos: this.trayPosition, 
                    hasSeenTip: this.hasSeenDiceTip 
                });
            }, 1000);

            // Carregamento Inicial
            const isGuest = localStorage.getItem('zenite_is_guest') === 'true';
            this.loadingProgress = 50; 
            this.loadingText = 'LOADING DATA';
            
            if (isGuest) {
                this.enterGuest(); 
            } else {
                await this.initAuth();
            }

            // Hacker Mode Check
            if (localStorage.getItem('zenite_hacker_unlocked') === 'true') this.hackerModeUnlocked = true;
            if (localStorage.getItem('zenite_hacker_mode') === 'true') { 
                this.isHackerMode = true; 
                document.body.classList.add('theme-hacker'); 
            }

            this.loadingProgress = 100; 
            this.loadingText = 'READY';
            setTimeout(() => this.systemLoading = false, 500);

            // Watcher principal para salvar dados
            this.$watch('char', (val) => {
                if (!val || !this.activeCharId || this.systemLoading || this.isReverting) return;
                // Clone para quebrar a referência e salvar snapshot
                this.chars[this.activeCharId] = JSON.parse(JSON.stringify(val));
                if (!this.isGuest) this.unsavedChanges = true;
                this.debouncedSaveFunc();
                if (this.activeTab === 'profile') this.updateRadar();
            }, {deep: true});
        },

        async initAuth() {
            // 1. Carrega Cache Local Primeiro (Instantâneo)
            const local = loadFromLocal(false);
            if (local.config) this.applySettings(local.config);
            this.chars = local.chars || {};
            this.updateAgentCount();
            
            // 2. Tenta Sync com Supabase
            if (supabase) {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    this.user = session.user;
                    this.loadingText = 'SYNCING CLOUD';
                    await this.syncCloud(null, local);
                } else {
                    // Sem sessão, não faz nada (fica na tela de login)
                }

                supabase.auth.onAuthStateChange((evt, sess) => {
                    if (evt === 'SIGNED_IN' && sess && !this.user) window.location.reload();
                    if (evt === 'SIGNED_OUT') window.location.reload();
                });
            }
        },

        // --- FUNÇÕES DE NAVEGAÇÃO & UI ---
        handleKeys(e) {
            // Lógica do Konami Code
            const konami = ['arrowup','arrowup','arrowdown','arrowdown','arrowleft','arrowright','arrowleft','arrowright','b','a'];
            this.konamiBuffer.push(e.key.toLowerCase());
            if (this.konamiBuffer.length > konami.length) this.konamiBuffer.shift();
            if (JSON.stringify(this.konamiBuffer) === JSON.stringify(konami)) {
                this.hackerModeUnlocked = true; 
                localStorage.setItem('zenite_hacker_unlocked', 'true');
                this.toggleHackerMode(); 
                this.konamiBuffer = [];
            }

            // Tecla ESC
            if (e.key === 'Escape') {
                if(this.systemFailure) return;
                if(this.wizardOpen) this.wizardOpen=false; 
                else if(this.configModal) this.configModal=false;
                else if(this.cropperOpen) this.cropperOpen=false;
                else if(this.confirmOpen) this.confirmOpen=false;
                else if(this.diceTrayOpen) this.diceTrayOpen=false;
                else if(this.userMenuOpen) this.userMenuOpen=false;
                else if(this.currentView === 'sheet') this.attemptGoBack();
            }
        },

        attemptGoBack() { 
            if(this.unsavedChanges && !this.isGuest) {
                this.shakeAlert = true; 
                setTimeout(()=>this.shakeAlert=false,300); 
                this.notify("Salve antes de sair!", "warn"); 
                return; 
            } 
            this.saveAndExit(); 
        },

        saveAndExit() {
            if(this.char && this.activeCharId) this.chars[this.activeCharId] = JSON.parse(JSON.stringify(this.char));
            this.debouncedSaveFunc(); 
            if(!this.isGuest && this.unsavedChanges) this.syncCloud();
            this.updateAgentCount(); 
            this.currentView = 'dashboard'; 
            this.activeCharId = null;
        },

        // --- AUTH & CLOUD ---
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
                    this.unsavedChanges = false; 
                    playSFX('save');
                }
                saveToLocal(false, res.mergedData);
            } catch(e) { console.error(e); this.notify('Erro Sync', 'error'); }
            this.isSyncing = false;
        },

        enterGuest() {
            this.isGuest = true;
            localStorage.setItem('zenite_is_guest', 'true');
            const data = loadFromLocal(true);
            this.chars = data.chars;
            this.updateAgentCount();
            if(data.config) this.applySettings(data.config);
        },

        doSocialAuth(provider) {
            this.authLoading = true;
            this.authMsg = "Conectando...";
            supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } })
                .then(({error}) => { if(error) { this.notify(error.message, 'error'); this.authLoading = false; } });
        },

        askLogout() { 
            this.askConfirm('SAIR?', 'Dados não salvos serão perdidos.', 'warn', async () => {
                await supabase.auth.signOut(); 
                localStorage.removeItem('zenite_cached_db');
                localStorage.removeItem('zenite_is_guest');
                window.location.reload();
            });
        },

        askSwitchToOnline() { 
            this.askConfirm('ONLINE?', 'Ir para login.', 'info', () => {
                localStorage.removeItem('zenite_is_guest'); 
                window.location.reload();
            });
        },

        // --- CONFIGURAÇÕES ---
        applySettings(newCfg = null) {
            if(newCfg) this.settings = { ...this.settings, ...newCfg };
            applyTheme(this.settings.themeColor);
            setSfxState(this.settings.sfxEnabled);
            if(this.settings.crtMode) document.body.classList.add('crt-mode'); else document.body.classList.remove('crt-mode');
            if(this.settings.compactMode && this.isMobile) document.body.classList.add('compact-mode');
        },

        toggleSetting(key, val=null) {
            if(val !== null) this.settings[key] = val; 
            else this.settings[key] = !this.settings[key];
            
            this.applySettings();
            if(!this.isGuest) this.unsavedChanges = true;
            this.debouncedSaveFunc();
        },

        // --- RPG: FICHA & DADOS ---
        loadCharacter(id) {
            if (!this.chars[id]) return this.notify('Erro ao carregar.', 'error');
            this.activeCharId = id;
            this.char = sanitizeChar(this.chars[id]);
            this.currentView = 'sheet'; 
            this.activeTab = 'profile';
            this.diceTrayOpen = false;
            
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

        updateRadar() {
            if(!this.char) return;
            updateChart('radarChart', [this.char.attrs.for, this.char.attrs.agi, this.char.attrs.int, this.char.attrs.von, this.char.attrs.pod]);
        },

        updateAgentCount() { this.agentCount = Object.keys(this.chars).length; },

        // --- RPG: INVENTÁRIO ---
        addSkill() { this.char.skills.push({name:'Nova', level:1}); }, 
        deleteSkill(i) { this.char.skills.splice(i,1); }, 
        setSkillLevel(i,l) { this.char.skills[i].level = l; },
        
        addItem(cat) { 
            const defs = { weapons: {name:'Arma',dmg:'1d6',range:'C'}, armor:{name:'Traje',def:'1',pen:'0'}, gear:{name:'Item',desc:'',qty:1}, social_people:{name:'Nome',role:'Relação'}, social_objects:{name:'Objeto',desc:'Detalhes'} };
            if(cat.includes('social_')) this.char.inventory.social[cat.split('_')[1]].push({...defs[cat]}); else this.char.inventory[cat].push({...defs[cat]});
        },
        deleteItem(cat, i, sub) { if(sub) this.char.inventory.social[sub].splice(i,1); else this.char.inventory[cat].splice(i,1); },
        
        addTechnique() { this.char.powers.techniques.push({name:'Técnica', desc:''}); }, 
        deleteTechnique(i) { this.char.powers.techniques.splice(i,1); },

        // --- WIZARD (CRIAÇÃO) ---
        openWizard() {
            if(this.agentCount >= CONSTANTS.MAX_AGENTS) return this.notify('Limite atingido.', 'error');
            this.wizardStep = 1; 
            this.wizardPoints = 8; 
            this.wizardData = createEmptyChar(); 
            // Reset attrs para o wizard
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
                this.wizardNameError = true; playSFX('error');
                setTimeout(()=>this.wizardNameError=false, 500);
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

        // --- DADOS & UX ---
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

        toggleDiceTray() {
            if(this.isReverting) return;
            this.diceTrayOpen = !this.diceTrayOpen;
            if(this.diceTrayOpen) { 
                if(!this.hasSeenDiceTip) { this.hasSeenDiceTip = true; this.debouncedSaveFunc(); }
                this.showDiceTip = false; 
                this.ensureTrayOnScreen();
            }
        },

        setDockMode(m) { 
            this.trayDockMode = m; 
            if(m==='float') this.ensureTrayOnScreen(); 
        },

        ensureTrayOnScreen() { 
            if(this.isMobile || this.trayDockMode !== 'float') return;
            this.trayPosition.x = Math.max(10, Math.min(window.innerWidth - 320, this.trayPosition.x));
            this.trayPosition.y = Math.max(60, Math.min(window.innerHeight - 400, this.trayPosition.y));
        },

        startDragTray(e) { 
            if(this.isMobile || this.trayDockMode !== 'float') return;
            if(e.target.closest('button, input')) return;
            
            const el = document.getElementById('dice-tray-window');
            if(!el) return;
            
            this.isDraggingTray = true;
            const startX = e.clientX, startY = e.clientY;
            const startL = this.trayPosition.x, startT = this.trayPosition.y;
            
            el.style.transition = 'none';
            
            const move = (ev) => { 
                if(this.isDraggingTray) { 
                    el.style.left = `${startL + ev.clientX - startX}px`; 
                    el.style.top = `${startT + ev.clientY - startY}px`; 
                }
            };
            
            const up = (ev) => { 
                this.isDraggingTray = false; 
                document.removeEventListener('mousemove', move); 
                document.removeEventListener('mouseup', up);
                this.trayPosition.x = startL + ev.clientX - startX; 
                this.trayPosition.y = startT + ev.clientY - startY;
                el.style.transition = ''; 
                this.debouncedSaveFunc();
            };
            document.addEventListener('mousemove', move); 
            document.addEventListener('mouseup', up);
        },

        // --- SISTEMA: HACKER & EXTRAS ---
        handleLogoClick() { 
            this.logoClickCount++; clearTimeout(this.logoClickTimer);
            if(this.logoClickCount >= 5) { this.systemFailure = true; playSFX('glitch'); }
            this.logoClickTimer = setTimeout(()=>this.logoClickCount=0, 400);
        },
        
        toggleHackerMode() { 
            this.isHackerMode = !this.isHackerMode; 
            if(this.isHackerMode) { document.body.classList.add('theme-hacker'); localStorage.setItem('zenite_hacker_mode', 'true'); playSFX('success'); }
            else { document.body.classList.remove('theme-hacker'); localStorage.removeItem('zenite_hacker_mode'); playSFX('click'); }
        },
        
        startMinigame() { this.minigameActive = true; this.minigameClicks = 5; },
        
        hitMinigame() { 
            this.minigameClicks--; playSFX('click');
            this.minigamePos = {x: Math.floor(Math.random()*80)+10, y: Math.floor(Math.random()*80)+10};
            if(this.minigameClicks <= 0) { 
                this.minigameActive = false; 
                this.systemFailure = false; 
                playSFX('success'); 
                this.notify("SISTEMA RESTAURADO", "success");
            }
        },

        // --- UTILITÁRIOS ---
        notify(msg, type='info') {
            const id = Date.now();
            this.notifications.push({id, message: msg, type});
            setTimeout(() => this.notifications = this.notifications.filter(n=>n.id!==id), 3000);
        },

        askConfirm(title, desc, type, action) { 
            this.confirmData = {title, desc, type, action}; 
            this.confirmOpen = true; 
        },
        
        confirmYes() { 
            if(this.confirmData.action) this.confirmData.action(); 
            this.confirmOpen = false; 
        },
        
        askDeleteChar(id) { 
            this.askConfirm('ELIMINAR?', 'Irreversível.', 'danger', () => { 
                delete this.chars[id]; 
                this.updateAgentCount(); 
                this.debouncedSaveFunc(); 
                if(!this.isGuest) this.syncCloud(); 
                this.notify('Deletado.', 'success');
            }); 
        },
        
        askHardReset() { 
            this.askConfirm('LIMPAR TUDO?', 'Apaga cache local.', 'danger', () => { 
                localStorage.clear(); 
                window.location.reload(); 
            }); 
        },
        
        toggleRevertMode() { 
            this.revertConfirmMode = !this.revertConfirmMode; 
            if(this.revertConfirmMode) this.diceTrayOpen = false; 
        },
        
        performRevert() {
            this.isReverting = true; 
            this.diceTrayOpen = false; 
            this.revertConfirmMode = false;
            playSFX('discard');
            
            setTimeout(async () => {
                if(this.isGuest) {
                    this.enterGuest();
                } else {
                    const local = loadFromLocal(false);
                    await this.syncCloud(null, local);
                }
                
                if(this.activeCharId && this.chars[this.activeCharId]) {
                    this.char = sanitizeChar(this.chars[this.activeCharId]);
                } else {
                    this.currentView = 'dashboard';
                    this.char = null;
                }
                
                this.unsavedChanges = false;
                this.notify('Dados restaurados.', 'success');
                this.isReverting = false;
            }, 300);
        },

        // --- IMAGENS & ARQUIVOS ---
        openImageEditor(ctx) { this.uploadContext = ctx; document.getElementById('file-input').click(); },
        initCropper(e) { 
            const f = e.target.files[0]; if(!f) return;
            const r = new FileReader(); 
            r.onload = (evt) => { 
                const img = document.getElementById('crop-target');
                img.src = evt.target.result; 
                this.cropperOpen = true;
                this.$nextTick(() => { 
                    if(this.cropperInstance) this.cropperInstance.destroy(); 
                    this.cropperInstance = new Cropper(img, {aspectRatio: 1, viewMode: 1}); 
                });
            };
            r.readAsDataURL(f);
            e.target.value = ''; // Reset input
        },
        applyCrop() { 
            if(!this.cropperInstance) return;
            const res = this.cropperInstance.getCroppedCanvas({width:300, height:300}).toDataURL('image/jpeg', 0.8);
            if(this.uploadContext === 'wizard') this.wizardData.photo = res; 
            else if(this.char) this.char.photo = res;
            this.cropperOpen = false; 
            this.notify('Foto processada.', 'success');
        },
        exportData() { 
            const s = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.chars));
            const a = document.createElement('a'); a.href = s; a.download = `zenite_bkp.json`; 
            a.click(); a.remove(); 
            this.notify('Backup baixado.', 'success');
        },
        triggerFileImport() { document.getElementById('import-file').click(); },
        processImport(e) { 
            const f = e.target.files[0]; if(!f) return;
            const r = new FileReader(); 
            r.onload = (evt) => { 
                try { 
                    const d = JSON.parse(evt.target.result); 
                    this.chars = {...this.chars, ...d}; 
                    this.updateAgentCount(); 
                    this.debouncedSaveFunc(); 
                    this.unsavedChanges = true; 
                    this.notify('Importado!', 'success'); 
                    this.configModal = false; 
                } catch(err){ this.notify('Erro arquivo.', 'error'); } 
            }; 
            r.readAsText(f); 
        }
    };
}

// ====================================================================
// CONEXÃO COM O HTML (O segredo para funcionar)
// ====================================================================

// 1. Expõe a função globalmente para o Alpine encontrar no x-data
window.zeniteSystem = zeniteSystem;

// 2. Garante que o Alpine saiba que o componente existe
document.addEventListener('alpine:init', () => {
    Alpine.data('zeniteSystem', zeniteSystem);
});