// ═══════════════════════════════════════════════════════════════════════════
// ZENITE ROUTER v5.0 - FULL REWRITE
// ═══════════════════════════════════════════════════════════════════════════
// Hash-based routing with full browser history synchronization:
// - /#/dashboard
// - /#/sheet/abc123  
// - /#/netlink/XY7ABC
// - /#/login
//
// KEY PRINCIPLE: Only change the hash. Let the listener handle rendering.
// This ensures both clicks AND back buttons use the exact same logic.
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// SANITIZERS
// ═══════════════════════════════════════════════════════════════════════════

const VALID_ROUTES = ['dashboard', 'sheet', 'netlink', 'login'];

const sanitizeRouteName = (raw) => {
    if (!raw) return 'dashboard';
    const safe = String(raw).toLowerCase().trim();
    return VALID_ROUTES.includes(safe) ? safe : 'dashboard';
};

const sanitizeParam = (route, param) => {
    if (!param) return null;
    const cleanParam = String(param).trim();
    
    switch (route) {
        case 'netlink':
            // NetLink codes: uppercase alphanumeric, max 12 chars
            return cleanParam.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || null;
        case 'sheet':
            // Sheet IDs: any string up to 50 chars
            return cleanParam.slice(0, 50) || null;
        default:
            return null;
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// ROUTER OBJECT
// ═══════════════════════════════════════════════════════════════════════════

export const router = {
    // State
    app: null,
    pendingRoute: null,
    isNavigating: false,
    isInitialized: false,
    lastProcessedHash: null,
    
    // Route configurations
    routes: {
        dashboard: { view: 'dashboard', title: 'Dashboard' },
        sheet: { view: 'sheet', title: 'Ficha', param: 'charId' },
        netlink: { view: 'campaign', title: 'NetLink', param: 'code' },
        login: { view: 'login', title: 'Login' }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Initialize the router with Alpine app reference
     * @param {Object} app - Alpine.js data object
     */
    init(app) {
        if (this.isInitialized) {
            console.warn('[ROUTER] Already initialized');
            return;
        }
        
        this.app = app;
        this.isInitialized = true;
        
        // Expose globally for cross-module access
        window.zeniteRouter = this;
        
        // PRIMARY LISTENER: hashchange handles ALL navigation
        // This is the SINGLE SOURCE OF TRUTH for route changes
        window.addEventListener('hashchange', () => {
            if (this.isNavigating) return;
            console.log('[ROUTER] HashChange detected:', window.location.hash);
            this.handleRoute();
        });
        
        // SECONDARY LISTENER: popstate for browser back/forward buttons
        // Syncs state object with route processing
        window.addEventListener('popstate', (e) => {
            if (this.isNavigating) return;
            
            console.log('[ROUTER] PopState detected:', e.state);
            
            // If we have state, use it; otherwise fall back to hash parsing
            if (e.state?.route) {
                this.processRoute(e.state.route, e.state.param, true);
            } else {
                this.handleRoute();
            }
        });
        
        // Process initial route
        this.handleRoute();
        
        console.log('[ROUTER] Initialized v5.0');
    },

    // ═══════════════════════════════════════════════════════════════════════
    // NAVIGATION METHODS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Navigate to a route. This is the PRIMARY method for programmatic navigation.
     * It changes the hash and lets the hashchange listener handle rendering.
     * 
     * @param {string} route - Route name: 'dashboard', 'sheet', 'netlink', 'login'
     * @param {string|null} param - Route parameter (e.g., character ID)
     * @param {boolean} replace - If true, replace history instead of pushing
     * @param {boolean} skipProcess - If true, only update URL without processing
     */
    navigate(route, param = null, replace = false, skipProcess = false) {
        const safeRoute = sanitizeRouteName(route);
        const safeParam = sanitizeParam(safeRoute, param);

        // Build the hash
        let hash = '#/' + safeRoute;
        if (safeParam) hash += '/' + safeParam;

        const currentHash = window.location.hash;
        
        // Skip if already on same route (unless forced replace)
        if (currentHash === hash && !replace) {
            console.log('[ROUTER] Already on route:', hash);
            return;
        }

        // Set navigating flag to prevent listener loops
        this.isNavigating = true;
        
        const url = window.location.pathname + window.location.search + hash;
        const stateObj = { 
            route: safeRoute, 
            param: safeParam, 
            timestamp: Date.now() 
        };
        
        // Update browser history
        if (replace) {
            window.history.replaceState(stateObj, '', url);
        } else {
            window.history.pushState(stateObj, '', url);
        }

        this.lastProcessedHash = hash;

        // Process route unless skipped
        if (!skipProcess) {
            this.processRoute(safeRoute, safeParam, false);
        }

        this.updateTitle(safeRoute, safeParam);
        
        // Reset flag after microtask to allow next navigation
        queueMicrotask(() => {
            this.isNavigating = false;
        });
    },

    /**
     * Go to a route by directly setting the hash.
     * The hashchange listener will handle the rest.
     * This is the SIMPLEST way to navigate.
     * 
     * @param {string} path - Hash path like '#/dashboard' or '#/sheet/abc123'
     */
    goto(path) {
        const cleanPath = path.startsWith('#') ? path : '#/' + path;
        window.location.hash = cleanPath;
    },

    /**
     * Parse and process the current URL hash.
     * Called by hashchange listener and on initial load.
     */
    handleRoute() {
        const hash = window.location.hash;
        
        // Skip if we just processed this hash (prevents double processing)
        if (hash === this.lastProcessedHash) {
            console.log('[ROUTER] Skipping duplicate hash:', hash);
            return;
        }

        // Handle empty/missing hash: default to dashboard (if logged in) or login
        if (!hash || hash === '#' || hash === '#/') {
            const defaultRoute = (this.app?.user || this.app?.isGuest) ? 'dashboard' : 'login';
            this.navigate(defaultRoute, null, true);
            return;
        }

        // Parse hash: #/route/param
        const parts = hash.slice(2).split('/').filter(p => p);
        const routeName = sanitizeRouteName(parts[0] || 'dashboard');
        const param = sanitizeParam(routeName, parts[1] || null);

        console.log('[ROUTER] HandleRoute:', routeName, param);
        
        this.lastProcessedHash = hash;
        this.processRoute(routeName, param, false);
    },

    // ═══════════════════════════════════════════════════════════════════════
    // ROUTE PROCESSING
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Process a specific route. Updates the app state to match the route.
     * This is where the actual view changes happen.
     * 
     * @param {string} routeName - The route to process
     * @param {string|null} param - Route parameter
     * @param {boolean} fromPopState - True if triggered by browser back/forward
     */
    async processRoute(routeName, param, fromPopState = false) {
        console.log('[ROUTER] Processing:', routeName, param, fromPopState ? '(popstate)' : '');

        // GUARD: Require authentication for protected routes
        if (!this.app.user && !this.app.isGuest && routeName !== 'login') {
            console.log('[ROUTER] Not authenticated, saving pending route and redirecting to login');
            this.pendingRoute = { route: routeName, param };
            
            // Redirect to login without adding to history
            const loginUrl = window.location.pathname + window.location.search + '#/login';
            window.history.replaceState({ route: 'login' }, '', loginUrl);
            this.app.currentView = 'login';
            this.updateTitle('login');
            return;
        }

        // Process each route type
        switch (routeName) {
            case 'dashboard':
                await this._processDashboard(fromPopState);
                break;

            case 'sheet':
                await this._processSheet(param, fromPopState);
                break;

            case 'netlink':
                await this._processNetlink(param, fromPopState);
                break;

            case 'login':
                this._processLogin(fromPopState);
                break;

            default:
                console.warn('[ROUTER] Unknown route:', routeName);
                this.navigate('dashboard', null, true);
        }
    },

    /**
     * Process dashboard route
     */
    async _processDashboard(fromPopState) {
        // Save current character data before leaving sheet
        if (this.app.activeCharId && this.app.char && this.app.chars) {
            try {
                this.app.chars[this.app.activeCharId] = JSON.parse(JSON.stringify(this.app.char));
                this.app.saveLocal?.();
            } catch (e) {
                console.error('[ROUTER] Error saving char before exit:', e);
            }
        }
        
        // Clear sheet state
        this.app.activeCharId = null;
        this.app.char = null;
        this.app.currentView = 'dashboard';
        this.app.diceTrayOpen = false;
        this.app.userMenuOpen = false;
        
        this.updateTitle('dashboard');
        this.pendingRoute = null;
        
        // Update URL silently if not from browser navigation
        if (!fromPopState) {
            this.updateUrl('dashboard');
        }
    },

    /**
     * Process sheet route
     */
    async _processSheet(param, fromPopState) {
        if (!param) {
            this.navigate('dashboard', null, true);
            return;
        }

        // Wait for characters to load
        await this.waitForChars();

        // Check if character exists
        if (!this.app.chars?.[param]) {
            this.app.notify?.('Ficha não encontrada', 'error');
            this.navigate('dashboard', null, true);
            return;
        }

        // Load the character
        const success = this.app.loadCharacter?.(param, true);
        
        if (success) {
            if (!fromPopState) {
                this.updateUrl('sheet', param);
            }
            this.updateTitle('sheet', this.app.char?.name);
        } else {
            this.app.notify?.('Erro ao carregar ficha', 'error');
            this.navigate('dashboard', null, true);
        }
    },

    /**
     * Process netlink route
     */
    async _processNetlink(param, fromPopState) {
        if (!param || !this.app.netlinkEnabled) {
            this.navigate('dashboard', null, true);
            return;
        }

        try {
            const success = await this.app.joinByCode?.(param);
            if (success) {
                this.updateTitle('netlink', this.app.activeCampaign?.name);
                if (!fromPopState) {
                    this.updateUrl('netlink', param);
                }
            }
        } catch (e) {
            console.error('[ROUTER] Error joining campaign:', e);
            this.app.notify?.('Campanha não encontrada', 'error');
            this.navigate('dashboard', null, true);
        }
    },

    /**
     * Process login route
     */
    _processLogin(fromPopState) {
        // Already logged in? Go to dashboard
        if (this.app.user || this.app.isGuest) {
            this.navigate('dashboard', null, true);
            return;
        }
        
        this.app.currentView = 'login';
        
        if (!fromPopState) {
            this.updateUrl('login');
        }
    },

    // ═══════════════════════════════════════════════════════════════════════
    // UTILITY METHODS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Wait for characters data to be loaded (with timeout)
     * @returns {Promise<void>}
     */
    waitForChars() {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 50; // 5 seconds max
            
            const check = () => {
                if (this.app.chars && !this.app.systemLoading) {
                    resolve();
                } else if (attempts >= maxAttempts) {
                    console.warn('[ROUTER] Timeout waiting for chars');
                    resolve(); // Resolve anyway to prevent blocking
                } else {
                    attempts++;
                    setTimeout(check, 100);
                }
            };
            check();
        });
    },

    /**
     * Redirect to pending route after login/authentication
     */
    redirectAfterLogin() {
        const target = this.pendingRoute || { route: 'dashboard', param: null };
        this.pendingRoute = null;
        
        console.log('[ROUTER] Redirecting after login to:', target.route);
        
        // Replace to avoid login page in history
        this.navigate(target.route, target.param, true);
    },

    // ═══════════════════════════════════════════════════════════════════════
    // CONVENIENCE NAVIGATION METHODS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Go back to dashboard. Used by "back" button in character sheet.
     */
    goBack() {
        this.navigate('dashboard', null, false);
    },

    /**
     * Exit character sheet and return to dashboard.
     * Saves character data automatically.
     */
    exitSheet() {
        // Save current character before exiting
        if (this.app.char && this.app.activeCharId && this.app.chars) {
            try {
                this.app.chars[this.app.activeCharId] = JSON.parse(JSON.stringify(this.app.char));
                this.app.saveLocal?.();
                console.log('[ROUTER] Saved character before exit');
            } catch (e) {
                console.error('[ROUTER] Error saving before exit:', e);
            }
        }
        
        // Clear UI state
        this.app.activeCharId = null;
        this.app.char = null;
        this.app.diceTrayOpen = false;
        this.app.showDiceTip = false;
        this.app.userMenuOpen = false;
        this.app.unsavedChanges = false;
        this.app.currentView = 'dashboard';
        
        // Push new history entry (allows forward navigation)
        const hash = '#/dashboard';
        const url = window.location.pathname + window.location.search + hash;
        window.history.pushState({ route: 'dashboard', param: null, timestamp: Date.now() }, '', url);
        
        this.lastProcessedHash = hash;
        this.updateTitle('dashboard');
        
        console.log('[ROUTER] Exited sheet to dashboard');
    },

    /**
     * Force navigation to dashboard (clears state without saving)
     */
    forceDashboard() {
        this.app.activeCharId = null;
        this.app.char = null;
        this.app.currentView = 'dashboard';
        this.app.diceTrayOpen = false;
        
        const hash = '#/dashboard';
        const url = window.location.pathname + window.location.search + hash;
        window.history.pushState({ route: 'dashboard', param: null }, '', url);
        
        this.lastProcessedHash = hash;
        this.updateTitle('dashboard');
    },

    // ═══════════════════════════════════════════════════════════════════════
    // URL & SHARING
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Get the current shareable URL
     * @returns {string}
     */
    getShareableUrl() {
        return window.location.href;
    },

    /**
     * Copy current URL to clipboard
     * @returns {Promise<string|null>}
     */
    async copyCurrentUrl() {
        try {
            const url = this.getShareableUrl();
            await navigator.clipboard.writeText(url);
            this.app.notify?.('Link copiado!', 'success');
            return url;
        } catch (e) {
            console.error('[ROUTER] Error copying URL:', e);
            this.app.notify?.('Erro ao copiar link', 'error');
            return null;
        }
    },

    /**
     * Update URL without triggering navigation (silent update)
     * @param {string} route 
     * @param {string|null} param 
     */
    updateUrl(route, param = null) {
        const safeRoute = sanitizeRouteName(route);
        const safeParam = sanitizeParam(safeRoute, param);

        let hash = '#/' + safeRoute;
        if (safeParam) hash += '/' + safeParam;

        const url = window.location.pathname + window.location.search + hash;
        window.history.replaceState({ route: safeRoute, param: safeParam }, '', url);
        
        this.lastProcessedHash = hash;
    },

    /**
     * Update browser tab title
     * @param {string} route 
     * @param {string|null} subtitle 
     */
    updateTitle(route, subtitle = null) {
        const routeConfig = this.routes[route];
        const title = subtitle || routeConfig?.title || 'ZENITE OS';
        document.title = `ZENITE OS // ${title}`;
    },

    // ═══════════════════════════════════════════════════════════════════════
    // GETTERS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Get the current route from the hash
     * @returns {{ route: string, param: string|null }}
     */
    getCurrentRoute() {
        const hash = window.location.hash;
        if (!hash || hash === '#' || hash === '#/') {
            return { route: 'dashboard', param: null };
        }
        
        const parts = hash.slice(2).split('/').filter(p => p);
        const route = sanitizeRouteName(parts[0]);
        const param = sanitizeParam(route, parts[1]);
        
        return { route, param };
    },

    /**
     * Check if currently on a specific route
     * @param {string} routeName 
     * @returns {boolean}
     */
    isOnRoute(routeName) {
        return this.getCurrentRoute().route === routeName;
    }
};

export default router;
