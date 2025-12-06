// ═══════════════════════════════════════════════════════════════════════════
// ZENITE SECURITY MODULE
// ═══════════════════════════════════════════════════════════════════════════
// Input sanitization, rate limiting, and XSS protection

/**
 * Sanitize HTML to prevent XSS attacks
 * @param {string} str - String to sanitize
 * @returns {string} - Sanitized string
 */
export const sanitizeHTML = (str) => {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};

/**
 * Sanitize character name (alphanumeric + spaces + basic punctuation)
 * @param {string} name - Name to sanitize
 * @returns {string} - Sanitized name
 */
export const sanitizeName = (name) => {
    if (!name) return '';
    // Allow letters, numbers, spaces, and basic punctuation
    return name.replace(/[^a-zA-Z0-9\s\-_'.]/g, '').slice(0, 50);
};

/**
 * Sanitize chat message (remove scripts but allow basic formatting)
 * @param {string} message - Message to sanitize
 * @returns {string} - Sanitized message
 */
export const sanitizeChatMessage = (message) => {
    if (!message) return '';
    // Remove script tags and event handlers
    return message
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/javascript:/gi, '')
        .slice(0, 2000); // Max 2000 chars
};

/**
 * Rate limiter class
 */
class RateLimiter {
    constructor(maxCalls, windowMs) {
        this.maxCalls = maxCalls;
        this.windowMs = windowMs;
        this.calls = new Map();
    }

    /**
     * Check if action is allowed
     * @param {string} key - Unique key for the action
     * @returns {boolean} - True if allowed, false if rate limited
     */
    isAllowed(key) {
        const now = Date.now();
        const userCalls = this.calls.get(key) || [];
        
        // Remove old calls outside the window
        const recentCalls = userCalls.filter(time => now - time < this.windowMs);
        
        if (recentCalls.length >= this.maxCalls) {
            return false;
        }
        
        recentCalls.push(now);
        this.calls.set(key, recentCalls);
        return true;
    }

    /**
     * Get remaining calls
     * @param {string} key - Unique key for the action
     * @returns {number} - Number of remaining calls
     */
    getRemaining(key) {
        const now = Date.now();
        const userCalls = this.calls.get(key) || [];
        const recentCalls = userCalls.filter(time => now - time < this.windowMs);
        return Math.max(0, this.maxCalls - recentCalls.length);
    }

    /**
     * Reset rate limit for a key
     * @param {string} key - Unique key to reset
     */
    reset(key) {
        this.calls.delete(key);
    }
}

// Create rate limiters for different actions
export const rateLimiters = {
    // 10 dice rolls per minute
    diceRoll: new RateLimiter(10, 60000),
    
    // 20 chat messages per minute
    chatMessage: new RateLimiter(20, 60000),
    
    // 5 invite code attempts per minute
    inviteCode: new RateLimiter(5, 60000),
    
    // 3 password reset attempts per hour
    passwordReset: new RateLimiter(3, 3600000),
    
    // 10 API calls per minute (generic)
    apiCall: new RateLimiter(10, 60000)
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid
 */
export const isValidEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} - { valid: boolean, score: number, message: string }
 */
export const validatePassword = (password) => {
    if (!password) return { valid: false, score: 0, message: 'Senha vazia' };
    
    let score = 0;
    const messages = [];
    
    if (password.length >= 8) score++;
    else messages.push('Mínimo 8 caracteres');
    
    if (password.length >= 12) score++;
    
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    else messages.push('Use maiúsculas e minúsculas');
    
    if (/\d/.test(password)) score++;
    else messages.push('Adicione números');
    
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    else messages.push('Adicione caracteres especiais');
    
    return {
        valid: score >= 3,
        score: score,
        message: messages.join(', ')
    };
};

/**
 * Generate secure random string
 * @param {number} length - Length of string
 * @returns {string} - Random string
 */
export const generateSecureToken = (length = 32) => {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

/**
 * Debounce function to prevent spam
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} - Debounced function
 */
export const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

/**
 * Throttle function to limit execution rate
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in ms
 * @returns {Function} - Throttled function
 */
export const throttle = (func, limit) => {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};

/**
 * Check if string contains potential XSS
 * @param {string} str - String to check
 * @returns {boolean} - True if suspicious
 */
export const containsXSS = (str) => {
    if (!str) return false;
    const xssPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /<iframe/i,
        /eval\(/i,
        /expression\(/i
    ];
    return xssPatterns.some(pattern => pattern.test(str));
};

/**
 * Log security event (for audit)
 * @param {string} event - Event type
 * @param {object} data - Event data
 */
export const logSecurityEvent = (event, data) => {
    const timestamp = new Date().toISOString();
    console.warn(`[SECURITY] ${timestamp} - ${event}:`, data);
    
    // In production, send to backend logging service
    // fetch('/api/security-log', { method: 'POST', body: JSON.stringify({ event, data, timestamp }) });
};
