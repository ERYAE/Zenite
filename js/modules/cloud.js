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
        
        // OTIMIZAÇÃO: Se estiver apenas mudando configurações, não precisa stringificar chars se não mudaram
        // Mas como a arquitetura atual junta tudo, vamos adicionar um debounce no watcher do Alpine no index.html
        // Em vez disso, vamos garantir que erros de cota não quebrem o app
        
        const payload = { 
            ...this.chars, 
            config: this.settings, 
            trayPos: this.trayPosition, 
            trayDockMode: this.trayDockMode,
            hasSeenTip: this.hasSeenDiceTip 
        };
        
        // Performance: JSON.stringify é bloqueante. 
        // Em apps grandes, considere usar indexedDB, mas para localStorage:
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
        console.log('[CLOUD] Iniciando logout...');
        this.systemLoading = true; 
        
        try {
            // Salva antes de sair (com timeout para não travar)
            if(!this.isGuest && this.supabase) { 
                try { 
                    await Promise.race([
                        this.syncCloud(true),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
                    ]);
                    console.log('[CLOUD] Dados salvos antes do logout');
                } catch(e) { 
                    console.warn("[CLOUD] Erro ao salvar no logout (continuando mesmo assim):", e); 
                } 
            } 
            
            // Salva localmente sempre
            this.saveLocal(); 
            
            // Desconecta realtime se ativo
            if (this.disconnectRealtime) {
                try {
                    await this.disconnectRealtime();
                } catch(e) {
                    console.warn('[CLOUD] Erro ao desconectar realtime:', e);
                }
            }
            
            // SignOut do Supabase
            if(this.supabase) { 
                try { 
                    await this.supabase.auth.signOut(); 
                    console.log('[CLOUD] Deslogado do Supabase');
                } catch(e) { 
                    console.error("[CLOUD] Erro no Supabase SignOut (limpando mesmo assim):", e); 
                }
            }
        } finally {
            // SEMPRE limpa estado, mesmo se houver erro
            console.log('[CLOUD] Limpando estado...');
            
            // Limpa storage
            localStorage.removeItem('zenite_is_guest');
            
            // Limpa estado do app
            this.user = null; 
            this.isGuest = false;
            this.activeCampaign = null;
            this.campaignMembers = [];
            this.realtimeChannel = null;
            
            // Redireciona para login
            this.currentView = 'login';
            window.history.replaceState({ route: 'login' }, '', '/');
            document.title = 'ZENITE OS // Login';
            
            this.systemLoading = false;
            this.notify('Sessão encerrada.', 'success');
            
            console.log('[CLOUD] Logout completo');
        }
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
        
        // Redireciona para dashboard
        this.currentView = 'dashboard';
        window.history.replaceState({ route: 'dashboard' }, '', '/');
    },
    
    // ═══════════════════════════════════════════════════════════════════════
    // LOGIN COM EMAIL/SENHA
    // ═══════════════════════════════════════════════════════════════════════
    
    /**
     * Registra novo usuário com email e senha
     */
    async signUpWithEmail(email = null, password = null, username = null) {
        // Usa valores do estado se não forem passados
        email = email || this.authEmail;
        password = password || this.authPassword;
        username = username || this.authUsername;
        const passwordConfirm = this.authPasswordConfirm;
        
        if (!this.supabase) {
            return this.notify("Erro de conexão com servidor.", "error");
        }
        
        if (!email || !password) {
            return this.notify("Email e senha são obrigatórios.", "error");
        }
        
        if (password.length < 6) {
            return this.notify("Senha deve ter pelo menos 6 caracteres.", "error");
        }
        
        if (password !== passwordConfirm) {
            return this.notify("As senhas não coincidem.", "error");
        }
        
        if (!username || username.length < 2) {
            return this.notify("Username deve ter pelo menos 2 caracteres.", "error");
        }
        
        // Verifica se email já está em uso com OAuth
        try {
            const { data: providerCheck } = await this.supabase
                .rpc('check_email_oauth_provider', { email_to_check: email });
            
            if (providerCheck?.exists) {
                const provider = providerCheck.provider;
                if (provider === 'google') {
                    this.authMsg = "Este email já está cadastrado com Google. Use 'Continuar com Google'.";
                    this.authMsgType = 'error';
                    this.notify(this.authMsg, "error");
                    return;
                } else if (provider === 'discord') {
                    this.authMsg = "Este email já está cadastrado com Discord. Use 'Continuar com Discord'.";
                    this.authMsgType = 'error';
                    this.notify(this.authMsg, "error");
                    return;
                }
            }
        } catch (e) {
            console.warn('[CLOUD] Não foi possível verificar OAuth provider:', e);
        }
        
        this.authLoading = true;
        this.authMsg = "Criando conta...";
        this.authMsgType = 'info';
        
        try {
            const { data, error } = await this.supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        username: username || email.split('@')[0]
                    }
                }
            });
            
            if (error) throw error;
            
            if (data.user && !data.session) {
                // Email de confirmação enviado
                this.authMsg = "Verifique seu email para confirmar a conta!";
                this.authMsgType = 'success';
                this.notify("Email de confirmação enviado!", "success");
            } else if (data.session) {
                // Login automático (se confirmação de email estiver desabilitada)
                this.user = data.user;
                this.isGuest = false;
                localStorage.removeItem('zenite_is_guest');
                
                this.authMsg = "Conta criada com sucesso!";
                this.authMsgType = 'success';
                this.notify("Bem-vindo ao ZENITE!", "success");
                
                // Carrega dados e redireciona
                await this.fetchCloud();
                this.checkOnboarding();
                this.checkUsername();
                this.currentView = 'dashboard';
                window.history.replaceState({ route: 'dashboard' }, '', '/');
            }
            
        } catch (e) {
            console.error('[CLOUD] Erro no registro:', e);
            this.authMsg = this.translateAuthError(e.message);
            this.authMsgType = 'error';
            this.notify(this.authMsg, "error");
        } finally {
            this.authLoading = false;
        }
    },
    
    /**
     * Login com email e senha
     */
    async signInWithEmail(email = null, password = null) {
        // Usa valores do estado se não forem passados
        email = email || this.authEmail;
        password = password || this.authPassword;
        
        if (!this.supabase) {
            return this.notify("Erro de conexão com servidor.", "error");
        }
        
        if (!email || !password) {
            return this.notify("Email e senha são obrigatórios.", "error");
        }
        
        // Verifica se email usa OAuth
        try {
            const { data: providerCheck } = await this.supabase
                .rpc('check_email_oauth_provider', { email_to_check: email });
            
            if (providerCheck?.exists && !providerCheck?.can_login_with_password) {
                const provider = providerCheck.provider;
                if (provider === 'google') {
                    this.authMsg = "Este email usa login com Google.";
                    this.authMsgType = 'error';
                    this.notify("Use 'Continuar com Google' para entrar.", "error");
                    return;
                } else if (provider === 'discord') {
                    this.authMsg = "Este email usa login com Discord.";
                    this.authMsgType = 'error';
                    this.notify("Use 'Continuar com Discord' para entrar.", "error");
                    return;
                }
            }
        } catch (e) {
            console.warn('[CLOUD] Não foi possível verificar OAuth provider:', e);
        }
        
        this.authLoading = true;
        this.authMsg = "Entrando...";
        this.authMsgType = 'info';
        
        try {
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) throw error;
            
            // Atualiza o usuário imediatamente
            this.user = data.user;
            this.isGuest = false;
            localStorage.removeItem('zenite_is_guest');
            
            this.authMsg = "Login realizado!";
            this.authMsgType = 'success';
            this.notify("Bem-vindo de volta!", "success");
            
            // Carrega dados do cloud
            await this.fetchCloud();
            this.checkOnboarding();
            this.checkUsername();
            
            // Redireciona para dashboard
            this.currentView = 'dashboard';
            window.history.replaceState({ route: 'dashboard' }, '', '/');
            
        } catch (e) {
            console.error('[CLOUD] Erro no login:', e);
            this.authMsg = this.translateAuthError(e.message);
            this.authMsgType = 'error';
            this.notify(this.authMsg, "error");
        } finally {
            this.authLoading = false;
        }
    },
    
    /**
     * Solicita recuperação de senha
     */
    async resetPassword(email = null) {
        // Usa valor do estado se não for passado
        email = email || this.authEmail;
        
        if (!this.supabase) {
            return this.notify("Erro de conexão com servidor.", "error");
        }
        
        if (!email) {
            return this.notify("Digite seu email.", "error");
        }
        
        // Verifica se email usa OAuth
        try {
            const { data: providerCheck } = await this.supabase
                .rpc('check_email_oauth_provider', { email_to_check: email });
            
            if (providerCheck?.exists && !providerCheck?.can_login_with_password) {
                const provider = providerCheck.provider;
                if (provider === 'google') {
                    this.authMsg = "Este email usa login com Google. Não é possível recuperar senha.";
                    this.authMsgType = 'error';
                    this.notify(this.authMsg, "error");
                    return;
                } else if (provider === 'discord') {
                    this.authMsg = "Este email usa login com Discord. Não é possível recuperar senha.";
                    this.authMsgType = 'error';
                    this.notify(this.authMsg, "error");
                    return;
                }
            }
        } catch (e) {
            console.warn('[CLOUD] Não foi possível verificar OAuth provider:', e);
        }
        
        this.authLoading = true;
        this.authMsg = "Enviando email...";
        
        try {
            const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`
            });
            
            if (error) throw error;
            
            this.authMsg = "Email de recuperação enviado!";
            this.authMsgType = 'success';
            this.notify("Verifique sua caixa de entrada.", "success");
            
        } catch (e) {
            console.error('[CLOUD] Erro ao recuperar senha:', e);
            this.authMsg = this.translateAuthError(e.message);
            this.authMsgType = 'error';
        } finally {
            this.authLoading = false;
        }
    },
    
    // NOTA: checkUsernameAvailable foi movido para social.js
    
    /**
     * Traduz mensagens de erro do Supabase Auth
     */
    translateAuthError(message) {
        const translations = {
            'Invalid login credentials': 'Email ou senha incorretos',
            'Email not confirmed': 'Email não confirmado. Verifique sua caixa de entrada.',
            'User already registered': 'Este email já está cadastrado',
            'Password should be at least 6 characters': 'Senha deve ter pelo menos 6 caracteres',
            'Unable to validate email address: invalid format': 'Formato de email inválido',
            'Email rate limit exceeded': 'Muitas tentativas. Aguarde alguns minutos.',
            'For security purposes, you can only request this once every 60 seconds': 'Aguarde 60 segundos para tentar novamente'
        };
        return translations[message] || message;
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