/**
 * Copyright 2025 Zenite - Todos os direitos reservados
 * Projeto desenvolvido com assistncia de IA
 */

// js/modules/cloud.js
import { sanitizeChar, migrateCharacter } from './utils.js';
import { supabase } from './config.js';
import { cloudLogger } from './logger.js';
import { compressData, decompressData, isCompressed, shouldSplitData } from './compression.js';

const normalizeUsername = (rawUsername = '') => {
    return rawUsername
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 20);
};

const isValidUsername = (username) => {
    if (!username) return false;
    if (username.length < 2 || username.length > 20) return false;
    return /^[a-z0-9_]+$/.test(username);
};

const friendlySignupError = (error) => {
    if (!error) return 'Erro ao criar conta. Tente novamente.';
    const message = error.message || '';
    if (message.includes('Database error')) {
        return 'Erro ao criar perfil. Verifique username e tente novamente.';
    }
    if (message.includes('duplicate key') || message.includes('profiles_username_lower_idx')) {
        return 'Username j est em uso. Escolha outro.';
    }
    if (message.toLowerCase().includes('password')) {
        return 'Senha invlida. Use pelo menos 6 caracteres.';
    }
    if (message.includes('already been registered') || message.includes('already registered')) {
        return 'Este email j est registrado. Tente fazer login.';
    }
    if (message.includes('Invalid login credentials')) {
        return 'Email ou senha incorretos.';
    }
    if (message.includes('Email not confirmed')) {
        return 'Email no confirmado. Verifique sua caixa de entrada.';
    }
    return message;
};

/**
 * Gera uma senha forte e segura
 * @returns {string} Senha com 16 caracteres incluindo maiúsculas, minúsculas, números e símbolos
 */
const generateStrongPassword = () => {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%&*-_+=?';
    const allChars = lowercase + uppercase + numbers + symbols;
    
    // Garante pelo menos um de cada tipo
    let password = '';
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Preenche o resto com caracteres aleatórios
    for (let i = 4; i < 16; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Embaralha a senha para no ter padrão previsível
    return password.split('').sort(() => Math.random() - 0.5).join('');
};

// Expõe globalmente para uso no HTML inline
window.generateStrongPassword = generateStrongPassword;

export const cloudLogic = {
    loadLocal(key) {
        const local = localStorage.getItem(key);
        if (!local) return;

        try {
            const parsed = JSON.parse(local);

            // Carrega configurações
            if (parsed.config) this.settings = { ...this.settings, ...parsed.config };
            if (parsed.trayPos) this.trayPosition = parsed.trayPos;
            if (parsed.hasSeenTip !== undefined) this.hasSeenDiceTip = parsed.hasSeenTip;
            if (parsed.trayDockMode) this.trayDockMode = parsed.trayDockMode;

            // SISTEMA DE GARBAGE COLLECTION (180 DIAS)
            const INACTIVITY_LIMIT = 180 * 24 * 60 * 60 * 1000;
            const now = Date.now();
            let deletedCount = 0;

            const validChars = {};
            const reservedKeys = ['config', 'trayPos', 'hasSeenTip', 'trayDockMode'];

            Object.keys(parsed).forEach((k) => {
                if (!reservedKeys.includes(k) && parsed[k]?.id) {
                    let char = sanitizeChar(parsed[k]);
                    char = migrateCharacter(char);

                    // Define lastAccess se não existir
                    const lastAccess = char.lastAccess || now;

                    if (now - lastAccess < INACTIVITY_LIMIT) {
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
        } catch (e) {
            cloudLogger.error('Local Load Error:', e);
            this.notify('Erro ao carregar dados locais.', 'error');
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
        } catch (e) {
            cloudLogger.error('Save Local Error:', e);
            if (e.name === 'QuotaExceededError') {
                this.notify('Armazenamento local cheio. Limpe o cache.', 'error');
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
                cloudLogger.info('Criando novo perfil para usuário:', this.user.id);
                const { error: insertError } = await this.supabase.from('profiles').insert([
                    {
                        id: this.user.id,
                        data: { config: this.settings }
                    }
                ]);

                if (insertError) {
                    cloudLogger.error('Erro ao criar perfil:', insertError);
                    this.notify('Erro ao criar perfil na nuvem.', 'error');
                    return;
                }
                data = { data: { config: this.settings } };
            } else if (error) {
                cloudLogger.error('Erro ao buscar dados:', error);
                this.notify('Erro ao buscar dados da nuvem.', 'error');
                return;
            }

            if (data && data.data) {
                const cloudData = data.data;
                const reservedKeys = ['config', 'hasSeenTip', 'trayDockMode'];

                // Verifica se dados estão comprimidos
                const decompressedData = isCompressed(cloudData) ? 
                    decompressData(cloudData) : cloudData;

                if (decompressedData.config) {
                    this.settings = { ...this.settings, ...decompressedData.config };
                    this.applyTheme(this.settings.themeColor);
                }

                if (decompressedData.hasSeenTip !== undefined) {
                    this.hasSeenDiceTip = decompressedData.hasSeenTip;
                }

                let merged = {};

                Object.keys(decompressedData).forEach((k) => {
                    if (!reservedKeys.includes(k) && decompressedData[k]?.id) {
                        let char = sanitizeChar(decompressedData[k]);
                        char = migrateCharacter(char);

                        // Define lastAccess se não existir
                        const lastAccess = char.lastAccess || Date.now();

                        if (!lastAccess) {
                            char.lastAccess = Date.now();
                        }
                        merged[k] = char;
                    }
                });

                this.chars = merged;
                this.updateAgentCount();
                this.saveLocal();

                cloudLogger.success('Dados sincronizados:', Object.keys(merged).length, 'personagens');
            }
        } catch (e) {
            cloudLogger.error('Fetch Error:', e);
            this.notify('Erro de conexão com a nuvem.', 'error');
        }
    },

    // Timeout para resetar isSyncing caso trave
    _syncTimeout: null,
    _syncRetryCount: 0,
    _maxSyncRetries: 3,
    
    async syncCloud(silent = false, retryAttempt = 0) {
        if (!this.user || this.isGuest || !this.supabase) return;
        
        // Timeout de segurança: reseta isSyncing após 30 segundos
        if (this.isSyncing) {
            const syncStartTime = this._syncStartTime || 0;
            const elapsed = Date.now() - syncStartTime;
            
            if (elapsed > 30000) {
                cloudLogger.warn('Sync travada detectada, resetando...');
                this.isSyncing = false;
            } else {
                cloudLogger.debug('Sincronização já em andamento, ignorando...');
                return;
            }
        }

        this.isSyncing = true;
        this._syncStartTime = Date.now();
        if (!silent) this.notify('Sincronizando...', 'info');

        try {
            // Prepara payload original
            const originalPayload = {
                ...this.chars,
                config: this.settings,
                hasSeenDiceTip: this.hasSeenDiceTip
            };

            // Verifica tamanho e comprime se necessário
            const sizeCheck = shouldSplitData(originalPayload);
            
            if (sizeCheck.shouldSplit) {
                cloudLogger.warn(`Payload muito grande: ${sizeCheck.sizeMB}MB`);
                
                // Tenta compressão primeiro
                const compressedPayload = compressData(originalPayload);
                const compressedSizeCheck = shouldSplitData(compressedPayload);
                
                if (compressedSizeCheck.shouldSplit) {
                    // Ainda muito grande, sugere limpeza
                    this.notify(
                        `Dados muito grandes (${sizeCheck.sizeMB}MB). Considere remover personagens antigos.`,
                        'warn'
                    );
                    
                    // Continua com payload comprimido mesmo assim
                    const payload = compressedPayload;
                    
                    const { error } = await this.supabase
                        .from('profiles')
                        .upsert(
                            {
                                id: this.user.id,
                                data: payload,
                                updated_at: new Date().toISOString()
                            },
                            {
                                onConflict: 'id'
                            }
                        );
                    
                    if (error) throw error;
                    
                } else {
                    // Compressão funcionou!
                    cloudLogger.info(`Payload comprimido: ${sizeCheck.sizeMB}MB → ${compressedSizeCheck.sizeMB}MB`);
                    
                    const payload = compressedPayload;
                    
                    const { error } = await this.supabase
                        .from('profiles')
                        .upsert(
                            {
                                id: this.user.id,
                                data: payload,
                                updated_at: new Date().toISOString()
                            },
                            {
                                onConflict: 'id'
                            }
                        );
                    
                    if (error) throw error;
                }
            } else {
                // Payload normal, sem compressão
                const payload = originalPayload;
                
                const { error } = await this.supabase
                    .from('profiles')
                    .upsert(
                        {
                            id: this.user.id,
                            data: payload,
                            updated_at: new Date().toISOString()
                        },
                        {
                            onConflict: 'id'
                        }
                    );
                
                if (error) throw error;
            }

            this.unsavedChanges = false;
            this.saveStatus = 'success';
            this.lastManualSave = new Date();
            this._syncRetryCount = 0; // Reseta contador de retry em sucesso

            console.log('[CLOUD] Sincronização bem-sucedida');

            if (!silent) {
                this.notify('Salvo na nuvem!', 'success');
                playSFX('save');
            }
        } catch (e) {
            console.error('[CLOUD] Sync Exception:', e);
            this.saveStatus = 'error';

            // Retry automático para erros de rede (até 3 tentativas)
            const isNetworkError = e.message?.includes('network') || 
                                   e.message?.includes('fetch') ||
                                   e.message?.includes('Failed to fetch') ||
                                   e.name === 'TypeError';
            
            if (isNetworkError && retryAttempt < this._maxSyncRetries) {
                const delay = Math.pow(2, retryAttempt) * 1000; // Backoff exponencial: 1s, 2s, 4s
                console.log(`[CLOUD] Retry ${retryAttempt + 1}/${this._maxSyncRetries} em ${delay}ms...`);
                
                this.isSyncing = false;
                setTimeout(() => {
                    this.syncCloud(silent, retryAttempt + 1);
                }, delay);
                return;
            }

            let errorMsg = 'Erro ao salvar na nuvem.';
            if (e.message?.includes('JWT')) {
                errorMsg = 'Sessão expirada. Faça login novamente.';
            } else if (isNetworkError) {
                errorMsg = 'Sem conexão com a internet. Tentativas esgotadas.';
            }

            if (!silent) this.notify(errorMsg, 'error');
        } finally {
            this.isSyncing = false;
            this._syncStartTime = null;
        }
    },

    async forceSyncCloud() {
        if (!this.user || this.isGuest || !this.supabase) return;

        this.notify('Forçando sincronização...', 'info');
        this.isSyncing = true;

        try {
            await this.fetchCloud();
            await this.syncCloud(false);
            this.notify('Sincronização completa!', 'success');
        } catch (e) {
            console.error('Force Sync Error:', e);
            this.notify('Erro na sincronização forçada.', 'error');
        } finally {
            this.isSyncing = false;
        }
    },

    updateAgentCount() {
        this.agentCount = Object.keys(this.chars).length;
    },

    askLogout() {
        this.askConfirm('ENCERRAR SESSÃO?', 'Dados pendentes serão salvos antes de sair.', 'warn', () =>
            this.logout()
        );
    },

    async logout() {
        console.log('[CLOUD] Iniciando logout...');
        this.systemLoading = true;

        try {
            if (!this.isGuest && this.supabase) {
                try {
                    await Promise.race([
                        this.syncCloud(true),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
                    ]);
                    console.log('[CLOUD] Dados salvos antes do logout');
                } catch (e) {
                    console.warn('[CLOUD] Erro ao salvar no logout (continuando mesmo assim):', e);
                }
            }

            this.saveLocal();

            if (this.disconnectRealtime) {
                try {
                    await this.disconnectRealtime();
                } catch (e) {
                    console.warn('[CLOUD] Erro ao desconectar realtime:', e);
                }
            }
            
            // Cleanup de intervals para evitar memory leaks
            this._cleanupIntervals();

            // Cleanup de event listeners globais registrados em app.js
            if (typeof this._cleanupListeners === 'function') {
                this._cleanupListeners();
            }

            if (this.supabase) {
                try {
                    await this.supabase.auth.signOut();
                    console.log('[CLOUD] Deslogado do Supabase');
                } catch (e) {
                    console.error('[CLOUD] Erro no Supabase SignOut (limpando mesmo assim):', e);
                }
            }
        } finally {
            console.log('[CLOUD] Limpando estado...');
            localStorage.removeItem('zenite_is_guest');

            this.user = null;
            this.isGuest = false;
            this.activeCampaign = null;
            this.campaignMembers = [];
            this.realtimeChannel = null;

            this.currentView = 'login';
            window.location.hash = '#/login';
            document.title = 'ZENITE OS // Login';

            this.systemLoading = false;
            this.notify('Sessão encerrada.', 'success');

            console.log('[CLOUD] Logout completo');
        }
    },

    /**
     * Limpa todos os intervals para evitar memory leaks
     * Chamado no logout e antes de recarregar a página
     */
    _cleanupIntervals() {
        console.log('[CLOUD] Limpando intervals...');
        
        // Auto-save timeout (definido em app.js - agora usa setTimeout recursivo)
        if (this._autoSaveTimeout) {
            clearTimeout(this._autoSaveTimeout);
            this._autoSaveTimeout = null;
        }
        
        // Auto-save interval (legado - mantido para compatibilidade)
        if (this._autoSaveInterval) {
            clearInterval(this._autoSaveInterval);
            this._autoSaveInterval = null;
        }
        
        // Music progress timeout (definido em app.js - agora usa setTimeout recursivo)
        if (this._musicProgressTimeout) {
            clearTimeout(this._musicProgressTimeout);
            this._musicProgressTimeout = null;
        }
        
        // Music progress interval (legado - mantido para compatibilidade)
        if (this._musicProgressInterval) {
            clearInterval(this._musicProgressInterval);
            this._musicProgressInterval = null;
        }
        
        // Campaign auto-save timer (definido em netlink.js)
        if (this._campaignAutoSaveTimer) {
            clearInterval(this._campaignAutoSaveTimer);
            this._campaignAutoSaveTimer = null;
        }
        
        // Session timer (definido em netlink.js)
        if (this.sessionTimerInterval) {
            clearInterval(this.sessionTimerInterval);
            this.sessionTimerInterval = null;
        }
        
        // Sync timeout
        if (this._syncTimeout) {
            clearTimeout(this._syncTimeout);
            this._syncTimeout = null;
        }
        
        // Local save timeout
        if (this._localSaveTimeout) {
            clearTimeout(this._localSaveTimeout);
            this._localSaveTimeout = null;
        }
        
        console.log('[CLOUD] Intervals limpos');
    },

    askSwitchToOnline() {
        this.askConfirm('CONECTAR À NUVEM?', 'Seus dados locais serão sincronizados.', 'info', () => {
            this.isGuest = false;
            localStorage.removeItem('zenite_is_guest');
            window.location.reload();
        });
    },

    enterGuest() {
        this.isGuest = true;
        localStorage.setItem('zenite_is_guest', 'true');
        this.loadLocal('zenite_guest_db');

        this.currentView = 'dashboard';
        window.location.hash = '#/dashboard';
    },

    // ═══════════════════════════════════════════════════════════════════════
    // LOGIN COM EMAIL/SENHA
    // ═══════════════════════════════════════════════════════════════════════

    async signUpWithEmail(email = null, password = null, username = null) {
        email = email || this.authEmail;
        password = password || this.authPassword;
        username = username || this.authUsername;
        const passwordConfirm = this.authPasswordConfirm;

        if (!this.supabase) {
            return this.notify('Erro de conexão com servidor.', 'error');
        }

        if (!email || !password) {
            return this.notify('Email e senha são obrigatórios.', 'error');
        }

        if (password.length < 6) {
            return this.notify('Senha deve ter pelo menos 6 caracteres.', 'error');
        }

        if (password !== passwordConfirm) {
            return this.notify('As senhas não coincidem.', 'error');
        }

        // DEFENSIVE: Generate fallback username from email if not provided
        const fallbackBase = (email || '').split('@')[0] || 'user';
        const rawUsername = username && username.trim().length >= 2 ? username : fallbackBase;
        const normalizedUsername = normalizeUsername(rawUsername);
        
        // If normalization failed, generate a random username
        const finalUsername = isValidUsername(normalizedUsername) 
            ? normalizedUsername 
            : `user_${Date.now().toString(36)}`;

        // Check OAuth provider (non-blocking)
        try {
            const { data: providerCheck } = await this.supabase.rpc('check_email_oauth_provider', {
                email_to_check: email
            });

            if (providerCheck?.exists) {
                const provider = providerCheck.provider;
                if (provider === 'google') {
                    this.authMsg = "Este email já está cadastrado com Google. Use 'Continuar com Google'.";
                    this.authMsgType = 'error';
                    this.notify(this.authMsg, 'error');
                    return;
                } else if (provider === 'discord') {
                    this.authMsg = "Este email já está cadastrado com Discord. Use 'Continuar com Discord'.";
                    this.authMsgType = 'error';
                    this.notify(this.authMsg, 'error');
                    return;
                }
            }
        } catch (e) {
            console.warn('[CLOUD] Não foi possível verificar OAuth provider:', e);
        }

        // Check username availability (non-blocking - trigger will handle conflicts)
        let usernameToSend = finalUsername;
        try {
            const { data: availability } = await this.supabase.rpc('check_username_available', {
                username_to_check: finalUsername
            });
            if (availability === false) {
                // Username taken, append random suffix
                usernameToSend = `${finalUsername.slice(0, 14)}_${Date.now().toString(36)}`;
                console.warn('[CLOUD] Username taken, using:', usernameToSend);
            }
        } catch (e) {
            console.warn('[CLOUD] Não foi possível validar username (seguindo mesmo assim):', e);
        }

        this.authLoading = true;
        this.authMsg = 'Criando conta...';
        this.authMsgType = 'info';

        try {
            // IMPORTANT: Always send username in metadata for trigger
            const { data, error } = await this.supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        username: usernameToSend,
                        display_name: usernameToSend,
                        avatar_url: null,
                        bio: '',
                        is_public: false
                    }
                }
            });

            if (error) throw error;

            if (data.user && !data.session) {
                // Email confirmation required
                this.authMsg = 'Verifique seu email para confirmar a conta!';
                this.authMsgType = 'success';
                this.notify('Email de confirmação enviado!', 'success');
                playSFX('success');
            } else if (data.session) {
                // Auto-confirmed (dev mode or disabled confirmation)
                this.user = data.user;
                this.isGuest = false;
                this.recoverMode = false; // Garante que recoverMode está false
                localStorage.removeItem('zenite_is_guest');

                // Fallback: ensure profile exists (trigger should handle this, but be safe)
                try {
                    const { error: profileError } = await this.supabase
                        .from('profiles')
                        .upsert(
                            {
                                id: data.user.id,
                                username: usernameToSend,
                                display_name: usernameToSend,
                                data: { config: this.settings },
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            },
                            {
                                onConflict: 'id',
                                ignoreDuplicates: false
                            }
                        );

                    if (profileError) {
                        console.warn('[CLOUD] Erro ao criar perfil (trigger já criou):', profileError);
                    }
                } catch (profileErr) {
                    console.warn('[CLOUD] Erro ao criar perfil:', profileErr);
                }

                this.authMsg = 'Conta criada com sucesso!';
                this.authMsgType = 'success';
                this.notify('Bem-vindo ao ZENITE!', 'success');
                playSFX('success');
                
                // Limpa campos do formulário para próximo uso
                this.authEmail = '';
                this.authPassword = '';
                this.authPasswordConfirm = '';
                this.authUsername = '';
                this.usernameCheckResult = null;

                await this.fetchCloud();
                this.checkOnboarding?.();
                this.checkUsername?.();
                
                // Use router if available (replaceState para não poder voltar)
                if (window.zeniteRouter) {
                    window.zeniteRouter.navigate('dashboard', null, true);
                } else {
                    this.currentView = 'dashboard';
                    window.location.hash = '#/dashboard';
                }
            }
        } catch (e) {
            console.error('[CLOUD] Erro no registro:', e);
            const friendly = friendlySignupError(e);
            this.authMsg = friendly;
            this.authMsgType = 'error';
            this.notify(friendly, 'error');
            playSFX('error');
        } finally {
            this.authLoading = false;
        }
    },

    async signInWithEmail(email = null, password = null) {
        email = email || this.authEmail;
        password = password || this.authPassword;

        if (!this.supabase) {
            return this.notify('Erro de conexão com servidor.', 'error');
        }

        if (!email || !password) {
            return this.notify('Email e senha são obrigatórios.', 'error');
        }

        try {
            const { data: providerCheck } = await this.supabase.rpc('check_email_oauth_provider', {
                email_to_check: email
            });

            if (providerCheck?.exists && !providerCheck?.can_login_with_password) {
                const provider = providerCheck.provider;
                if (provider === 'google') {
                    this.authMsg = 'Este email usa login com Google.';
                    this.authMsgType = 'error';
                    this.notify("Use 'Continuar com Google' para entrar.", 'error');
                    return;
                } else if (provider === 'discord') {
                    this.authMsg = 'Este email usa login com Discord.';
                    this.authMsgType = 'error';
                    this.notify("Use 'Continuar com Discord' para entrar.", 'error');
                    return;
                }
            }
        } catch (e) {
            console.warn('[CLOUD] Não foi possível verificar OAuth provider:', e);
        }

        this.authLoading = true;
        this.authMsg = 'Entrando...';
        this.authMsgType = 'info';

        try {
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            this.user = data.user;
            this.isGuest = false;
            this.recoverMode = false; // Garante que recoverMode está false
            localStorage.removeItem('zenite_is_guest');

            this.authMsg = 'Login realizado!';
            this.authMsgType = 'success';
            this.notify('Bem-vindo de volta!', 'success');
            
            // Limpa campos do formulário
            this.authEmail = '';
            this.authPassword = '';
            this.authPasswordConfirm = '';
            this.authUsername = '';
            
            // FORÇA reatividade do Alpine.js para fechar o modal
            this.$nextTick?.(() => {
                // Dupla verificação para garantir que o modal feche
                if (this.user) {
                    console.log('[AUTH] Modal deve fechar agora - user:', this.user.id);
                }
            });

            await this.fetchCloud();
            this.checkOnboarding();
            this.checkUsername();

            // Navega para dashboard usando router (replaceState para não poder voltar)
            if (window.zeniteRouter) {
                window.zeniteRouter.navigate('dashboard', null, true);
            } else {
                this.currentView = 'dashboard';
                // Usa replaceState para impedir voltar para login
                window.history.replaceState({ route: 'dashboard' }, '', '#/dashboard');
            }
            
            // Modal de migração só aparece UMA VEZ por conta
            // IMPORTANTE: Aguarda o router processar antes de abrir o modal
            const migrationKey = `zenite_migration_seen_${this.user.id}`;
            if (!localStorage.getItem(migrationKey)) {
                setTimeout(() => { 
                    // Verifica se REALMENTE está no dashboard (não no login)
                    const isOnDashboard = this.currentView === 'dashboard' && window.location.hash.includes('dashboard');
                    if (isOnDashboard && this.user && !this.isGuest) {
                        this.migrationModalOpen = true;
                        localStorage.setItem(migrationKey, 'true');
                    }
                }, 2000); // Aumentado para 2s para garantir que o router processou
            }
        } catch (e) {
            console.error('[CLOUD] Erro no login:', e);
            this.authMsg = this.translateAuthError(e.message);
            this.authMsgType = 'error';
            this.notify(this.authMsg, 'error');
        } finally {
            this.authLoading = false;
        }
    },

    async resetPassword(email = null) {
        email = email || this.authEmail;

        if (!this.supabase) {
            return this.notify('Erro de conexão com servidor.', 'error');
        }

        if (!email) {
            return this.notify('Digite seu email.', 'error');
        }

        try {
            const { data: providerCheck } = await this.supabase.rpc('check_email_oauth_provider', {
                email_to_check: email
            });

            if (providerCheck?.exists && !providerCheck?.can_login_with_password) {
                const provider = providerCheck.provider;
                if (provider === 'google') {
                    this.authMsg = 'Este email usa login com Google. Não é possível recuperar senha.';
                    this.authMsgType = 'error';
                    this.notify(this.authMsg, 'error');
                    return;
                } else if (provider === 'discord') {
                    this.authMsg = 'Este email usa login com Discord. Não é possível recuperar senha.';
                    this.authMsgType = 'error';
                    this.notify(this.authMsg, 'error');
                    return;
                }
            }
        } catch (e) {
            console.warn('[CLOUD] Não foi possível verificar OAuth provider:', e);
        }

        this.authLoading = true;
        this.authMsg = 'Enviando email...';

        try {
            const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/#/recover`
            });

            if (error) throw error;

            this.authMsg = 'Email de recuperação enviado!';
            this.authMsgType = 'success';
            this.notify('Verifique sua caixa de entrada.', 'success');
        } catch (e) {
            console.error('[CLOUD] Erro ao recuperar senha:', e);
            this.authMsg = this.translateAuthError(e.message);
            this.authMsgType = 'error';
        } finally {
            this.authLoading = false;
        }
    },

    translateAuthError(message) {
        const translations = {
            'Invalid login credentials': 'Email ou senha incorretos',
            'Email not confirmed': 'Email não confirmado. Verifique sua caixa de entrada.',
            'User already registered': 'Este email já está cadastrado',
            'Password should be at least 6 characters': 'Senha deve ter pelo menos 6 caracteres',
            'Unable to validate email address: invalid format': 'Formato de email inválido',
            'Email rate limit exceeded': 'Muitas tentativas. Aguarde alguns minutos.',
            'For security purposes, you can only request this once every 60 seconds':
                'Aguarde 60 segundos para tentar novamente',
            'Signup requires a valid password': 'Senha inválida. Use pelo menos 6 caracteres.',
            'A user with this email address has already been registered': 'Este email já está cadastrado',
            'Invalid email or password': 'Email ou senha incorretos',
            'Too many requests': 'Muitas tentativas. Aguarde um momento.',
            'Network request failed': 'Erro de conexão. Verifique sua internet.'
        };
        
        // Trata erros de rate limit dinâmicos ("after X seconds")
        if (message?.includes('you can only request this after')) {
            const match = message.match(/(\d+) seconds?/);
            if (match) {
                const seconds = parseInt(match[1]);
                if (seconds <= 0) return 'Tente novamente agora.';
                return `Aguarde ${seconds} segundo${seconds > 1 ? 's' : ''} para tentar novamente.`;
            }
            return 'Aguarde alguns segundos para tentar novamente.';
        }
        
        return translations[message] || message;
    },

    doSocialAuth(provider) {
        if (!this.supabase) {
            return this.notify('Erro de conexão com servidor.', 'error');
        }

        this.authLoading = true;
        this.authMsg = 'Conectando...';

        this.supabase.auth
            .signInWithOAuth({
                provider,
                options: {
                    redirectTo: window.location.origin
                }
            })
            .then(({ error }) => {
                if (error) {
                    this.notify(error.message, 'error');
                    this.authLoading = false;
                }
            });
    },

    /**
     * Update password for logged-in user (from recover link ONLY)
     * This is called when user clicks the password reset link from email
     * @param {string} newPassword - The new password
     */
    async updatePassword(newPassword) {
        if (!this.supabase) {
            this.notify('Erro de conexão com servidor.', 'error');
            return false;
        }

        if (!newPassword || newPassword.length < 6) {
            this.notify('Senha deve ter pelo menos 6 caracteres.', 'error');
            return false;
        }

        this.authLoading = true;
        this.authMsg = '';

        try {
            const { error } = await this.supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            this.notify('Senha alterada com sucesso!', 'success');
            this.authMsg = 'Senha alterada! Redirecionando...';
            this.authMsgType = 'success';
            
            // Reset recover mode
            this.recoverMode = false;
            this.newPassword = '';
            this.newPasswordConfirm = '';
            
            // Redirect to dashboard after short delay
            setTimeout(() => {
                window.location.hash = '#/dashboard';
                this.currentView = 'dashboard';
            }, 1500);

            // Só abre modal de migração se estiver no dashboard
            setTimeout(() => { 
                if (this.currentView === 'dashboard' && this.user) {
                    this.migrationModalOpen = true; 
                }
            }, 2000);
            
            return true;
        } catch (e) {
            console.error('[CLOUD] Erro ao alterar senha:', e);
            this.authMsg = this.translateAuthError(e.message);
            this.authMsgType = 'error';
            this.notify('Erro ao alterar senha: ' + e.message, 'error');
            return false;
        } finally {
            this.authLoading = false;
        }
    },
    
    /**
     * Change password from account settings (requires current password verification)
     * More secure than updatePassword - verifies identity first
     * @param {string} currentPassword - Current password for verification
     * @param {string} newPassword - New password to set
     */
    async changePasswordSecure(currentPassword, newPassword) {
        if (!this.supabase || !this.user) {
            this.notify('Você precisa estar logado.', 'error');
            return false;
        }
        
        if (!currentPassword) {
            this.notify('Digite sua senha atual.', 'error');
            return false;
        }

        if (!newPassword || newPassword.length < 6) {
            this.notify('Nova senha deve ter pelo menos 6 caracteres.', 'error');
            return false;
        }
        
        if (currentPassword === newPassword) {
            this.notify('A nova senha deve ser diferente da atual.', 'error');
            return false;
        }

        this.authLoading = true;
        this.authMsg = 'Verificando senha atual...';
        this.authMsgType = 'info';

        try {
            // Step 1: Verify current password by attempting to sign in
            const { error: verifyError } = await this.supabase.auth.signInWithPassword({
                email: this.user.email,
                password: currentPassword
            });
            
            if (verifyError) {
                this.authMsg = 'Senha atual incorreta.';
                this.authMsgType = 'error';
                this.notify('Senha atual incorreta.', 'error');
                return false;
            }
            
            // Step 2: Update to new password
            this.authMsg = 'Alterando senha...';
            
            const { error: updateError } = await this.supabase.auth.updateUser({
                password: newPassword
            });

            if (updateError) throw updateError;

            this.notify('Senha alterada com sucesso!', 'success');
            this.authMsg = 'Senha alterada!';
            this.authMsgType = 'success';
            
            // Clear password fields
            this.currentPassword = '';
            this.newPassword = '';
            this.newPasswordConfirm = '';
            
            return true;
        } catch (e) {
            console.error('[CLOUD] Erro ao alterar senha:', e);
            this.authMsg = this.translateAuthError(e.message);
            this.authMsgType = 'error';
            this.notify('Erro ao alterar senha.', 'error');
            return false;
        } finally {
            this.authLoading = false;
        }
    },
    
    /**
     * Permanently delete user account and all associated data
     * This is IRREVERSIBLE - use with extreme caution
     */
    async deleteAccountPermanently() {
        if (!this.supabase || !this.user) {
            this.notify('Você precisa estar logado.', 'error');
            return false;
        }
        
        this.authLoading = true;
        this.notify('Deletando conta...', 'info');
        
        try {
            const userId = this.user.id;
            
            // 1. Delete all campaign memberships
            await this.supabase
                .from('campaign_members')
                .delete()
                .eq('user_id', userId);
            
            // 2. Delete all campaigns owned by user
            const { data: ownedCampaigns } = await this.supabase
                .from('campaigns')
                .select('id')
                .eq('gm_id', userId);
            
            if (ownedCampaigns?.length) {
                for (const campaign of ownedCampaigns) {
                    // Delete campaign members
                    await this.supabase.from('campaign_members').delete().eq('campaign_id', campaign.id);
                    // Delete campaign logs
                    await this.supabase.from('campaign_logs').delete().eq('campaign_id', campaign.id);
                    // Delete dice logs
                    await this.supabase.from('dice_logs').delete().eq('campaign_id', campaign.id);
                }
                // Delete campaigns
                await this.supabase.from('campaigns').delete().eq('gm_id', userId);
            }
            
            // 3. Delete user profile
            await this.supabase
                .from('profiles')
                .delete()
                .eq('id', userId);
            
            // 4. Clear all local storage
            localStorage.clear();
            
            // 5. Sign out
            await this.supabase.auth.signOut();
            
            this.notify('Conta deletada com sucesso. Adeus!', 'success');
            
            // 6. Reload page after delay
            setTimeout(() => {
                window.location.reload();
            }, 2000);
            
            return true;
        } catch (e) {
            console.error('[CLOUD] Erro ao deletar conta:', e);
            this.notify('Erro ao deletar conta: ' + e.message, 'error');
            return false;
        } finally {
            this.authLoading = false;
        }
    },
    
    /**
     * Request email change - sends confirmation to new email
     * Only works for email/password users, not OAuth
     * @param {string} newEmail - New email address
     */
    async requestEmailChange(newEmail) {
        if (!this.supabase || !this.user) {
            this.notify('Você precisa estar logado.', 'error');
            return false;
        }
        
        // Check if OAuth user
        if (this.user.app_metadata?.provider && this.user.app_metadata?.provider !== 'email') {
            this.notify('Usuários OAuth não podem alterar o e-mail.', 'error');
            return false;
        }
        
        if (!newEmail || !newEmail.includes('@')) {
            this.notify('E-mail inválido.', 'error');
            return false;
        }
        
        this.authLoading = true;
        
        try {
            const { error } = await this.supabase.auth.updateUser({
                email: newEmail
            });
            
            if (error) throw error;
            
            this.notify('Link de confirmação enviado para o novo e-mail!', 'success');
            return true;
        } catch (e) {
            console.error('[CLOUD] Erro ao solicitar mudança de e-mail:', e);
            this.notify('Erro: ' + this.translateAuthError(e.message), 'error');
            return false;
        } finally {
            this.authLoading = false;
        }
    },
    
    // ═══════════════════════════════════════════════════════════════════════
    // CLOUDCHECK - SISTEMA DE VERIFICAÇÃO E MIGRAÇÃO DE DADOS
    // ⚠️ IMPORTANTE: Sempre incrementar CLOUDCHECK_VERSION ao fazer mudanças!
    // ⚠️ IMPORTANTE: Atualizar CHANGELOG.md e changelog.js quando houver updates!
    // ═══════════════════════════════════════════════════════════════════════
    
    // Versão atual do schema de dados
    CLOUDCHECK_VERSION: 3,
    
    /**
     * Executa verificação completa dos dados do usuário
     * Corrige problemas e migra dados antigos
     */
    async runCloudCheck(silent = false) {
        if (!this.supabase || !this.user) {
            console.log('[CLOUDCHECK] Usuário não logado, pulando...');
            return { success: false, reason: 'not_logged_in' };
        }
        
        console.log('[CLOUDCHECK] ═══════════════════════════════════════════');
        console.log('[CLOUDCHECK] Iniciando verificação de dados...');
        
        const report = {
            startTime: Date.now(),
            checks: [],
            fixes: [],
            errors: [],
            profileFixed: false,
            charsFixed: 0,
            friendsFixed: 0
        };
        
        try {
            // 1. Verificar e corrigir perfil
            await this._checkProfile(report);
            
            // 2. Verificar e corrigir personagens
            await this._checkCharacters(report);
            
            // 3. Verificar e corrigir amizades
            await this._checkFriendships(report);
            
            // 4. Verificar e corrigir configurações
            await this._checkSettings(report);
            
            // 5. Atualizar versão do schema
            await this._updateSchemaVersion(report);
            
            report.duration = Date.now() - report.startTime;
            report.success = true;
            
            console.log('[CLOUDCHECK] ═══════════════════════════════════════════');
            console.log('[CLOUDCHECK] Verificação concluída em', report.duration, 'ms');
            console.log('[CLOUDCHECK] Checks:', report.checks.length);
            console.log('[CLOUDCHECK] Fixes:', report.fixes.length);
            console.log('[CLOUDCHECK] Errors:', report.errors.length);
            
            if (!silent && report.fixes.length > 0) {
                this.notify(`CloudCheck: ${report.fixes.length} correções aplicadas!`, 'success');
            }
            
            return report;
            
        } catch (e) {
            console.error('[CLOUDCHECK] Erro fatal:', e);
            report.errors.push({ type: 'fatal', message: e.message });
            report.success = false;
            
            if (!silent) {
                this.notify('Erro no CloudCheck. Verifique o console.', 'error');
            }
            
            return report;
        }
    },
    
    /**
     * Verifica e corrige o perfil do usuário
     */
    async _checkProfile(report) {
        console.log('[CLOUDCHECK] Verificando perfil...');
        report.checks.push('profile');
        
        try {
            const { data: profile, error } = await this.supabase
                .from('profiles')
                .select('*')
                .eq('id', this.user.id)
                .single();
            
            if (error) {
                if (error.code === 'PGRST116') {
                    // Perfil não existe - criar
                    console.log('[CLOUDCHECK] Perfil não encontrado, criando...');
                    await this._createMissingProfile(report);
                    return;
                }
                throw error;
            }
            
            const fixes = [];
            const updates = {};
            
            // Check: username válido
            if (!profile.username || profile.username.length < 2) {
                const fallback = this.user.email?.split('@')[0] || 'user';
                const newUsername = normalizeUsername(fallback) || `user_${Date.now().toString(36)}`;
                updates.username = newUsername;
                fixes.push('username_missing');
                console.log('[CLOUDCHECK] Username inválido, corrigindo para:', newUsername);
            } else if (!/^[a-z0-9_]+$/.test(profile.username)) {
                // Username com caracteres inválidos
                const normalized = normalizeUsername(profile.username);
                if (normalized && normalized !== profile.username) {
                    updates.username = normalized;
                    fixes.push('username_normalized');
                    console.log('[CLOUDCHECK] Username normalizado:', profile.username, '->', normalized);
                }
            }
            
            // Check: display_name
            if (!profile.display_name) {
                updates.display_name = profile.username || updates.username || 'Usuário';
                fixes.push('display_name_missing');
            }
            
            // Check: is_public definido
            if (profile.is_public === null || profile.is_public === undefined) {
                updates.is_public = true;
                fixes.push('is_public_default');
            }
            
            // Check: bio muito longa
            if (profile.bio && profile.bio.length > 500) {
                updates.bio = profile.bio.substring(0, 500);
                fixes.push('bio_truncated');
            }
            
            // Check: avatar_url válida
            if (profile.avatar_url && !profile.avatar_url.startsWith('http')) {
                updates.avatar_url = null;
                fixes.push('avatar_url_invalid');
            }
            
            // Check: data é objeto válido
            if (profile.data && typeof profile.data !== 'object') {
                updates.data = {};
                fixes.push('data_invalid');
            }
            
            // Aplicar correções se houver
            if (Object.keys(updates).length > 0) {
                updates.updated_at = new Date().toISOString();
                
                const { error: updateError } = await this.supabase
                    .from('profiles')
                    .update(updates)
                    .eq('id', this.user.id);
                
                if (updateError) {
                    console.error('[CLOUDCHECK] Erro ao atualizar perfil:', updateError);
                    report.errors.push({ type: 'profile_update', message: updateError.message });
                } else {
                    report.fixes.push(...fixes);
                    report.profileFixed = true;
                    console.log('[CLOUDCHECK] Perfil corrigido:', fixes);
                }
            } else {
                console.log('[CLOUDCHECK] Perfil OK');
            }
            
        } catch (e) {
            console.error('[CLOUDCHECK] Erro ao verificar perfil:', e);
            report.errors.push({ type: 'profile_check', message: e.message });
        }
    },
    
    /**
     * Cria perfil faltando
     */
    async _createMissingProfile(report) {
        const fallbackUsername = normalizeUsername(this.user.email?.split('@')[0] || '') || `user_${Date.now().toString(36)}`;
        
        const newProfile = {
            id: this.user.id,
            username: fallbackUsername,
            display_name: fallbackUsername,
            bio: '',
            avatar_url: null,
            is_public: true,
            data: { config: this.settings || {} },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        const { error } = await this.supabase
            .from('profiles')
            .insert([newProfile]);
        
        if (error) {
            console.error('[CLOUDCHECK] Erro ao criar perfil:', error);
            report.errors.push({ type: 'profile_create', message: error.message });
        } else {
            report.fixes.push('profile_created');
            report.profileFixed = true;
            console.log('[CLOUDCHECK] Perfil criado com sucesso');
        }
    },
    
    /**
     * Verifica e corrige personagens
     */
    async _checkCharacters(report) {
        console.log('[CLOUDCHECK] Verificando personagens...');
        report.checks.push('characters');
        
        if (!this.chars || typeof this.chars !== 'object') {
            console.log('[CLOUDCHECK] Nenhum personagem para verificar');
            return;
        }
        
        let fixedCount = 0;
        const charsToFix = {};
        
        for (const [id, char] of Object.entries(this.chars)) {
            if (!char || typeof char !== 'object') continue;
            
            let needsFix = false;
            const fixedChar = { ...char };
            
            // Check: ID válido
            if (!fixedChar.id) {
                fixedChar.id = id;
                needsFix = true;
            }
            
            // Check: nome válido
            if (!fixedChar.name || typeof fixedChar.name !== 'string') {
                fixedChar.name = 'Personagem Sem Nome';
                needsFix = true;
            } else if (fixedChar.name.length > 100) {
                fixedChar.name = fixedChar.name.substring(0, 100);
                needsFix = true;
            }
            
            // Check: level válido
            if (typeof fixedChar.level !== 'number' || fixedChar.level < 1) {
                fixedChar.level = 1;
                needsFix = true;
            } else if (fixedChar.level > 99) {
                fixedChar.level = 99;
                needsFix = true;
            }
            
            // Check: HP/MP válidos
            ['hp', 'mp', 'san', 'ep'].forEach(stat => {
                if (fixedChar[stat] !== undefined) {
                    if (typeof fixedChar[stat].current !== 'number') {
                        fixedChar[stat].current = fixedChar[stat].max || 10;
                        needsFix = true;
                    }
                    if (typeof fixedChar[stat].max !== 'number' || fixedChar[stat].max < 1) {
                        fixedChar[stat].max = 10;
                        needsFix = true;
                    }
                    // Current não pode ser maior que max
                    if (fixedChar[stat].current > fixedChar[stat].max) {
                        fixedChar[stat].current = fixedChar[stat].max;
                        needsFix = true;
                    }
                    // Current não pode ser negativo
                    if (fixedChar[stat].current < 0) {
                        fixedChar[stat].current = 0;
                        needsFix = true;
                    }
                }
            });
            
            // Check: atributos válidos
            if (fixedChar.attributes && typeof fixedChar.attributes === 'object') {
                for (const [attr, value] of Object.entries(fixedChar.attributes)) {
                    if (typeof value !== 'number') {
                        fixedChar.attributes[attr] = 0;
                        needsFix = true;
                    } else if (value < -10 || value > 100) {
                        fixedChar.attributes[attr] = Math.max(-10, Math.min(100, value));
                        needsFix = true;
                    }
                }
            }
            
            // Check: lastAccess
            if (!fixedChar.lastAccess || typeof fixedChar.lastAccess !== 'number') {
                fixedChar.lastAccess = Date.now();
                needsFix = true;
            }
            
            // Check: inventory é array
            if (fixedChar.inventory && !Array.isArray(fixedChar.inventory)) {
                fixedChar.inventory = [];
                needsFix = true;
            }
            
            // Check: skills é array
            if (fixedChar.skills && !Array.isArray(fixedChar.skills)) {
                fixedChar.skills = [];
                needsFix = true;
            }
            
            // Check: notes é string
            if (fixedChar.notes && typeof fixedChar.notes !== 'string') {
                fixedChar.notes = String(fixedChar.notes);
                needsFix = true;
            }
            
            // Check: history é array
            if (fixedChar.history && !Array.isArray(fixedChar.history)) {
                fixedChar.history = [];
                needsFix = true;
            }
            
            // Check: classe/raça são strings válidas
            if (fixedChar.class && typeof fixedChar.class !== 'string') {
                fixedChar.class = String(fixedChar.class);
                needsFix = true;
            }
            if (fixedChar.race && typeof fixedChar.race !== 'string') {
                fixedChar.race = String(fixedChar.race);
                needsFix = true;
            }
            
            // Check: experiência é número válido
            if (fixedChar.exp !== undefined && (typeof fixedChar.exp !== 'number' || fixedChar.exp < 0)) {
                fixedChar.exp = 0;
                needsFix = true;
            }
            
            // Check: dinheiro/moedas são números válidos
            if (fixedChar.gold !== undefined && (typeof fixedChar.gold !== 'number' || fixedChar.gold < 0)) {
                fixedChar.gold = 0;
                needsFix = true;
            }
            
            if (needsFix) {
                charsToFix[id] = fixedChar;
                fixedCount++;
            }
        }
        
        // Aplicar correções
        if (fixedCount > 0) {
            Object.assign(this.chars, charsToFix);
            await this.syncCloud(true);
            report.fixes.push(`characters_fixed_${fixedCount}`);
            report.charsFixed = fixedCount;
            console.log('[CLOUDCHECK] Personagens corrigidos:', fixedCount);
        } else {
            console.log('[CLOUDCHECK] Personagens OK');
        }
    },
    
    /**
     * Verifica e corrige amizades
     */
    async _checkFriendships(report) {
        console.log('[CLOUDCHECK] Verificando amizades...');
        report.checks.push('friendships');
        
        try {
            // Busca amizades do usuário
            const { data: friendships, error } = await this.supabase
                .from('friendships')
                .select('id, user_id, friend_id, status')
                .or(`user_id.eq.${this.user.id},friend_id.eq.${this.user.id}`);
            
            if (error) throw error;
            
            if (!friendships || friendships.length === 0) {
                console.log('[CLOUDCHECK] Nenhuma amizade para verificar');
                return;
            }
            
            let fixedCount = 0;
            const toDelete = [];
            
            for (const friendship of friendships) {
                // Check: auto-amizade (usuário amigo de si mesmo)
                if (friendship.user_id === friendship.friend_id) {
                    toDelete.push(friendship.id);
                    fixedCount++;
                    console.log('[CLOUDCHECK] Removendo auto-amizade:', friendship.id);
                    continue;
                }
                
                // Check: status válido
                if (!['pending', 'accepted', 'rejected', 'blocked'].includes(friendship.status)) {
                    const { error: updateError } = await this.supabase
                        .from('friendships')
                        .update({ status: 'pending' })
                        .eq('id', friendship.id);
                    
                    if (!updateError) {
                        fixedCount++;
                        console.log('[CLOUDCHECK] Status de amizade corrigido:', friendship.id);
                    }
                }
            }
            
            // Deletar amizades inválidas
            if (toDelete.length > 0) {
                const { error: deleteError } = await this.supabase
                    .from('friendships')
                    .delete()
                    .in('id', toDelete);
                
                if (deleteError) {
                    console.error('[CLOUDCHECK] Erro ao deletar amizades:', deleteError);
                }
            }
            
            if (fixedCount > 0) {
                report.fixes.push(`friendships_fixed_${fixedCount}`);
                report.friendsFixed = fixedCount;
                // Recarrega lista de amigos
                if (this.loadFriends) {
                    await this.loadFriends(true);
                }
            }
            
            console.log('[CLOUDCHECK] Amizades verificadas:', friendships.length, '| Corrigidas:', fixedCount);
            
        } catch (e) {
            console.error('[CLOUDCHECK] Erro ao verificar amizades:', e);
            report.errors.push({ type: 'friendships_check', message: e.message });
        }
    },
    
    /**
     * Verifica e corrige configurações
     */
    async _checkSettings(report) {
        console.log('[CLOUDCHECK] Verificando configurações...');
        report.checks.push('settings');
        
        const defaultSettings = {
            themeColor: 'cyan',
            soundEnabled: true,
            musicEnabled: true,
            sfxVolume: 0.5,
            musicVolume: 0.3,
            diceAnimation: true,
            autoSave: true,
            compactMode: false,
            lowPerformance: false
        };
        
        let needsFix = false;
        
        if (!this.settings || typeof this.settings !== 'object') {
            this.settings = { ...defaultSettings };
            needsFix = true;
        } else {
            // Garantir que todas as configurações existem
            for (const [key, defaultValue] of Object.entries(defaultSettings)) {
                if (this.settings[key] === undefined || this.settings[key] === null) {
                    this.settings[key] = defaultValue;
                    needsFix = true;
                }
            }
            
            // Validar tipos
            if (typeof this.settings.sfxVolume !== 'number' || this.settings.sfxVolume < 0 || this.settings.sfxVolume > 1) {
                this.settings.sfxVolume = 0.5;
                needsFix = true;
            }
            if (typeof this.settings.musicVolume !== 'number' || this.settings.musicVolume < 0 || this.settings.musicVolume > 1) {
                this.settings.musicVolume = 0.3;
                needsFix = true;
            }
        }
        
        if (needsFix) {
            report.fixes.push('settings_fixed');
            this.saveLocal();
            console.log('[CLOUDCHECK] Configurações corrigidas');
        } else {
            console.log('[CLOUDCHECK] Configurações OK');
        }
    },
    
    /**
     * Atualiza versão do schema
     */
    async _updateSchemaVersion(report) {
        console.log('[CLOUDCHECK] Atualizando versão do schema...');
        
        const currentVersion = localStorage.getItem('zenite_schema_version');
        
        if (currentVersion !== String(this.CLOUDCHECK_VERSION)) {
            localStorage.setItem('zenite_schema_version', String(this.CLOUDCHECK_VERSION));
            report.fixes.push(`schema_updated_v${this.CLOUDCHECK_VERSION}`);
            console.log('[CLOUDCHECK] Schema atualizado para v' + this.CLOUDCHECK_VERSION);
        }
    },
    
    /**
     * Verifica se precisa rodar CloudCheck
     */
    needsCloudCheck() {
        const lastCheck = localStorage.getItem('zenite_last_cloudcheck');
        const schemaVersion = localStorage.getItem('zenite_schema_version');
        
        // Se nunca rodou ou versão diferente
        if (!lastCheck || schemaVersion !== String(this.CLOUDCHECK_VERSION)) {
            return true;
        }
        
        // Se faz mais de 7 dias
        const daysSinceCheck = (Date.now() - parseInt(lastCheck)) / (1000 * 60 * 60 * 24);
        return daysSinceCheck > 7;
    },
    
    /**
     * Marca CloudCheck como executado
     */
    markCloudCheckDone() {
        localStorage.setItem('zenite_last_cloudcheck', String(Date.now()));
    },
    
    /**
     * Executa CloudCheck se necessário (chamado no login)
     */
    async autoCloudCheck() {
        if (this.needsCloudCheck()) {
            console.log('[CLOUDCHECK] Executando verificação automática...');
            const report = await this.runCloudCheck(true);
            this.markCloudCheckDone();
            return report;
        }
        return null;
    }
};
