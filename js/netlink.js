function netLinkSystem(supabase, user) {
    return {
        campaigns: [],
        activeCampaign: null,
        isGM: false,
        members: [],
        logs: [], // Histórico de dados
        
        // GM TOOLS
        initiativeList: [],
        bestiary: [],
        
        async init() {
            if(!user) return;
            await this.fetchCampaigns();
            
            // Listener Global para Convites (Futuro)
            supabase.channel(`user:${user.id}`).on('broadcast', { event: 'invite' }, payload => {
                SFX.play('success');
                // Notificar convite...
            }).subscribe();
        },

        async createCampaign(name) {
            if (this.campaigns.length >= CONFIG.MAX_CAMPAIGNS) return alert("Limite de campanhas!");
            const code = 'NET-' + Math.random().toString(36).substr(2, 6).toUpperCase();
            const { data, error } = await supabase.from('campaigns').insert([
                { gm_id: user.id, name, code, atmosphere: 'neutral' }
            ]).select().single();
            
            if(data) {
                this.campaigns.push(data);
                this.joinCampaign(data.code, true); // Entra como GM
            }
        },

        async joinCampaign(code, isCreator = false) {
            // 1. Busca Campanha
            const { data: camp } = await supabase.from('campaigns').select().eq('code', code).single();
            if(!camp) return alert("Código inválido.");

            // 2. Entra na sala Realtime
            this.activeCampaign = camp;
            this.isGM = (camp.gm_id === user.id);
            
            const channel = supabase.channel(`campaign:${camp.id}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_logs', filter: `campaign_id=eq.${camp.id}` }, 
                    payload => { this.handleLogUpdate(payload.new); })
                .on('broadcast', { event: 'atmosphere' }, ({payload}) => { this.setAtmosphere(payload.type); })
                .subscribe();

            // 3. Se for player, cria snapshot da ficha
            if(!this.isGM) {
                // Lógica de snapshot...
            }
        },

        // --- GM FUNCTIONS ---
        setAtmosphere(type) {
            // Muda CSS e Audio
            document.body.className = `theme-${type}`; // Ex: theme-rain
            if(type === 'rain') SFX.setAmbiance('rain');
            else if(type === 'combat') SFX.setAmbiance('drone');
            else SFX.setAmbiance(null);
            
            // Se sou GM, avisa todos
            if(this.isGM && this.activeCampaign) {
                supabase.channel(`campaign:${this.activeCampaign.id}`).send({
                    type: 'broadcast', event: 'atmosphere', payload: { type }
                });
                // Salva no banco
                supabase.from('campaigns').update({ atmosphere: type }).eq('id', this.activeCampaign.id).then();
            }
        },

        broadcastRoll(rollData) {
            if(!this.activeCampaign) return;
            const content = `${rollData.result} (${rollData.formula})`;
            supabase.from('campaign_logs').insert([{
                campaign_id: this.activeCampaign.id,
                sender: user.email.split('@')[0], // Nome provisório
                content: content,
                type: 'roll'
            }]).then();
        },

        handleLogUpdate(newLog) {
            this.logs.unshift(newLog);
            if(this.logs.length > 50) this.logs.pop();
            SFX.play('roll'); // Som de dado chegando
        }
    };
}