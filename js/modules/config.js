export const CONSTANTS = {
    MAX_AGENTS: 30,
    SAVE_INTERVAL: 180000, 
    TOAST_DURATION: 3000,
    SUPABASE_URL: 'https://pwjoakajtygmbpezcrix.supabase.co',
    SUPABASE_KEY: 'sb_publishable_ULe02tKpa38keGvz8bEDIw_mJJaBK6j'
};

export const ARCHETYPES = [
    { class: 'Titã', icon: 'fa-solid fa-shield-halved', focus: 'for', color: 'text-rose-500', desc: 'Resiliência e força bruta.' },
    { class: 'Estrategista', icon: 'fa-solid fa-chess', focus: 'int', color: 'text-cyan-500', desc: 'Análise tática e liderança.' },
    { class: 'Infiltrador', icon: 'fa-solid fa-user-ninja', focus: 'agi', color: 'text-emerald-500', desc: 'Furtividade e precisão.' },
    { class: 'Controlador', icon: 'fa-solid fa-hand-spock', focus: 'pod', color: 'text-violet-500', desc: 'Manipulação de energia.' },
    { class: 'Psíquico', icon: 'fa-solid fa-brain', focus: 'von', color: 'text-amber-500', desc: 'Domínio mental.' }
];