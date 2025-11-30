window.RPG = {
    archetypes: [
        { class: 'Titã', icon: 'fa-solid fa-shield-halved', focus: 'for', color: 'text-rose-500', desc: 'Tanque defensivo e força bruta.' },
        { class: 'Estrategista', icon: 'fa-solid fa-chess', focus: 'int', color: 'text-cyan-500', desc: 'Suporte tático e buffs.' },
        { class: 'Infiltrador', icon: 'fa-solid fa-user-ninja', focus: 'agi', color: 'text-emerald-500', desc: 'Dano crítico e furtividade.' },
        { class: 'Controlador', icon: 'fa-solid fa-hand-spock', focus: 'pod', color: 'text-violet-500', desc: 'Manipulação de campo e energia.' },
        { class: 'Psíquico', icon: 'fa-solid fa-brain', focus: 'von', color: 'text-amber-500', desc: 'Dano mental e interrogação.' }
    ],
    // Criação de personagem vazia atualizada
    createBlankChar(id, wizardData) {
        return {
            id: id,
            name: wizardData.name,
            identity: wizardData.identity || 'Desconhecido', // Identidade Real
            class: wizardData.class,
            level: 1,
            age: wizardData.age || 25,
            photo: wizardData.photo || '',
            history: wizardData.history || '',
            credits: 100,
            missionLog: [], // Novo: Diário de Missão
            statusEffects: [], // Novo: Condições (envenenado, etc)
            
            // Atributos
            attrs: {...wizardData.attrs},
            
            // Stats (Calculados depois)
            stats: { 
                pv: {current: 10, max: 10}, 
                pf: {current: 10, max: 10}, 
                pdf: {current: 10, max: 10} 
            },
            
            inventory: { 
                weapons: [], 
                armor: [], 
                gear: [], 
                backpack: "" 
            },
            powers: { active: '', passive: '' }
        };
    },
    
    // Recalcula stats baseados nos atributos e nível
    recalcStats(char) {
        const statsBase = {
            'Titã':        { pv: [15, 4], pf: [12, 2], pdf: [12, 2] },
            'Estrategista':{ pv: [12, 2], pf: [15, 4], pdf: [12, 2] },
            'Infiltrador': { pv: [12, 2], pf: [15, 4], pdf: [12, 3] },
            'Controlador': { pv: [12, 2], pf: [12, 2], pdf: [15, 4] },
            'Psíquico':    { pv: [12, 2], pf: [13, 3], pdf: [14, 3] }
        };
        const cfg = statsBase[char.class] || statsBase['Titã'];
        const lvl = parseInt(char.level) || 1;
        
        // Fórmulas
        const maxPV = (cfg.pv[0] + parseInt(char.attrs.for)) + ((cfg.pv[1] + parseInt(char.attrs.for)) * (lvl - 1));
        const maxPF = (cfg.pf[0] + parseInt(char.attrs.pod)) + ((cfg.pf[1] + parseInt(char.attrs.pod)) * (lvl - 1));
        const maxPDF = (cfg.pdf[0] + parseInt(char.attrs.von)) + ((cfg.pdf[1] + parseInt(char.attrs.von)) * (lvl - 1));

        // Atualiza apenas os máximos, mantém o atual se possível
        char.stats.pv.max = maxPV;
        char.stats.pf.max = maxPF;
        char.stats.pdf.max = maxPDF;
        
        return char;
    }
};