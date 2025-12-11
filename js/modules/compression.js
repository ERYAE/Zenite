/**
 * Módulo de Compressão de Dados
 * Reduz tamanho do payload de sync para evitar limites do Supabase
 */

/**
 * Comprime dados usando algoritmo simples de remoção de redundância
 * @param {Object} data - Dados a comprimir  
 * @returns {Object} Dados comprimidos com metadados
 */
export function compressData(data) {
    if (!data || typeof data !== 'object') return data;
    
    const compressed = {
        _compressed: true,
        _version: '1.0',
        _originalSize: JSON.stringify(data).length,
        chars: {},
        metadata: {}
    };
    
    // Extrai metadados do config
    if (data.config) {
        compressed.metadata = {
            themeColor: data.config.themeColor,
            crtMode: data.config.crtMode,
            compactMode: data.config.compactMode,
            lowPerfMode: data.config.lowPerfMode,
            hackerMode: data.config.hackerMode
        };
    }
    
    // Comprime personagens removendo dados desnecessários
    if (data.chars) {
        for (const [charId, char] of Object.entries(data.chars)) {
            compressed.chars[charId] = compressCharacter(char);
        }
    }
    
    // Adiciona outros metadados pequenos
    if (data.hasSeenDiceTip !== undefined) {
        compressed.metadata.hasSeenDiceTip = data.hasSeenDiceTip;
    }
    
    compressed._compressedSize = JSON.stringify(compressed).length;
    compressed._compressionRatio = ((compressed._originalSize - compressed._compressedSize) / compressed._originalSize * 100).toFixed(1);
    
    console.log(`[COMPRESSION] ${compressed._originalSize} → ${compressed._compressedSize} bytes (${compressed._compressionRatio}% redução)`);
    
    return compressed;
}

/**
 * Comprime um personagem removendo cache e dados temporários
 */
function compressCharacter(char) {
    if (!char) return char;
    
    const compressed = {
        // Dados essenciais
        id: char.id,
        name: char.name,
        identity: char.identity,
        class: char.class,
        level: char.level,
        age: char.age,
        photo: char.photo,
        history: char.history,
        
        // Atributos e stats
        attrs: char.attrs,
        stats: char.stats,
        skills: char.skills,
        powers: char.powers,
        
        // Inventário
        inventory: char.inventory ? {
            weapons: char.inventory.weapons || [],
            armor: char.inventory.armor || [],
            gear: char.inventory.gear || [],
            backpack: char.inventory.backpack || '',
            social: char.inventory.social || { people: [], objects: [] }
        } : {},
        
        // Metadados
        version: char.version,
        created: char.created,
        updated: char.updated
    };
    
    // Remove campos de cache e temporários
    // Campos como _cache, _temp, _lastSync são removidos
    
    return compressed;
}

/**
 * Descomprime dados para uso normal
 */
export function decompressData(compressed) {
    if (!compressed || !compressed._compressed) return compressed;
    
    const decompressed = {
        chars: {},
        config: {},
        hasSeenDiceTip: compressed.metadata?.hasSeenDiceTip
    };
    
    // Restaura personagens
    if (compressed.chars) {
        for (const [charId, char] of Object.entries(compressed.chars)) {
            decompressed.chars[charId] = decompressCharacter(char);
        }
    }
    
    // Restaura configurações
    if (compressed.metadata) {
        decompressed.config = {
            themeColor: compressed.metadata.themeColor || 'cyan',
            crtMode: compressed.metadata.crtMode || false,
            compactMode: compressed.metadata.compactMode || false,
            lowPerfMode: compressed.metadata.lowPerfMode || false,
            hackerMode: compressed.metadata.hackerMode || false
        };
    }
    
    console.log(`[COMPRESSION] Descomprimido ${compressed._compressedSize} → ${compressed._originalSize} bytes`);
    
    return decompressed;
}

/**
 * Descomprime um personagem
 */
function decompressCharacter(char) {
    if (!char) return char;
    
    // Garante estrutura mínima
    const decompressed = {
        ...char,
        
        // Garante campos obrigatórios
        attrs: char.attrs || { for: 0, agi: 0, int: 0, von: 0, pod: 0 },
        stats: char.stats || { 
            pv: { current: 10, max: 10 }, 
            pf: { current: 10, max: 10 }, 
            pdf: { current: 10, max: 10 } 
        },
        skills: char.skills || [],
        powers: char.powers || { 
            passive: '', 
            active: '', 
            techniques: [], 
            lvl3: '', 
            lvl6: '', 
            lvl9: '', 
            lvl10: '' 
        },
        inventory: char.inventory || {
            weapons: [],
            armor: [],
            gear: [],
            backpack: '',
            social: { people: [], objects: [] }
        },
        
        // Metadados
        version: char.version || '1.0',
        created: char.created || new Date().toISOString(),
        updated: char.updated || new Date().toISOString()
    };
    
    return decompressed;
}

/**
 * Verifica se os dados estão comprimidos
 */
export function isCompressed(data) {
    return data && typeof data === 'object' && data._compressed === true;
}

/**
 * Calcula tamanho do payload em bytes
 */
export function calculatePayloadSize(data) {
    return JSON.stringify(data).length;
}

/**
 * Sugere split de dados se muito grande
 */
export function shouldSplitData(data, maxSize = 800000) { // 800KB limite
    const size = calculatePayloadSize(data);
    return {
        shouldSplit: size > maxSize,
        size: size,
        sizeMB: (size / 1024 / 1024).toFixed(2),
        recommendation: size > maxSize ? `Dividir em ${Math.ceil(size / maxSize)} partes` : 'OK'
    };
}
