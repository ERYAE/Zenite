// Gerenciamento de Dados (Local e Cloud)
import { supabase } from './config.js';
import { sanitizeChar } from './rpg.js';

const GUEST_KEY = 'zenite_guest_db';
const CACHE_KEY = 'zenite_cached_db';

export function loadFromLocal(isGuest) {
    try {
        const raw = localStorage.getItem(isGuest ? GUEST_KEY : CACHE_KEY);
        if (!raw) return { chars: {}, config: null };
        const parsed = JSON.parse(raw);
        const chars = {};
        Object.keys(parsed).forEach(k => {
            if (parsed[k]?.id) chars[k] = sanitizeChar(parsed[k]);
        });
        return { chars, config: parsed.config, trayPos: parsed.trayPos, hasSeenTip: parsed.hasSeenTip };
    } catch (e) {
        console.error("Load Error", e);
        return { chars: {}, config: null };
    }
}

export function saveToLocal(isGuest, data) {
    const key = isGuest ? GUEST_KEY : CACHE_KEY;
    localStorage.setItem(key, JSON.stringify(data));
}

export async function syncWithSupabase(user, localData) {
    if (!user) throw new Error("No User");
    
    // 1. Fetch Cloud
    let { data, error } = await supabase.from('profiles').select('data').eq('id', user.id).single();
    
    // Se não existir, cria
    if (error?.code === 'PGRST116') {
        const initial = { config: localData.config || {} };
        await supabase.from('profiles').insert([{ id: user.id, data: initial }]);
        data = { data: initial };
    }
    
    const cloudData = data?.data || {};
    
    // 2. Merge (Cloud + Local)
    const mergedChars = { ...localData.chars };
    let hasLocalUpdates = false;

    // Traz o que tem na nuvem para o local
    Object.keys(cloudData).forEach(k => {
        if (cloudData[k]?.id) mergedChars[k] = sanitizeChar(cloudData[k]);
    });

    // Se tiver coisa local que não ta na nuvem, marca para salvar
    Object.keys(localData.chars).forEach(k => {
        if (!cloudData[k]) hasLocalUpdates = true;
    });

    return { 
        mergedData: { ...cloudData, ...localData, chars: mergedChars }, // Dados combinados
        shouldPush: hasLocalUpdates 
    };
}

export async function pushToSupabase(user, data) {
    return await supabase.from('profiles').upsert({ id: user.id, data: data });
}