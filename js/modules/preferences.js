/**
 * Copyright © 2025 Zenite - Todos os direitos reservados
 * Projeto desenvolvido com assistência de IA
 */

// js/modules/preferences.js
// ═══════════════════════════════════════════════════════════════════════════
// ZENITE OS - PREFERENCES MODULE
// Sistema de Persistência de Preferências no Supabase
// ═══════════════════════════════════════════════════════════════════════════
//
// Este módulo centraliza toda a lógica de preferências do usuário:
// - Changelog version seen
// - Migration modal seen
// - Theme color
// - CRT mode
// - Sound enabled
// - Welcome screen seen
//
// Todas as preferências são salvas no Supabase (tabela profiles) e
// sincronizadas automaticamente entre dispositivos.
// ═══════════════════════════════════════════════════════════════════════════

import { CHANGELOG_VERSION } from '../../changelog.version.js';

// Cache local para evitar chamadas desnecessárias ao banco
let preferencesCache = null;
let cacheUserId = null;

/**
 * Carrega preferências do usuário do Supabase
 * @param {object} supabase - Cliente Supabase
 * @param {string} userId - ID do usuário
 * @returns {Promise<object|null>} Preferências do usuário
 */
export async function loadUserPreferences(supabase, userId) {
    if (!supabase || !userId) return null;
    
    // Retorna cache se for o mesmo usuário
    if (preferencesCache && cacheUserId === userId) {
        return preferencesCache;
    }
    
    try {
        const { data, error } = await supabase.rpc('get_user_preferences');
        
        if (error) {
            console.warn('[PREFERENCES] Erro ao carregar:', error.message);
            return null;
        }
        
        if (data && data.length > 0) {
            preferencesCache = data[0];
            cacheUserId = userId;
            console.log('[PREFERENCES] Carregado do banco:', preferencesCache);
            return preferencesCache;
        }
        
        return null;
    } catch (e) {
        console.error('[PREFERENCES] Exceção ao carregar:', e);
        return null;
    }
}

/**
 * Salva preferências do usuário no Supabase
 * @param {object} supabase - Cliente Supabase
 * @param {object} preferences - Objeto com preferências a salvar
 * @returns {Promise<boolean>} Sucesso da operação
 */
export async function saveUserPreferences(supabase, preferences) {
    if (!supabase) return false;
    
    try {
        const { data, error } = await supabase.rpc('save_user_preferences', {
            p_changelog_version: preferences.changelogVersion ?? null,
            p_migration_seen: preferences.migrationSeen ?? null,
            p_theme_color: preferences.themeColor ?? null,
            p_crt_mode: preferences.crtMode ?? null,
            p_sound_enabled: preferences.soundEnabled ?? null,
            p_has_seen_welcome: preferences.hasSeenWelcome ?? null
        });
        
        if (error) {
            console.warn('[PREFERENCES] Erro ao salvar:', error.message);
            return false;
        }
        
        // Atualiza cache local
        if (preferencesCache) {
            if (preferences.changelogVersion !== undefined) preferencesCache.changelog_version_seen = preferences.changelogVersion;
            if (preferences.migrationSeen !== undefined) preferencesCache.migration_seen = preferences.migrationSeen;
            if (preferences.themeColor !== undefined) preferencesCache.theme_color = preferences.themeColor;
            if (preferences.crtMode !== undefined) preferencesCache.crt_mode = preferences.crtMode;
            if (preferences.soundEnabled !== undefined) preferencesCache.sound_enabled = preferences.soundEnabled;
            if (preferences.hasSeenWelcome !== undefined) preferencesCache.has_seen_welcome = preferences.hasSeenWelcome;
        }
        
        console.log('[PREFERENCES] Salvo no banco');
        return true;
    } catch (e) {
        console.error('[PREFERENCES] Exceção ao salvar:', e);
        return false;
    }
}

/**
 * Verifica se há changelog novo para mostrar
 * @param {object} supabase - Cliente Supabase
 * @param {string} userId - ID do usuário (null para guest)
 * @returns {Promise<boolean>} True se há changelog novo
 */
export async function hasNewChangelog(supabase, userId) {
    // Guest: usa localStorage
    if (!userId || !supabase) {
        const lastSeen = localStorage.getItem('zenite_changelog_version_guest');
        return CHANGELOG_VERSION > parseInt(lastSeen || '0');
    }
    
    // Usuário logado: usa Supabase
    const prefs = await loadUserPreferences(supabase, userId);
    const seenVersion = prefs?.changelog_version_seen || 0;
    return CHANGELOG_VERSION > seenVersion;
}

/**
 * Marca changelog como visto
 * @param {object} supabase - Cliente Supabase
 * @param {string} userId - ID do usuário (null para guest)
 */
export async function markChangelogSeen(supabase, userId) {
    // Guest: usa localStorage
    if (!userId || !supabase) {
        localStorage.setItem('zenite_changelog_version_guest', CHANGELOG_VERSION.toString());
        return;
    }
    
    // Usuário logado: salva no Supabase
    await saveUserPreferences(supabase, { changelogVersion: CHANGELOG_VERSION });
}

/**
 * Verifica se migration modal já foi visto
 * @param {object} supabase - Cliente Supabase
 * @param {string} userId - ID do usuário
 * @returns {Promise<boolean>} True se já foi visto
 */
export async function hasMigrationSeen(supabase, userId) {
    if (!userId || !supabase) return true; // Guest não vê migration
    
    const prefs = await loadUserPreferences(supabase, userId);
    return prefs?.migration_seen === true;
}

/**
 * Marca migration modal como visto
 * @param {object} supabase - Cliente Supabase
 */
export async function markMigrationSeen(supabase) {
    if (!supabase) return;
    await saveUserPreferences(supabase, { migrationSeen: true });
}

/**
 * Verifica se welcome screen já foi vista
 * @param {object} supabase - Cliente Supabase
 * @param {string} userId - ID do usuário
 * @returns {Promise<boolean>} True se já foi vista
 */
export async function hasWelcomeSeen(supabase, userId) {
    if (!userId || !supabase) return true;
    
    const prefs = await loadUserPreferences(supabase, userId);
    return prefs?.has_seen_welcome === true;
}

/**
 * Marca welcome screen como vista
 * @param {object} supabase - Cliente Supabase
 */
export async function markWelcomeSeen(supabase) {
    if (!supabase) return;
    await saveUserPreferences(supabase, { hasSeenWelcome: true });
}

/**
 * Salva tema do usuário
 * @param {object} supabase - Cliente Supabase
 * @param {string} themeColor - Cor do tema (ex: 'cyan', 'purple')
 */
export async function saveTheme(supabase, themeColor) {
    if (!supabase) return;
    await saveUserPreferences(supabase, { themeColor });
}

/**
 * Salva configuração de CRT mode
 * @param {object} supabase - Cliente Supabase
 * @param {boolean} enabled - Se CRT mode está habilitado
 */
export async function saveCrtMode(supabase, enabled) {
    if (!supabase) return;
    await saveUserPreferences(supabase, { crtMode: enabled });
}

/**
 * Salva configuração de som
 * @param {object} supabase - Cliente Supabase
 * @param {boolean} enabled - Se som está habilitado
 */
export async function saveSoundEnabled(supabase, enabled) {
    if (!supabase) return;
    await saveUserPreferences(supabase, { soundEnabled: enabled });
}

/**
 * Obtém tema do usuário do cache
 * @returns {string|null} Cor do tema ou null
 */
export function getCachedTheme() {
    return preferencesCache?.theme_color || null;
}

/**
 * Obtém configuração de CRT do cache
 * @returns {boolean} Se CRT está habilitado
 */
export function getCachedCrtMode() {
    return preferencesCache?.crt_mode || false;
}

/**
 * Obtém configuração de som do cache
 * @returns {boolean} Se som está habilitado
 */
export function getCachedSoundEnabled() {
    return preferencesCache?.sound_enabled !== false; // Default true
}

/**
 * Limpa cache de preferências (usar no logout)
 */
export function clearPreferencesCache() {
    preferencesCache = null;
    cacheUserId = null;
    console.log('[PREFERENCES] Cache limpo');
}

/**
 * Obtém tema padrão para tela de login (sempre cyan)
 * @returns {string} Cor padrão
 */
export function getDefaultTheme() {
    return 'cyan';
}
