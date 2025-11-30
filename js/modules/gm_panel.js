/**
 * ZENITE OS - GM Panel Module
 * Ferramentas exclusivas para o Mestre (Clima, Iniciativa, Notas).
 */

window.GMPanel = function(netLink) {
    return {
        // --- ATMOSFERA / CLIMA ---
        setAtmosphere(type) {
            if (!netLink) return;
            // Atualiza no banco (NetLink cuida do som local via listener)
            netLink.updateCampaignData('atmosphere', type);
        },

        // --- INICIATIVA ---
        // Adiciona alguém à lista de combate
        addToInitiative(name, roll) {
            if (!netLink || !netLink.activeCampaign) return;
            
            let list = netLink.activeCampaign.data.initiative || [];
            list.push({ 
                id: Date.now(), 
                name: name, 
                roll: parseInt(roll) || 0,
                active: false 
            });
            
            // Ordena do maior para o menor
            list.sort((a, b) => b.roll - a.roll);
            
            netLink.updateCampaignData('initiative', list);
        },

        nextTurn() {
            if (!netLink || !netLink.activeCampaign) return;
            let list = netLink.activeCampaign.data.initiative || [];
            if(list.length === 0) return;

            // Encontra quem está ativo
            const activeIdx = list.findIndex(i => i.active);
            
            // Desativa todos
            list = list.map(i => ({...i, active: false}));

            // Passa para o próximo (ou volta pro primeiro)
            let nextIdx = 0;
            if (activeIdx !== -1 && activeIdx < list.length - 1) {
                nextIdx = activeIdx + 1;
            }
            
            list[nextIdx].active = true;
            netLink.updateCampaignData('initiative', list);
        },

        clearInitiative() {
            if (!netLink) return;
            netLink.updateCampaignData('initiative', []);
        },

        removeFromInitiative(index) {
            if (!netLink || !netLink.activeCampaign) return;
            let list = [...netLink.activeCampaign.data.initiative];
            list.splice(index, 1);
            netLink.updateCampaignData('initiative', list);
        },

        // --- NOTAS DO MESTRE ---
        saveNotes(text) {
            if (!netLink) return;
            netLink.updateCampaignData('notes', text);
        }
    };
};