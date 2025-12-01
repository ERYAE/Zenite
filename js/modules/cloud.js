import { sanitizeChar } from './utils.js';
import { playSFX } from './audio.js';

export const cloudLogic = {
    loadLocal(key) {
        const local = localStorage.getItem(key);
        if(local) {
            try {
                const parsed = JSON.parse(local);
                if(parsed.config) this.settings = { ...this.settings, ...parsed.config };
                if(parsed.trayPos) this.trayPosition = parsed.trayPos;
                if(parsed.hasSeenTip !== undefined) this.hasSeenDiceTip = parsed.hasSeenTip;
                const validChars = {};
                Object.keys(parsed).forEach(k => { if(!['config','trayPos','hasSeenTip'].includes(k) && parsed[k]?.id) { validChars[k] = sanitizeChar(parsed[k]); } });
                this.chars = validChars;
                this.updateAgentCount();
            } catch(e) { console.error("Local Load Error", e); }
        }
    },
    saveLocal() {
        const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db';
        const payload = { ...this.chars, config: this.settings, trayPos: this.trayPosition, hasSeenTip: this.hasSeenDiceTip };
        localStorage.setItem(key, JSON.stringify(payload));
    },
    async fetchCloud() {
        if (!this.user || !this.supabase) return;
        try {
            let { data, error } = await this.supabase.from('profiles').select('data').eq('id', this.user.id).single();
            if (error && error.code === 'PGRST116') { await this.supabase.from('profiles').insert([{ id: this.user.id, data: { config: this.settings } }]); data = { data: { config: this.settings } }; }
            if (data && data.data) {
                const cloudData = data.data;
                if(cloudData.config) { this.settings = { ...this.settings, ...cloudData.config }; this.applyTheme(this.settings.themeColor); }
                if(cloudData.hasSeenTip !== undefined) this.hasSeenDiceTip = cloudData.hasSeenTip;
                let merged = { ...this.chars }; let hasLocalOnly = false;
                Object.keys(cloudData).forEach(k => { if(!['config','hasSeenTip'].includes(k)) { merged[k] = sanitizeChar(cloudData[k]); } });
                Object.keys(this.chars).forEach(localId => { if (!cloudData[localId] && localId !== 'config') { merged[localId] = this.chars[localId]; hasLocalOnly = true; } });
                this.chars = merged; this.updateAgentCount(); this.saveLocal();
                if (hasLocalOnly) { this.unsavedChanges = true; this.syncCloud(true); }
            }
        } catch(e) {}
    },
    async syncCloud(silent = false) {
         if (!this.user || this.isGuest || !this.unsavedChanges || this.isSyncing || !this.supabase) return;
        this.isSyncing = true; if(!silent) this.notify('Sincronizando...', 'info');
        try {
            const payload = { ...this.chars, config: this.settings, hasSeenTip: this.hasSeenDiceTip };
            const { error } = await this.supabase.from('profiles').upsert({ id: this.user.id, data: payload });
            if (error) throw error;
            this.unsavedChanges = false; this.saveStatus = 'success'; 
            if(!silent) { this.notify('Salvo!', 'success'); playSFX('save'); } 
        } catch (e) { this.saveStatus = 'error'; if(!silent) this.notify('Erro ao salvar.', 'error'); } finally { this.isSyncing = false; }
    },
    updateAgentCount() { this.agentCount = Object.keys(this.chars).length; },
    askLogout() { this.askConfirm('SAIR?', 'Dados pendentes serão salvos.', 'warn', () => this.logout()); },
    async logout() { 
        this.systemLoading = true; 
        if(this.unsavedChanges && !this.isGuest) { try { await this.syncCloud(true); } catch(e) { console.warn("Erro ao salvar no logout", e); } } 
        localStorage.removeItem('zenite_cached_db'); localStorage.removeItem('zenite_is_guest'); 
        if(this.supabase) { try { await this.supabase.auth.signOut(); } catch(e) { console.error("Erro no Supabase SignOut", e); } }
        window.location.reload(); 
    },
    askSwitchToOnline() { this.askConfirm('FICAR ONLINE?', 'Ir para login.', 'info', () => { this.isGuest = false; localStorage.removeItem('zenite_is_guest'); window.location.reload(); }); },
    enterGuest() { this.isGuest = true; localStorage.setItem('zenite_is_guest', 'true'); this.loadLocal('zenite_guest_db'); },
    doSocialAuth(provider) { if(!this.supabase) return this.notify("Erro de conexão.", "error"); this.authLoading = true; this.authMsg = "Conectando..."; this.supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } }).then(({error}) => { if(error) { this.notify(error.message, 'error'); this.authLoading = false; } }); }
};