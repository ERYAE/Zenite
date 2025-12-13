/**
 * Copyright © 2025 Zenite - Todos os direitos reservados
 * Projeto desenvolvido com assistência de IA
 */

// js/modules/changelog.js
// ═══════════════════════════════════════════════════════════════════════════
// ZENITE OS - CHANGELOG
// ═══════════════════════════════════════════════════════════════════════════
// Histórico de atualizações do sistema
// Adicione novos updates no TOPO do array
// Para mostrar changelog novamente: incremente CHANGELOG_VERSION em changelog.version.js
// ═══════════════════════════════════════════════════════════════════════════

import { CHANGELOG_VERSION } from '../../changelog.version.js';

export const CHANGELOG = [
    // ───────────────────────────────────────────────────────────────────
    // SYSTEM EVOLUTION - Persistência e Visual
    // ───────────────────────────────────────────────────────────────────
    
    {
        title: 'SYSTEM EVOLUTION',
        emoji: '🧬',
        isNew: true,
        sections: [
            {
                title: 'Core & Persistência',
                icon: 'fa-database',
                color: 'blue',
                items: [
                    {
                        title: 'Sincronização por Conta',
                        description: 'Changelogs e Welcome Screen agora persistem na conta',
                        details: [
                            'Salvo no banco de dados do usuário',
                            'Não perde status ao limpar cache',
                            'Sincroniza entre dispositivos'
                        ]
                    },
                    {
                        title: 'Compatibilidade Vercel',
                        description: 'Correções críticas de ambiente',
                        details: [
                            'Fallback seguro para variáveis de ambiente',
                            'Correção de erros de deploy',
                            'Melhor estabilidade em produção'
                        ]
                    }
                ]
            },
            {
                title: 'Visual & Performance',
                icon: 'fa-palette',
                color: 'purple',
                items: [
                    {
                        title: 'Achievements Remasterizados',
                        description: 'Nova interface visual para conquistas',
                        details: [
                            'Cards com design Glassmorphism',
                            'Barra de progresso animada',
                            'Enquadramento perfeito na tela',
                            'Animações suaves de entrada/saída'
                        ]
                    },
                    {
                        title: 'Otimização de Imagens',
                        description: 'Uploads agora usam formato WebP',
                        details: [
                            'Arquivos 30% menores',
                            'Maior qualidade visual',
                            'Carregamento mais rápido',
                            'Melhor precisão no recorte (crop)'
                        ]
                    }
                ]
            }
        ]
    },

    // ───────────────────────────────────────────────────────────────────
    // UI/UX FIXES - Correções de Interface e Experiência
    // ───────────────────────────────────────────────────────────────────
    {
        title: 'UI/UX FIXES',
        emoji: '✨',
        isNew: false,
        sections: [
            {
                title: 'Correções de Interface',
                icon: 'fa-sparkles',
                color: 'cyan',
                items: [
                    {
                        title: 'Display Name no Perfil',
                        description: 'Agora mostra o nome de exibição corretamente',
                        details: [
                            'Prioriza display_name sobre username',
                            'Fallback inteligente para username e email',
                            'Visível em perfil próprio e de outros usuários'
                        ]
                    },
                    {
                        title: 'Modal de Login',
                        description: 'Fecha automaticamente após autenticação',
                        details: [
                            'Corrigido para login via email/senha',
                            'Corrigido para OAuth (Google/Discord)',
                            'Navegação automática para dashboard',
                            'Não requer mais reload da página'
                        ]
                    }
                ]
            },
            {
                title: 'Sistema de Notificações',
                icon: 'fa-bell',
                color: 'purple',
                items: [
                    {
                        title: 'Notificações Interativas',
                        description: 'Suporte para ações e botões',
                        details: [
                            'Botões de ação (ACEITAR, IGNORAR)',
                            'Notificações persistentes',
                            'Novos tipos: invite, campaign',
                            'Duração customizada por tipo',
                            'Botão de fechar manual'
                        ]
                    }
                ]
            },
            {
                title: 'Música Ambiente',
                icon: 'fa-music',
                color: 'pink',
                items: [
                    {
                        title: 'Aviso de AdBlocker',
                        description: 'Detecta e informa quando adblocker bloqueia música',
                        details: [
                            'Aviso visual automático',
                            'Instruções claras para desbloquear',
                            'Funciona para GM e jogadores',
                            'Ícone de escudo amarelo'
                        ]
                    }
                ]
            }
        ]
    }
];

// Obtém o update mais recente
export function getLatestUpdate() {
    return CHANGELOG[0] || null;
}

// Verifica se há update novo desde a última visualização (por user.id)
// LEGADO: Usa localStorage - para novos usuários, usar hasNewChangelogAsync
export function hasNewUpdate(userId = null) {
    // Guest ou não logado: usa sistema simples por título
    if (!userId) {
        const lastSeenUpdate = localStorage.getItem('zenite_last_seen_update');
        const latest = CHANGELOG[0];
        return latest && lastSeenUpdate !== latest.title;
    }
    
    // Usuário logado: usa localStorage com chave por userId
    const storageKey = `zenite_changelog_seen_${userId}`;
    const lastSeenVersion = parseInt(localStorage.getItem(storageKey) || '0');
    return CHANGELOG_VERSION > lastSeenVersion;
}

// Marca update como visualizado (por user.id)
// LEGADO: Usa localStorage - para novos usuários, usar markChangelogSeenAsync
export function markUpdateSeen(userId = null) {
    // Guest ou não logado: usa sistema simples por título
    if (!userId) {
        const latest = CHANGELOG[0];
        if (latest) {
            localStorage.setItem('zenite_last_seen_update', latest.title);
        }
        return;
    }
    
    // Usuário logado: salva no localStorage com chave por userId
    const storageKey = `zenite_changelog_seen_${userId}`;
    localStorage.setItem(storageKey, CHANGELOG_VERSION.toString());
}

// ═══════════════════════════════════════════════════════════════════════════
// NOVAS FUNÇÕES COM SUPABASE (persistência no banco)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Verifica se há changelog novo usando Supabase (async)
 * @param {object} supabase - Cliente Supabase
 * @param {string} userId - ID do usuário
 * @param {number|null} cachedVersion - Versão em cache (evita chamada ao banco)
 * @returns {Promise<boolean>} True se há changelog novo
 */
export async function hasNewChangelogAsync(supabase, userId, cachedVersion = null) {
    // Guest: usa localStorage
    if (!userId || !supabase) {
        const lastSeen = localStorage.getItem('zenite_changelog_version_guest');
        return CHANGELOG_VERSION > parseInt(lastSeen || '0');
    }
    
    // Se temos versão em cache, usa ela
    if (cachedVersion !== null) {
        return CHANGELOG_VERSION > cachedVersion;
    }
    
    // Busca do banco
    try {
        const { data, error } = await supabase.rpc('get_user_preferences');
        if (error) throw error;
        
        const seenVersion = data?.[0]?.changelog_version_seen || 0;
        return CHANGELOG_VERSION > seenVersion;
    } catch (e) {
        console.warn('[CHANGELOG] Erro ao verificar no banco, usando localStorage:', e);
        return hasNewUpdate(userId);
    }
}

/**
 * Marca changelog como visto no Supabase (async)
 * @param {object} supabase - Cliente Supabase
 * @param {string} userId - ID do usuário
 */
export async function markChangelogSeenAsync(supabase, userId) {
    // Guest: usa localStorage
    if (!userId || !supabase) {
        localStorage.setItem('zenite_changelog_version_guest', CHANGELOG_VERSION.toString());
        return;
    }
    
    // Salva no banco
    try {
        await supabase.rpc('save_user_preferences', {
            p_changelog_version: CHANGELOG_VERSION
        });
        console.log('[CHANGELOG] Marcado como visto no banco');
    } catch (e) {
        console.warn('[CHANGELOG] Erro ao salvar no banco, usando localStorage:', e);
        markUpdateSeen(userId);
    }
}

// Obtém a versão atual do changelog
export function getChangelogVersion() {
    return CHANGELOG_VERSION;
}

// Obtém quantidade de updates
export function getUpdateCount() {
    return CHANGELOG.length;
}
