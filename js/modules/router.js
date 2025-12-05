// ═══════════════════════════════════════════════════════════════════════════
// ZENITE ROUTER v2.0
// ═══════════════════════════════════════════════════════════════════════════
// URLs compartilháveis com hash routing (compatível com qualquer host):
// - /#/dashboard
// - /#/sheet/abc123
// - /#/netlink/XY7ABC
// ═══════════════════════════════════════════════════════════════════════════

export const router = {
    // Referência ao app
    app: null,
    
    // Rota pendente após login
    pendingRoute: null,
    
    // Rotas disponíveis
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
        
        // Escuta mudanças de hash
        window.addEventListener('hashchange', () => this.handleRoute());
        
        // Processa rota inicial
        this.handleRoute();
    },
    
    /**
     * Navega para uma rota
     * @param {string} route - Nome da rota
     * @param {string|null} param - Parâmetro opcional (ID de ficha, código de campanha)
     * @param {boolean} replace - Se true, substitui a entrada atual no histórico
     * @param {boolean} skipProcess - Se true, apenas atualiza URL sem processar rota
     */
    navigate(route, param = null, replace = false, skipProcess = false) {
        // Constrói o hash
        let hash = '#/' + route;
        if (param) hash += '/' + param;
        
        // Dashboard pode ficar limpo ou com hash
        if (route === 'dashboard') {
            hash = '#/dashboard';
        }
        
        const currentHash = window.location.hash;
        
        // Evita navegação para a mesma rota
        if (currentHash === hash && !replace) {
            return;
        }
        
        if (replace) {
            // Substitui sem adicionar ao histórico
            const url = window.location.pathname + window.location.search + hash;
            window.history.replaceState({ route, param }, '', url);
        } else {
            window.location.hash = hash;
        }
        
        if (!skipProcess) {
            this.processRoute(route, param);
        }
        
        this.updateTitle(route, param);
    },
    
    /**
     * Processa a rota atual baseada no hash
     */
    handleRoute() {
        const hash = window.location.hash;
        
        // Se não tem hash, vai para dashboard
        if (!hash || hash === '#' || hash === '#/') {
            this.navigate('dashboard', null, true);
            return;
        }
        
        // Parse do hash: #/route/param
        const parts = hash.slice(2).split('/').filter(p => p); // Remove #/
        const routeName = parts[0] || 'dashboard';
        const param = parts[1] || null;
        
        console.log('[ROUTER] HandleRoute -', routeName, param);
        
        this.processRoute(routeName, param);
    },
    
    /**
     * Processa uma rota específica
     */
    async processRoute(routeName, param) {
        console.log('[ROUTER] Processando:', routeName, param);
        
        // Se não estiver autenticado e tentar acessar algo diferente de login
        if (!this.app.user && !this.app.isGuest && routeName !== 'login') {
            // Salva a rota pretendida para redirecionar após login
            this.pendingRoute = { route: routeName, param };
            this.updateTitle('login');
            return; // Fica na tela de login
        }
        
        switch (routeName) {
            case 'dashboard':
                this.app.currentView = 'dashboard';
                this.updateTitle('dashboard');
                break;
                
            case 'sheet':
                if (param) {
                    // Aguarda chars carregarem se necessário
                    await this.waitForChars();
                    
                    if (this.app.chars && this.app.chars[param]) {
                        // Usa loadCharacter (skipPush=true para não duplicar navegação)
                        const success = this.app.loadCharacter(param, true);
                        if (success) {
                            // Atualiza URL após carregar
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
                // Se já estiver logado, vai para dashboard
                if (this.app.user || this.app.isGuest) {
                    this.navigate('dashboard', null, true);
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
     */
    redirectAfterLogin() {
        if (this.pendingRoute) {
            const { route, param } = this.pendingRoute;
            this.pendingRoute = null;
            this.navigate(route, param, true);
        } else {
            this.navigate('dashboard', null, true);
        }
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
        let hash = '#/' + route;
        if (param) hash += '/' + param;
        
        const url = window.location.pathname + window.location.search + hash;
        window.history.replaceState({ route, param }, '', url);
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
