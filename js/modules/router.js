// ═══════════════════════════════════════════════════════════════════════════
// ZENITE ROUTER
// ═══════════════════════════════════════════════════════════════════════════
// URLs compartilháveis com hash routing limpo:
// - / (dashboard - URL limpa)
// - /sheet/abc123
// - /netlink/XY7ABC
// ═══════════════════════════════════════════════════════════════════════════

export const router = {
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
        
        // Escuta mudanças de navegação
        window.addEventListener('popstate', () => this.handleRoute());
        
        // Processa rota inicial
        this.handleRoute();
    },
    
    /**
     * Navega para uma rota usando History API
     * @param {string} route - Nome da rota (dashboard, sheet, netlink)
     * @param {string} param - Parâmetro opcional (charId, campaignCode)
     * @param {boolean} replace - Se true, usa replaceState ao invés de pushState
     */
    navigate(route, param = null, replace = false) {
        let path = '/';
        
        // Dashboard fica com URL limpa
        if (route !== 'dashboard') {
            path = `/${route}`;
            if (param) path += `/${param}`;
        }
        
        const url = window.location.origin + path;
        
        if (replace) {
            window.history.replaceState({ route, param }, '', url);
        } else {
            window.history.pushState({ route, param }, '', url);
        }
        
        this.processRoute(route, param);
    },
    
    /**
     * Processa a rota atual
     */
    handleRoute() {
        const path = window.location.pathname;
        const parts = path.split('/').filter(p => p);
        
        // Se tiver hash antigo, migra para o novo formato
        if (window.location.hash.startsWith('#/')) {
            const hashParts = window.location.hash.slice(2).split('/').filter(p => p);
            const route = hashParts[0] || 'dashboard';
            const param = hashParts[1] || null;
            this.navigate(route, param, true);
            return;
        }
        
        const routeName = parts[0] || 'dashboard';
        const param = parts[1] || null;
        
        console.log('[ROUTER] HandleRoute -', routeName, param, 'State:', window.history.state);
        
        this.processRoute(routeName, param);
    },
    
    /**
     * Processa uma rota específica
     */
    processRoute(routeName, param) {
        console.log('[ROUTER] Navegando para:', routeName, param);
        
        // Se não estiver autenticado e tentar acessar algo diferente de login
        if (!this.app.user && !this.app.isGuest && routeName !== 'login') {
            // Salva a rota pretendida para redirecionar após login
            this.pendingRoute = { route: routeName, param };
            this.updateTitle('Login');
            return; // Fica na tela de login
        }
        
        switch (routeName) {
            case 'dashboard':
                this.app.currentView = 'dashboard';
                this.updateTitle('Dashboard');
                break;
                
            case 'sheet':
                if (param) {
                    // Aguarda chars carregarem se necessário
                    const tryLoad = () => {
                        if (this.app.chars && Object.keys(this.app.chars).length > 0) {
                            this.app.loadChar(param).then(success => {
                                if (success) {
                                    this.app.currentView = 'sheet';
                                    this.updateTitle(this.app.char?.name || 'Ficha');
                                } else {
                                    this.navigate('dashboard', null, true);
                                }
                            });
                        } else {
                            setTimeout(tryLoad, 200);
                        }
                    };
                    tryLoad();
                } else {
                    this.navigate('dashboard', null, true);
                }
                break;
                
            case 'netlink':
                if (param && this.app.netlinkEnabled) {
                    // Tenta entrar na campanha pelo código
                    if (this.app.joinByCode) {
                        this.app.joinByCode(param).then(success => {
                            if (success) {
                                this.updateTitle(this.app.activeCampaign?.name || 'NetLink');
                            }
                        }).catch(() => {
                            this.app.notify('Campanha não encontrada', 'error');
                            this.navigate('dashboard', null, true);
                        });
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
     * Redireciona para rota pendente após login
     * Usa replaceState para impedir que o botão voltar leve à tela de login
     */
    redirectAfterLogin() {
        // IMPORTANTE: Substituir a entrada atual no histórico para impedir
        // que o usuário volte para a tela de login com o botão voltar
        if (this.pendingRoute) {
            const { route, param } = this.pendingRoute;
            this.pendingRoute = null;
            // Primeiro limpa a entrada de login
            window.history.replaceState({ route, param }, '', '/');
            this.processRoute(route, param);
        } else {
            // Substitui a entrada de login por dashboard
            window.history.replaceState({ route: 'dashboard' }, '', '/');
            this.processRoute('dashboard', null);
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
     * Atualiza a URL sem navegar (para quando o estado muda internamente)
     */
    updateUrl(route, param = null) {
        let path = '/';
        if (route !== 'dashboard') {
            path = `/${route}`;
            if (param) path += `/${param}`;
        }
        window.history.replaceState({ route, param }, '', path);
    },
    
    /**
     * Atualiza o título da aba do navegador
     * @param {string} title - Título da página (sem prefixo "ZENITE OS //")
     */
    updateTitle(title) {
        const fullTitle = title ? `ZENITE OS // ${title}` : 'ZENITE OS';
        document.title = fullTitle;
        console.log('[ROUTER] Título atualizado:', fullTitle);
        
        // Força atualização (alguns navegadores precisam de delay)
        setTimeout(() => {
            if (document.title !== fullTitle) {
                document.title = fullTitle;
                console.log('[ROUTER] Título forçado novamente');
            }
        }, 100);
    }
};

export default router;
