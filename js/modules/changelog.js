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
// Usa localStorage com chave por userId para diferenciar contas
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
// Usa localStorage com chave por userId para diferenciar contas
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

// Obtém a versão atual do changelog
export function getChangelogVersion() {
    return CHANGELOG_VERSION;
}

// Obtém quantidade de updates
export function getUpdateCount() {
    return CHANGELOG.length;
}
