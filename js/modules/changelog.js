// js/modules/changelog.js
// ═══════════════════════════════════════════════════════════════════════════
// ZENITE OS - CHANGELOG
// ═══════════════════════════════════════════════════════════════════════════
// Histórico de atualizações do sistema
// Adicione novos updates no TOPO do array
// ═══════════════════════════════════════════════════════════════════════════

export const CHANGELOG = [
    // ───────────────────────────────────────────────────────────────────
    // SOCIAL OVERHAUL - Sistema de Amigos e Chat
    // ───────────────────────────────────────────────────────────────────
    {
        title: 'SOCIAL OVERHAUL',
        emoji: '👥',
        isNew: true,
        sections: [
            {
                title: 'Chat entre Amigos',
                icon: 'fa-comments',
                color: 'pink',
                items: [
                    {
                        title: 'Whisper/Cochicho',
                        description: 'Converse em privado com seus amigos',
                        details: [
                            'Mensagens em tempo real',
                            'Contador de mensagens não lidas',
                            'Atualização otimista instantânea',
                            'Realtime lazy loading (conecta só quando usa)'
                        ]
                    },
                    {
                        title: 'Convite para Campanha',
                        description: 'Convide amigos diretamente para suas campanhas'
                    }
                ]
            },
            {
                title: 'Sistema de Amigos',
                icon: 'fa-user-group',
                color: 'cyan',
                items: [
                    {
                        title: 'Perfis Completos',
                        details: [
                            'Username e display name',
                            'Avatar personalizável',
                            'Bio e links sociais',
                            'Contagem de achievements'
                        ]
                    },
                    {
                        title: 'SQL Otimizado',
                        details: [
                            'Funções get_friends_full() e get_pending_requests()',
                            'Índices compostos para performance',
                            'Row Level Security (RLS)',
                            'Queries 10x mais rápidas'
                        ]
                    }
                ]
            },
            {
                title: 'Animações Premium',
                icon: 'fa-wand-magic-sparkles',
                color: 'purple',
                items: [
                    {
                        title: 'Feeling macOS/iOS',
                        description: 'Easing curves premium e micro-interações',
                        details: [
                            'Ease-out-expo para transições suaves',
                            'Ease-out-back para bounce sutil',
                            'Hover com glow + scale + lift',
                            'Active press com feedback instantâneo',
                            'Ripple effect em botões'
                        ]
                    },
                    {
                        title: 'Modais & Overlays',
                        details: [
                            'Modal enter com blur progressivo',
                            'Glass effect com saturação dinâmica',
                            'Backdrop fade suave',
                            'Slide from right/bottom',
                            'Fade in genérico'
                        ]
                    },
                    {
                        title: 'Notificações & Toasts',
                        details: [
                            'Slide + bounce no enter',
                            'Toast bounce from top',
                            'Shake para erros',
                            'Wiggle para atenção',
                            'Exit animation suave'
                        ]
                    },
                    {
                        title: 'Progress & Loading',
                        details: [
                            'Skeleton shimmer com cor neon',
                            'Progress bars com shimmer effect',
                            'Pulse crítico para alertas',
                            'Stagger animation em listas',
                            'Typing indicator bounce'
                        ]
                    },
                    {
                        title: 'Hover Effects',
                        details: [
                            'Ícones com rotate + scale',
                            'Imagens com zoom suave',
                            'Cards com lift + glow + border',
                            'Inputs com focus glow',
                            'Links com underline animado'
                        ]
                    }
                ]
            },
            {
                title: 'UX & Correções',
                icon: 'fa-wrench',
                color: 'green',
                items: [
                    {
                        title: 'Modais Centralizados',
                        details: [
                            'Modal de configurações centralizado corretamente',
                            'Altura máxima ajustada (65vh)',
                            'Scroll interno suave',
                            'Previne cortes de conteúdo'
                        ]
                    },
                    {
                        title: 'Inputs Melhorados',
                        details: [
                            'Padding adequado (10px 14px)',
                            'Altura mínima 42px',
                            'Placeholder com transição suave',
                            'Focus glow premium'
                        ]
                    },
                    {
                        title: 'Dropdowns Premium',
                        details: [
                            'Animação de entrada suave',
                            'Ripple effect em menu items',
                            'Ícones com movimento no hover',
                            'Transições 0.15s ease-out-expo'
                        ]
                    },
                    {
                        title: 'Tooltips Melhorados',
                        details: [
                            'Estilo premium com border neon',
                            'Animação de entrada suave',
                            'Box-shadow profundo',
                            'Z-index correto (10000)'
                        ]
                    }
                ]
            },
            {
                title: 'Performance',
                icon: 'fa-bolt',
                color: 'yellow',
                items: [
                    { title: 'GPU acceleration apenas onde necessário' },
                    { title: 'Removido will-change excessivo' },
                    { title: 'Realtime lazy loading' },
                    { title: 'Fallbacks automáticos' },
                    { title: 'Cache agressivo com invalidação inteligente' }
                ]
            }
        ]
    },
    
    // ───────────────────────────────────────────────────────────────────
    // CLOUDCHECK - Sistema de Verificação de Dados
    // ───────────────────────────────────────────────────────────────────
    {
        title: 'CLOUDCHECK',
        emoji: '🛡️',
        sections: [
            {
                title: 'Novidades',
                icon: 'fa-sparkles',
                color: 'cyan',
                items: [
                    {
                        title: 'Sistema de Amigos Refatorado',
                        description: 'Reescrito do zero com otimizações SQL',
                        details: [
                            'Funções PostgreSQL otimizadas',
                            'Índices compostos para queries 10x mais rápidas',
                            'Constraint única para evitar duplicatas',
                            'Row Level Security (RLS) implementado',
                            'Trigger automático para updated_at'
                        ]
                    },
                    {
                        title: 'Loading Aprimorado',
                        description: 'Delay aumentado para 1.8s para evitar flash de conteúdo'
                    }
                ]
            },
            {
                title: 'Correções',
                icon: 'fa-wrench',
                color: 'yellow',
                items: [
                    {
                        title: 'Performance SQL',
                        details: [
                            'Reduzido de 3 queries para 1 query com JOIN',
                            'Índices em user_id, friend_id, status e created_at',
                            'Constraint para prevenir auto-amizade',
                            'Validações no banco de dados'
                        ]
                    }
                ]
            }
        ]
    },
    // ───────────────────────────────────────────────────────────────────
    // STABILITY - Correções e Melhorias
    // ───────────────────────────────────────────────────────────────────
    {
        title: 'STABILITY',
        emoji: '🔧',
        sections: [
            {
                title: 'Novidades',
                icon: 'fa-sparkles',
                color: 'cyan',
                items: [
                    {
                        title: 'CloudCheck System',
                        description: 'Sistema automático de verificação e correção de dados',
                        details: [
                            'Verifica integridade de perfis, personagens, amizades e configurações',
                            'Executa automaticamente a cada 7 dias ou quando há atualização',
                            'Interface manual nas Configurações da Conta',
                            'Relatório detalhado de correções aplicadas'
                        ]
                    },
                    {
                        title: 'Upload de Avatar',
                        description: 'Usuários podem fazer upload de foto de perfil',
                        details: [
                            'Suporte para imagens até 2MB',
                            'Armazenamento no Supabase Storage',
                            'Exibição em perfis e lista de amigos'
                        ]
                    },
                    {
                        title: 'Modal de Changelog',
                        description: 'Histórico completo de atualizações acessível no site'
                    }
                ]
            },
            {
                title: 'Correções',
                icon: 'fa-wrench',
                color: 'yellow',
                items: [
                    {
                        title: 'Sistema de Amigos',
                        details: [
                            'Corrigido mapeamento de dados (usernames e avatars corretos)',
                            'Real-time funcional para pedidos de amizade',
                            'Visualização de perfil de amigos corrigida',
                            'Removido problema de dados duplicados'
                        ]
                    },
                    {
                        title: 'Animações',
                        details: [
                            'Corrigido conflito de .animate-spin no CSS',
                            'Loading spinner agora gira corretamente',
                            'Animação D20 no loading screen',
                            'Modo low-performance preservado'
                        ]
                    },
                    {
                        title: 'Modal de Perfil',
                        details: [
                            'Mostra dados corretos ao visualizar perfil de amigos',
                            'Esconde informações pessoais quando vendo perfil de outros',
                            'Avatar com botão de upload (hover)'
                        ]
                    }
                ]
            },
            {
                title: 'Melhorias',
                icon: 'fa-arrow-up',
                color: 'green',
                items: [
                    {
                        title: 'Loading screen com delay de 1.2s para melhor experiência'
                    },
                    {
                        title: 'Logs detalhados no console para debug'
                    },
                    {
                        title: 'Validações robustas em todo o sistema de amigos'
                    },
                    {
                        title: 'Tratamento de erros aprimorado'
                    }
                ]
            }
        ]
    },
    // ───────────────────────────────────────────────────────────────────
    // SISTEMA BASE - Lançamento Inicial
    // ───────────────────────────────────────────────────────────────────
    {
        title: 'SISTEMA BASE',
        emoji: '🚀',
        sections: [
            {
                title: 'Funcionalidades Principais',
                icon: 'fa-star',
                color: 'purple',
                items: [
                    { title: 'Sistema de personagens com fichas completas' },
                    { title: 'Campanhas multiplayer com real-time' },
                    { title: 'Sistema de dados (D3, D4, D6, D8, D10, D12, D20, D100)' },
                    { title: 'Chat de campanha com suporte a comandos' },
                    { title: 'Inventário e gerenciamento de itens' },
                    { title: 'Sistema de achievements' },
                    { title: 'Temas customizáveis' },
                    { title: 'Modo Hacker (CRT effect)' },
                    { title: 'Suporte offline (Guest Mode)' },
                    { title: 'Sincronização na nuvem via Supabase' }
                ]
            }
        ]
    }
];

// Obtém o update mais recente
export function getLatestUpdate() {
    return CHANGELOG[0] || null;
}

// Verifica se há update novo desde a última visualização
export function hasNewUpdate() {
    const lastSeenUpdate = localStorage.getItem('zenite_last_seen_update');
    const latest = CHANGELOG[0];
    return latest && lastSeenUpdate !== latest.title;
}

// Marca update como visualizado
export function markUpdateSeen() {
    const latest = CHANGELOG[0];
    if (latest) {
        localStorage.setItem('zenite_last_seen_update', latest.title);
    }
}

// Obtém quantidade de updates
export function getUpdateCount() {
    return CHANGELOG.length;
}
