/**
 * ZENITE OS - NetLink System (Campaign Manager)
 * Gerencia conexão realtime, campanhas e painel do mestre.
 */

function netLinkSystem(supabase, user) {
    return {
        campaigns: [],
        activeCampaign: null,
        isGM: false,
        members: [],
        logs: [], 
        
        // GM TOOLS
        initiativeList: [],
        bestiary: [],
        
        async init() {
            if(!user) return;
            // AGORA A FUNÇÃO EXISTE!
            await this.fetchCampaigns();
            
            // Listener para convites (Placeholder)
            supabase.channel(`user:${user.id}`).on('broadcast', { event: 'invite' }, payload => {
                if(typeof SFX !== 'undefined') SFX.play('success');
            }).subscribe();
        },

        // --- FUNÇÃO QUE FALTAVA ---
        async fetchCampaigns() {
            try {
                // Busca campanhas onde o usuário é membro ou mestre
                const { data, error } = await supabase
                    .from('campaign_members')
                    .select(`
                        role,
                        campaign:campaigns (
                            id, name, code, atmosphere, gm_id
                        )
                    `)
                    .eq('user_id', user.id);

                if (error) throw error;

                // Formata os dados para facilitar o uso no front
                if (data) {
                    this.campaigns = data.map(item => ({
                        ...item.campaign,
                        role: item.role
                    }));
                }
            } catch (e) {
                console.error("Erro ao buscar campanhas:", e);
            }
        },

        async createCampaign(name) {
            if (this.campaigns.length >= CONFIG.MAX_CAMPAIGNS) return alert("Limite atingido!");
            
            const code = 'NET-' + Math.random().toString(36).substr(2, 6).toUpperCase();
            
            // 1. Cria a campanha
            const { data: camp, error } = await supabase.from('campaigns').insert([
                { gm_id: user.id, name, code, atmosphere: 'neutral' }
            ]).select().single();
            
            if(camp) {
                // 2. Adiciona o criador como membro (GM) automaticamente
                await supabase.from('campaign_members').insert([
                    { campaign_id: camp.id, user_id: user.id, role: 'gm' }
                ]);
                
                await this.fetchCampaigns(); // Atualiza lista
                this.joinCampaign(camp.code); // Entra na sala
            }
        },

        async joinCampaign(code) {
            // 1. Busca detalhes da campanha
            const { data: camp, error } = await supabase.from('campaigns').select().eq('code', code).single();
            if(!camp) return alert("Código inválido.");

            this.activeCampaign = camp;
            this.isGM = (camp.gm_id === user.id);
            
            // 2. Conecta no Realtime
            const channel = supabase.channel(`campaign:${camp.id}`)
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'campaign_logs', filter: `campaign_id=eq.${camp.id}` }, 
                    payload => { this.handleLogUpdate(payload.new); })
                .on('broadcast', { event: 'atmosphere' }, ({payload}) => { this.setAtmosphere(payload.type); })
                .subscribe();

            // Carrega logs antigos
            this.fetchLogs(camp.id);
        },

        async fetchLogs(campaignId) {
            const { data } = await supabase.from('campaign_logs')
                .select('*')
                .eq('campaign_id', campaignId)
                .order('created_at', { ascending: false })
                .limit(50);
            if(data) this.logs = data;
        },

        // --- GM & PLAYER ACTIONS ---
        setAtmosphere(type) {
            document.body.className = `theme-${type}`;
            
            if(typeof SFX !== 'undefined') {
                if(type === 'rain') SFX.setAmbiance('rain');
                else if(type === 'combat') SFX.setAmbiance('drone');
                else SFX.setAmbiance(null);
            }
            
            if(this.isGM && this.activeCampaign) {
                supabase.channel(`campaign:${this.activeCampaign.id}`).send({
                    type: 'broadcast', event: 'atmosphere', payload: { type }
                });
                supabase.from('campaigns').update({ atmosphere: type }).eq('id', this.activeCampaign.id).then();
            }
        },

        broadcastRoll(rollData) {
            if(!this.activeCampaign) return;
            const content = `${rollData.result} (${rollData.formula})`;
            supabase.from('campaign_logs').insert([{
                campaign_id: this.activeCampaign.id,
                sender: user.email.split('@')[0], 
                content: content,
                type: 'roll'
            }]).then();
        },

        handleLogUpdate(newLog) {
            this.logs.unshift(newLog);
            if(this.logs.length > 50) this.logs.pop();
            if(typeof SFX !== 'undefined') SFX.play('roll');
        }
    };
}