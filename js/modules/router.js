// ═══════════════════════════════════════════════════════════════════════════
// ZENITE ROUTER v3.0
// ═══════════════════════════════════════════════════════════════════════════
// Hash routing compartilhável:
// - /#/dashboard
// - /#/sheet/abc123
// - /#/netlink/XY7ABC
// - /#/login
// Foco em segurança de histórico: limpa login do histórico ao autenticar.
// ═══════════════════════════════════════════════════════════════════════════

const sanitizeRouteName = (raw) => {
    if (!raw) return 'dashboard';
    const safe = String(raw).toLowerCase();
    if (['dashboard', 'sheet', 'netlink', 'login'].includes(safe)) return safe;
    return 'dashboard';
};

const sanitizeParam = (route, param) => {
    if (!param) return null;
    if (route === 'netlink') {
        return String(param).trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
    }
    if (route === 'sheet') {
        return String(param).trim();
    }
    return null;
};

export const router = {
    app: null,
    pendingRoute: null,
    routes: {
        dashboard: { view: 'dashboard', title: 'Dashboard' },
        sheet: { view: 'sheet', title: 'Ficha', param: 'charId' },
        netlink: { view: 'campaign', title: 'NetLink', param: 'code' },
        login: { view: 'login', title: 'Login' }
    },

    /**
     * Inicializa o router
     * @param {Object} app - Referência ao app Alpine
     */
    init(app) {
        this.app = app;
        window.addEventListener('hashchange', () => this.handleRoute());
        this.handleRoute();
    },

    /**
     * Navega para uma rota
     * @param {string} route
     * @param {string|null} param
     * @param {boolean} replace
     * @param {boolean} skipProcess
     */
    navigate(route, param = null, replace = false, skipProcess = false) {
        const safeRoute = sanitizeRouteName(route);
        const safeParam = sanitizeParam(safeRoute, param);

        let hash = '#/' + safeRoute;
        if (safeParam) hash += '/' + safeParam;

        if (safeRoute === 'dashboard') {
            hash = '#/dashboard';
        }

        const currentHash = window.location.hash;
        if (currentHash === hash && !replace) {
            return;
        }

        if (replace) {
            const url = window.location.pathname + window.location.search + hash;
            window.history.replaceState({ route: safeRoute, param: safeParam }, '', url);
        } else {
            window.location.hash = hash;
        }

        if (!skipProcess) {
            this.processRoute(safeRoute, safeParam);
        }

        this.updateTitle(safeRoute, safeParam);
    },

    /**
     * Processa a rota atual baseada no hash
     */
    handleRoute() {
        const hash = window.location.hash;

        if (!hash || hash === '#' || hash === '#/') {
            this.navigate('dashboard', null, true);
            return;
        }

        const parts = hash.slice(2).split('/').filter((p) => p);
        const routeName = sanitizeRouteName(parts[0] || 'dashboard');
        const param = sanitizeParam(routeName, parts[1] || null);

        console.log('[ROUTER] HandleRoute -', routeName, param);

        this.processRoute(routeName, param);
    },

    /**
     * Processa uma rota específica
     */
    async processRoute(routeName, param) {
        console.log('[ROUTER] Processando:', routeName, param);

        // Guarda tentativa de rota antes do login
        if (!this.app.user && !this.app.isGuest && routeName !== 'login') {
            this.pendingRoute = { route: routeName, param };
            // Garante hash de login com replace para evitar histórico de volta
            const loginUrl = window.location.pathname + window.location.search + '#/login';
            window.history.replaceState({ route: 'login' }, '', loginUrl);
            this.app.currentView = 'login';
            this.updateTitle('login');
            return;
        }

        switch (routeName) {
            case 'dashboard':
                this.app.currentView = 'dashboard';
                this.updateTitle('dashboard');
                // Limpa pendência ao chegar no dashboard
                this.pendingRoute = null;
                this.updateUrl('dashboard');
                break;

            case 'sheet':
                if (param) {
                    await this.waitForChars();

                    if (this.app.chars && this.app.chars[param]) {
                        const success = this.app.loadCharacter(param, true);
                        if (success) {
                            this.updateUrl('sheet', param);
                            this.updateTitle('sheet', this.app.char?.name);
                        } else {
                            this.app.notify('Ficha não encontrada', 'error');
                            this.navigate('dashboard', null, true);
                        }
                    } else {
                        this.app.notify('Ficha não encontrada', 'error');
                        this.navigate('dashboard', null, true);
                    }
                } else {
                    this.navigate('dashboard', null, true);
                }
                break;

            case 'netlink':
                if (param && this.app.netlinkEnabled) {
                    try {
                        const success = await this.app.joinByCode(param);
                        if (success) {
                            this.updateTitle('netlink', this.app.activeCampaign?.name);
                            this.updateUrl('netlink', param);
                        }
                    } catch (e) {
                        console.error('[ROUTER] Erro ao entrar na campanha:', e);
                        this.app.notify('Campanha não encontrada', 'error');
                        this.navigate('dashboard', null, true);
                    }
                } else {
                    this.navigate('dashboard', null, true);
                }
                break;

            case 'login':
                if (this.app.user || this.app.isGuest) {
                    // Limpa histórico de login para não voltar
                    this.navigate('dashboard', null, true);
                } else {
                    this.app.currentView = 'login';
                    this.updateUrl('login');
                }
                break;

            default:
                this.navigate('dashboard', null, true);
        }
    },

    /**
     * Aguarda os chars carregarem
     */
    waitForChars() {
        return new Promise((resolve) => {
            const check = () => {
                if (this.app.chars && !this.app.systemLoading) {
                    resolve();
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    },

    /**
     * Redireciona para rota pendente após login
     * Limpando histórico de login para evitar back unsafe.
     */
    redirectAfterLogin() {
        const target = this.pendingRoute || { route: 'dashboard', param: null };
        this.pendingRoute = null;
        // Replace para não deixar login no histórico
        this.navigate(target.route, target.param, true);
    },

    /**
     * Retorna a URL compartilhável atual
     */
    getShareableUrl() {
        return window.location.href;
    },

    /**
     * Copia a URL atual para a área de transferência
     */
    async copyCurrentUrl() {
        const url = this.getShareableUrl();
        await navigator.clipboard.writeText(url);
        this.app.notify('Link copiado!', 'success');
        return url;
    },

    /**
     * Atualiza a URL sem disparar navegação
     */
    updateUrl(route, param = null) {
        const safeRoute = sanitizeRouteName(route);
        const safeParam = sanitizeParam(safeRoute, param);

        let hash = '#/' + safeRoute;
        if (safeParam) hash += '/' + safeParam;

        const url = window.location.pathname + window.location.search + hash;
        window.history.replaceState({ route: safeRoute, param: safeParam }, '', url);
    },

    /**
     * Atualiza o título da aba do navegador
     */
    updateTitle(route, subtitle = null) {
        const routeConfig = this.routes[route];
        let title = routeConfig?.title || 'ZENITE OS';

        if (subtitle) {
            title = subtitle;
        }

        document.title = `ZENITE OS // ${title}`;
    }
};

export default router;
