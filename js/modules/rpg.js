// Regras de Negócio do RPG (Classes, Status, Dados)

export const ARCHETYPES = [
    { class: 'Titã', icon: 'fa-solid fa-shield-halved', focus: 'for', color: 'text-rose-500', desc: 'Resiliência e força bruta.' },
    { class: 'Estrategista', icon: 'fa-solid fa-chess', focus: 'int', color: 'text-cyan-500', desc: 'Análise tática e liderança.' },
    { class: 'Infiltrador', icon: 'fa-solid fa-user-ninja', focus: 'agi', color: 'text-emerald-500', desc: 'Furtividade e precisão.' },
    { class: 'Controlador', icon: 'fa-solid fa-hand-spock', focus: 'pod', color: 'text-violet-500', desc: 'Manipulação de energia.' },
    { class: 'Psíquico', icon: 'fa-solid fa-brain', focus: 'von', color: 'text-amber-500', desc: 'Domínio mental.' }
];

export function calculateStats(className, levelStr, attrs) {
    const lvl = Math.max(1, parseInt(levelStr) || 1); 
    const get = (v) => parseInt(attrs[v] || 0);
    const config = { 
        'Titã':{pv:[15,4],pf:[12,2],pdf:[12,2]}, 'Estrategista':{pv:[12,2],pf:[15,4],pdf:[12,2]}, 
        'Infiltrador':{pv:[12,2],pf:[15,4],pdf:[12,3]}, 'Controlador':{pv:[12,2],pf:[12,2],pdf:[15,4]}, 
        'Psíquico':{pv:[12,2],pf:[13,3],pdf:[14,3]} 
    };
    const cfg = config[className] || config['Titã'];
    return { 
        pv: (cfg.pv[0]+get('for')) + ((cfg.pv[1]+get('for'))*(lvl-1)), 
        pf: (cfg.pf[0]+get('pod')) + ((cfg.pf[1]+get('pod'))*(lvl-1)), 
        pdf: (cfg.pdf[0]+get('von')) + ((cfg.pdf[1]+get('von'))*(lvl-1)) 
    };
}

export function createEmptyChar() {
    return {
        attrs: {for:0, agi:0, int:0, von:0, pod:0},
        stats: { pv:{current:10, max:10}, pf:{current:10, max:10}, pdf:{current:10, max:10} },
        inventory: { weapons:[], armor:[], gear:[], backpack: "", social: { people:[], objects:[]} },
        skills: [], powers: { passive:'', active:'', techniques:[], lvl3:'', lvl6:'', lvl9:'', lvl10:'' }
    };
}

// Garante que o objeto tenha todas as propriedades necessárias (evita erros ao carregar fichas antigas)
export function sanitizeChar(data) {
    if (!data) return null;
    const safe = JSON.parse(JSON.stringify(data));
    const def = createEmptyChar();
    
    safe.attrs = { ...def.attrs, ...safe.attrs };
    safe.stats = { ...def.stats, ...safe.stats };
    ['pv','pf','pdf'].forEach(k => { if(!safe.stats[k]) safe.stats[k] = {current:10, max:10}; });
    
    if (!safe.inventory) safe.inventory = def.inventory;
    ['weapons', 'armor', 'gear'].forEach(k => { if (!safe.inventory[k]) safe.inventory[k] = []; });
    if(!safe.inventory.social) safe.inventory.social = { people:[], objects:[] };
    
    if (!safe.skills) safe.skills = [];
    if (!safe.powers) safe.powers = def.powers;
    if (!safe.powers.techniques) safe.powers.techniques = [];
    
    return safe;
}