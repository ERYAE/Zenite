// js/modules/changelog.js
// ═══════════════════════════════════════════════════════════════════════════
// CHANGELOG DATA
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ IMPORTANTE: SEMPRE ATUALIZAR ESTE ARQUIVO QUANDO HOUVER MUDANÇAS!
// ⚠️ Adicione novas versões no TOPO do array
// ═══════════════════════════════════════════════════════════════════════════

export const CHANGELOG = [
    {
        version: 'v2.3.0',
        date: '2024-12-06',
        title: 'ANIMATIONS & LOADING PRECISION',
        emoji: '✨',
        sections: [
            {
                title: 'Novidades',
                icon: 'fa-sparkles',
                color: 'cyan',
                items: [
                    {
                        title: 'Loading com Progresso Real',
                        description: 'Sistema de loading mostra etapas precisas do carregamento',
                        details: [
                            'Etapas: INIT → AUTH → SYNC → LOAD → READY',
                            'Barra de progresso real (0% → 100%)',
                            'Textos descritivos para cada etapa',
                            'Animação suave entre transições'
                        ]
                    },
                    {
                        title: 'Animações Aprimoradas',
                        description: 'Todas as animações funcionando corretamente',
                        details: [
                            'Hover states em todos os botões',
                            'Transições suaves em modais',
                            'Pulse effects em notificações',
                            'Skeleton loaders durante carregamento',
                            'Compatível com modo low-performance'
                        ]
                    }
                ]
            },
            {
                title: 'Correções',
                icon: 'fa-wrench',
                color: 'yellow',
                items: [
                    {
                        title: 'Animações CSS',
                        details: [
                            'Corrigido will-change para melhor performance',
                            'GPU acceleration em elementos críticos',
                            'Removido jank em transições',
                            'Keyframes otimizados'
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
                        title: 'Performance de animações otimizada'
                    },
                    {
                        title: 'Loading mais informativo e preciso'
                    },
                    {
                        title: 'Feedback visual em todas as ações'
                    }
                ]
            }
        ]
    },
    {
        version: 'v2.2.0',
        date: '2024-12-06',
        title: 'FRIENDS SYSTEM OVERHAUL',
        emoji: '🤝',
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
    {
        version: 'v2.1.0',
        date: '2024-12-06',
        title: 'CLOUDCHECK & STABILITY',
        emoji: '🛡️',
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
    {
        version: 'v2.0.0',
        date: '2024-11-XX',
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

// Versão atual do sistema
export const CURRENT_VERSION = 'v2.3.0';

// Verifica se há nova versão desde a última visualização
export function hasNewVersion() {
    const lastSeenVersion = localStorage.getItem('zenite_last_seen_version');
    return lastSeenVersion !== CURRENT_VERSION;
}

// Marca versão como visualizada
export function markVersionSeen() {
    localStorage.setItem('zenite_last_seen_version', CURRENT_VERSION);
}
