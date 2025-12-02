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
                Object.keys(parsed).forEach(k => { 
                    if(!['config','trayPos','hasSeenTip'].includes(k) && parsed[k]?.id) { 
                        validChars[k] = sanitizeChar(parsed[k]); 
                    } 
                });
                this.chars = validChars;
                this.updateAgentCount();
            } catch(e) { 
                console.error("Local Load Error", e); 
            }
        }
    },
    
    saveLocal() {
        const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db';
        const payload = { 
            ...this.chars, 
            config: this.settings, 
            trayPos: this.trayPosition, 
            hasSeenTip: this.hasSeenDiceTip 
        };
        localStorage.setItem(key, JSON.stringify(payload));
    },
    
    async fetchCloud() {
        if (!this.user || !this.supabase) return;
        try {
            let { data, error } = await this.supabase
                .from('profiles')
                .select('data')
                .eq('id', this.user.id)
                .single();
            
            if (error && error.code === 'PGRST116') { 
                // Cria perfil novo
                await this.supabase
                    .from('profiles')
                    .insert([{ 
                        id: this.user.id, 
                        data: { config: this.settings } 
                    }]); 
                data = { data: { config: this.settings } }; 
            }
            
            if (data && data.data) {
                const cloudData = data.data;
                
                // Aplica configs
                if(cloudData.config) { 
                    this.settings = { ...this.settings, ...cloudData.config }; 
                    this.applyTheme(this.settings.themeColor); 
                }
                
                if(cloudData.hasSeenTip !== undefined) {
                    this.hasSeenDiceTip = cloudData.hasSeenTip;
                }
                
                // CORREÇÃO: Prioriza dados da nuvem
                // Remove personagens locais que não existem na nuvem
                let merged = {};
                
                // Adiciona todos os chars da nuvem
                Object.keys(cloudData).forEach(k => { 
                    if(!['config','hasSeenTip'].includes(k) && cloudData[k]?.id) { 
                        merged[k] = sanitizeChar(cloudData[k]); 
                    } 
                });
                
                this.chars = merged; 
                this.updateAgentCount(); 
                this.saveLocal();
            }
        } catch(e) {
            console.error("Fetch Cloud Error:", e);
            this.notify('Erro ao sincronizar.', 'error');
        }
    },
    
    async syncCloud(silent = false) {
        if (!this.user || this.isGuest || this.isSyncing || !this.supabase) return;
        
        this.isSyncing = true; 
        if(!silent) this.notify('Sincronizando...', 'info');
        
        try {
            const payload = { 
                ...this.chars, 
                config: this.settings, 
                hasSeenTip: this.hasSeenDiceTip 
            };
            
            const { error } = await this.supabase
                .from('profiles')
                .upsert({ 
                    id: this.user.id, 
                    data: payload 
                }, {
                    onConflict: 'id'
                });
            
            if (error) throw error;
            
            this.unsavedChanges = false; 
            this.saveStatus = 'success'; 
            this.lastManualSave = new Date();
            
            if(!silent) { 
                this.notify('Salvo na nuvem!', 'success'); 
                playSFX('save'); 
            } 
        } catch (e) { 
            console.error("Sync Error:", e);
            this.saveStatus = 'error'; 
            if(!silent) this.notify('Erro ao salvar na nuvem.', 'error'); 
        } finally { 
            this.isSyncing = false; 
        }
    },
    
    // NOVO: Função para forçar sincronização completa
    async forceSyncCloud() {
        if (!this.user || this.isGuest || !this.supabase) return;
        
        this.notify('Forçando sincronização...', 'info');
        this.isSyncing = true;
        
        try {
            // Baixa dados da nuvem
            await this.fetchCloud();
            
            // Sobe dados locais
            await this.syncCloud(false);
            
            this.notify('Sincronização completa!', 'success');
        } catch(e) {
            console.error("Force Sync Error:", e);
            this.notify('Erro na sincronização forçada.', 'error');
        } finally {
            this.isSyncing = false;
        }
    },
    
    updateAgentCount() { 
        this.agentCount = Object.keys(this.chars).length; 
    },
    
    askLogout() { 
        this.askConfirm(
            'ENCERRAR SESSÃO?', 
            'Dados pendentes serão salvos antes de sair.', 
            'warn', 
            () => this.logout()
        ); 
    },
    
    async logout() { 
        this.systemLoading = true; 
        
        // Salva antes de sair
        if(this.unsavedChanges && !this.isGuest) { 
            try { 
                await this.syncCloud(true); 
            } catch(e) { 
                console.warn("Erro ao salvar no logout", e); 
            } 
        } 
        
        localStorage.removeItem('zenite_cached_db'); 
        localStorage.removeItem('zenite_is_guest'); 
        
        if(this.supabase) { 
            try { 
                await this.supabase.auth.signOut(); 
            } catch(e) { 
                console.error("Erro no Supabase SignOut", e); 
            }
        }
        
        window.location.reload(); 
    },
    
    askSwitchToOnline() { 
        this.askConfirm(
            'CONECTAR À NUVEM?', 
            'Seus dados locais serão sincronizados.', 
            'info', 
            () => { 
                this.isGuest = false; 
                localStorage.removeItem('zenite_is_guest'); 
                window.location.reload(); 
            }
        ); 
    },
    
    enterGuest() { 
        this.isGuest = true; 
        localStorage.setItem('zenite_is_guest', 'true'); 
        this.loadLocal('zenite_guest_db'); 
    },
    
    doSocialAuth(provider) { 
        if(!this.supabase) {
            return this.notify("Erro de conexão com servidor.", "error"); 
        }
        
        this.authLoading = true; 
        this.authMsg = "Conectando..."; 
        
        this.supabase.auth.signInWithOAuth({ 
            provider, 
            options: { 
                redirectTo: window.location.origin 
            } 
        }).then(({error}) => { 
            if(error) { 
                this.notify(error.message, 'error'); 
                this.authLoading = false; 
            } 
        }); 
    }
};