/**
 * Copyright © 2025 Zenite - Todos os direitos reservados
 * Projeto desenvolvido com assistência de IA
 */

/**
 * ZENITE OS - Sistema Centralizado de Notificações
 * 
 * Sistema robusto para notificações em tempo real:
 * - Notificações de mensagens, convites, campanhas, dados e sistema
 * - Priorização automática
 * - Sons integrados
 * - Ações clicáveis
 * - Persistência opcional
 * - Limite de notificações visíveis
 */

import { playSFX } from './audio.js';

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATION CENTER - Sistema Centralizado
// ═══════════════════════════════════════════════════════════════════════════

export const NotificationCenter = {
    queue: [],
    maxVisible: 5,
    soundEnabled: true,
    
    // Tipos de notificação com configurações
    types: {
        message: { 
            icon: 'fa-envelope', 
            sound: 'notification', 
            priority: 1,
            color: 'cyan'
        },
        invite: { 
            icon: 'fa-user-plus', 
            sound: 'success', 
            priority: 2,
            color: 'green'
        },
        campaign: { 
            icon: 'fa-users', 
            sound: 'success', 
            priority: 2,
            color: 'purple'
        },
        dice: { 
            icon: 'fa-dice', 
            sound: 'dice', 
            priority: 0,
            color: 'blue'
        },
        system: { 
            icon: 'fa-bell', 
            sound: 'click', 
            priority: 1,
            color: 'gray'
        },
        error: {
            icon: 'fa-triangle-exclamation',
            sound: 'error',
            priority: 3,
            color: 'red'
        },
        success: {
            icon: 'fa-circle-check',
            sound: 'success',
            priority: 1,
            color: 'green'
        }
    },
    
    /**
     * Mostra uma notificação
     * @param {string} type - Tipo da notificação (message, invite, campaign, etc)
     * @param {string} message - Mensagem a exibir
     * @param {object} options - Opções adicionais
     * @returns {string} ID da notificação
     */
    show(type, message, options = {}) {
        const config = this.types[type] || this.types.system;
        const notification = {
            id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type,
            message,
            icon: options.icon || config.icon,
            color: options.color || config.color,
            priority: options.priority ?? config.priority,
            timestamp: new Date(),
            read: false,
            action: options.action,
            actionLabel: options.actionLabel || 'Ver',
            persistent: options.persistent || false,
            duration: options.duration || 5000
        };
        
        // Adiciona à fila
        this.queue.push(notification);
        
        // Ordena por prioridade (maior primeiro)
        this.queue.sort((a, b) => b.priority - a.priority);
        
        // Limita quantidade visível
        if (this.queue.length > this.maxVisible) {
            this.queue = this.queue.slice(0, this.maxVisible);
        }
        
        // Renderiza
        this._render();
        
        // Toca som se habilitado
        if (config.sound && this.soundEnabled) {
            playSFX(config.sound);
        }
        
        // Auto-dismiss se não for persistente
        if (!notification.persistent) {
            setTimeout(() => this.dismiss(notification.id), notification.duration);
        }
        
        return notification.id;
    },
    
    /**
     * Dismissar notificação
     */
    dismiss(id) {
        this.queue = this.queue.filter(n => n.id !== id);
        this._render();
    },
    
    /**
     * Dismissar todas
     */
    dismissAll() {
        this.queue = [];
        this._render();
    },
    
    /**
     * Renderiza notificações no DOM
     */
    _render() {
        let container = document.getElementById('notification-container');
        
        // Cria container se não existir
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.className = 'fixed top-4 right-4 z-[10000] flex flex-col gap-2 pointer-events-none';
            document.body.appendChild(container);
        }
        
        // Limpa container
        container.innerHTML = '';
        
        // Renderiza cada notificação
        this.queue.forEach(notif => {
            const el = this._createNotificationElement(notif);
            container.appendChild(el);
        });
    },
    
    /**
     * Cria elemento HTML da notificação
     */
    _createNotificationElement(notif) {
        const div = document.createElement('div');
        div.className = `glass rounded-lg p-4 min-w-[320px] max-w-[400px] shadow-xl border border-${notif.color}-500/30 pointer-events-auto transform transition-all duration-300 hover:scale-105`;
        div.style.animation = 'slideInRight 0.3s ease-out';
        
        const colorClasses = {
            cyan: 'text-cyan-400',
            green: 'text-green-400',
            purple: 'text-purple-400',
            blue: 'text-blue-400',
            gray: 'text-gray-400',
            red: 'text-red-400',
            pink: 'text-pink-400',
            rose: 'text-rose-400'
        };
        
        const iconColor = colorClasses[notif.color] || 'text-gray-400';
        
        div.innerHTML = `
            <div class="flex items-start gap-3">
                <div class="flex-shrink-0">
                    <i class="fas ${notif.icon} ${iconColor} text-xl"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm text-white font-medium break-words">${this._escapeHtml(notif.message)}</p>
                    ${notif.action ? `
                        <button 
                            class="mt-2 text-xs ${iconColor} hover:underline font-semibold"
                            onclick="window.notificationAction_${notif.id}()"
                        >
                            ${this._escapeHtml(notif.actionLabel)}
                        </button>
                    ` : ''}
                </div>
                <button 
                    class="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
                    onclick="window.NotificationCenter.dismiss('${notif.id}')"
                >
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // Registra ação se existir
        if (notif.action) {
            window[`notificationAction_${notif.id}`] = () => {
                notif.action();
                this.dismiss(notif.id);
            };
        }
        
        return div;
    },
    
    /**
     * Escape HTML para prevenir XSS
     */
    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    /**
     * Habilita/desabilita sons
     */
    toggleSound(enabled) {
        this.soundEnabled = enabled;
    }
};

// Expõe globalmente para uso em Alpine.js
window.NotificationCenter = NotificationCenter;

// Adiciona animação CSS se não existir
if (!document.getElementById('notification-animations')) {
    const style = document.createElement('style');
    style.id = 'notification-animations';
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);
}

export default NotificationCenter;
