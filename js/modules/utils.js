// =============================================================================
// [AI_NOTE] CONFIGURAÇÃO DE VERSÃO
// Sempre que alterar a estrutura de dados do personagem (novos campos, inventories),
// INCREMENTE esta versão e adicione a regra na função 'migrateCharacter' abaixo.
// =============================================================================
export const DATA_VERSION = 1.0;


export function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

export function sanitizeChar(data) {
    if (!data) return null;
    const safe = JSON.parse(JSON.stringify(data));
    
    if (!safe.attrs) safe.attrs = {for:0, agi:0, int:0, von:0, pod:0};
    if (!safe.stats) safe.stats = {};
    if (!safe.stats.pv) safe.stats.pv = {current: 10, max: 10};
    if (!safe.stats.pf) safe.stats.pf = {current: 10, max: 10};
    if (!safe.stats.pdf) safe.stats.pdf = {current: 10, max: 10};
    if (!safe.inventory) safe.inventory = { 
        weapons:[], 
        armor:[], 
        gear:[], 
        backpack: "", 
        social: { people:[], objects:[]} 
    };
    if (!safe.inventory.weapons) safe.inventory.weapons = [];
    if (!safe.inventory.armor) safe.inventory.armor = [];
    if (!safe.inventory.gear) safe.inventory.gear = [];
    if (!safe.inventory.social) safe.inventory.social = { people:[], objects:[] };
    if (!safe.skills) safe.skills = [];
    if (!safe.powers) safe.powers = { 
        passive:'', 
        active:'', 
        techniques:[], 
        lvl3:'', 
        lvl6:'', 
        lvl9:'', 
        lvl10:'' 
    };
    if (!safe.powers.techniques) safe.powers.techniques = [];
    
    return safe;
}

export function calculateBaseStats(className, levelStr, attrs) {
    const cl = className || 'Titã'; 
    const lvl = Math.max(1, parseInt(levelStr) || 1); 
    const get = (v) => parseInt(attrs[v] || 0);
    
    const config = { 
        'Titã':{pv:[15,4],pf:[12,2],pdf:[12,2]}, 
        'Estrategista':{pv:[12,2],pf:[15,4],pdf:[12,2]}, 
        'Infiltrador':{pv:[12,2],pf:[15,4],pdf:[12,3]}, 
        'Controlador':{pv:[12,2],pf:[12,2],pdf:[15,4]}, 
        'Psíquico':{pv:[12,2],pf:[13,3],pdf:[14,3]} 
    };
    
    const cfg = config[cl] || config['Titã'];
    
    return { 
        pv: (cfg.pv[0] + get('for')) + ((cfg.pv[1] + get('for')) * (lvl - 1)), 
        pf: (cfg.pf[0] + get('pod')) + ((cfg.pf[1] + get('pod')) * (lvl - 1)), 
        pdf: (cfg.pdf[0] + get('von')) + ((cfg.pdf[1] + get('von')) * (lvl - 1)) 
    };
}

/**
 * Formata data para nome de arquivo
 * Formato: YYYY-MM-DD_HH-MM
 * Exemplo: 2025-01-15_14-30
 */
export function formatDateForFilename() {
    const now = new Date();
    
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}_${hours}-${minutes}`;
}

/**
 * Valida estrutura de personagem
 */
export function validateChar(char) {
    if (!char || typeof char !== 'object') return false;
    if (!char.id || !char.name) return false;
    if (!char.attrs || typeof char.attrs !== 'object') return false;
    if (!char.stats || typeof char.stats !== 'object') return false;
    return true;
}

/**
 * Deep clone de objeto (evita referências)
 */
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * [CRITICAL] SISTEMA DE MIGRAÇÃO DE DADOS
 * Executa automaticamente ao carregar fichas antigas.
 * * @instruction PARA DESENVOLVEDORES E IAs:
 * 1. Se você adicionar um novo campo no Wizard ou na Ficha (ex: Pets, Veículos):
 * 2. Incremente DATA_VERSION no topo deste arquivo.
 * 3. Adicione um bloco `if (charVersion < X.X)` abaixo para inicializar o novo campo.
 * * @param {Object} char - O objeto do personagem carregado do banco.
 * @returns {Object} - O personagem atualizado com a estrutura nova.
 */
export function migrateCharacter(char) {
    if (!char) return null;

    // Se já está atualizada, retorna direto
    if (charVersion >= DATA_VERSION) return char;

    const charVersion = char.version || 0.5;

    console.log(`[MIGRATION] Atualizando Agente ${char.name} da v${charVersion} para v${DATA_VERSION}`);

    // --- CORREÇÕES ESTRUTURAIS ---

    // 1. Garante LastAccess (Proteção contra Garbage Collector)
    if (!char.lastAccess) {
        char.lastAccess = Date.now();
    }

    // 2. Garante STATS (PV, PF, PDF)
    if (!char.stats) char.stats = { pv: {}, pf: {}, pdf: {} };
    // Garante que dentro dos stats existam current/max
    ['pv', 'pf', 'pdf'].forEach(stat => {
        if (!char.stats[stat]) char.stats[stat] = { current: 0, max: 0 };
    });

    // 3. Garante INVENTÁRIO COMPLETO
    if (!char.inventory) {
        char.inventory = { 
            weapons: [], armor: [], gear: [], backpack: '', 
            social: { people: [], objects: [] } 
        };
    } else {
        if (!char.inventory.weapons) char.inventory.weapons = [];
        if (!char.inventory.armor) char.inventory.armor = [];
        if (!char.inventory.gear) char.inventory.gear = [];
        if (typeof char.inventory.backpack === 'undefined') char.inventory.backpack = '';

        // Garante a aba SOCIAL
        if (!char.inventory.social) {
            char.inventory.social = { people: [], objects: [] };
        } else {
            if (!char.inventory.social.people) char.inventory.social.people = [];
            if (!char.inventory.social.objects) char.inventory.social.objects = [];
        }
    }

    // 4. Garante ATRIBUTOS 
    if (!char.attrs) {
        char.attrs = { for: 0, agi: 0, int: 0, von: 0, pod: 0 };
    } else {
        // Spread Merge: Mantém existentes, adiciona faltantes com valor 0
        const defaultAttrs = { for: 0, agi: 0, int: 0, von: 0, pod: 0 };
        char.attrs = { ...defaultAttrs, ...char.attrs };
    }

    // 5. Garante PERÍCIAS e PODERES
    if (!char.skills) char.skills = [];
    if (!char.powers) char.powers = { passive: '', active: '', techniques: [] };
    if (!char.powers.techniques) char.powers.techniques = [];

    // --- FIM DA LÓGICA ---

    char.version = DATA_VERSION;
    return char;
}