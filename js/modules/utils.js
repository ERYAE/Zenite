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
    if (!safe.inventory) safe.inventory = { weapons:[], armor:[], gear:[], backpack: "", social: { people:[], objects:[]} };
    if (!safe.inventory.weapons) safe.inventory.weapons = [];
    if (!safe.inventory.armor) safe.inventory.armor = [];
    if (!safe.inventory.gear) safe.inventory.gear = [];
    if (!safe.inventory.social) safe.inventory.social = { people:[], objects:[] };
    if (!safe.skills) safe.skills = [];
    if (!safe.powers) safe.powers = { passive:'', active:'', techniques:[], lvl3:'', lvl6:'', lvl9:'', lvl10:'' };
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
        pv:(cfg.pv[0]+get('for'))+((cfg.pv[1]+get('for'))*(lvl-1)), 
        pf:(cfg.pf[0]+get('pod'))+((cfg.pf[1]+get('pod'))*(lvl-1)), 
        pdf:(cfg.pdf[0]+get('von'))+((cfg.pdf[1]+get('von'))*(lvl-1)) 
    };
}