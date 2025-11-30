window.netLinkSystem = function(supabase, user) {
    return {
        campaigns: [], activeCampaign: null, isGM: false, members: [], logs: [],
        
        async init() {
            if(!user) return;
            await this.fetchCampaigns();
        },
        async fetchCampaigns() {
            try {
                const { data } = await supabase.from('campaign_members').select('role, campaign:campaigns(*)').eq('user_id', user.id);
                if (data) this.campaigns = data.map(i => ({...i.campaign, role: i.role}));
            } catch (e) { console.log("NetLink offline"); }
        },
        async createCampaign(name) {
            if (this.campaigns.length >= window.CONFIG.MAX_CAMPAIGNS) return alert("Limite!");
            const code = 'NET-' + Math.random().toString(36).substr(2,6).toUpperCase();
            const { data } = await supabase.from('campaigns').insert([{ gm_id: user.id, name, code }]).select().single();
            if(data) {
                await supabase.from('campaign_members').insert([{ campaign_id: data.id, user_id: user.id, role: 'gm' }]);
                this.fetchCampaigns();
            }
        },
        async joinCampaign(code) {
            const { data: camp } = await supabase.from('campaigns').select().eq('code', code).single();
            if(!camp) return alert("Inválido");
            this.activeCampaign = camp;
            this.isGM = (camp.gm_id === user.id);
            // Realtime logic placeholder (to keep it simple for now)
        },
        broadcastRoll(rollData) {
            // Implementation pending realtime setup
        }
    };
};