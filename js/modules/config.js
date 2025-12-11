/**
 * Copyright 2025 Zenite - Todos os direitos reservados
 * Projeto desenvolvido com assistncia de IA
 */

// Variáveis sensíveis vêm de .env.local (Vite: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
// Vercel: configurado nas environment variables do projeto
export const CONSTANTS = {
    MAX_ALUNOS: 30,
    SAVE_INTERVAL: 180000, 
    TOAST_DURATION: 3000,
    SUPABASE_URL: typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL 
        ? import.meta.env.VITE_SUPABASE_URL 
        : 'https://pwjoakajtygmbpezcrix.supabase.co',
    SUPABASE_KEY: typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY 
        ? import.meta.env.VITE_SUPABASE_ANON_KEY 
        : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3am9ha2FqdHlnbWJwZXpjcml4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzMxNjY3NzQsImV4cCI6MjA0ODc0Mjc3NH0.zzMKhsqLQqJCGCLWBqBkOjQzqBPbxKQXKjRSqMXoYKg'
};

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE FLAGS - NetLink sempre habilitado (flag removida)
// ═══════════════════════════════════════════════════════════════════════════════
export const FEATURES = {
    NETLINK_ENABLED: true
};

export const ARCHETYPES = [
    { class: 'Titã', icon: 'fa-solid fa-shield-halved', focus: 'for', color: 'text-rose-500', desc: 'Resiliência e força bruta.' },
    { class: 'Estrategista', icon: 'fa-solid fa-chess', focus: 'int', color: 'text-cyan-500', desc: 'Análise tática e liderança.' },
    { class: 'Infiltrador', icon: 'fa-solid fa-user-ninja', focus: 'agi', color: 'text-emerald-500', desc: 'Furtividade e precisão.' },
    { class: 'Controlador', icon: 'fa-solid fa-hand-spock', focus: 'pod', color: 'text-violet-500', desc: 'Manipulação de energia.' },
    { class: 'Psíquico', icon: 'fa-solid fa-brain', focus: 'von', color: 'text-amber-500', desc: 'Domínio mental.' }
];