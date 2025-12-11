import { playSFX } from './audio.js';
import { CONSTANTS, ARCHETYPES } from './config.js';
import { sanitizeChar, calculateBaseStats, formatDateForFilename } from './utils.js';

export const uiLogic = {
    toggleSetting(key, val=null) {
        if(val !== null) { 
            this.settings[key] = val; 
            if(key === 'themeColor') {
                this.applyTheme(val);
                // Achievement: mudou tema
                if (this.incrementStat) this.incrementStat('themeChanges');
            }
        } else { 
            this.settings[key] = !this.settings[key]; 
        }
        
        // Aplica modo compacto
        if(key === 'compactMode') {
            this.applyCompactMode();
        }
        
        // Aplica modo low performance
        if(key === 'lowPerfMode') {
            this.applyLowPerfMode();
        }
        
        this.updateVisualState();
        this.saveLocal(); 
    },

    applyCompactMode() {
        if (this.isMobile && this.settings.compactMode) {
            document.body.classList.add('compact-mode');
            document.documentElement.style.setProperty('--compact-scale', '0.9');
        } else {
            document.body.classList.remove('compact-mode');
            document.documentElement.style.removeProperty('--compact-scale');
        }
    },
    
    applyLowPerfMode() {
        if (this.settings.lowPerfMode) {
            document.body.classList.add('low-perf');
            // Load low-perf CSS if not already loaded
            if (!document.getElementById('low-perf-css')) {
                const link = document.createElement('link');
                link.id = 'low-perf-css';
                link.rel = 'stylesheet';
                link.href = '/css/low-performance.css';
                document.head.appendChild(link);
            }
            this.notify('Modo Performance ativado! Animações desabilitadas.', 'success');
        } else {
            document.body.classList.remove('low-perf');
            this.notify('Modo Performance desativado.', 'info');
        }
    },

    applyTheme(color) {
        const root = document.documentElement; 
        const themeColors = { 
            // Neon/Cyberpunk
            'cyan': '#0ea5e9', 
            'purple': '#d946ef', 
            'gold': '#eab308',
            'red': '#ef4444',
            // Novos
            'green': '#22c55e',
            'orange': '#f97316',
            'pink': '#ec4899',
            'lime': '#84cc16',
            'emerald': '#10b981',
            'violet': '#8b5cf6',
            'rose': '#f43f5e',
            'amber': '#f59e0b',
            'teal': '#14b8a6',
            'indigo': '#6366f1',
            'fuchsia': '#d946ef',
            'sky': '#0ea5e9'
        };
        const hex = themeColors[color] || themeColors['cyan'];
        const r = parseInt(hex.slice(1, 3), 16); 
        const g = parseInt(hex.slice(3, 5), 16); 
        const b = parseInt(hex.slice(5, 7), 16);
        
        root.style.setProperty('--neon-core', hex); 
        root.style.setProperty('--neon-rgb', `${r}, ${g}, ${b}`);
    },
    
    // Retorna lista de cores disponíveis para UI
    getThemeColors() {
        return [
            { id: 'cyan', name: 'Ciano', hex: '#0ea5e9' },
            { id: 'purple', name: 'Roxo', hex: '#d946ef' },
            { id: 'gold', name: 'Dourado', hex: '#eab308' },
            { id: 'red', name: 'Vermelho', hex: '#ef4444' },
            { id: 'green', name: 'Verde', hex: '#22c55e' },
            { id: 'orange', name: 'Laranja', hex: '#f97316' },
            { id: 'pink', name: 'Rosa', hex: '#ec4899' },
            { id: 'lime', name: 'Lima', hex: '#84cc16' },
            { id: 'emerald', name: 'Esmeralda', hex: '#10b981' },
            { id: 'violet', name: 'Violeta', hex: '#8b5cf6' },
            { id: 'rose', name: 'Rosé', hex: '#f43f5e' },
            { id: 'amber', name: 'Âmbar', hex: '#f59e0b' },
            { id: 'teal', name: 'Azul-Verde', hex: '#14b8a6' },
            { id: 'indigo', name: 'Índigo', hex: '#6366f1' }
        ];
    },

    // Aplica estados visuais (simplificado - cursor removido por performance)
    updateVisualState() {
        const isAuthenticated = this.user || this.isGuest;
        
        // CRT Mode
        if (isAuthenticated && this.settings.crtMode) {
            document.body.classList.add('crt-mode');
        } else {
            document.body.classList.remove('crt-mode');
        }
        
        // Hacker Mode
        const hackerActive = localStorage.getItem('zenite_hacker_mode') === 'true';
        if (hackerActive) {
            this.isHackerMode = true;
            document.body.classList.add('theme-hacker');
        }
    },

    // WIZARD
    openWizard() { 
        if(this.agentCount >= CONSTANTS.MAX_AGENTS) {
            return this.notify('Limite de 30 agentes atingido.', 'error'); 
        }
        
        this.wizardStep = 1; 
        this.wizardPoints = 8; 
        this.wizardData = { 
            class: '', 
            name: '', 
            identity: '', 
            age: '', 
            history: '', 
            photo: null, 
            attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} 
        }; 
        this.wizardOpen = true; 
    },

    selectArchetype(a) { 
        this.wizardData.class = a.class; 
        // CORREÇÃO: Sempre reseta os atributos E os pontos ao selecionar novo arquétipo
        this.wizardData.attrs = {for:-1, agi:-1, int:-1, von:-1, pod:-1}; 
        this.wizardData.attrs[a.focus] = 0; 
        this.wizardFocusAttr = a.focus; 
        this.wizardPoints = 8; // Reseta pontos disponíveis ao trocar de arquétipo
        this.wizardStep = 2; 
        this.$nextTick(() => { this.updateWizardChart(); }); 
    },

    modWizardAttr(k,v) { 
        const c = this.wizardData.attrs[k]; 
        const f = k === this.wizardFocusAttr; 
        
        if(v>0 && this.wizardPoints>0 && c<3) { 
            this.wizardData.attrs[k]++; 
            this.wizardPoints--; 
            this.updateWizardChart(); 
        } 
        
        if(v<0 && c>(f?0:-1)) { 
            this.wizardData.attrs[k]--; 
            this.wizardPoints++; 
            this.updateWizardChart(); 
        } 
    },

    finishWizard() {
        if(!this.wizardData.name) { 
            this.wizardNameError = true; 
            this.notify("Codinome obrigatório!", "warn"); 
            playSFX('error'); 
            setTimeout(() => { this.wizardNameError = false; }, 500); 
            return; 
        }
        
        const id = 'z_'+Date.now(); 
        const calculated = calculateBaseStats(
            this.wizardData.class, 
            1, 
            this.wizardData.attrs
        );
        
        const newChar = sanitizeChar({ 
            id, 
            name: this.wizardData.name, 
            identity: this.wizardData.identity, 
            class: this.wizardData.class, 
            level: 1, 
            age: this.wizardData.age, 
            photo: this.wizardData.photo || '', 
            history: this.wizardData.history, 
            attrs: {...this.wizardData.attrs}, 
            stats: { 
                pv: {current: calculated.pv, max: calculated.pv}, 
                pf: {current: calculated.pf, max: calculated.pf}, 
                pdf: {current: calculated.pdf, max: calculated.pdf} 
            }
        });
        
        this.chars[id] = newChar; 
        this.updateAgentCount(); 
        this.saveLocal(); 
        
        if(!this.isGuest) { 
            this.unsavedChanges = true;
            // Salva automaticamente personagem novo
            this.autoSaveEnabled = true;
            this.debouncedSaveFunc();
        }
        
        this.wizardOpen = false; 
        
        // Verifica se há campanha pendente (usuário veio por link de convite)
        const pendingCampaignCode = sessionStorage.getItem('zenite_pending_campaign');
        
        if (pendingCampaignCode) {
            // Tem campanha pendente - seleciona automaticamente o personagem criado
            sessionStorage.removeItem('zenite_pending_campaign');
            this.selectedCharForCampaign = id;
            
            // Busca a campanha e entra
            this.notify('Personagem criado! Entrando na campanha...', 'success');
            this.joinByCode(pendingCampaignCode);
        } else if (this.wizardFromNetlink) {
            // Se veio do NetLink, volta para o modal ao invés de abrir a ficha
            this.wizardFromNetlink = false;
            this.netlinkModal = true;
            this.loadCampaigns();
            this.notify('Personagem criado! Agora selecione-o para entrar na campanha.', 'success');
        } else {
            this.loadCharacter(id); 
            this.notify('Agente inicializado com sucesso!', 'success');
        }
    },

    loadCharacter(id, skipPush = false) {
        if(!this.chars[id]) {
            return this.notify('Erro ao carregar personagem.', 'error');
        }
        
        // Atualiza URL com hash routing (importa router dinamicamente)
        if (!skipPush) {
            import('./router.js').then(({ router }) => {
                router.updateUrl('sheet', id);
            }).catch(() => {
                // Fallback se router não estiver disponível
                window.location.hash = `#/sheet/${id}`;
            });
        }
        
        this.loadingChar = true; 
        this.activeCharId = id; 
        this.diceTrayOpen = false;
        this.userMenuOpen = false; 
        
        requestAnimationFrame(() => {
            this.char = sanitizeChar(this.chars[id]);
            this.currentView = 'sheet'; 
            this.activeTab = 'profile'; 
            
            if(!this.hasSeenDiceTip) {
                setTimeout(() => this.showDiceTip = true, 2000);
            }
            
            this.$nextTick(() => { 
                this.updateRadarChart(); 
                setTimeout(() => { 
                    this.loadingChar = false; 
                    this.unsavedChanges = false; 
                }, 300); 
            });
        });
        
        return true; // Retorna true para indicar sucesso
    },
    
    askDeleteChar(id) { 
        const charName = this.chars[id]?.name || 'este personagem';
        
        this.askConfirm(
            'ELIMINAR PERMANENTEMENTE?', 
            `"${charName}" será deletado para sempre. Esta ação é irreversível.`, 
            'danger', 
            async () => { 
                // CORREÇÃO: Primeiro sai da view ANTES de deletar para evitar erros Alpine
                const wasViewing = this.activeCharId === id;
                
                if (wasViewing) {
                    this.activeCharId = null;
                    this.char = null;
                    this.currentView = 'dashboard';
                    await new Promise(r => setTimeout(r, 50)); // Aguarda Alpine processar
                }
                
                delete this.chars[id]; 
                this.saveLocal(); 
                
                if(!this.isGuest && this.user) {
                    this.unsavedChanges = true;
                    await this.syncCloud(false);
                }
                
                this.updateAgentCount(); 
                this.notify('Personagem eliminado.', 'success'); 
            }
        ); 
    },
    
    askHardReset() { 
        this.askConfirm(
            'LIMPAR CACHE LOCAL?', 
            'Remove TODOS os dados salvos localmente. Use apenas se houver problemas graves.',
            'danger', 
            () => { 
                localStorage.clear(); 
                window.location.reload(); 
            }
        ); 
    },
    
    askConfirm(title, desc, type, action) { 
        this.confirmData = { title, desc, type, action }; 
        this.confirmOpen = true; 
    },
    
    confirmYes() { 
        if (this.confirmData.action) this.confirmData.action(); 
        this.confirmOpen = false; 
    },
    
    toggleRevertMode() { 
        this.revertConfirmMode = !this.revertConfirmMode; 
        if(this.revertConfirmMode) this.diceTrayOpen = false; 
    },
    
    async performRevert() {
        this.isReverting = true;
        this.diceTrayOpen = false; 
        this.revertConfirmMode = false;
        
        document.body.classList.add('animating-out'); 
        document.body.classList.add('interaction-lock');
        playSFX('discard'); 
        
        setTimeout(async () => {
            try {
                if(this.isGuest) { 
                    this.loadLocal('zenite_guest_db'); 
                } else { 
                    this.loadLocal('zenite_cached_db'); 
                    await this.fetchCloud(); 
                }
                
                if(this.activeCharId && this.chars[this.activeCharId]) { 
                    this.char = sanitizeChar(this.chars[this.activeCharId]); 
                } else { 
                    this.currentView = 'dashboard'; 
                    this.char = null; 
                }
                
                this.unsavedChanges = false;
                
                document.body.classList.remove('animating-out'); 
                document.body.classList.add('animating-in');
                this.notify('Alterações descartadas.', 'success');
                
                setTimeout(() => { 
                    document.body.classList.remove('animating-in'); 
                    document.body.classList.remove('interaction-lock'); 
                    this.isReverting = false; 
                    this.unsavedChanges = false;
                }, 400);
                
            } catch (e) { 
                console.error("Revert Error:", e); 
                this.notify("Erro ao descartar alterações.", "error"); 
                document.body.classList.remove('animating-out'); 
                document.body.classList.remove('interaction-lock'); 
                this.isReverting = false; 
            }
        }, 300);
    },
    
    triggerShake() { 
        this.shakeAlert = true; 
        playSFX('error');
        setTimeout(() => this.shakeAlert = false, 300); 
    },
    
    attemptGoBack() { 
        if (this.unsavedChanges && !this.isGuest) { 
            this.triggerShake(); 
            this.notify("Salve ou descarte as alterações antes de sair.", "warn"); 
            return; 
        } 
        this.saveAndExit(); 
    },
    
    saveAndExit(fromHistory = false) {
        // Bloqueia saída se houver alterações não salvas (exceto modo guest ou popstate)
        if (this.unsavedChanges && !this.isGuest && !fromHistory) { 
            this.triggerShake(); 
            this.notify('Salve ou descarte as alterações.', 'warn');
            return; 
        }
        
        // Salva dados do personagem atual
        if (this.char && this.activeCharId && this.chars) { 
            try {
                this.chars[this.activeCharId] = JSON.parse(JSON.stringify(this.char)); 
                this.updateAgentCount?.(); 
            } catch (e) {
                console.error('[UI] Erro ao salvar personagem:', e);
            }
        } 
        
        this.saveLocal?.(); 
        
        // Sincroniza com nuvem se necessário
        if (!this.isGuest && this.unsavedChanges && this.debouncedSaveFunc) {
            this.autoSaveEnabled = true;
            this.debouncedSaveFunc();
        }
        
        // Limpa estado da UI
        this.diceTrayOpen = false; 
        this.showDiceTip = false; 
        this.userMenuOpen = false;
        this.unsavedChanges = false;
        this.char = null;
        this.activeCharId = null;
        this.currentView = 'dashboard';
        
        // Usa o router para navegar corretamente
        if (window.zeniteRouter) {
            // Se veio do popstate (botão voltar), não adiciona nova entrada no histórico
            if (fromHistory) {
                window.zeniteRouter.updateUrl('dashboard');
            } else {
                window.zeniteRouter.exitSheet?.() || window.zeniteRouter.navigate('dashboard', null, false);
            }
        } else {
            // Fallback se router não disponível
            window.location.hash = '#/dashboard';
        }
    },

    // CHARTS
    _renderChart(id, data, isWizard=false) { 
        const ctx = document.getElementById(id); 
        if(!ctx) return; 
        
        const color = getComputedStyle(document.documentElement)
            .getPropertyValue('--neon-core').trim(); 
        const r = parseInt(color.slice(1, 3), 16); 
        const g = parseInt(color.slice(3, 5), 16); 
        const b = parseInt(color.slice(5, 7), 16); 
        const rgb = `${r},${g},${b}`; 
        
        if (ctx.chart) { 
            ctx.chart.data.datasets[0].data = data; 
            ctx.chart.data.datasets[0].backgroundColor = `rgba(${rgb}, 0.2)`; 
            ctx.chart.data.datasets[0].borderColor = `rgba(${rgb}, 1)`; 
            ctx.chart.update(); 
        } else { 
            ctx.chart = new Chart(ctx, { 
                type: 'radar', 
                data: { 
                    labels: ['FOR','AGI','INT','VON','POD'], 
                    datasets: [{ 
                        data: data, 
                        backgroundColor: `rgba(${rgb}, 0.2)`, 
                        borderColor: `rgba(${rgb}, 1)`, 
                        borderWidth: 2, 
                        pointBackgroundColor: '#fff', 
                        pointRadius: isWizard ? 4 : 3 
                    }] 
                }, 
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false, 
                    scales: { 
                        r: { 
                            min: -1, 
                            max: isWizard ? 4 : 6, 
                            ticks: { display: false, stepSize: 1 }, 
                            grid: { color: 'rgba(255,255,255,0.1)', circular: false }, 
                            angleLines: { color: 'rgba(255,255,255,0.1)' } 
                        } 
                    }, 
                    plugins: { legend: { display: false } }, 
                    transitions: { active: { animation: { duration: 600 } } } 
                } 
            }); 
        } 
    },
    
    updateRadarChart() { 
        if(!this.char || !this.char.attrs) return; 
        const d = [
            this.char.attrs.for, 
            this.char.attrs.agi, 
            this.char.attrs.int, 
            this.char.attrs.von, 
            this.char.attrs.pod
        ]; 
        this._renderChart('radarChart', d); 
    },
    
    updateWizardChart() { 
        const d = [
            this.wizardData.attrs.for, 
            this.wizardData.attrs.agi, 
            this.wizardData.attrs.int, 
            this.wizardData.attrs.von, 
            this.wizardData.attrs.pod
        ]; 
        this._renderChart('wizChart', d, true); 
    },

    // CROPPER
    openImageEditor(context = 'sheet') { 
        this.uploadContext = context; 
        this.cropperMode = 'upload'; // 'upload' ou 'recrop'
        document.getElementById('file-input').click(); 
    },
    
    // Abre o cropper para re-cortar a imagem existente
    openRecropEditor(context = 'sheet') {
        this.uploadContext = context;
        this.cropperMode = 'recrop';
        
        // Pega a foto atual
        let currentPhoto = null;
        if (context === 'wizard') {
            currentPhoto = this.wizardData?.photo;
        } else if (this.char) {
            currentPhoto = this.char.photo;
        }
        
        if (!currentPhoto) {
            this.notify('Nenhuma foto para editar. Faça upload de uma imagem primeiro.', 'warn');
            return;
        }
        
        const img = document.getElementById('crop-target');
        if (!img) return;
        
        img.src = currentPhoto;
        this.cropperOpen = true;
        
        setTimeout(() => {
            if (this.cropperInstance) this.cropperInstance.destroy();
            this.cropperInstance = new Cropper(img, {
                aspectRatio: 1,
                viewMode: 1
            });
        }, 150);
    },
    
    initCropper(e) { 
        const file = e.target.files[0]; 
        if(!file) return; 
        
        const reader = new FileReader(); 
        reader.onload = (evt) => { 
            const img = document.getElementById('crop-target');
            if(!img) return; 
            
            // Salva a imagem original para permitir re-crop
            this.originalCropImage = evt.target.result;
            img.src = evt.target.result; 
            this.cropperOpen = true; 
            
            setTimeout(() => { 
                if(this.cropperInstance) this.cropperInstance.destroy(); 
                this.cropperInstance = new Cropper(img, { 
                    aspectRatio: 1, 
                    viewMode: 1 
                }); 
            }, 150);
        }; 
        reader.readAsDataURL(file); 
        e.target.value = ''; 
    },
    
    applyCrop() { 
        if(!this.cropperInstance) return; 
        
        const result = this.cropperInstance
            .getCroppedCanvas({width:300, height:300})
            .toDataURL('image/jpeg', 0.8); 
        
        if (this.uploadContext === 'wizard') { 
            this.wizardData.photo = result; 
        } else if (this.char) { 
            this.char.photo = result; 
        } 
        
        this.cropperOpen = false; 
        this.notify('Foto atualizada.', 'success'); 
    },

    // BACKUP/RESTORE
    exportData() { 
        const timestamp = formatDateForFilename();
        const userEmail = this.user?.email || 'guest';
        const username = userEmail.split('@')[0];
        const filename = `zenite_backup_${username}_${timestamp}.json`;
        
        const data = {
            version: '2.2',
            exported: new Date().toISOString(),
            user: userEmail,
            chars: this.chars,
            settings: this.settings
        };
        
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a'); 
        a.href = url; 
        a.download = filename; 
        a.click(); 
        
        URL.revokeObjectURL(url);
        a.remove(); 
        
        this.notify('Backup baixado com sucesso.', 'success'); 
    },
    
    triggerFileImport() { 
        document.getElementById('import-file').click(); 
    },
    
    processImport(e) { 
        const f = e.target.files[0]; 
        if(!f) return; 
        
        const r = new FileReader(); 
        r.onload = (evt) => { 
            try { 
                const imported = JSON.parse(evt.target.result); 
                
                // Valida estrutura
                if (!imported.chars) {
                    throw new Error('Arquivo inválido');
                }
                
                // Merge com dados existentes
                this.chars = {...this.chars, ...imported.chars}; 
                
                if (imported.settings) {
                    this.settings = {...this.settings, ...imported.settings};
                    this.applyTheme(this.settings.themeColor);
                }
                
                this.updateAgentCount(); 
                this.unsavedChanges = true; 
                
                this.notify(`${Object.keys(imported.chars).length} personagens importados!`, 'success'); 
                this.configModal = false; 
            } catch(e){ 
                console.error('Import error:', e);
                this.notify('Erro ao importar arquivo.', 'error'); 
            } 
        }; 
        r.readAsText(f); 
    },

    // ESC Handler
    handleEscKey() {
        if (this.systemFailure) return; 
        if (this.confirmOpen) { this.confirmOpen = false; return; }
        if (this.cropperOpen) { this.cropperOpen = false; return; }
        if (this.welcomeModal) { this.welcomeModal = false; return; }
        if (this.netlinkModal) { this.netlinkModal = false; this.netlinkCreateMode = false; return; }
        if (this.configModal) { this.configModal = false; return; }
        if (this.wizardOpen) { this.wizardOpen = false; return; }
        if (this.diceTrayOpen) { this.diceTrayOpen = false; return; }
        if (this.userMenuOpen) { this.userMenuOpen = false; return; }
        if (this.currentView === 'sheet') { this.attemptGoBack(); return; }
    },

    // Hacker Mode Toggle
    toggleHackerMode() {
        this.isHackerMode = !this.isHackerMode;
        if (this.isHackerMode) {
            document.body.classList.add('theme-hacker');
            localStorage.setItem('zenite_hacker_mode', 'true');
            
            // Hacker mode automaticamente ativa CRT
            if (!this.settings.crtMode) {
                this.settings.crtMode = true;
                document.body.classList.add('crt-mode');
                this.saveSettings();
            }
            
            playSFX('success');
            this.notify(">>> HACKER MODE ACTIVATED <<<", "success");
            
            // Achievement: Hacker Elite
            if (this.localStats) {
                this.localStats.hackerMode = true;
                this.saveLocalStats();
                this.checkAchievements();
            }
        } else {
            document.body.classList.remove('theme-hacker');
            localStorage.removeItem('zenite_hacker_mode');
            
            // Desativa CRT junto com hacker mode
            if (this.settings.crtMode) {
                this.settings.crtMode = false;
                document.body.classList.remove('crt-mode');
                this.saveSettings();
            }
            
            playSFX('click');
            this.notify("System mode restored.", "info");
        }
    },

    handleLogoClick() {
        clearTimeout(this.logoClickTimer); 
        this.logoClickCount++;
        
        // Easter egg: 5 cliques rápidos
        if (this.logoClickCount >= 5) {
            this.logoClickCount = 0;
            this.triggerSystemFailure();
            return;
        }
        
        this.logoClickTimer = setTimeout(() => {
            // Se foi um clique simples, vai para dashboard
            if (this.logoClickCount === 1) {
                // Se estiver em campanha, sai dela primeiro
                if (this.activeCampaign) {
                    this.leaveCampaign();
                }
                this.currentView = 'dashboard';
                this.selectedCharId = null;
                this.char = null;
            }
            this.logoClickCount = 0; 
        }, 300);
    },

    ensureTrayOnScreen() {
        if(this.isMobile || this.trayDockMode !== 'float') return;
        this.trayPosition.x = Math.max(10, Math.min(window.innerWidth - 320, this.trayPosition.x));
        this.trayPosition.y = Math.max(60, Math.min(window.innerHeight - 400, this.trayPosition.y));
    },

    // Dice Tray - Só pode abrir na view 'sheet' (ou futuramente no painel do mestre NetLink)
    toggleDiceTray() {
        if (this.isReverting) return;
        
        // Bloqueia abertura fora da ficha de personagem
        if (!this.diceTrayOpen && this.currentView !== 'sheet') {
            // No futuro: permitir também em 'netlink-gm' para o painel do mestre
            return;
        }
        
        this.diceTrayOpen = !this.diceTrayOpen;
        
        if(this.diceTrayOpen) {
            if(!this.hasSeenDiceTip) { 
                this.hasSeenDiceTip = true; 
                this.saveLocal(); 
            }
            this.showDiceTip = false;
            
            // Define posição inicial visível para modo float
            if(this.trayDockMode === 'float' && !this.isMobile) {
                // Se posição não definida ou fora da tela, centraliza
                if(!this.trayPosition.x || !this.trayPosition.y || 
                   this.trayPosition.y > window.innerHeight - 100) {
                    this.trayPosition = {
                        x: Math.max(20, window.innerWidth - 340),
                        y: 100
                    };
                }
                this.ensureTrayOnScreen();
            }
        }
    },
    
    setDockMode(mode) {
        this.trayDockMode = mode;
        if(mode === 'float') { 
            // Posição visível: canto superior direito
            this.trayPosition = { 
                x: Math.max(20, window.innerWidth - 340), 
                y: 100 
            }; 
            this.ensureTrayOnScreen();
        }
        this.saveLocal();
    },
    
    startDragTray(e) {
        if(this.isMobile || this.trayDockMode !== 'float') return;
        if(e.target.closest('button') || e.target.closest('input')) return;
        
        const trayEl = document.getElementById('dice-tray-window');
        if(!trayEl) return;
        
        this.isDraggingTray = true;
        
        // Captura offset do mouse dentro do elemento
        const rect = trayEl.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;
        
        let rafId = null;
        let targetX = this.trayPosition.x;
        let targetY = this.trayPosition.y;
        
        const updatePosition = () => {
            // Atualiza diretamente o state do Alpine
            // Alpine vai atualizar o :style automaticamente
            this.trayPosition.x = targetX;
            this.trayPosition.y = targetY;
            rafId = null;
        };
        
        const moveHandler = (ev) => {
            if(!this.isDraggingTray) return;
            
            // Calcula nova posição baseada no offset do mouse
            targetX = ev.clientX - offsetX;
            targetY = ev.clientY - offsetY;
            
            // Limita à viewport
            const maxX = window.innerWidth - rect.width;
            const maxY = window.innerHeight - rect.height;
            targetX = Math.max(0, Math.min(targetX, maxX));
            targetY = Math.max(0, Math.min(targetY, maxY));
            
            // Throttle com requestAnimationFrame
            if (!rafId) {
                rafId = requestAnimationFrame(updatePosition);
            }
        };
        
        const upHandler = () => {
            this.isDraggingTray = false;
            
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            
            document.removeEventListener('mousemove', moveHandler); 
            document.removeEventListener('mouseup', upHandler);
            
            // Garante posição final
            this.trayPosition.x = targetX;
            this.trayPosition.y = targetY;
            
            this.saveLocal(); 
        };
        
        document.addEventListener('mousemove', moveHandler, { passive: true }); 
        document.addEventListener('mouseup', upHandler);
    },

    askClearAllChars() {
        this.askConfirm(
            'LIMPAR TODAS AS FICHAS?',
            'Isso irá DELETAR PERMANENTEMENTE todos os seus personagens. Esta ação é IRREVERSÍVEL!',
            'danger',
            async () => {
                this.configModal = false;
                this.diceTrayOpen = false;
                this.currentView = 'dashboard';
                this.activeCharId = null;
                
                await new Promise(r => setTimeout(r, 100));
                
                this.char = null;
                this.chars = {};
                this.saveLocal();
                this.updateAgentCount();
                
                if (!this.isGuest && this.user && this.supabase) {
                    try {
                        await this.supabase.from('profiles').update({ data: { config: this.settings } }).eq('id', this.user.id);
                    } catch(e) {
                        console.error('Erro ao limpar nuvem:', e);
                    }
                }
                
                this.notify('Todas as fichas foram removidas.', 'success');
            }
        );
    },

    askDeleteAccount() {
        this.askConfirm(
            'APAGAR CONTA PERMANENTEMENTE?',
            'Isso irá DELETAR sua conta e TODOS os dados. TEM CERTEZA?',
            'danger',
            async () => {
                if (!this.user || !this.supabase) return;
                
                try {
                    await this.supabase.from('profiles').delete().eq('id', this.user.id);
                    localStorage.clear();
                    await this.supabase.auth.signOut();
                    this.notify('Conta deletada com sucesso.', 'success');
                    setTimeout(() => window.location.reload(), 1500);
                } catch(e) {
                    console.error('Erro ao deletar conta:', e);
                    this.notify('Erro ao deletar conta.', 'error');
                }
            }
        );
    },
    
    // ═══════════════════════════════════════════════════════════════════════
    // MACROS DE DADOS
    // ═══════════════════════════════════════════════════════════════════════
    
    openMacrosModal() {
        this.editingMacro = null;
        this.macrosModalOpen = true;
    },
    
    createNewMacro() {
        this.editingMacro = {
            id: null,
            name: '',
            dice: '1d20',
            modifier: 0,
            description: ''
        };
    },
    
    editMacro(macro) {
        this.editingMacro = { ...macro };
    },
    
    saveMacro() {
        if (!this.editingMacro || !this.editingMacro.name.trim()) {
            this.notify('Nome da macro é obrigatório!', 'error');
            return;
        }
        
        if (!this.editingMacro.dice.trim()) {
            this.notify('Dados são obrigatórios!', 'error');
            return;
        }
        
        if (this.editingMacro.id) {
            // Editando macro existente
            const idx = this.diceMacros.findIndex(m => m.id === this.editingMacro.id);
            if (idx !== -1) {
                this.diceMacros[idx] = { ...this.editingMacro };
            }
        } else {
            // Nova macro
            this.diceMacros.push({
                ...this.editingMacro,
                id: 'macro_' + Date.now()
            });
        }
        
        this.editingMacro = null;
        this.saveLocal();
        this.notify('Macro salva!', 'success');
        playSFX('success');
    },
    
    deleteMacro(macroId) {
        this.diceMacros = this.diceMacros.filter(m => m.id !== macroId);
        this.saveLocal();
        this.notify('Macro removida.', 'success');
    },
    
    // Executa uma macro (rola os dados)
    executeMacro(macro, isSecret = false) {
        if (!macro?.dice) {
            this.notify?.('Macro inválida!', 'error');
            return;
        }
        
        // Parse do formato de dados (ex: "2d6+3", "1d20", "3d8-2")
        const diceRegex = /(\d+)d(\d+)([+-]\d+)?/i;
        const match = macro.dice.trim().match(diceRegex);
        
        if (!match) {
            this.notify?.('Formato de dados inválido! Use: 2d6, 1d20+5, 3d8-2', 'error');
            return;
        }
        
        const numDice = parseInt(match[1]) || 1;
        const diceSides = parseInt(match[2]) || 20;
        const modifier = match[3] ? parseInt(match[3]) : 0;
        
        // Se estiver em campanha, usa o sistema de campanha
        if (this.activeCampaign && typeof this.rollForCampaign === 'function') {
            // Salva o motivo e modificador temporariamente
            const oldReason = this.diceReason;
            const oldMod = this.diceMod;
            
            this.diceReason = macro.name;
            this.diceMod = modifier;
            
            // Rola cada dado individualmente e soma
            let totalRolls = 0;
            for (let i = 0; i < numDice; i++) {
                // Para múltiplos dados, só envia o último para o log
                if (i === numDice - 1) {
                    this.rollForCampaign(diceSides, isSecret);
                } else {
                    // Rola localmente sem enviar
                    const roll = Math.floor(Math.random() * diceSides) + 1;
                    totalRolls += roll;
                }
            }
            
            // Restaura valores
            this.diceReason = oldReason;
            this.diceMod = oldMod;
            
        } else {
            // Rolagem local (sem campanha)
            let rolls = [];
            let total = 0;
            for (let i = 0; i < numDice; i++) {
                const roll = Math.floor(Math.random() * diceSides) + 1;
                rolls.push(roll);
                total += roll;
            }
            total += modifier;
            
            const isCrit = diceSides === 20 && numDice === 1 && rolls[0] === 20;
            const isFumble = diceSides === 20 && numDice === 1 && rolls[0] === 1;
            
            const modStr = modifier !== 0 ? (modifier >= 0 ? ` +${modifier}` : ` ${modifier}`) : '';
            const rollsStr = rolls.length > 1 ? ` (${rolls.join('+')})` : '';
            
            let message = `${macro.name}: ${total}${rollsStr}${modStr}`;
            let type = 'info';
            
            if (isCrit) {
                message = `🎯 CRÍTICO! ${macro.name}: ${total}${modStr}`;
                type = 'success';
                playSFX?.('critical');
            } else if (isFumble) {
                message = `💀 FUMBLE! ${macro.name}: ${total}${modStr}`;
                type = 'error';
                playSFX?.('fumble');
            } else {
                playSFX?.('dice');
            }
            
            this.notify?.(message, type);
            console.log(`[MACRO] ${macro.name}: ${rolls.join('+')}${modStr} = ${total}`);
        }
    },
    
    // ═══════════════════════════════════════════════════════════════════════
    // VERIFICAÇÃO DE USERNAME
    // ═══════════════════════════════════════════════════════════════════════
    
    async checkUsername() {
        // Só verifica para usuários logados (não guests)
        if (this.isGuest || !this.user) return;
        
        // CRÍTICO: Verifica se username foi definido no signup (metadata)
        // Evita abrir modal se usuário já escolheu username no registro
        try {
            // Primeiro verifica no profile do Supabase
            if (this.supabase && this.user) {
                const { data: profile } = await this.supabase
                    .from('profiles')
                    .select('username')
                    .eq('id', this.user.id)
                    .single();
                
                // Se tem username no profile, atualiza settings e não abre modal
                if (profile?.username) {
                    if (!this.settings.username) {
                        this.settings.username = profile.username;
                        await this.saveLocal();
                    }
                    return; // Username já definido, não abre modal
                }
            }
        } catch (e) {
            console.error('[USERNAME] Erro ao verificar profile:', e);
        }
        
        // Se não tem username em lugar nenhum, abre modal (contas antigas)
        if (!this.settings.username || this.settings.username.trim() === '') {
            setTimeout(() => {
                this.tempUsername = this.user?.email?.split('@')[0] || '';
                this.usernameModalOpen = true;
            }, 1500);
        }
    },
    
    async confirmUsername() {
        if (!this.tempUsername || this.tempUsername.trim().length < 2) {
            this.notify('Username precisa ter pelo menos 2 caracteres!', 'error');
            playSFX('error');
            return;
        }
        
        const username = this.tempUsername.trim();
        
        // Se estiver no Supabase, usa a função RPC que valida e aplica cooldown
        if (this.user && this.supabase) {
            try {
                const { data, error } = await this.supabase
                    .rpc('change_username', { new_username: username });
                
                if (error) throw error;
                
                if (!data?.success) {
                    this.notify(data?.error || 'Erro ao definir username', 'error');
                    playSFX('error');
                    return;
                }
                
                this.settings.username = username;
                this.saveLocal();
                
                this.usernameModalOpen = false;
                this.notify('Username definido!', 'success');
                playSFX('save');
            } catch (e) {
                console.error('[UI] Erro ao definir username:', e);
                this.notify('Erro ao definir username', 'error');
                playSFX('error');
            }
        } else {
            // Modo offline/guest
            this.settings.username = username;
            this.saveLocal();
            
            this.usernameModalOpen = false;
            this.notify('Username definido!', 'success');
            playSFX('save');
        }
    },
    
    // ═══════════════════════════════════════════════════════════════════════
    // AUTH UI HELPERS - Password Strength, Generation, Email Autocomplete
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Calculate password strength score (0-4)
     * @param {string} password - The password to evaluate
     * @returns {number} Score from 0 (very weak) to 4 (excellent)
     */
    calculatePasswordStrength(password) {
        if (!password) return 0;
        
        let score = 0;
        const p = String(password);
        
        // Length checks
        if (p.length >= 6) score++;
        if (p.length >= 8 && /[A-Z]/.test(p)) score++;
        if (p.length >= 10 && /[0-9]/.test(p)) score++;
        if (p.length >= 12 && /[^A-Za-z0-9]/.test(p)) score++;
        
        return score;
    },

    /**
     * Get password strength label
     * @param {number} score - Strength score (0-4)
     * @returns {string} Localized strength label
     */
    getPasswordStrengthLabel(score) {
        const labels = ['Muito fraca', 'Fraca', 'Razoável', 'Boa', 'Excelente!'];
        return labels[Math.min(score, 4)] || labels[0];
    },

    /**
     * Get password strength color class
     * @param {number} score - Strength score (0-4)
     * @returns {string} Tailwind color class
     */
    getPasswordStrengthColor(score) {
        const colors = ['text-gray-500', 'text-red-400', 'text-yellow-400', 'text-green-400', 'text-cyan-400'];
        return colors[Math.min(score, 4)] || colors[0];
    },

    /**
     * Update password strength meter bars (toggle classes, don't recreate)
     * Call this from @input on password field
     * @param {string} password - Current password value
     */
    updatePasswordStrengthMeter(password) {
        const score = this.calculatePasswordStrength(password);
        
        // Store in app state for Alpine reactivity
        this.passwordStrength = score;
        this.passwordStrengthLabel = this.getPasswordStrengthLabel(score);
        this.passwordStrengthColor = this.getPasswordStrengthColor(score);
        
        // Update DOM bars directly (for non-Alpine scenarios)
        const bars = document.querySelectorAll('[data-strength-bar]');
        bars.forEach((bar, index) => {
            const barIndex = index + 1;
            
            // Remove all color classes first
            bar.classList.remove('bg-red-500', 'bg-yellow-500', 'bg-green-500', 'bg-cyan-500', 'bg-white/10');
            
            // Apply appropriate color based on score
            if (score === 0) {
                bar.classList.add('bg-white/10');
            } else if (barIndex <= score) {
                if (score === 1) bar.classList.add('bg-red-500');
                else if (score === 2) bar.classList.add('bg-yellow-500');
                else if (score === 3) bar.classList.add('bg-green-500');
                else bar.classList.add('bg-cyan-500');
            } else {
                bar.classList.add('bg-white/10');
            }
        });
        
        return score;
    },

    /**
     * Generate a strong random password
     * @param {number} length - Password length (default 16)
     * @returns {string} Generated password
     */
    generateStrongPassword(length = 16) {
        const lowercase = 'abcdefghijklmnopqrstuvwxyz';
        const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const numbers = '0123456789';
        const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
        
        const allChars = lowercase + uppercase + numbers + symbols;
        
        // Ensure at least one of each type
        let password = '';
        password += lowercase[Math.floor(Math.random() * lowercase.length)];
        password += uppercase[Math.floor(Math.random() * uppercase.length)];
        password += numbers[Math.floor(Math.random() * numbers.length)];
        password += symbols[Math.floor(Math.random() * symbols.length)];
        
        // Fill the rest randomly
        for (let i = password.length; i < length; i++) {
            password += allChars[Math.floor(Math.random() * allChars.length)];
        }
        
        // Shuffle the password
        password = password.split('').sort(() => Math.random() - 0.5).join('');
        
        return password;
    },

    /**
     * Handle email input keydown for Tab autocomplete
     * Call this with @keydown on email input
     * @param {KeyboardEvent} event - The keydown event
     * @param {string} currentEmail - Current email value
     * @param {string|null} suggestion - Current suggestion (if any)
     */
    handleEmailKeydown(event, currentEmail, suggestion) {
        // Only handle Tab key
        if (event.key !== 'Tab') return;
        
        // If we have a valid suggestion, use it
        if (suggestion && suggestion !== currentEmail) {
            event.preventDefault(); // Stop focus change
            this.authEmail = suggestion;
            return true;
        }
        
        return false;
    },

    /**
     * Generate email domain suggestions based on partial input
     * @param {string} email - Current email value
     * @returns {string|null} Suggested complete email or null
     */
    getEmailSuggestion(email) {
        if (!email || !email.includes('@')) return null;
        
        const [localPart, domainPart] = email.split('@');
        if (!localPart) return null;
        
        const domains = [
            'gmail.com',
            'outlook.com',
            'hotmail.com',
            'yahoo.com',
            'icloud.com',
            'protonmail.com'
        ];
        
        // If domain part is empty or partial, suggest first matching domain
        if (!domainPart) {
            return `${localPart}@${domains[0]}`;
        }
        
        // Find matching domain
        const matchingDomain = domains.find(d => d.startsWith(domainPart.toLowerCase()));
        if (matchingDomain && matchingDomain !== domainPart.toLowerCase()) {
            return `${localPart}@${matchingDomain}`;
        }
        
        return null;
    },

    /**
     * Initialize auth UI state
     * Call this when auth modal opens
     */
    initAuthUI() {
        this.passwordStrength = 0;
        this.passwordStrengthLabel = 'Muito fraca';
        this.passwordStrengthColor = 'text-gray-500';
        this.emailSuggestion = null;
    },

    // ═══════════════════════════════════════════════════════════════════════
    // EXPORTAR FICHA COMO IMAGEM (PNG)
    // ═══════════════════════════════════════════════════════════════════════
    
    async exportCharAsImage() {
        if (!this.char) {
            this.notify('Nenhum personagem selecionado!', 'error');
            return;
        }
        
        this.notify('Gerando imagem...', 'info');
        
        // Cria canvas para desenhar o cartão
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Dimensões do cartão (estilo ID card)
        canvas.width = 600;
        canvas.height = 900;
        
        // Cor do tema
        const themeColor = getComputedStyle(document.documentElement).getPropertyValue('--neon-core').trim() || '#0ea5e9';
        
        // Background com gradiente
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#0a0a0f');
        gradient.addColorStop(1, '#050508');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Borda neon
        ctx.strokeStyle = themeColor;
        ctx.lineWidth = 3;
        ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
        
        // Header com gradiente
        const headerGradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
        headerGradient.addColorStop(0, themeColor + '40');
        headerGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = headerGradient;
        ctx.fillRect(10, 10, canvas.width - 20, 80);
        
        // Logo/Título
        ctx.fillStyle = themeColor;
        ctx.font = 'bold 28px "Orbitron", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('ZENITE OS', canvas.width / 2, 55);
        
        ctx.fillStyle = '#666';
        ctx.font = '10px monospace';
        ctx.fillText('HERO ACADEMY DATABASE // AGENT FILE', canvas.width / 2, 75);
        
        // Foto do personagem (ou placeholder)
        const photoY = 110;
        const photoSize = 150;
        const photoX = (canvas.width - photoSize) / 2;
        
        // Moldura da foto
        ctx.strokeStyle = themeColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(photoX - 5, photoY - 5, photoSize + 10, photoSize + 10);
        
        if (this.char.photo) {
            try {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = this.char.photo;
                });
                ctx.drawImage(img, photoX, photoY, photoSize, photoSize);
            } catch (e) {
                // Placeholder se falhar
                ctx.fillStyle = '#1a1a1f';
                ctx.fillRect(photoX, photoY, photoSize, photoSize);
                ctx.fillStyle = '#333';
                ctx.font = '40px "Font Awesome 6 Free"';
                ctx.textAlign = 'center';
                ctx.fillText('?', canvas.width / 2, photoY + 90);
            }
        } else {
            ctx.fillStyle = '#1a1a1f';
            ctx.fillRect(photoX, photoY, photoSize, photoSize);
            ctx.fillStyle = themeColor + '60';
            ctx.font = '60px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(this.char.name?.charAt(0)?.toUpperCase() || '?', canvas.width / 2, photoY + 100);
        }
        
        // Nome do personagem
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 32px "Orbitron", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(this.char.name?.toUpperCase() || 'SEM NOME', canvas.width / 2, 310);
        
        // Classe
        ctx.fillStyle = themeColor;
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText(this.char.class?.toUpperCase() || 'SEM CLASSE', canvas.width / 2, 340);
        
        // Identidade (se houver)
        if (this.char.identity) {
            ctx.fillStyle = '#888';
            ctx.font = 'italic 14px sans-serif';
            ctx.fillText(`"${this.char.identity}"`, canvas.width / 2, 365);
        }
        
        // Linha divisória
        ctx.strokeStyle = themeColor + '40';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(50, 390);
        ctx.lineTo(canvas.width - 50, 390);
        ctx.stroke();
        
        // Stats
        const statsY = 420;
        const statsConfig = [
            { label: 'NÍVEL', value: this.char.level || 1, color: themeColor },
            { label: 'IDADE', value: this.char.age || '?', color: '#888' },
            { label: 'PV', value: `${this.char.stats?.pv?.current || 0}/${this.char.stats?.pv?.max || 0}`, color: '#ef4444' },
            { label: 'PF', value: `${this.char.stats?.pf?.current || 0}/${this.char.stats?.pf?.max || 0}`, color: '#3b82f6' },
        ];
        
        const statWidth = (canvas.width - 100) / statsConfig.length;
        statsConfig.forEach((stat, i) => {
            const x = 50 + statWidth * i + statWidth / 2;
            
            ctx.fillStyle = stat.color + '20';
            ctx.fillRect(50 + statWidth * i + 5, statsY - 25, statWidth - 10, 55);
            
            ctx.fillStyle = '#888';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(stat.label, x, statsY - 8);
            
            ctx.fillStyle = stat.color;
            ctx.font = 'bold 20px "Orbitron", sans-serif';
            ctx.fillText(String(stat.value), x, statsY + 18);
        });
        
        // Atributos
        const attrsY = 510;
        ctx.fillStyle = '#666';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('ATRIBUTOS', canvas.width / 2, attrsY);
        
        const attrs = ['FOR', 'AGI', 'INT', 'VON', 'POD'];
        const attrValues = [
            this.char.attrs?.for ?? 0,
            this.char.attrs?.agi ?? 0,
            this.char.attrs?.int ?? 0,
            this.char.attrs?.von ?? 0,
            this.char.attrs?.pod ?? 0
        ];
        
        const attrWidth = (canvas.width - 100) / 5;
        attrs.forEach((attr, i) => {
            const x = 50 + attrWidth * i + attrWidth / 2;
            const val = attrValues[i];
            const valColor = val >= 2 ? '#22c55e' : val >= 0 ? '#eab308' : '#ef4444';
            
            ctx.fillStyle = '#1a1a1f';
            ctx.fillRect(50 + attrWidth * i + 8, attrsY + 10, attrWidth - 16, 50);
            
            ctx.fillStyle = '#888';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(attr, x, attrsY + 28);
            
            ctx.fillStyle = valColor;
            ctx.font = 'bold 22px "Orbitron", sans-serif';
            ctx.fillText(val >= 0 ? `+${val}` : String(val), x, attrsY + 52);
        });
        
        // História (resumida)
        if (this.char.history) {
            const historyY = 600;
            ctx.fillStyle = '#666';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('HISTÓRIA', canvas.width / 2, historyY);
            
            ctx.fillStyle = '#aaa';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            
            // Quebra texto em linhas
            const maxWidth = canvas.width - 80;
            const words = this.char.history.split(' ');
            let line = '';
            let y = historyY + 20;
            let lineCount = 0;
            
            for (let word of words) {
                const testLine = line + word + ' ';
                const metrics = ctx.measureText(testLine);
                if (metrics.width > maxWidth && line !== '') {
                    ctx.fillText(line.trim(), canvas.width / 2, y);
                    line = word + ' ';
                    y += 18;
                    lineCount++;
                    if (lineCount >= 5) {
                        ctx.fillText('...', canvas.width / 2, y);
                        break;
                    }
                } else {
                    line = testLine;
                }
            }
            if (lineCount < 5 && line) {
                ctx.fillText(line.trim(), canvas.width / 2, y);
            }
        }
        
        // Rodapé
        const footerY = canvas.height - 50;
        ctx.strokeStyle = themeColor + '40';
        ctx.beginPath();
        ctx.moveTo(50, footerY);
        ctx.lineTo(canvas.width - 50, footerY);
        ctx.stroke();
        
        ctx.fillStyle = '#444';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`ID: ${this.char.id || 'N/A'}`, canvas.width / 2, footerY + 20);
        ctx.fillText(`Gerado em ${new Date().toLocaleDateString('pt-BR')} via ZENITE OS`, canvas.width / 2, footerY + 35);
        
        // Converte para PNG e baixa
        try {
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `zenite_${this.char.name?.toLowerCase().replace(/\s+/g, '_') || 'agente'}_${Date.now()}.png`;
            link.href = dataUrl;
            link.click();
            
            this.notify('Imagem exportada com sucesso!', 'success');
            playSFX('save');
        } catch (e) {
            console.error('Erro ao exportar imagem:', e);
            this.notify('Erro ao exportar imagem', 'error');
        }
    }
};