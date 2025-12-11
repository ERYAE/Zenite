/**
 * Copyright © 2025 Zenite - Todos os direitos reservados
 * Projeto desenvolvido com assistência de IA
 */

// ═══════════════════════════════════════════════════════════════════════════════
// ZENITE OS - Sistema de Logging Condicional
// ═══════════════════════════════════════════════════════════════════════════════
// Logs aparecem apenas em desenvolvimento, silenciados em produção

// Verifica ambiente de desenvolvimento de forma segura (compatível com Vercel)
const isDevelopment = (function() {
    try {
        return typeof import.meta !== 'undefined' && 
               import.meta.env && 
               (import.meta.env.DEV === true || import.meta.env.MODE === 'development');
    } catch {
        return false; // Em produção ou se import.meta não existir
    }
})();

/**
 * Logger condicional - só exibe em desenvolvimento
 */
export const logger = {
    /**
     * Log informativo (azul)
     * @param {string} module - Nome do módulo (ex: 'CLOUD', 'AUTH', 'NETLINK')
     * @param {...any} args - Argumentos para log
     */
    info(module, ...args) {
        if (isDevelopment) {
            console.log(`%c[${module}]`, 'color: #00d9ff; font-weight: bold', ...args);
        }
    },

    /**
     * Log de sucesso (verde)
     * @param {string} module - Nome do módulo
     * @param {...any} args - Argumentos para log
     */
    success(module, ...args) {
        if (isDevelopment) {
            console.log(`%c[${module}]`, 'color: #00ff88; font-weight: bold', ...args);
        }
    },

    /**
     * Log de aviso (amarelo) - sempre exibe
     * @param {string} module - Nome do módulo
     * @param {...any} args - Argumentos para log
     */
    warn(module, ...args) {
        console.warn(`[${module}]`, ...args);
    },

    /**
     * Log de erro (vermelho) - sempre exibe
     * @param {string} module - Nome do módulo
     * @param {...any} args - Argumentos para log
     */
    error(module, ...args) {
        console.error(`[${module}]`, ...args);
    },

    /**
     * Log de debug (cinza) - apenas em dev
     * @param {string} module - Nome do módulo
     * @param {...any} args - Argumentos para log
     */
    debug(module, ...args) {
        if (isDevelopment) {
            console.log(`%c[${module}]`, 'color: #888; font-weight: normal', ...args);
        }
    },

    /**
     * Agrupa logs relacionados
     * @param {string} title - Título do grupo
     * @param {Function} fn - Função que contém os logs
     */
    group(title, fn) {
        if (isDevelopment) {
            console.group(title);
            fn();
            console.groupEnd();
        }
    }
};

// Atalhos para módulos específicos
export const cloudLogger = {
    info: (...args) => logger.info('CLOUD', ...args),
    success: (...args) => logger.success('CLOUD', ...args),
    warn: (...args) => logger.warn('CLOUD', ...args),
    error: (...args) => logger.error('CLOUD', ...args),
    debug: (...args) => logger.debug('CLOUD', ...args)
};

export const authLogger = {
    info: (...args) => logger.info('AUTH', ...args),
    success: (...args) => logger.success('AUTH', ...args),
    warn: (...args) => logger.warn('AUTH', ...args),
    error: (...args) => logger.error('AUTH', ...args),
    debug: (...args) => logger.debug('AUTH', ...args)
};

export const netlinkLogger = {
    info: (...args) => logger.info('NETLINK', ...args),
    success: (...args) => logger.success('NETLINK', ...args),
    warn: (...args) => logger.warn('NETLINK', ...args),
    error: (...args) => logger.error('NETLINK', ...args),
    debug: (...args) => logger.debug('NETLINK', ...args)
};

export const socialLogger = {
    info: (...args) => logger.info('SOCIAL', ...args),
    success: (...args) => logger.success('SOCIAL', ...args),
    warn: (...args) => logger.warn('SOCIAL', ...args),
    error: (...args) => logger.error('SOCIAL', ...args),
    debug: (...args) => logger.debug('SOCIAL', ...args)
};

// ═══════════════════════════════════════════════════════════════════════════════
// TRATAMENTO DE ERROS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Traduz erros do Supabase para mensagens amigáveis
 * @param {Error} error - Erro do Supabase
 * @param {string} context - Contexto da operação (ex: 'criar campanha', 'salvar perfil')
 * @returns {string} - Mensagem de erro amigável
 */
export function translateError(error, context = 'operação') {
    netlinkLogger.error(`Erro ao ${context}:`, error);
    netlinkLogger.error('Detalhes:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
    });
    
    // Erros de duplicidade
    if (error.message?.includes('duplicate key') || error.message?.includes('unique')) {
        return 'Este item já existe. Tente outro valor.';
    }
    
    // Erros de permissão
    if (error.message?.includes('permission') || error.message?.includes('policy') || error.code === '42501') {
        return `Sem permissão para ${context}. ${error.hint || 'Verifique seu login.'}`;
    }
    
    // Erros de sessão
    if (error.code === 'PGRST301' || error.message?.includes('JWT')) {
        return 'Sessão expirada. Faça login novamente.';
    }
    
    // Erro genérico com mensagem real em desenvolvimento
    if (isDevelopment && error.message) {
        return `Erro ao ${context}: ${error.message}`;
    }
    
    return `Erro ao ${context}. Tente novamente.`;
}
