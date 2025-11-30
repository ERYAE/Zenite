/**
 * ZENITE OS - Core Controller
 */
function zeniteSystem() {
    return {
        // Estado Global
        loading: true,
        user: null,
        currentView: 'dashboard', // dashboard, sheet, campaign
        
        // Módulos
        netLink: null,
        
        // Dados Locais
        chars: {},
        activeCharId: null,
        char: null, // Personagem ativo (Referência)
        
        // UI States
        wizardOpen: false,
        wizardStep: 1,
        wizardData: {},
        settingsModal: false,
        
        async initSystem() {
            console.log("Zenite: Booting...");
            
            // 1. Inicializa Supabase
            if (window.supabase && window.CONFIG) {
                this.supabase = window.supabase.createClient(window.CONFIG.SUPABASE_URL, window.CONFIG.SUPABASE_KEY);
            }
            
            // 2. Verifica Auth
            const session = await this.checkSession();
            
            // 3. Inicializa NetLink
            this.netLink = window.netLinkSystem(this.supabase, this.user);
            if(this.user) await this.netLink.init();

            // 4. Carrega Dados Locais (Offline/Cache)
            this.loadLocalData();

            this.loading = false;
        },

        async checkSession() {
            if(!this.supabase) return;
            const { data: { session } } = await this.supabase.auth.getSession();
            if(session) {
                this.user = session.user;
                // Carrega perfil da nuvem
                const { data } = await this.supabase.from('profiles').select('config').eq('id', this.user.id).single();
                if(data) this.applyConfig(data.config);
                return session;
            }
        },

        // --- CHARACTER MANAGEMENT ---
        loadCharacter(id) {
            this.char = JSON.parse(JSON.stringify(this.chars[id])); // Deep copy para edição segura
            this.activeCharId = id;
            this.currentView = 'sheet';
            window.SFX.play('click');
        },

        saveCharacter() {
            if(!this.char) return;
            // Recalcula stats antes de salvar
            this.char = window.RPG.recalcStats(this.char);
            
            this.chars[this.activeCharId] = this.char;
            this.saveLocalData();
            
            // Salva na nuvem se logado
            if(this.user) {
                // Aqui você pode implementar o save na tabela 'characters' do Supabase
            }
            window.SFX.play('save');
            alert("Salvo!"); // Feedback simples
        },

        exitCharacter() {
            if(confirm("Salvar antes de sair?")) this.saveCharacter();
            this.char = null;
            this.activeCharId = null;
            this.currentView = 'dashboard';
            window.SFX.setAmbience('none'); // Reseta som
        },

        // --- WIZARD (Criação) ---
        openWizard() {
            this.wizardOpen = true;
            this.wizardStep = 1;
            this.wizardData = { class: '', attrs: {for:0, agi:0, int:0, von:0, pod:0} };
        },
        
        finishWizard() {
            const id = 'z_' + Date.now();
            const newChar = window.RPG.createBlankChar(id, this.wizardData);
            // Aplica stats iniciais
            const charWithStats = window.RPG.recalcStats(newChar);
            
            this.chars[id] = charWithStats;
            this.saveLocalData();
            this.wizardOpen = false;
            this.loadCharacter(id);
        },

        // --- NETLINK (Campanhas) ---
        async enterNetLink(campaign) {
            await this.netLink.enterCampaign(campaign.id);
            this.currentView = 'campaign_lobby';
        },

        // --- UTILS ---
        loadLocalData() {
            const data = localStorage.getItem('zenite_db');
            if(data) this.chars = JSON.parse(data);
        },
        saveLocalData() {
            localStorage.setItem('zenite_db', JSON.stringify(this.chars));
        },
        roll(d) {
            const r = Math.floor(Math.random() * d) + 1;
            alert(`Rolagem D${d}: ${r}`); // Simplificado por enquanto
            window.SFX.play('click');
        },
        
        // --- AUTH ---
        async login(provider) {
            await this.supabase.auth.signInWithOAuth({provider});
        },
        async logout() {
            await this.supabase.auth.signOut();
            window.location.reload();
        }
    };
}