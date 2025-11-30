window.netLinkSystem = function(supabase, user) {
    return {
        campaigns: [],
        activeCampaign: null,
        isGM: false,
        sessionData: null, // Dados em tempo real
        
        async init() {
            if(!user) return;
            await this.fetchCampaigns();
            
            // Listener Global de Realtime
            supabase.channel('public:campaigns')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns' }, payload => {
                    this.handleCampaignUpdate(payload);
                })
                .subscribe();
        },

        async fetchCampaigns() {
            const { data } = await supabase
                .from('campaign_members')
                .select('role, campaign:campaigns(*)');
            
            if (data) {
                this.campaigns = data.map(item => ({
                    ...item.campaign,
                    role: item.role // 'gm' ou 'player'
                }));
            }
        },

        async createCampaign(name) {
            if (this.campaigns.length >= 15) return alert("Limite de campanhas atingido!");
            
            const code = 'NET-' + Math.random().toString(36).substring(2, 7).toUpperCase();
            
            // 1. Criar Campanha
            const { data: camp, error } = await supabase
                .from('campaigns')
                .insert([{ 
                    name, 
                    code, 
                    gm_id: user.id,
                    data: { 
                        notes: '', 
                        bestiary: [], 
                        initiative: [],
                        atmosphere: 'neutral' // Clima/Ambiente
                    } 
                }])
                .select()
                .single();

            if (error) return alert("Erro ao criar: " + error.message);

            // 2. Add Criador como GM
            await supabase.from('campaign_members').insert([{
                campaign_id: camp.id,
                user_id: user.id,
                role: 'gm'
            }]);

            await this.fetchCampaigns();
        },

        async joinCampaign(code) {
            // Busca campanha pelo código
            const { data: camp } = await supabase.from('campaigns').select().eq('code', code).single();
            if (!camp) return alert("Código inválido.");

            // Verifica se já participa
            const alreadyIn = this.campaigns.find(c => c.id === camp.id);
            if (alreadyIn) return alert("Você já está nesta campanha.");

            await supabase.from('campaign_members').insert([{
                campaign_id: camp.id,
                user_id: user.id,
                role: 'player'
            }]);

            await this.fetchCampaigns();
        },

        async enterCampaign(campId) {
            const camp = this.campaigns.find(c => c.id === campId);
            if(!camp) return;
            
            this.activeCampaign = camp;
            this.isGM = (camp.role === 'gm');
            
            // Carregar estado atual
            if(this.activeCampaign.data && this.activeCampaign.data.atmosphere) {
                window.SFX.setAmbience(this.activeCampaign.data.atmosphere);
            }

            console.log("NetLink: Conectado a " + camp.name);
        },

        // --- GM TOOLS ---
        async updateCampaignData(key, value) {
            if(!this.isGM || !this.activeCampaign) return;
            
            const newData = { ...this.activeCampaign.data, [key]: value };
            this.activeCampaign.data = newData;

            // Sincroniza com o banco
            await supabase
                .from('campaigns')
                .update({ data: newData })
                .eq('id', this.activeCampaign.id);
                
            // Se for atmosfera, atualiza som local também
            if(key === 'atmosphere') window.SFX.setAmbience(value);
        },

        handleCampaignUpdate(payload) {
            // Se a atualização for na campanha que estou vendo agora
            if (this.activeCampaign && payload.new.id === this.activeCampaign.id) {
                this.activeCampaign = { ...this.activeCampaign, ...payload.new };
                // Sincroniza ambiente para os jogadores
                if (this.activeCampaign.data.atmosphere) {
                    window.SFX.setAmbience(this.activeCampaign.data.atmosphere);
                }
            }
            // Atualiza lista
            this.fetchCampaigns();
        }
    };
};