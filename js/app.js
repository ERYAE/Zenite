/**
 * ZENITE OS - Modular Core
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
        sys: { loading: true, progress: 0, text: 'BOOT', failure: false },
        user: null, isGuest: false,
        view: { current: 'dashboard', tab: 'profile', logi: 'inventory', search: '' },
        
        // --- DADOS ---
        chars: {}, activeId: null, char: null,
        unsaved: false, syncing: false, saveStatus: 'idle',
        
        // --- MODAIS E WIDGETS ---
        modals: { config: false, wizard: false, cropper: false, confirm: false, tray: false },
        tray: { mode: 'float', pos: {x:0, y:0}, dragging: false, log: [], roll: '--', tip: false, seenTip: false },
        wiz: { step: 1, points: 8, data: {}, focus: '' },
        confirm: { title:'', desc:'', action:null, type:'danger' },
        
        // --- CONFIG ---
        cfg: { trail: true, compact: false, crt: true, sfx: true, color: 'cyan' },
        
        // --- EXTRAS ---
        hacker: { active: false, unlocked: false, clicks: 0, buffer: [] },
        cropper: null, uploadCtx: 'char', archetypes: ARCHETYPES,

        get filtered() {
            if (!this.view.search) return this.chars;
            const q = this.view.search.toLowerCase();
            return Object.fromEntries(Object.entries(this.chars).filter(([_, c]) => 
                c.name?.toLowerCase().includes(q) || c.class?.toLowerCase().includes(q)
            ));
        },

        // --- INICIALIZAÇÃO ---
        async init() {
            this.sys.progress = 10;
            this.tray.pos = { x: window.innerWidth - 350, y: window.innerHeight - 500 };
            
            // Audio & UX
            window.addEventListener('resize', () => this.trayFit());
            window.addEventListener('keydown', e => this.onKey(e));
            initCursor(() => this.cfg.trail && !this.isMobile() && !this.isGuest);
            
            // Debouncer para salvar
            this.saveFn = debounce(() => {
                saveToLocal(this.isGuest, { ...this.chars, config: this.cfg, trayPos: this.tray.pos, hasSeenTip: this.tray.seenTip });
            }, 1000);

            // Carregamento de Dados
            const isGuest = localStorage.getItem('zenite_is_guest') === 'true';
            this.sys.progress = 50; this.sys.text = 'LOADING MEMORY';
            
            if (isGuest) this.setGuest(true);
            else await this.initAuth();

            this.sys.progress = 100; this.sys.text = 'READY';
            setTimeout(() => this.sys.loading = false, 500);

            // Watcher para mudanças na ficha
            this.$watch('char', (val) => {
                if (!val || !this.activeId || this.sys.loading) return;
                this.chars[this.activeId] = JSON.parse(JSON.stringify(val));
                if (!this.isGuest) this.unsaved = true;
                this.saveFn();
                if (this.view.tab === 'profile') this.renderRadar();
            }, {deep: true});
        },

        async initAuth() {
            const local = loadFromLocal(false);
            if (local.config) this.applyCfg(local.config);
            this.chars = local.chars;
            
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                this.user = session.user;
                this.sys.text = 'SYNCING CLOUD';
                await this.doSync(local);
            }

            supabase.auth.onAuthStateChange((evt, sess) => {
                if (evt === 'SIGNED_IN' && sess) window.location.reload();
                if (evt === 'SIGNED_OUT') window.location.reload();
            });
        },

        // --- AÇÕES DO SISTEMA ---
        async doSync(localData = null) {
            if (!this.user) return;
            this.syncing = true;
            try {
                // Se não passamos dados locais, carregamos agora
                const local = localData || { chars: this.chars, config: this.cfg };
                const res = await syncWithSupabase(this.user, local);
                
                this.chars = res.mergedData.chars;
                if(res.mergedData.config) this.applyCfg(res.mergedData.config);
                
                if (res.shouldPush || this.unsaved) {
                    await pushToSupabase(this.user, res.mergedData);
                    this.unsaved = false; playSFX('save');
                }
                saveToLocal(false, res.mergedData); // Atualiza cache local
            } catch(e) { console.error(e); this.notify('Erro Sync', 'error'); }
            this.syncing = false;
        },
        
        setGuest(val) {
            this.isGuest = val;
            const data = loadFromLocal(val);
            this.chars = data.chars;
            if(data.config) this.applyCfg(data.config);
        },
        
        applyCfg(newCfg) {
            this.cfg = { ...this.cfg, ...newCfg };
            applyTheme(this.cfg.color);
            setSfxState(this.cfg.sfx);
            document.body.classList.toggle('crt-mode', this.cfg.crt);
        },

        toggleCfg(k, v=null) {
            this.cfg[k] = v !== null ? v : !this.cfg[k];
            this.applyCfg(this.cfg);
            this.unsaved = !this.isGuest;
            this.saveFn();
        },

        // --- RPG & FICHA ---
        loadChar(id) {
            if (!this.chars[id]) return;
            this.activeId = id;
            this.char = sanitizeChar(this.chars[id]); // Clona e limpa
            this.view.current = 'sheet'; this.view.tab = 'profile';
            if(!this.tray.seenTip) setTimeout(() => this.tray.tip = true, 1000);
            this.$nextTick(() => this.renderRadar());
        },
        
        calcStats() {
            if (!this.char) return;
            const neo = calculateStats(this.char.class, this.char.level, this.char.attrs);
            // Atualiza Max, mantém Current proporcional ou restrito
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
                this.calcStats();
                this.renderRadar();
            }
        },

        // --- WIZARD (CRIAÇÃO) ---
        openWizard() {
            if(Object.keys(this.chars).length >= CONSTANTS.MAX_AGENTS) return this.notify('Limite!', 'error');
            this.wiz = { step: 1, points: 8, data: createEmptyChar(), focus: '' };
            this.modals.wizard = true;
        },
        
        wizSelect(arch) {
            this.wiz.data.class = arch.class;
            this.wiz.data.attrs[arch.focus] = 0;
            this.wiz.focus = arch.focus;
            this.wiz.step = 2;
            this.$nextTick(() => updateChart('wizChart', Object.values(this.wiz.data.attrs), true));
        },
        
        wizMod(k, v) {
            const cur = this.wiz.data.attrs[k];
            const min = k === this.wiz.focus ? 0 : -1;
            if (v > 0 && this.wiz.points > 0 && cur < 3) { this.wiz.data.attrs[k]++; this.wiz.points--; }
            if (v < 0 && cur > min) { this.wiz.data.attrs[k]--; this.wiz.points++; }
            updateChart('wizChart', Object.values(this.wiz.data.attrs), true);
        },
        
        wizFinish() {
            if(!this.wiz.data.name) return this.notify('Nome obrigatório!', 'error');
            const id = generateId();
            const stats = calculateStats(this.wiz.data.class, 1, this.wiz.data.attrs);
            
            const newChar = sanitizeChar({ 
                id, ...this.wiz.data, level: 1, credits: 0,
                stats: { 
                    pv: {current: stats.pv, max: stats.pv}, 
                    pf: {current: stats.pf, max: stats.pf}, 
                    pdf: {current: stats.pdf, max: stats.pdf} 
                }
            });
            
            this.chars[id] = newChar;
            this.saveFn();
            if(!this.isGuest) this.doSync(); // Força sync ao criar
            this.modals.wizard = false;
            this.loadChar(id);
            this.notify('Agente Criado.', 'success');
        },

        // --- INTERFACE & UTIL ---
        roll(d) {
            playSFX('click');
            const res = rollDice(d);
            const mod = parseInt(this.tray.rollMod || 0);
            this.tray.roll = res + mod;
            this.tray.log.unshift({
                t: new Date().toLocaleTimeString(),
                f: `D${d}${mod? (mod>0?'+'+mod:mod) : ''}`,
                r: res + mod,
                crit: res === d, fumble: res === 1
            });
            if(this.tray.log.length > 20) this.tray.log.pop();
        },

        notify(msg, type='info') {
            const id = Date.now();
            this.sys.notifications = this.sys.notifications || []; // Safety
            this.sys.notifications.push({id, message: msg, type});
            setTimeout(() => this.sys.notifications = this.sys.notifications.filter(n=>n.id!==id), 3000);
        },

        renderRadar() {
            if(!this.char) return;
            updateChart('radarChart', [this.char.attrs.for,this.char.attrs.agi,this.char.attrs.int,this.char.attrs.von,this.char.attrs.pod]);
        },

        // Atalhos de UI
        isMobile() { return window.innerWidth < 768; },
        onKey(e) { if(e.key==='Escape') Object.keys(this.modals).forEach(k=>this.modals[k]=false); },
        trayFit() { /* lógica de manter na tela igual anterior */ },
        
        // --- AUTH SOCIAL ---
        socialLogin(provider) {
            this.sys.authLoading = true;
            supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });
        }
    };
}
window.zeniteSystem = zeniteSystem;