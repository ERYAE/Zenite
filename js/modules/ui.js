import { playSFX } from './audio.js';
import { CONSTANTS, ARCHETYPES } from './config.js';
import { sanitizeChar, calculateBaseStats, formatDateForFilename } from './utils.js';

export const uiLogic = {
    toggleSetting(key, val=null) {
        if(val !== null) { 
            this.settings[key] = val; 
            if(key === 'themeColor') this.applyTheme(val); 
        } else { 
            this.settings[key] = !this.settings[key]; 
        }
        
        // Aplica modo compacto
        if(key === 'compactMode') {
            this.applyCompactMode();
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

    applyTheme(color) {
        const root = document.documentElement; 
        const map = { 
            'cyan': '#0ea5e9', 
            'purple': '#d946ef', 
            'gold': '#eab308',
            'red': '#ef4444'
        };
        const hex = map[color] || map['cyan'];
        const r = parseInt(hex.slice(1, 3), 16); 
        const g = parseInt(hex.slice(3, 5), 16); 
        const b = parseInt(hex.slice(5, 7), 16);
        
        root.style.setProperty('--neon-core', hex); 
        root.style.setProperty('--neon-rgb', `${r}, ${g}, ${b}`);
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
        this.wizardData.attrs = {for:-1, agi:-1, int:-1, von:-1, pod:-1}; 
        this.wizardData.attrs[a.focus] = 0; 
        this.wizardFocusAttr = a.focus; 
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
        this.loadCharacter(id); 
        this.notify('Agente inicializado com sucesso!', 'success');
    },

    loadCharacter(id, skipPush = false) {
        if(!this.chars[id]) {
            return this.notify('Erro ao carregar personagem.', 'error');
        }
        
        if (!skipPush) {
            history.pushState({ view: 'sheet', id: id }, "Ficha", "#sheet");
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
    },
    
    askDeleteChar(id) { 
        const charName = this.chars[id]?.name || 'este personagem';
        
        this.askConfirm(
            'ELIMINAR PERMANENTEMENTE?', 
            `"${charName}" será deletado para sempre. Esta ação é irreversível.`, 
            'danger', 
            async () => { 
                // Verifica se estamos vendo este personagem
                const wasViewing = this.activeCharId === id;
                
                delete this.chars[id]; 
                this.saveLocal(); 
                
                if(!this.isGuest && this.user) {
                    this.unsavedChanges = true;
                    await this.syncCloud(false); // Força sync imediato
                }
                
                this.updateAgentCount(); 
                this.notify('Personagem eliminado.', 'success'); 
                
                // Se estava vendo a ficha deletada, volta para dashboard
                if (wasViewing) {
                    this.activeCharId = null;
                    this.char = null;
                    this.currentView = 'dash';
                }
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
        if (this.unsavedChanges && !this.isGuest && !fromHistory) { 
            this.triggerShake(); 
            return; 
        }
        
        if(this.char && this.activeCharId) { 
            this.chars[this.activeCharId] = JSON.parse(JSON.stringify(this.char)); 
            this.updateAgentCount(); 
        } 
        
        this.saveLocal(); 
        
        if (!this.isGuest && this.unsavedChanges) {
            this.autoSaveEnabled = true;
            this.debouncedSaveFunc();
        }
        
        this.diceTrayOpen = false; 
        this.showDiceTip = false; 
        this.userMenuOpen = false;
        this.currentView = 'dashboard'; 
        this.activeCharId = null;
        
        if (!fromHistory && window.location.hash === '#sheet') { 
            history.back(); 
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
        document.getElementById('file-input').click(); 
    },
    
    initCropper(e) { 
        const file = e.target.files[0]; 
        if(!file) return; 
        
        const reader = new FileReader(); 
        reader.onload = (evt) => { 
            const img = document.getElementById('crop-target');
            if(!img) return; 
            
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
            playSFX('success');
            this.notify(">>> HACKER MODE ACTIVATED <<<", "success");
        } else {
            document.body.classList.remove('theme-hacker');
            localStorage.removeItem('zenite_hacker_mode');
            playSFX('click');
            this.notify("System mode restored.", "info");
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
        
        this.logoClickTimer = setTimeout(() => { 
            this.logoClickCount = 0; 
        }, 400);
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
        const startX = e.clientX; 
        const startY = e.clientY;
        const startLeft = this.trayPosition.x; 
        const startTop = this.trayPosition.y;
        
        trayEl.style.transition = 'none';
        
        const moveHandler = (ev) => {
            if(!this.isDraggingTray) return;
            const dx = ev.clientX - startX; 
            const dy = ev.clientY - startY;
            trayEl.style.left = `${startLeft + dx}px`; 
            trayEl.style.top = `${startTop + dy}px`;
        };
        
        const upHandler = (ev) => {
            this.isDraggingTray = false;
            document.removeEventListener('mousemove', moveHandler); 
            document.removeEventListener('mouseup', upHandler);
            
            const dx = ev.clientX - startX; 
            const dy = ev.clientY - startY;
            this.trayPosition.x = startLeft + dx; 
            this.trayPosition.y = startTop + dy;
            
            if(trayEl) trayEl.style.transition = '';
            this.saveLocal(); 
        };
        
        document.addEventListener('mousemove', moveHandler); 
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
    }
};