import { playSFX } from './audio.js';
import { CONSTANTS, ARCHETYPES } from './config.js';
import { sanitizeChar, calculateBaseStats } from './utils.js';

export const uiLogic = {
    // --- AUTH & SETTINGS ---
    toggleSetting(key, val=null) {
        if(val !== null) { this.settings[key] = val; if(key === 'themeColor') this.applyTheme(val); } 
        else { 
            this.settings[key] = !this.settings[key]; 
            if(key === 'compactMode') { if(this.isMobile) document.body.classList.toggle('compact-mode', this.settings.compactMode); }
            if(key === 'crtMode') this.updateVisualState();
        }
        this.updateVisualState(); this.saveLocal(); if(!this.isGuest && this.user) { this.unsavedChanges = true; this.syncCloud(true); }
    },
    applyTheme(color) {
        const root = document.documentElement; const map = { 'cyan': '#0ea5e9', 'purple': '#d946ef', 'gold': '#eab308' };
        const hex = map[color] || map['cyan']; const r = parseInt(hex.slice(1, 3), 16); const g = parseInt(hex.slice(3, 5), 16); const b = parseInt(hex.slice(5, 7), 16);
        root.style.setProperty('--neon-core', hex); root.style.setProperty('--neon-rgb', `${r}, ${g}, ${b}`); 
        const trail = document.getElementById('mouse-trail'); if(trail) trail.style.background = `radial-gradient(circle, rgba(${r}, ${g}, ${b}, 0.2), transparent 70%)`;
    },

    // --- WIZARD ---
    openWizard() { if(this.agentCount >= CONSTANTS.MAX_AGENTS) return this.notify('Limite atingido.', 'error'); this.wizardStep = 1; this.wizardPoints = 8; this.wizardData = { class: '', name: '', identity: '', age: '', history: '', photo: null, attrs: {for:-1, agi:-1, int:-1, von:-1, pod:-1} }; this.wizardFocusAttr = ''; history.pushState({ modal: 'wizard' }, "Wizard", "#new"); this.wizardOpen = true; },
    selectArchetype(a) { this.wizardData.class = a.class; this.wizardData.attrs = {for:-1, agi:-1, int:-1, von:-1, pod:-1}; this.wizardData.attrs[a.focus] = 0; this.wizardFocusAttr = a.focus; this.wizardStep = 2; this.$nextTick(() => { this.updateWizardChart(); }); },
    modWizardAttr(k,v) { const c = this.wizardData.attrs[k]; const f = k === this.wizardFocusAttr; if(v>0 && this.wizardPoints>0 && c<3) { this.wizardData.attrs[k]++; this.wizardPoints--; this.updateWizardChart(); } if(v<0 && c>(f?0:-1)) { this.wizardData.attrs[k]--; this.wizardPoints++; this.updateWizardChart(); } },
    finishWizard() {
        if(!this.wizardData.name) { this.wizardNameError = true; this.notify("Codinome obrigatório!", "warn"); playSFX('error'); setTimeout(() => { this.wizardNameError = false; }, 500); return; }
        const id = 'z_'+Date.now(); 
        const calculated = calculateBaseStats(this.wizardData.class, 1, this.wizardData.attrs);
        const newChar = sanitizeChar({ id, name: this.wizardData.name, identity: this.wizardData.identity, class: this.wizardData.class, level: 1, age: this.wizardData.age, photo: this.wizardData.photo || '', history: this.wizardData.history, credits: 0, attrs: {...this.wizardData.attrs}, stats: { pv: {current: calculated.pv, max: calculated.pv}, pf: {current: calculated.pf, max: calculated.pf}, pdf: {current: calculated.pdf, max: calculated.pdf} }, inventory: { weapons:[], armor:[], gear:[], backpack:"", social:{people:[], objects:[]} }, skills: [], powers: { passive:'', active:'', techniques:[], lvl3:'', lvl6:'', lvl9:'', lvl10:'' } });
        this.chars[id] = newChar; this.updateAgentCount(); this.saveLocal(); 
        if(!this.isGuest) { this.unsavedChanges = true; this.syncCloud(true); }
        this.wizardOpen = false; history.replaceState({ view: 'sheet', id: id }, "Ficha", "#sheet"); this.loadCharacter(id, true); this.notify('Agente Inicializado.', 'success');
    },

    // --- NAVIGATION & UX ---
    loadCharacter(id, skipPush = false) {
        if(!this.chars[id]) return this.notify('Erro ao carregar.', 'error');
        if (!skipPush) history.pushState({ view: 'sheet', id: id }, "Ficha", "#sheet");
        this.loadingChar = true; this.activeCharId = id; this.diceTrayOpen = false; 
        requestAnimationFrame(() => {
            this.char = sanitizeChar(this.chars[id]);
            this.currentView = 'sheet'; this.activeTab = 'profile'; this.diceTrayOpen = false; 
            if(!this.hasSeenDiceTip) setTimeout(() => this.showDiceTip = true, 1000);
            this.$nextTick(() => { this.updateRadarChart(); setTimeout(() => { this.loadingChar = false; this.unsavedChanges = false; }, 300); });
        });
     },
    askDeleteChar(id) { this.askConfirm('ELIMINAR?', 'Irreversível.', 'danger', () => { delete this.chars[id]; this.saveLocal(); if(!this.isGuest) this.syncCloud(true); this.updateAgentCount(); this.notify('Deletado.', 'success'); }); },
    askHardReset() { this.askConfirm('LIMPAR TUDO?', 'Apaga cache local.', 'danger', () => { localStorage.clear(); window.location.reload(); }); },
    askConfirm(title, desc, type, action) { this.confirmData = { title, desc, type, action }; this.confirmOpen = true; }, 
    confirmYes() { if (this.confirmData.action) this.confirmData.action(); this.confirmOpen = false; },
    toggleRevertMode() { this.revertConfirmMode = !this.revertConfirmMode; if(this.revertConfirmMode) this.diceTrayOpen = false; },
    async performRevert() {
        this.isReverting = true; this.diceTrayOpen = false; this.revertConfirmMode = false;
        document.body.classList.add('animating-out'); document.body.classList.add('interaction-lock');
        playSFX('discard'); 
        setTimeout(async () => {
            try {
                if(this.isGuest) { this.loadLocal('zenite_guest_db'); } else { this.loadLocal('zenite_cached_db'); await this.fetchCloud(); }
                if(this.activeCharId && this.chars[this.activeCharId]) { this.char = sanitizeChar(this.chars[this.activeCharId]); } else { this.currentView = 'dashboard'; this.char = null; }
                this.unsavedChanges = false;
                document.body.classList.remove('animating-out'); document.body.classList.add('animating-in');
                this.notify('Dados restaurados.', 'success');
                setTimeout(() => { document.body.classList.remove('animating-in'); document.body.classList.remove('interaction-lock'); this.isReverting = false; }, 400);
            } catch (e) { console.error("Revert Error:", e); this.notify("Erro na restauração.", "error"); document.body.classList.remove('animating-out'); document.body.classList.remove('interaction-lock'); this.isReverting = false; }
        }, 300);
    },
    triggerShake() { this.shakeAlert = true; setTimeout(() => this.shakeAlert = false, 300); },
    attemptGoBack() { if (this.unsavedChanges && !this.isGuest) { this.triggerShake(); this.notify("Salve ou descarte antes de sair.", "warn"); return; } this.saveAndExit(); },
    saveAndExit(fromHistory = false) {
        if (this.unsavedChanges && !this.isGuest && !fromHistory) { this.triggerShake(); return; }
        if(this.char && this.activeCharId) { this.chars[this.activeCharId] = JSON.parse(JSON.stringify(this.char)); this.updateAgentCount(); } 
        this.saveLocal(); if (!this.isGuest && this.unsavedChanges) this.syncCloud(true); 
        this.diceTrayOpen = false; this.showDiceTip = false; this.currentView = 'dashboard'; this.activeCharId = null;
        if (!fromHistory && window.location.hash === '#sheet') { history.back(); }
    },

    // --- VISUAL WIDGETS ---
    ensureTrayOnScreen() {
        if(this.isMobile || this.trayDockMode !== 'float') return;
        this.trayPosition.x = Math.max(10, Math.min(window.innerWidth - 320, this.trayPosition.x));
        this.trayPosition.y = Math.max(60, Math.min(window.innerHeight - 400, this.trayPosition.y));
    },
    updateVisualState() {
        const isAuthenticated = this.user || this.isGuest;
        const showTrail = isAuthenticated && this.settings.mouseTrail && !this.isMobile;
        if (showTrail) { document.body.classList.add('custom-cursor-active'); } 
        else { document.body.classList.remove('custom-cursor-active'); }
        if (isAuthenticated && this.settings.crtMode) { document.body.classList.add('crt-mode'); } 
        else { document.body.classList.remove('crt-mode'); }
    },
    toggleDiceTray() {
        if (this.isReverting) return;
        this.diceTrayOpen = !this.diceTrayOpen;
        if(this.diceTrayOpen) {
            if(!this.hasSeenDiceTip) { this.hasSeenDiceTip = true; this.saveLocal(); }
            this.showDiceTip = false; this.ensureTrayOnScreen();
        }
    },
    setDockMode(mode) {
        this.trayDockMode = mode;
        if(mode === 'float') { this.trayPosition = { x: window.innerWidth - 350, y: window.innerHeight - 500 }; this.ensureTrayOnScreen(); }
    },
    startDragTray(e) {
        if(this.isMobile || this.trayDockMode !== 'float') return;
        if(e.target.closest('button') || e.target.closest('input')) return;
        const trayEl = document.getElementById('dice-tray-window');
        if(!trayEl) return;
        this.isDraggingTray = true;
        const startX = e.clientX; const startY = e.clientY;
        const startLeft = this.trayPosition.x; const startTop = this.trayPosition.y;
        trayEl.style.transition = 'none';
        const moveHandler = (ev) => {
            if(!this.isDraggingTray) return;
            const dx = ev.clientX - startX; const dy = ev.clientY - startY;
            trayEl.style.left = `${startLeft + dx}px`; trayEl.style.top = `${startTop + dy}px`;
        };
        const upHandler = (ev) => {
            this.isDraggingTray = false;
            document.removeEventListener('mousemove', moveHandler); document.removeEventListener('mouseup', upHandler);
            const dx = ev.clientX - startX; const dy = ev.clientY - startY;
            this.trayPosition.x = startLeft + dx; this.trayPosition.y = startTop + dy;
            if(trayEl) trayEl.style.transition = '';
            this.saveLocal(); 
        };
        document.addEventListener('mousemove', moveHandler); document.addEventListener('mouseup', upHandler);
    },

    // --- CHARTS & FX ---
    _renderChart(id, data, isWizard=false) { const ctx = document.getElementById(id); if(!ctx) return; const color = getComputedStyle(document.documentElement).getPropertyValue('--neon-core').trim(); const r = parseInt(color.slice(1, 3), 16); const g = parseInt(color.slice(3, 5), 16); const b = parseInt(color.slice(5, 7), 16); const rgb = `${r},${g},${b}`; if (ctx.chart) { ctx.chart.data.datasets[0].data = data; ctx.chart.data.datasets[0].backgroundColor = `rgba(${rgb}, 0.2)`; ctx.chart.data.datasets[0].borderColor = `rgba(${rgb}, 1)`; ctx.chart.update(); } else { ctx.chart = new Chart(ctx, { type: 'radar', data: { labels: ['FOR','AGI','INT','VON','POD'], datasets: [{ data: data, backgroundColor: `rgba(${rgb}, 0.2)`, borderColor: `rgba(${rgb}, 1)`, borderWidth: 2, pointBackgroundColor: '#fff', pointRadius: isWizard ? 4 : 3 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { r: { min: -1, max: isWizard ? 4 : 6, ticks: { display: false, stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.1)', circular: false }, angleLines: { color: 'rgba(255,255,255,0.1)' } } }, plugins: { legend: { display: false } }, transitions: { active: { animation: { duration: 600 } } } } }); } },
    updateRadarChart() { if(!this.char || !this.char.attrs) return; const d = [this.char.attrs.for, this.char.attrs.agi, this.char.attrs.int, this.char.attrs.von, this.char.attrs.pod]; this._renderChart('radarChart', d); },
    updateWizardChart() { const d = [this.wizardData.attrs.for, this.wizardData.attrs.agi, this.wizardData.attrs.int, this.wizardData.attrs.von, this.wizardData.attrs.pod]; this._renderChart('wizChart', d, true); },
    triggerFX(type) { const el = document.getElementById(type+'-overlay'); if(el) { el.style.opacity='0.4'; setTimeout(()=>el.style.opacity='0', 200); } },
    notify(msg, type='info') { const id = Date.now(); this.notifications.push({id, message: msg, type}); setTimeout(() => { this.notifications = this.notifications.filter(n => n.id !== id); }, 3000); },
    
    // --- FILES & IMAGES ---
    openImageEditor(context = 'sheet') { this.uploadContext = context; document.getElementById('file-input').click(); }, 
    initCropper(e) { const file = e.target.files[0]; if(!file) return; const reader = new FileReader(); reader.onload = (evt) => { document.getElementById('crop-target').src = evt.target.result; this.cropperOpen = true; this.$nextTick(() => { if(this.cropperInstance) this.cropperInstance.destroy(); this.cropperInstance = new Cropper(document.getElementById('crop-target'), { aspectRatio: 1, viewMode: 1 }); }); }; reader.readAsDataURL(file); e.target.value = ''; }, 
    applyCrop() { if(!this.cropperInstance) return; const result = this.cropperInstance.getCroppedCanvas({width:300, height:300}).toDataURL('image/jpeg', 0.8); if (this.uploadContext === 'wizard') { this.wizardData.photo = result; } else if (this.char) { this.char.photo = result; } this.cropperOpen = false; this.notify('Foto processada.', 'success'); },
    exportData() { const s = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.chars)); const a = document.createElement('a'); a.href = s; a.download = `zenite_bkp.json`; a.click(); a.remove(); this.notify('Backup baixado.', 'success'); },
    triggerFileImport() { document.getElementById('import-file').click(); },
    processImport(e) { const f = e.target.files[0]; if(!f) return; const r = new FileReader(); r.onload = (evt) => { try { const d = JSON.parse(evt.target.result); this.chars = {...this.chars, ...d}; this.updateAgentCount(); this.saveLocal(); this.unsavedChanges = true; this.notify('Importado!', 'success'); this.configModal = false; } catch(e){ this.notify('Erro arquivo.', 'error'); } }; r.readAsText(f); },

    // --- INPUTS & SECRETS ---
    handleEscKey() {
        if (this.systemFailure) return; 
        if (this.confirmOpen) { this.confirmOpen = false; return; }
        if (this.cropperOpen) { this.cropperOpen = false; return; }
        if (this.configModal) { this.configModal = false; return; }
        if (this.wizardOpen) { this.wizardOpen = false; return; }
        if (this.diceTrayOpen) { this.diceTrayOpen = false; return; }
        if (this.userMenuOpen) { this.userMenuOpen = false; return; }
        if (this.currentView === 'sheet') { this.attemptGoBack(); return; }
    },
    toggleHackerMode() {
        this.isHackerMode = !this.isHackerMode;
        if (this.isHackerMode) {
            document.body.classList.add('theme-hacker');
            localStorage.setItem('zenite_hacker_mode', 'true');
            playSFX('success');
            this.notify("SYSTEM OVERRIDE: HACKER MODE", "success");
        } else {
            document.body.classList.remove('theme-hacker');
            localStorage.removeItem('zenite_hacker_mode');
            playSFX('click');
            this.notify("SYSTEM NORMAL", "info");
        }
    },
    handleKeys(e) {
        const key = e.key.toLowerCase();
        const konamiCode = ['arrowup','arrowup','arrowdown','arrowdown','arrowleft','arrowright','arrowleft','arrowright','b','a'];
        this.konamiBuffer.push(key);
        if (this.konamiBuffer.length > konamiCode.length) this.konamiBuffer.shift();
        
        if (JSON.stringify(this.konamiBuffer) === JSON.stringify(konamiCode)) {
            this.hackerModeUnlocked = true;
            localStorage.setItem('zenite_hacker_unlocked', 'true');
            
            if (!this.isHackerMode) {
                this.toggleHackerMode();
            } else {
                playSFX('success');
                this.notify("ACESSO RECONHECIDO", "success");
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
        this.logoClickTimer = setTimeout(() => { this.logoClickCount = 0; }, 400);
    },
    triggerSystemFailure() { playSFX('glitch'); this.systemFailure = true; this.minigameActive = false; },
    startMinigame() { this.minigameActive = true; this.minigameClicks = 5; this.moveMinigameTarget(); },
    moveMinigameTarget() { this.minigamePos.x = Math.floor(Math.random() * 80) + 10; this.minigamePos.y = Math.floor(Math.random() * 80) + 10; },
    hitMinigame() {
        playSFX('click');
        this.minigameClicks--;
        if (this.minigameClicks <= 0) {
            playSFX('success');
            this.notify("SISTEMA RESTAURADO", "success");
            this.systemFailure = false;
            this.minigameActive = false;
        } else {
            this.moveMinigameTarget();
        }
    }
};