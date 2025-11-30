window.CONFIG = {
    // Sistema
    MAX_AGENTS_LOCAL: 30,
    MAX_CAMPAIGNS: 15, // Limite para não sobrecarregar
    SAVE_INTERVAL: 180000, // 3 minutos
    
    // Supabase (Suas chaves)
    SUPABASE_URL: 'https://pwjoakajtygmbpezcrix.supabase.co',
    SUPABASE_KEY: 'sb_publishable_ULe02tKpa38keGvz8bEDIw_mJJaBK6j', // Cuidado em produção, use variáveis de ambiente se possível no Vercel

    // Temas Visuais
    THEMES: {
        'cyan': { hex: '#0ea5e9', rgb: '14, 165, 233' },
        'purple': { hex: '#d946ef', rgb: '217, 70, 239' },
        'gold': { hex: '#eab308', rgb: '234, 179, 8' },
        'red': { hex: '#ef4444', rgb: '239, 68, 68' }, // Bom para modo Combate
    },

    // Arquétipos (Definição fixa do jogo)
    ARCHETYPES: [
        { class: 'Titã', icon: 'fa-solid fa-shield-halved', focus: 'for', color: 'text-rose-500', desc: 'Tanque defensivo e força bruta.' },
        { class: 'Estrategista', icon: 'fa-solid fa-chess', focus: 'int', color: 'text-cyan-500', desc: 'Suporte tático e buffs.' },
        { class: 'Infiltrador', icon: 'fa-solid fa-user-ninja', focus: 'agi', color: 'text-emerald-500', desc: 'Dano crítico e furtividade.' },
        { class: 'Controlador', icon: 'fa-solid fa-hand-spock', focus: 'pod', color: 'text-violet-500', desc: 'Manipulação de campo e energia.' },
        { class: 'Psíquico', icon: 'fa-solid fa-brain', focus: 'von', color: 'text-amber-500', desc: 'Dano mental e interrogação.' }
    ]
};