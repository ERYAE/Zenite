/**
 * ZENITE OS - RPG Core Logic
 * Responsável por cálculos, regras e dados estáticos do sistema.
 */

const RPG = {
    // Definição dos Arquétipos
    archetypes: [
        { class: 'Titã', icon: 'fa-solid fa-shield-halved', focus: 'for', color: 'text-rose-500', desc: 'Resiliência e força bruta.' },
        { class: 'Estrategista', icon: 'fa-solid fa-chess', focus: 'int', color: 'text-cyan-500', desc: 'Análise tática e liderança.' },
        { class: 'Infiltrador', icon: 'fa-solid fa-user-ninja', focus: 'agi', color: 'text-emerald-500', desc: 'Furtividade e precisão.' },
        { class: 'Controlador', icon: 'fa-solid fa-hand-spock', focus: 'pod', color: 'text-violet-500', desc: 'Manipulação de energia.' },
        { class: 'Psíquico', icon: 'fa-solid fa-brain', focus: 'von', color: 'text-amber-500', desc: 'Domínio mental.' }
    ],

    // Tabela de crescimento de atributos por classe
    // [Base Inicial, Multiplicador por Nível]
    statsConfig: {
        'Titã':        { pv: [15, 4], pf: [12, 2], pdf: [12, 2] },
        'Estrategista':{ pv: [12, 2], pf: [15, 4], pdf: [12, 2] },
        'Infiltrador': { pv: [12, 2], pf: [15, 4], pdf: [12, 3] },
        'Controlador': { pv: [12, 2], pf: [12, 2], pdf: [15, 4] },
        'Psíquico':    { pv: [12, 2], pf: [13, 3], pdf: [14, 3] }
    },

    // Função principal de cálculo de status derivados
    calculateDerived(className, levelStr, attrs) {
        const cl = className || 'Titã';
        const lvl = Math.max(1, parseInt(levelStr) || 1);
        
        // Helper seguro para pegar atributo (evita NaN)
        const get = (v) => parseInt(attrs[v] || 0);
        
        // Pega configuração da classe ou usa Titã como fallback
        const cfg = this.statsConfig[cl] || this.statsConfig['Titã'];

        return {
            // PV = (Base + Força) + ((Inc + Força) * (Nível - 1))
            pv: (cfg.pv[0] + get('for')) + ((cfg.pv[1] + get('for')) * (lvl - 1)),
            
            // PF = (Base + Poder) + ((Inc + Poder) * (Nível - 1))
            pf: (cfg.pf[0] + get('pod')) + ((cfg.pf[1] + get('pod')) * (lvl - 1)),
            
            // PDF = (Base + Vontade) + ((Inc + Vontade) * (Nível - 1))
            pdf: (cfg.pdf[0] + get('von')) + ((cfg.pdf[1] + get('von')) * (lvl - 1))
        };
    },

    // Cria um objeto de personagem vazio com a estrutura correta
    createBlankChar(id, wizardData) {
        const calculated = this.calculateDerived(wizardData.class, 1, wizardData.attrs);
        
        return {
            id: id, 
            name: wizardData.name, 
            identity: wizardData.identity, 
            class: wizardData.class, 
            level: 1, 
            age: wizardData.age, 
            photo: wizardData.photo || '', 
            history: wizardData.history, 
            credits: 0,
            missionLog: "", // Novo campo para Diário
            attrs: {...wizardData.attrs},
            stats: { 
                pv: { current: calculated.pv, max: calculated.pv }, 
                pf: { current: calculated.pf, max: calculated.pf }, 
                pdf: { current: calculated.pdf, max: calculated.pdf } 
            },
            inventory: { 
                weapons: [], 
                armor: [], 
                gear: [], 
                backpack: "", 
                social: { people: [], objects: [] } 
            },
            skills: [], 
            powers: { passive: '', active: '', techniques: [], lvl3: '', lvl6: '', lvl9: '', lvl10: '' }
        };
    }
};