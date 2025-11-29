/**
 * ZENITE OS - Main Controller v76.0
 * Integração: Audio, NetLink, RPG Core, UI
 */

// Variáveis de Performance (Mouse)
let cursorX = -100, cursorY = -100;
let isCursorHover = false;
let renderRafId = null;

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function zeniteSystem() {
    return {
        // --- STATES ---
        systemLoading: true, loadingProgress: 0, loadingText: 'BOOT',
        loadingChar: false, notifications: [], user: null, isGuest: false,
        userMenuOpen: false, authLoading: false, authMsg: '', authMsgType: '',
        
        // --- MODULES ---
        netLink: null, // Sistema de Campanha (Carregado dinamicamente)
        
        // --- DATA ---
        chars: {}, activeCharId: null, char: null, agentCount: 0,
        currentView: 'dashboard', activeTab: 'profile', logisticsTab: 'inventory', searchQuery: '',
        
        // --- WIDGETS ---
        diceTrayOpen: false, trayDockMode: 'float', trayPosition: { x: window.innerWidth - 350, y: window.innerHeight - 500 },
        isDraggingTray: false, dragOffset: { x: 0, y: 0 },
        showDiceTip: false, hasSeenDiceTip: false,
        diceLog: [], lastRoll: '--', lastNatural: 0, lastFaces: 20, diceMod: 0, diceReason: '',
        
        // --- UX/SECRETS ---
        konamiBuffer: [], logoClickCount: 0, logoClickTimer: null, systemFailure: false,
        revertConfirmMode: false, isReverting: false, shakeAlert: false,
        isMobile: window.innerWidth < 768,

        // --- MODALS ---
        configModal: false, wizardOpen: false, cropperOpen: false, cropperInstance: null, uploadContext: 'char',
        confirmOpen: false, confirmData: { title:'', desc:'', action:null, type:'danger' },
        
        // --- WIZARD ---
        wizardStep: 1, wizardPoints: 8, wizardData: { class: '', name: '', identity: '', age: '', history: '', photo: null, attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} }, wizardFocusAttr: '',
        
        // --- CONFIGS ---
        settings: {
            mouseTrail: true, compactMode: false, performanceMode: false, 
            crtMode: true, sfxEnabled: true, themeColor: 'cyan'
        },
        
        unsavedChanges: false, isSyncing: false, saveStatus: 'idle', supabase: null, debouncedSaveFunc: null,

        // Getter para Arquétipos (Vem do rpg.js)
        get archetypes() { return RPG.archetypes; },

        get filteredChars() {
            if (!this.searchQuery) return this.chars;
            const q = this.searchQuery.toLowerCase();
            const result = {};
            Object.keys(this.chars).forEach(id => {
                const c = this.chars[id];
                if ((c.name && c.name.toLowerCase().includes(q)) || (c.class && c.class.toLowerCase().includes(q))) {
                    result[id] = c;
                }
            });
            return result;
        },

        // --- INIT & BOOT ---
        async initSystem() {
            this.loadingProgress = 10; this.loadingText = 'CORE SYSTEM';
            setTimeout(() => { if(this.systemLoading) this.systemLoading = false; }, 8000);
            
            // Bloqueio de saída
            window.addEventListener('beforeunload', (e) => { 
                if (this.unsavedChanges && !this.isGuest) { e.preventDefault(); e.returnValue = 'Alterações pendentes.'; } 
            });

            try {
                await new Promise(r => setTimeout(r, 300));
                
                // Conexão Supabase
                if (typeof window.supabase !== 'undefined') {
                    this.supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, {
                        auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
                    });
                }
                this.loadingProgress = 30; this.loadingText = 'AUTHENTICATING';
                
                this.debouncedSaveFunc = debounce(() => { this.saveLocal(); }, 1000);
                this.setupListeners();
                this.setupCursorEngine(); 
                this.setupWatchers();

                this.loadingProgress = 50; this.loadingText = 'LOADING CACHE';
                
                // Autenticação & Carregamento
                const isGuest = localStorage.getItem('zenite_is_guest') === 'true';
                if (isGuest) { 
                    this.isGuest = true; 
                    this.loadLocal('zenite_guest_db'); 
                } else {
                    this.loadLocal('zenite_cached_db');
                    if(this.supabase) {
                        try {
                            const { data: { session } } = await this.supabase.auth.getSession();
                            if (session) { 
                                this.user = session.user; 
                                this.loadingText = 'SYNCING CLOUD'; 
                                this.loadingProgress = 70; 
                                await this.fetchCloud();
                                
                                // INICIALIZA NETLINK (CAMPANHAS)
                                this.netLink = netLinkSystem(this.supabase, this.user);
                                this.netLink.init();
                            }
                        } catch(e) { this.notify("Modo Offline", "warn"); }
                        
                        this.supabase.auth.onAuthStateChange(async (event, session) => {
                            if (event === 'SIGNED_IN' && session) { 
                                if (this.user?.id === session.user.id) return;
                                this.user = session.user; 
                                this.isGuest = false; 
                                localStorage.removeItem('zenite_is_guest'); 
                                await this.fetchCloud();
                                // Re-init NetLink
                                this.netLink = netLinkSystem(this.supabase, this.user);
                                this.netLink.init();
                            } else if (event === 'SIGNED_OUT') { 
                                this.user = null; this.chars = {}; this.currentView = 'dashboard'; 
                            }
                        });
                    }
                }

                this.loadingProgress = 90; this.loadingText = 'APPLYING THEME';
                this.applyTheme(this.settings.themeColor);
                if(this.settings.compactMode && this.isMobile) document.body.classList.add('compact-mode');
                if(this.settings.performanceMode) document.body.classList.add('performance-mode');
                
                // Sincroniza SFX global
                if (typeof SFX !== 'undefined') SFX.toggle(this.settings.sfxEnabled);
                this.updateVisualState();
                
                this.updateAgentCount();
                setInterval(() => { if (this.user && this.unsavedChanges && !this.isSyncing) this.syncCloud(true); }, CONSTANTS.SAVE_INTERVAL);

                this.loadingProgress = 100; this.loadingText = 'READY';
                setTimeout(() => { this.systemLoading = false; }, 500);

            } catch (err) { 
                console.error("Boot Error:", err); 
                this.notify("Erro na inicialização.", "error"); 
                this.systemLoading = false; 
            }
        },

        // --- CORE FUNCTIONS (Delegadas para Módulos) ---
        
        recalcDerivedStats() { 
            if(!this.char) return; 
            // Usa o novo módulo RPG
            const newStats = RPG.calculateDerived(this.char.class, this.char.level, this.char.attrs);
            
            const c = this.char;
            const diffPv = (c.stats.pv.max || newStats.pv) - c.stats.pv.current;
            const diffPf = (c.stats.pf.max || newStats.pf) - c.stats.pf.current;
            const diffPdf = (c.stats.pdf.max || newStats.pdf) - c.stats.pdf.current;

            c.stats.pv.max = newStats.pv;
            c.stats.pv.current = Math.max(0, newStats.pv - diffPv);
            c.stats.pf.max = newStats.pf;
            c.stats.pf.current = Math.max(0, newStats.pf - diffPf);
            c.stats.pdf.max = newStats.pdf;
            c.stats.pdf.current = Math.max(0, newStats.pdf - diffPdf);
        },

        modAttr(key, val) { 
            const c = this.char; 
            if ((val > 0 && c.attrs[key] < 6) || (val < 0 && c.attrs[key] > -1)) { 
                c.attrs[key] += val; 
                this.recalcDerivedStats(); 
                this.updateRadarChart(); 
            } 
        },

        finishWizard() {
            if(!this.wizardData.name) { this.notify("Codinome obrigatório!", "warn"); return; }
            const id = 'z_'+Date.now();
            
            // Usa RPG para criar ficha
            const newChar = RPG.createBlankChar(id, this.wizardData);
            
            this.chars[id] = newChar; 
            this.updateAgentCount(); 
            this.saveLocal();
            
            if(!this.isGuest) { 
                this.unsavedChanges = true; 
                this.syncCloud(true); 
            }
            
            this.wizardOpen = false;
            history.replaceState({ view: 'sheet', id: id }, "Ficha", "#sheet");
            this.loadCharacter(id, true);
            this.notify('Agente Inicializado.', 'success');
        },

        // --- NEW FEATURES ---

        // 1. Exportar ID Card (Requer html2canvas)
        exportIdentityCard() {
            // Nota: Adicione id="character-sheet-content" na div principal da ficha no HTML
            const element = document.querySelector('main'); 
            if(!element) return;
            
            this.notify("Gerando ID Card...", "info");
            SFX.play('click');
            
            html2canvas(element, {
                backgroundColor: '#050507',
                scale: 2, // Alta resolução
                useCORS: true, // Para imagens externas
                ignoreElements: (el) => el.classList.contains('no-print') // Ignore botões se quiser
            }).then(canvas => {
                const link = document.createElement('a');
                link.download = `ID_${this.char.name}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
                SFX.play('save');
                this.notify("ID Card exportado!", "success");
            });
        },

        // 2. Roll Dice (Agora com som atualizado)
        roll(s) {
            SFX.play('click'); // Click ao apertar
            const arr = new Uint32Array(1); 
            window.crypto.getRandomValues(arr); 
            const n = (arr[0] % s) + 1; 
            const m = parseInt(this.diceMod || 0); 
            
            this.lastNatural = n; 
            this.lastFaces = s; 
            this.lastRoll = n + m;
            
            let formulaStr = `D${s}`; 
            if (m !== 0) formulaStr += (m > 0 ? `+${m}` : `${m}`);
            
            const rollData = {
                id: Date.now(), 
                time: new Date().toLocaleTimeString(), 
                formula: formulaStr, 
                result: n+m, 
                crit: n===s, 
                fumble: n===1, 
                reason: this.diceReason
            };

            this.diceLog.unshift(rollData);
            this.diceReason = ''; 
            
            if (this.isMobile && this.diceLog.length > 10) this.diceLog.pop();
            else if (!this.isMobile && this.diceLog.length > 100) this.diceLog.pop();

            // NetLink Broadcast (Se estiver em campanha)
            if(this.netLink && this.netLink.activeCampaign) {
                this.netLink.broadcastRoll(rollData);
            }
        },

        // --- UI & LISTENERS ---
        setupListeners() {
            window.addEventListener('pageshow', (event) => { if (event.persisted) window.location.reload(); });
            window.addEventListener('resize', () => { this.isMobile = window.innerWidth < 768; this.ensureTrayOnScreen(); });
            window.addEventListener('popstate', (event) => {
                if (this.currentView === 'sheet' && this.unsavedChanges && !this.isGuest) { 
                    history.pushState(null, null, location.href); this.triggerShake(); this.notify("Salve antes de sair!", "warn"); return; 
                }
                if (this.currentView === 'sheet' || this.wizardOpen || this.configModal) { 
                    if(this.currentView === 'sheet') this.saveAndExit(true); 
                    this.wizardOpen = false; this.configModal = false; this.cropperOpen = false; 
                }
            });
            
            // SFX Listeners Inteligentes
            let lastHovered = null;
            document.addEventListener('click', (e) => { 
                if(e.target.closest('button, a, .cursor-pointer')) SFX.play('click'); 
            });
            document.addEventListener('mouseover', (e) => {
                const target = e.target.closest('button, a, .cursor-pointer');
                if (target && target !== lastHovered) {
                    SFX.play('hover');
                    lastHovered = target;
                } else if (!target) {
                    lastHovered = null;
                }
            });
        },

        // --- VISUAL STATE MANAGER ---
        updateVisualState() {
            const isAuthenticated = this.user || this.isGuest;
            
            // Cursor
            if (isAuthenticated && this.settings.mouseTrail && !this.settings.performanceMode && !this.isMobile) {
                document.body.classList.add('custom-cursor-active');
            } else {
                document.body.classList.remove('custom-cursor-active');
            }

            // CRT
            if (isAuthenticated && this.settings.crtMode) {
                document.body.classList.add('crt-mode');
            } else {
                document.body.classList.remove('crt-mode');
            }
            
            // Audio Update
            if(typeof SFX !== 'undefined') SFX.toggle(this.settings.sfxEnabled);
        },

        // ... (Mantém funções auxiliares como toggleSetting, applyTheme, saveAndExit, etc. iguais ao anterior, mas chamando updateVisualState) ...
        
        toggleSetting(key, val=null) {
            if(val !== null) { this.settings[key] = val; if(key === 'themeColor') this.applyTheme(val); } 
            else { 
                this.settings[key] = !this.settings[key]; 
                if(key === 'compactMode') { if(this.isMobile) document.body.classList.toggle('compact-mode', this.settings.compactMode); }
                if(key === 'performanceMode') document.body.classList.toggle('performance-mode', this.settings.performanceMode); 
                // CRT e SFX tratados no updateVisualState
            }
            this.updateVisualState(); 
            this.saveLocal(); 
            if(!this.isGuest && this.user) { this.unsavedChanges = true; this.syncCloud(true); }
        },

        // ... (Funções de modal, cropper, exportData mantidas iguais) ...
        
        // --- SECRETS ---
        handleKeys(e) {
            const key = e.key.toLowerCase();
            const konamiCode = ['arrowup','arrowup','arrowdown','arrowdown','arrowleft','arrowright','arrowleft','arrowright','b','a'];
            this.konamiBuffer.push(key);
            if (this.konamiBuffer.length > konamiCode.length) this.konamiBuffer.shift();
            if (JSON.stringify(this.konamiBuffer) === JSON.stringify(konamiCode)) {
                document.body.classList.toggle('theme-hacker');
                if(document.body.classList.contains('theme-hacker')) { 
                    SFX.play('success'); 
                    this.notify("SYSTEM OVERRIDE: HACKER MODE", "success"); 
                } else { 
                    SFX.play('click'); 
                    this.notify("SYSTEM NORMAL", "info"); 
                }
                this.konamiBuffer = [];
            }
        },

        handleLogoClick() {
            clearTimeout(this.logoClickTimer); 
            this.logoClickCount++;
            
            if (this.logoClickCount >= 5) {
                this.logoClickCount = 0;
                this.triggerSystemFailure();
                return;
            }
            
            this.logoClickTimer = setTimeout(() => { this.logoClickCount = 0; }, 2000);
            
            if (!this.systemFailure) {
                 if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(()=>{});
                } else if (document.exitFullscreen) {
                    document.exitFullscreen();
                }
            }
        },

        triggerSystemFailure() {
            SFX.play('glitch'); 
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch((err) => { console.log("Fullscreen blocked:", err); });
            }
            this.systemFailure = true; 
            setTimeout(() => { 
                this.systemFailure = false; 
                SFX.play('discard'); 
            }, 5000);
        },

        // ... (Resto das funções como loadCharacter, askDelete, etc. mantidas) ...
        
        // --- CHART & HELPERS (IMPORTANTE: Copie as funções _renderChart, updateRadarChart, etc. aqui) ---
        _renderChart(id, data, isWizard=false) { const ctx = document.getElementById(id); if(!ctx) return; const color = getComputedStyle(document.documentElement).getPropertyValue('--neon-core').trim(); const r = parseInt(color.slice(1, 3), 16); const g = parseInt(color.slice(3, 5), 16); const b = parseInt(color.slice(5, 7), 16); const rgb = `${r},${g},${b}`; if (ctx.chart) { ctx.chart.data.datasets[0].data = data; ctx.chart.data.datasets[0].backgroundColor = `rgba(${rgb}, 0.2)`; ctx.chart.data.datasets[0].borderColor = `rgba(${rgb}, 1)`; ctx.chart.update(); } else { ctx.chart = new Chart(ctx, { type: 'radar', data: { labels: ['FOR','AGI','INT','VON','POD'], datasets: [{ data: data, backgroundColor: `rgba(${rgb}, 0.2)`, borderColor: `rgba(${rgb}, 1)`, borderWidth: 2, pointBackgroundColor: '#fff', pointRadius: isWizard ? 4 : 3 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { r: { min: -1, max: isWizard ? 4 : 6, ticks: { display: false, stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.1)', circular: false }, angleLines: { color: 'rgba(255,255,255,0.1)' } } }, plugins: { legend: { display: false } }, transitions: { active: { animation: { duration: 600 } } } } }); } },
        updateRadarChart() { if(!this.char) return; const d = [this.char.attrs.for, this.char.attrs.agi, this.char.attrs.int, this.char.attrs.von, this.char.attrs.pod]; this._renderChart('radarChart', d); },
        updateWizardChart() { const d = [this.wizardData.attrs.for, this.wizardData.attrs.agi, this.wizardData.attrs.int, this.wizardData.attrs.von, this.wizardData.attrs.pod]; this._renderChart('wizChart', d, true); },
        
        notify(msg, type='info') { const id = Date.now(); this.notifications.push({id, message: msg, type}); setTimeout(() => { this.notifications = this.notifications.filter(n => n.id !== id); }, 3000); },
        openImageEditor(context = 'sheet') { this.uploadContext = context; document.getElementById('file-input').click(); }, 
        initCropper(e) { const file = e.target.files[0]; if(!file) return; const reader = new FileReader(); reader.onload = (evt) => { document.getElementById('crop-target').src = evt.target.result; this.cropperOpen = true; this.$nextTick(() => { if(this.cropperInstance) this.cropperInstance.destroy(); this.cropperInstance = new Cropper(document.getElementById('crop-target'), { aspectRatio: 1, viewMode: 1 }); }); }; reader.readAsDataURL(file); e.target.value = ''; }, 
        applyCrop() { if(!this.cropperInstance) return; const result = this.cropperInstance.getCroppedCanvas({width:300, height:300}).toDataURL('image/jpeg', 0.8); if (this.uploadContext === 'wizard') { this.wizardData.photo = result; } else if (this.char) { this.char.photo = result; } this.cropperOpen = false; this.notify('Foto processada.', 'success'); },
        exportData() { const s = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.chars)); const a = document.createElement('a'); a.href = s; a.download = `zenite_bkp.json`; a.click(); a.remove(); this.notify('Backup baixado.', 'success'); },
        triggerFileImport() { document.getElementById('import-file').click(); },
        processImport(e) { const f = e.target.files[0]; if(!f) return; const r = new FileReader(); r.onload = (evt) => { try { const d = JSON.parse(evt.target.result); this.chars = {...this.chars, ...d}; this.updateAgentCount(); this.saveLocal(); this.unsavedChanges = true; this.notify('Importado!', 'success'); this.configModal = false; } catch(e){ this.notify('Erro arquivo.', 'error'); } }; r.readAsText(f); },
        
        // Funções mantidas do original (sintetizadas para caber)
        modStat(stat, val) { if(!this.char || !this.char.stats[stat]) return; const s = this.char.stats[stat]; s.current = Math.max(0, Math.min(s.max, s.current + val)); },
        addItem(cat) { const defs = { weapons: { name: 'Arma', dmg: '1d6', range: 'C' }, armor: { name: 'Traje', def: '1', pen: '0' }, gear: { name: 'Item', desc: '', qty: 1 }, social_people: { name: 'Nome', role: 'Relação' }, social_objects: { name: 'Objeto', desc: 'Detalhes' } }; if(cat.startsWith('social_')) this.char.inventory.social[cat.split('_')[1]].push({...defs[cat]}); else this.char.inventory[cat].push({...defs[cat]}); },
        deleteItem(cat, i, sub=null) { if(sub) this.char.inventory.social[sub].splice(i,1); else this.char.inventory[cat].splice(i,1); },
        addSkill() { this.char.skills.push({name:'Nova Perícia', level:1}); }, deleteSkill(idx) { this.char.skills.splice(idx,1); }, setSkillLevel(idx, l) { this.char.skills[idx].level = l; },
        addTechnique() { this.char.powers.techniques.push({name:'Técnica', desc:''}); }, deleteTechnique(idx) { this.char.powers.techniques.splice(idx,1); },
        selectArchetype(a) { this.wizardData.class = a.class; this.wizardData.attrs = {for:-1, agi:-1, int:-1, von:-1, pod:-1}; this.wizardData.attrs[a.focus] = 0; this.wizardFocusAttr = a.focus; this.wizardStep = 2; this.$nextTick(() => { this.updateWizardChart(); }); },
        modWizardAttr(k,v) { const c = this.wizardData.attrs[k]; const f = k === this.wizardFocusAttr; if(v>0 && this.wizardPoints>0 && c<3) { this.wizardData.attrs[k]++; this.wizardPoints--; this.updateWizardChart(); } if(v<0 && c>(f?0:-1)) { this.wizardData.attrs[k]--; this.wizardPoints++; this.updateWizardChart(); } },
        askLogout() { this.askConfirm('SAIR?', 'Dados pendentes serão salvos.', 'warn', () => this.logout()); },
        async logout() { this.systemLoading = true; if(this.unsavedChanges && !this.isGuest) { try { await this.syncCloud(true); } catch(e) {} } localStorage.removeItem('zenite_cached_db'); localStorage.removeItem('zenite_is_guest'); if(this.supabase) await this.supabase.auth.signOut(); window.location.reload(); },
        askSwitchToOnline() { this.askConfirm('FICAR ONLINE?', 'Ir para login.', 'info', () => { this.isGuest = false; localStorage.removeItem('zenite_is_guest'); window.location.reload(); }); },
        enterGuest() { this.isGuest = true; localStorage.setItem('zenite_is_guest', 'true'); this.loadLocal('zenite_guest_db'); },
        doSocialAuth(provider) { if(!this.supabase) return this.notify("Erro de conexão.", "error"); this.authLoading = true; this.authMsg = "Conectando..."; this.supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } }).then(({error}) => { if(error) { this.notify(error.message, 'error'); this.authLoading = false; } }); },
        askDeleteChar(id) { this.askConfirm('ELIMINAR?', 'Irreversível.', 'danger', () => { delete this.chars[id]; this.saveLocal(); if(!this.isGuest) this.syncCloud(true); this.updateAgentCount(); this.notify('Deletado.', 'success'); }); },
        askHardReset() { this.askConfirm('LIMPAR TUDO?', 'Apaga cache local.', 'danger', () => { localStorage.clear(); window.location.reload(); }); },
        askConfirm(title, desc, type, action) { this.confirmData = { title, desc, type, action }; this.confirmOpen = true; }, 
        confirmYes() { if (this.confirmData.action) this.confirmData.action(); this.confirmOpen = false; },
        
        // MOUSE SETUP REPLICADO (Fallback de segurança)
        setupCursorEngine() {
            const trail = document.getElementById('mouse-trail');
            if (!window.matchMedia("(pointer: fine)").matches) { if(trail) trail.style.display = 'none'; return; }
            document.addEventListener('mousemove', (e) => { 
                cursorX = e.clientX; cursorY = e.clientY;
                if(this.settings.mouseTrail && !this.isMobile) { isCursorHover = e.target.closest('button, a, input, select, textarea, .cursor-pointer, .draggable-handle') !== null; }
            });
            const renderLoop = () => {
                if (!trail) return;
                const isAuthenticated = this.user || this.isGuest;
                if (isAuthenticated && this.settings.mouseTrail && !this.settings.performanceMode && !this.isMobile) {
                    trail.style.display = 'block'; trail.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0)`; 
                    if(isCursorHover) trail.classList.add('hover-active'); else trail.classList.remove('hover-active');
                    if(trail.style.opacity === '0') trail.style.opacity = '1';
                } else { trail.style.display = 'none'; }
                renderRafId = requestAnimationFrame(renderLoop);
            };
            renderLoop();
        }
    };
}