/**
 * Copyright © 2025 Zenite - Todos os direitos reservados
 * Projeto desenvolvido com assistência de IA
 */

/**
 * ZENITE OS - Realtime Connection Manager
 * 
 * Gerencia conexões Realtime do Supabase para economizar recursos no Free Tier
 * FREE TIER: 2GB de bandwidth/mês, 200 conexões simultâneas
 * 
 * ESTRATÉGIA:
 * - Desconecta automaticamente após inatividade
 * - Reconecta quando necessário
 * - Monitora atividade do usuário
 * - Prioriza conexões críticas
 */

export class RealtimeManager {
    constructor() {
        this.idleTimeout = 5 * 60 * 1000; // 5 minutos de inatividade
        this.idleTimer = null;
        this.isIdle = false;
        this.activeChannels = new Map();
        this.lastActivity = Date.now();
        
        // Eventos que indicam atividade
        this.activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];
        
        this.setupActivityListeners();
    }
    
    /**
     * Configura listeners de atividade do usuário
     */
    setupActivityListeners() {
        this.activityEvents.forEach(event => {
            document.addEventListener(event, () => this.recordActivity(), { passive: true });
        });
        
        // Inicia monitoramento de inatividade
        this.startIdleMonitoring();
    }
    
    /**
     * Registra atividade do usuário
     */
    recordActivity() {
        this.lastActivity = Date.now();
        
        if (this.isIdle) {
            this.isIdle = false;
            this.reconnectChannels();
        }
        
        // Reseta timer de inatividade
        this.resetIdleTimer();
    }
    
    /**
     * Inicia monitoramento de inatividade
     */
    startIdleMonitoring() {
        this.resetIdleTimer();
    }
    
    /**
     * Reseta timer de inatividade
     */
    resetIdleTimer() {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
        }
        
        this.idleTimer = setTimeout(() => {
            this.handleIdle();
        }, this.idleTimeout);
    }
    
    /**
     * Lida com estado ocioso
     */
    handleIdle() {
        console.log('[REALTIME] Usuário ocioso. Desconectando canais não críticos...');
        this.isIdle = true;
        this.disconnectNonCriticalChannels();
    }
    
    /**
     * Registra um canal Realtime
     * @param {string} channelId - ID único do canal
     * @param {object} channel - Instância do canal Supabase
     * @param {boolean} critical - Se o canal é crítico (não desconecta quando ocioso)
     */
    registerChannel(channelId, channel, critical = false) {
        this.activeChannels.set(channelId, {
            channel,
            critical,
            connectedAt: Date.now()
        });
        
        console.log(`[REALTIME] Canal registrado: ${channelId} (crítico: ${critical})`);
    }
    
    /**
     * Remove registro de um canal
     * @param {string} channelId - ID do canal
     */
    unregisterChannel(channelId) {
        this.activeChannels.delete(channelId);
        console.log(`[REALTIME] Canal removido: ${channelId}`);
    }
    
    /**
     * Desconecta canais não críticos quando ocioso
     */
    async disconnectNonCriticalChannels() {
        const disconnected = [];
        
        for (const [channelId, data] of this.activeChannels.entries()) {
            if (!data.critical && data.channel) {
                try {
                    await data.channel.unsubscribe();
                    disconnected.push(channelId);
                    console.log(`[REALTIME] Canal desconectado (ocioso): ${channelId}`);
                } catch (error) {
                    console.error(`[REALTIME] Erro ao desconectar ${channelId}:`, error);
                }
            }
        }
        
        return disconnected;
    }
    
    /**
     * Reconecta canais quando usuário volta a ficar ativo
     */
    async reconnectChannels() {
        console.log('[REALTIME] Usuário ativo novamente. Reconectando canais...');
        
        // Dispara evento customizado para que módulos reconectem seus canais
        window.dispatchEvent(new CustomEvent('realtime:reconnect'));
    }
    
    /**
     * Obtém estatísticas de uso
     */
    getStats() {
        const now = Date.now();
        const channels = Array.from(this.activeChannels.entries()).map(([id, data]) => ({
            id,
            critical: data.critical,
            uptime: Math.floor((now - data.connectedAt) / 1000) // segundos
        }));
        
        return {
            totalChannels: this.activeChannels.size,
            criticalChannels: channels.filter(c => c.critical).length,
            isIdle: this.isIdle,
            lastActivity: new Date(this.lastActivity).toISOString(),
            channels
        };
    }
    
    /**
     * Desconecta todos os canais (logout)
     */
    async disconnectAll() {
        console.log('[REALTIME] Desconectando todos os canais...');
        
        for (const [channelId, data] of this.activeChannels.entries()) {
            if (data.channel) {
                try {
                    await data.channel.unsubscribe();
                    console.log(`[REALTIME] Canal desconectado: ${channelId}`);
                } catch (error) {
                    console.error(`[REALTIME] Erro ao desconectar ${channelId}:`, error);
                }
            }
        }
        
        this.activeChannels.clear();
        
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
        }
    }
}

// Instância global
export const realtimeManager = new RealtimeManager();

// Expõe globalmente para debug
if (typeof window !== 'undefined') {
    window.realtimeManager = realtimeManager;
}

export default realtimeManager;
