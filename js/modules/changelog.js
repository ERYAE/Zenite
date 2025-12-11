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
    // PERFORMANCE MASTERCLASS - Otimizao Extrema & Estabilidade
    // ───────────────────────────────────────────────────────────────────
    
    {
        title: 'PERFORMANCE MASTERCLASS',
        emoji: '⚡',
        isNew: true,
        sections: [
            {
                title: 'Performance & Estabilidade',
                icon: 'fa-gauge-high',
                color: 'yellow',
                items: [
                    {
                        title: 'Memory Leak no Áudio',
                        description: 'Sistema de pooling de nós de áudio implementado',
                        details: [
                            'Gerenciamento automático de memória',
                            'Prevenção de vazamentos em longas sesses',
                            'Eliminado 100% de chiados (crackling)',
                            'Performance estável mesmo com uso intenso'
                        ]
                    },
                    {
                        title: 'Router Race Conditions',
                        description: 'Sistema de fila de navegaao com IDs nicos',
                        details: [
                            'Processamento sequencial assncrono',
                            'Eliminao 100% de estados inconsistentes',
                            'Navegaao mais confivel e rpida',
                            'Sem mais perdas de estado ao navegar'
                        ]
                    },
                    {
                        title: 'Modo Performance Aggressivo',
                        description: 'Otimizaes drsticas para PCs antigos',
                        details: [
                            'CSS inline para performance imediata',
                            'Remoo completa de animações e blur',
                            'Indicador visual ⚡ discreto',
                            'Configuraes de runtime otimizadas'
                        ]
                    }
                ]
            },
            {
                title: 'Sistema de Convites',
                icon: 'fa-envelope-open-text',
                color: 'green',
                items: [
                    {
                        title: 'Convites de Campanha 2.0',
                        description: 'Sistema completo com validaes robustas',
                        details: [
                            'Reenvio automtico aps 24h sem resposta',
                            'Metadados ricos com informaes do GM',
                            'Notificaes em tempo real bidirecionais',
                            'Interface com tempo pendente e status',
                            'Confirmao de resposta ao GM'
                        ]
                    }
                ]
            },
            {
                title: 'Rate Limiting Otimizado',
                icon: 'fa-shield-halved',
                color: 'red',
                items: [
                    {
                        title: 'Limites Granulares',
                        description: 'Rate limiting especfico por operao',
                        details: [
                            'Dados: 10 rolagens por 15s (reduzido)',
                            'Chat: 30 mensagens por minuto (aumentado)',
                            'API: 40 chamadas por minuto (aumentado)',
                            'Feedback claro com tempo de espera',
                            'Novos limiters para save, sync, perfil, convites'
                        ]
                    }
                ]
            },
            {
                title: 'Dados em Nuvem',
                icon: 'fa-cloud',
                color: 'blue',
                items: [
                    {
                        title: 'Bestirio Multiplayer',
                        description: 'Migrao completa do localStorage para Supabase',
                        details: [
                            'Sincronizao bidirecional',
                            'Compresso LZ-string (>90% reduo)',
                            'Cache inteligente com TTL',
                            'Compartilhamento entre jogadores da campanha'
                        ]
                    }
                ]
            },
            {
                title: 'Notificaes Premium',
                icon: 'fa-bell',
                color: 'purple',
                items: [
                    {
                        title: 'Sistema Completo 9 Tipos',
                        description: 'Notificaes ricas com sons e prioridades',
                        details: [
                            '9 tipos especializados com sons nicos',
                            'Sistema de prioridades (low/normal/high)',
                            'Fila gerenciada (mximo 5 ativas)',
                            'Animaes suaves e metadados ricos',
                            'Mtodos helper para convites e dados'
                        ]
                    }
                ]
            }
        ]
    },

    // ───────────────────────────────────────────────────────────────────
    // SYSTEM EVOLUTION - Persistncia e Visual
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
