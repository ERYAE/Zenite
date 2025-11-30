/**
 * ZENITE OS - RPG Definitions
 * Contém apenas dados estáticos (Arquétipos, Tabelas) e Factory.
 * A lógica matemática foi movida para o SheetModule.
 */

window.RPG = {
    // Definição das Classes e Ícones
    archetypes: [
        { class: 'Titã', icon: 'fa-solid fa-shield-halved', focus: 'for', color: 'text-rose-500', desc: 'Tanque defensivo e força bruta.' },
        { class: 'Estrategista', icon: 'fa-solid fa-chess', focus: 'int', color: 'text-cyan-500', desc: 'Suporte tático e buffs.' },
        { class: 'Infiltrador', icon: 'fa-solid fa-user-ninja', focus: 'agi', color: 'text-emerald-500', desc: 'Dano crítico e furtividade.' },
        { class: 'Controlador', icon: 'fa-solid fa-hand-spock', focus: 'pod', color: 'text-violet-500', desc: 'Manipulação de campo e energia.' },
        { class: 'Psíquico', icon: 'fa-solid fa-brain', focus: 'von', color: 'text-amber-500', desc: 'Dano mental e interrogação.' }
    ],

    // Factory: Cria um objeto JSON limpo para novos personagens
    createBlankChar(id, wizardData) {
        return {
            id: id,
            name: wizardData.name,
            identity: wizardData.identity || 'Desconhecido',
            class: wizardData.class,
            level: 1,
            age: wizardData.age || 25,
            photo: wizardData.photo || '',
            history: wizardData.history || '',
            credits: 0,
            missionLog: [], 
            statusEffects: [],
            
            // Atributos Iniciais
            attrs: {...wizardData.attrs},
            
            // Stats Base (Serão recalculados pelo SheetModule ao carregar)
            stats: { 
                pv: {current: 10, max: 10}, 
                pf: {current: 10, max: 10}, 
                pdf: {current: 10, max: 10} 
            },
            
            inventory: { weapons: [], armor: [], gear: [], social: {people:[], objects:[]}, backpack: "" },
            powers: { active: '', passive: '', techniques: [], lvl3:'', lvl6:'', lvl9:'', lvl10:'' },
            skills: []
        };
    }
};