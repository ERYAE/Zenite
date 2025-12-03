/**
 * ZENITE OS - Módulo de Sincronização Cloud
 * Gerencia salvamento local e sincronização com Supabase
 */

import { sanitizeChar, migrateCharacter } from './utils.js';
import { playSFX } from './audio.js';

export const cloudLogic = {
    /**
     * Carrega dados do LocalStorage
     * @param {string} key - Chave do localStorage
     */
    loadLocal(key) {
        const local = localStorage.getItem(key);
        if (!local) return;
        
        try {
            const parsed = JSON.parse(local);
            
            // Carrega configurações
            if (parsed.config) {
                this.settings = { ...this.settings, ...parsed.config };
            }
            if (parsed.trayPos) {
                this.trayPosition = parsed.trayPos;
            }
            if (parsed.hasSeenTip !== undefined) {
                this.hasSeenDiceTip = parsed.hasSeenTip;
            }
            
            // SISTEMA DE GARBAGE COLLECTION (180 DIAS)
            const INACTIVITY_LIMIT = 180 * 24 * 60 * 60 * 1000;
            const now = Date.now();
            let deletedCount = 0;
            
            const validChars = {};
            Object.keys(parsed).forEach(k => {
                if (!['config', 'trayPos', 'hasSeenTip'].includes(k) && parsed[k]?.id) {
                    let char = sanitizeChar(parsed[k]);
                    
                    // Aplica migração
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
                this.notify(`${deletedCount} fichas antigas removidas por inatividade.`, 'info');
            }

            this.chars = validChars;
            this.updateAgentCount();
            
        } catch (e) {
            console.error("Erro ao carregar dados locais:", e);
        }
    },
    
    /**
     * Salva dados no LocalStorage
     * CRÍTICO: Sempre sincroniza o personagem atual antes de salvar
     */
    saveLocal() {
        // CORREÇÃO: Garante que o personagem atual está no objeto chars
        if (this.char && this.activeCharId) {
            this.chars[this.activeCharId] = JSON.parse(JSON.stringify(this.char));
        }
        
        const key = this.isGuest ? 'zenite_guest_db' : 'zenite_cached_db';
        const payload = {
            ...this.chars,
            config: this.settings,
            trayPos: this.trayPosition,
            hasSeenTip: this.hasSeenDiceTip
        };
        
        try {
            localStorage.setItem(key, JSON.stringify(payload));
        } catch (e) {
            console.error("Erro ao salvar localmente:", e);
            // Possível quota excedida - tenta limpar dados antigos
            if (e.name === 'QuotaExceededError') {
                this.notify('Armazenamento local cheio. Limpando cache antigo...', 'warn');
                localStorage.removeItem('zenite_history');
                localStorage.removeItem('zenite_dice_log');
                // Tenta novamente
                try {
                    localStorage.setItem(key, JSON.stringify(payload));
                } catch (e2) {
                    this.notify('Erro crítico de armazenamento.', 'error');
                }
            }
        }
    },
    
    /**
     * Busca dados da nuvem (Supabase)
     */
    async fetchCloud() {
        if (!this.user || !this.supabase) return;
        
        try {
            let { data, error } = await this.supabase
                .from('profiles')
                .select('data')
                .eq('id', this.user.id)
                .single();
            
            // Se não existe perfil, cria um novo
            if (error && error.code === 'PGRST116') {
                console.log('[CLOUD] Criando novo perfil para usuário');
                const { error: insertError } = await this.supabase
                    .from('profiles')
                    .insert([{
                        id: this.user.id,
                        data: { config: this.settings }
                    }]);
                
                if (insertError) {
                    console.error('[CLOUD] Erro ao criar perfil:', insertError);
                    throw insertError;
                }
                
                data = { data: { config: this.settings } };
            } else if (error) {
                throw error;
            }
            
            if (data && data.data) {
                const cloudData = data.data;
                
                // 1. Carrega Configs da Nuvem
                if (cloudData.config) {
                    this.settings = { ...this.settings, ...cloudData.config };
                    this.applyTheme(this.settings.themeColor);
                }
                
                if (cloudData.hasSeenTip !== undefined) {
                    this.hasSeenDiceTip = cloudData.hasSeenTip;
                }
                
                // 2. Processa Personagens
                let merged = {};
                
                Object.keys(cloudData).forEach(k => {
                    if (!['config', 'hasSeenTip'].includes(k) && cloudData[k]?.id) {
                        // A. Sanitiza
                        let char = sanitizeChar(cloudData[k]);
                        
                        // B. Aplica Migração
                        char = migrateCharacter(char);
                        
                        // C. Garante timestamp
                        if (!char.lastAccess) {
                            char.lastAccess = Date.now();
                        }
                        
                        merged[k] = char;
                    }
                });
                
                this.chars = merged;
                this.updateAgentCount();
                this.saveLocal();
                
                console.log(`[CLOUD] Carregados ${Object.keys(merged).length} personagens da nuvem`);
            }
            
        } catch (e) {
            console.error("[CLOUD] Erro ao buscar dados:", e);
            this.notify('Erro ao sincronizar com a nuvem.', 'error');
        }
    },
    
    /**
     * Sincroniza dados com a nuvem (Supabase)
     * @param {boolean} silent - Se true, não mostra notificações
     */
    async syncCloud(silent = false) {
        if (!this.user || this.isGuest || !this.supabase) {
            console.log('[CLOUD] Sync ignorado: usuário guest ou não autenticado');
            return false;
        }
        
        // Evita sincronizações simultâneas
        if (this.isSyncing) {
            console.log('[CLOUD] Sync já em andamento, ignorando...');
            return false;
        }
        
        this.isSyncing = true;
        if (!silent) this.notify('Sincronizando...', 'info');
        
        try {
            // CORREÇÃO CRÍTICA: Garante que o personagem atual está atualizado
            if (this.char && this.activeCharId) {
                this.char.lastAccess = Date.now();
                this.chars[this.activeCharId] = JSON.parse(JSON.stringify(this.char));
            }
            
            // Monta payload limpo (sem dados undefined ou circulares)
            const cleanChars = {};
            Object.keys(this.chars).forEach(k => {
                if (this.chars[k]?.id) {
                    // Garante que cada personagem tem lastAccess
                    const charCopy = JSON.parse(JSON.stringify(this.chars[k]));
                    if (!charCopy.lastAccess) {
                        charCopy.lastAccess = Date.now();
                    }
                    cleanChars[k] = charCopy;
                }
            });
            
            const payload = {
                ...cleanChars,
                config: this.settings,
                hasSeenTip: this.hasSeenDiceTip
            };
            
            console.log(`[CLOUD] Enviando ${Object.keys(cleanChars).length} personagens para nuvem`);
            console.log('[CLOUD] IDs dos personagens:', Object.keys(cleanChars));
            
            // Usa UPDATE ao invés de UPSERT para garantir que os dados são substituídos
            const { data, error } = await this.supabase
                .from('profiles')
                .update({ 
                    data: payload,
                    updated_at: new Date().toISOString()
                })
                .eq('id', this.user.id)
                .select();
            
            // Se não encontrou registro para atualizar, faz INSERT
            if (!data || data.length === 0) {
                console.log('[CLOUD] Perfil não existe, criando novo...');
                const { error: insertError } = await this.supabase
                    .from('profiles')
                    .insert({
                        id: this.user.id,
                        data: payload,
                        updated_at: new Date().toISOString()
                    });
                
                if (insertError) {
                    console.error('[CLOUD] Erro no insert:', insertError);
                    throw insertError;
                }
            } else if (error) {
                console.error('[CLOUD] Erro no update:', error);
                throw error;
            }
            
            this.unsavedChanges = false;
            this.saveStatus = 'success';
            this.lastManualSave = new Date();
            
            if (!silent) {
                this.notify('Salvo na nuvem!', 'success');
                playSFX('save');
            }
            
            console.log('[CLOUD] Sincronização concluída com sucesso');
            return true;
            
        } catch (e) {
            console.error("[CLOUD] Erro na sincronização:", e);
            this.saveStatus = 'error';
            
            if (!silent) {
                this.notify('Erro ao salvar na nuvem. Seus dados estão salvos localmente.', 'error');
            }
            return false;
        } finally {
            this.isSyncing = false;
        }
    },
    
    /**
     * Força sincronização completa (download + upload)
     */
    async forceSyncCloud() {
        if (!this.user || this.isGuest || !this.supabase) return;
        
        this.notify('Forçando sincronização completa...', 'info');
        this.isSyncing = true;
        
        try {
            // Baixa dados da nuvem
            await this.fetchCloud();
            
            // Sobe dados locais
            await this.syncCloud(true);
            
            this.notify('Sincronização completa!', 'success');
            playSFX('success');
        } catch (e) {
            console.error("[CLOUD] Erro na sincronização forçada:", e);
            this.notify('Erro na sincronização.', 'error');
        } finally {
            this.isSyncing = false;
        }
    },
    
    /**
     * Atualiza contador de agentes
     */
    updateAgentCount() {
        this.agentCount = Object.keys(this.chars).length;
    },
    
    /**
     * Solicita confirmação de logout
     */
    askLogout() {
        this.askConfirm(
            'ENCERRAR SESSÃO?',
            'Dados pendentes serão salvos antes de sair.',
            'warn',
            () => this.logout()
        );
    },
    
    /**
     * Executa logout
     */
    async logout() {
        this.systemLoading = true;
        
        // Salva antes de sair
        if (this.unsavedChanges && !this.isGuest) {
            try {
                await this.syncCloud(true);
            } catch (e) {
                console.warn("Erro ao salvar no logout", e);
            }
        }
        
        localStorage.removeItem('zenite_cached_db');
        localStorage.removeItem('zenite_is_guest');
        
        if (this.supabase) {
            try {
                await this.supabase.auth.signOut();
            } catch (e) {
                console.error("Erro no Supabase SignOut", e);
            }
        }
        
        window.location.reload();
    },
    
    /**
     * Solicita mudança para modo online
     */
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
    
    /**
     * Entra no modo guest (offline)
     */
    enterGuest() {
        this.isGuest = true;
        localStorage.setItem('zenite_is_guest', 'true');
        this.loadLocal('zenite_guest_db');
    },
    
    /**
     * Executa autenticação social (Google/Discord)
     * @param {string} provider - 'google' ou 'discord'
     */
    doSocialAuth(provider) {
        if (!this.supabase) {
            return this.notify("Erro de conexão com servidor.", "error");
        }
        
        this.authLoading = true;
        this.authMsg = "Conectando...";
        
        this.supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: window.location.origin
            }
        }).then(({ error }) => {
            if (error) {
                this.notify(error.message, 'error');
                this.authLoading = false;
            }
        });
    }
};
