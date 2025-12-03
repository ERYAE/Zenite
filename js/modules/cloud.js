// js/modules/cloud.js
import { sanitizeChar, migrateCharacter } from './utils.js';
import { playSFX } from './audio.js';

export const cloudLogic = {
    loadLocal(key) {
        const local = localStorage.getItem(key);
        if(!local) return;
        
        try {
            const parsed = JSON.parse(local);
            
            // Carrega configurações
            if(parsed.config) this.settings = { ...this.settings, ...parsed.config };
            if(parsed.trayPos) this.trayPosition = parsed.trayPos;
            if(parsed.hasSeenTip !== undefined) this.hasSeenDiceTip = parsed.hasSeenTip;
            if(parsed.trayDockMode) this.trayDockMode = parsed.trayDockMode;
            
            // SISTEMA DE GARBAGE COLLECTION (180 DIAS)
            const INACTIVITY_LIMIT = 180 * 24 * 60 * 60 * 1000; 
            const now = Date.now();
            let deletedCount = 0;
            
            const validChars = {};
            const reservedKeys = ['config', 'trayPos', 'hasSeenTip', 'trayDockMode'];
            
            Object.keys(parsed).forEach(k => { 
                if(!reservedKeys.includes(k) && parsed[k]?.id) { 
                    let char = sanitizeChar(parsed[k]);
                    char = migrateCharacter(char);
                    
                    // Define lastAccess se não existir
                    const lastAccess = char.lastAccess || now;
                    
                    if ((now - lastAccess) < INACTIVITY_LIMIT) {
                        validChars[k] = char;
                    } else {
                        deletedCount++;
                    }
                } 
            });
            
            if (deletedCount > 0) {
                this.notify(`${deletedCount} fichas antigas removidas.`, 'info');
            }

            this.chars = validChars;
            this.updateAgentCount();
        } catch(e) { 
            console.error("Local Load Error:", e); 
            this.notify("Erro ao carregar dados locais.", "error");
        }
    },
    
    saveLocal() {
        try {
            const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db';
            const payload = { 
                ...this.chars, 
                config: this.settings, 
                trayPos: this.trayPosition, 
                trayDockMode: this.trayDockMode,
                hasSeenTip: this.hasSeenDiceTip 
            };
            localStorage.setItem(key, JSON.stringify(payload));
        } catch(e) {
            console.error("Save Local Error:", e);
            // Provavelmente localStorage está cheio
            if (e.name === 'QuotaExceededError') {
                this.notify("Armazenamento local cheio. Limpe o cache.", "error");
            }
        }
    },
    
    async fetchCloud() {
        if (!this.user || !this.supabase) return;
        
        try {
            let { data, error } = await this.supabase
                .from('profiles')
                .select('data')
                .eq('id', this.user.id)
                .single();
            
            // Perfil não existe - cria novo
            if (error && error.code === 'PGRST116') { 
                console.log("[CLOUD] Criando novo perfil para usuário:", this.user.id);
                const { error: insertError } = await this.supabase
                    .from('profiles')
                    .insert([{ 
                        id: this.user.id, 
                        data: { config: this.settings } 
                    }]); 
                    
                if (insertError) {
                    console.error("[CLOUD] Erro ao criar perfil:", insertError);
                    this.notify('Erro ao criar perfil na nuvem.', 'error');
                    return;
                }
                data = { data: { config: this.settings } }; 
            } else if (error) {
                // Outro tipo de erro
                console.error("[CLOUD] Erro ao buscar dados:", error);
                this.notify('Erro ao buscar dados da nuvem.', 'error');
                return;
            }
            
            if (data && data.data) {
                const cloudData = data.data;
                const reservedKeys = ['config', 'hasSeenTip', 'trayDockMode'];
                
                // 1. Carrega Configs da Nuvem
                if(cloudData.config) { 
                    this.settings = { ...this.settings, ...cloudData.config }; 
                    this.applyTheme(this.settings.themeColor); 
                }
                
                if(cloudData.hasSeenTip !== undefined) {
                    this.hasSeenDiceTip = cloudData.hasSeenTip;
                }
                
                // 2. Processa Personagens
                let merged = {};
                
                Object.keys(cloudData).forEach(k => { 
                    if(!reservedKeys.includes(k) && cloudData[k]?.id) { 
                        // A. Sanitiza
                        let char = sanitizeChar(cloudData[k]); 

                        // B. Aplica Migração
                        char = migrateCharacter(char);
                        
                        // C. Garante timestamp para evitar deleção acidental
                        if (!char.lastAccess) {
                            char.lastAccess = Date.now();
                        }

                        merged[k] = char; 
                    } 
                });
                
                this.chars = merged; 
                this.updateAgentCount(); 
                this.saveLocal();
                
                console.log("[CLOUD] Dados sincronizados:", Object.keys(merged).length, "personagens");
            }
        } catch(e) {
            console.error("[CLOUD] Fetch Error:", e);
            this.notify('Erro de conexão com a nuvem.', 'error');
        }
    },
    
    async syncCloud(silent = false) {
        if (!this.user || this.isGuest || !this.supabase) return;
        
        // Evita múltiplas sincronizações simultâneas
        if (this.isSyncing) {
            console.log("[CLOUD] Sincronização já em andamento, ignorando...");
            return;
        }
        
        this.isSyncing = true; 
        if(!silent) this.notify('Sincronizando...', 'info');
        
        try {
            // Prepara payload com todos os dados necessários
            const payload = { 
                ...this.chars, 
                config: this.settings, 
                hasSeenTip: this.hasSeenDiceTip 
            };
            
            // Verifica tamanho do payload (Supabase tem limite de ~1MB por campo JSONB)
            const payloadSize = JSON.stringify(payload).length;
            if (payloadSize > 900000) { // ~900KB de segurança
                console.warn("[CLOUD] Payload muito grande:", payloadSize, "bytes");
                this.notify('Dados muito grandes. Remova personagens antigos.', 'warn');
            }
            
            const { error } = await this.supabase
                .from('profiles')
                .upsert({ 
                    id: this.user.id, 
                    data: payload,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'id'
                });
            
            if (error) {
                console.error("[CLOUD] Sync Error:", error);
                throw error;
            }
            
            this.unsavedChanges = false; 
            this.saveStatus = 'success'; 
            this.lastManualSave = new Date();
            
            console.log("[CLOUD] Sincronização bem-sucedida");
            
            if(!silent) { 
                this.notify('Salvo na nuvem!', 'success'); 
                playSFX('save'); 
            } 
        } catch (e) { 
            console.error("[CLOUD] Sync Exception:", e);
            this.saveStatus = 'error'; 
            
            // Mensagens de erro mais específicas
            let errorMsg = 'Erro ao salvar na nuvem.';
            if (e.message?.includes('JWT')) {
                errorMsg = 'Sessão expirada. Faça login novamente.';
            } else if (e.message?.includes('network')) {
                errorMsg = 'Sem conexão com a internet.';
            }
            
            if(!silent) this.notify(errorMsg, 'error'); 
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