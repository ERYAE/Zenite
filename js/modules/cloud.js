// js/modules/cloud.js
import { sanitizeChar, migrateCharacter } from './utils.js';
import { playSFX } from './audio.js';

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
        return 'Username já está em uso. Escolha outro.';
    }
    if (message.toLowerCase().includes('password')) {
        return 'Senha inválida. Use pelo menos 6 caracteres.';
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
    
    // Embaralha a senha para não ter padrão previsível
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
            console.error('Local Load Error:', e);
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
            console.error('Save Local Error:', e);
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
                console.log('[CLOUD] Criando novo perfil para usuário:', this.user.id);
                const { error: insertError } = await this.supabase.from('profiles').insert([
                    {
                        id: this.user.id,
                        data: { config: this.settings }
                    }
                ]);

                if (insertError) {
                    console.error('[CLOUD] Erro ao criar perfil:', insertError);
                    this.notify('Erro ao criar perfil na nuvem.', 'error');
                    return;
                }
                data = { data: { config: this.settings } };
            } else if (error) {
                console.error('[CLOUD] Erro ao buscar dados:', error);
                this.notify('Erro ao buscar dados da nuvem.', 'error');
                return;
            }

            if (data && data.data) {
                const cloudData = data.data;
                const reservedKeys = ['config', 'hasSeenTip', 'trayDockMode'];

                if (cloudData.config) {
                    this.settings = { ...this.settings, ...cloudData.config };
                    this.applyTheme(this.settings.themeColor);
                }

                if (cloudData.hasSeenTip !== undefined) {
                    this.hasSeenDiceTip = cloudData.hasSeenTip;
                }

                let merged = {};

                Object.keys(cloudData).forEach((k) => {
                    if (!reservedKeys.includes(k) && cloudData[k]?.id) {
                        let char = sanitizeChar(cloudData[k]);
                        char = migrateCharacter(char);
                        if (!char.lastAccess) {
                            char.lastAccess = Date.now();
                        }
                        merged[k] = char;
                    }
                });

                this.chars = merged;
                this.updateAgentCount();
                this.saveLocal();

                console.log('[CLOUD] Dados sincronizados:', Object.keys(merged).length, 'personagens');
            }
        } catch (e) {
            console.error('[CLOUD] Fetch Error:', e);
            this.notify('Erro de conexão com a nuvem.', 'error');
        }
    },

    async syncCloud(silent = false) {
        if (!this.user || this.isGuest || !this.supabase) return;
        if (this.isSyncing) {
            console.log('[CLOUD] Sincronização já em andamento, ignorando...');
            return;
        }

        this.isSyncing = true;
        if (!silent) this.notify('Sincronizando...', 'info');

        try {
            const payload = {
                ...this.chars,
                config: this.settings,
                hasSeenTip: this.hasSeenDiceTip
            };

            const payloadSize = JSON.stringify(payload).length;
            if (payloadSize > 900000) {
                console.warn('[CLOUD] Payload muito grande:', payloadSize, 'bytes');
                this.notify('Dados muito grandes. Remova personagens antigos.', 'warn');
            }

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

            if (error) {
                console.error('[CLOUD] Sync Error:', error);
                throw error;
            }

            this.unsavedChanges = false;
            this.saveStatus = 'success';
            this.lastManualSave = new Date();

            console.log('[CLOUD] Sincronização bem-sucedida');

            if (!silent) {
                this.notify('Salvo na nuvem!', 'success');
                playSFX('save');
            }
        } catch (e) {
            console.error('[CLOUD] Sync Exception:', e);
            this.saveStatus = 'error';

            let errorMsg = 'Erro ao salvar na nuvem.';
            if (e.message?.includes('JWT')) {
                errorMsg = 'Sessão expirada. Faça login novamente.';
            } else if (e.message?.includes('network')) {
                errorMsg = 'Sem conexão com a internet.';
            }

            if (!silent) this.notify(errorMsg, 'error');
        } finally {
            this.isSyncing = false;
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
                check_username: finalUsername,
                current_user_id: null
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

                await this.fetchCloud();
                this.checkOnboarding?.();
                this.checkUsername?.();
                
                // Use router if available
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
            localStorage.removeItem('zenite_is_guest');

            this.authMsg = 'Login realizado!';
            this.authMsgType = 'success';
            this.notify('Bem-vindo de volta!', 'success');

            await this.fetchCloud();
            this.checkOnboarding();
            this.checkUsername();

            this.currentView = 'dashboard';
            window.location.hash = '#/dashboard';
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
                redirectTo: `${window.location.origin}/reset-password`
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
                'Aguarde 60 segundos para tentar novamente'
        };
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
    }
};