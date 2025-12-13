/**
 * Copyright © 2025 Zenite - Todos os direitos reservados
 * Projeto desenvolvido com assistência de IA
 */

/**
 * ZENITE OS - Image Compression Module
 * 
 * Comprime imagens para WebP antes de upload para economizar espaço no Supabase Storage
 * FREE TIER: 1GB de storage - precisamos otimizar!
 * 
 * FEATURES:
 * - Compressão para WebP (melhor compressão que JPEG/PNG)
 * - Redimensionamento automático (max 800x800 para avatares, 1200x1200 para capas)
 * - Qualidade ajustável
 * - Preview antes do upload
 * - Fallback para navegadores sem suporte a WebP
 */

/**
 * Comprime uma imagem para WebP
 * @param {File|Blob} file - Arquivo de imagem original
 * @param {object} options - Opções de compressão
 * @returns {Promise<Blob>} - Imagem comprimida em WebP
 */
export async function compressImage(file, options = {}) {
    const {
        maxWidth = 800,
        maxHeight = 800,
        quality = 0.85,
        outputFormat = 'image/webp'
    } = options;
    
    return new Promise((resolve, reject) => {
        // Verifica se é uma imagem
        if (!file.type.startsWith('image/')) {
            reject(new Error('Arquivo não é uma imagem'));
            return;
        }
        
        // Cria um elemento de imagem
        const img = new Image();
        const reader = new FileReader();
        
        reader.onload = (e) => {
            img.src = e.target.result;
        };
        
        reader.onerror = () => {
            reject(new Error('Erro ao ler arquivo'));
        };
        
        img.onload = () => {
            try {
                // Calcula dimensões mantendo aspect ratio
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = Math.floor(width * ratio);
                    height = Math.floor(height * ratio);
                }
                
                // Cria canvas
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                
                // Desenha imagem redimensionada
                ctx.drawImage(img, 0, 0, width, height);
                
                // Converte para blob
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('Falha ao comprimir imagem'));
                        }
                    },
                    outputFormat,
                    quality
                );
            } catch (error) {
                reject(error);
            }
        };
        
        img.onerror = () => {
            reject(new Error('Erro ao carregar imagem'));
        };
        
        reader.readAsDataURL(file);
    });
}

/**
 * Comprime imagem para avatar (400x400, qualidade alta)
 * @param {File|Blob} file - Arquivo de imagem
 * @returns {Promise<Blob>} - Imagem comprimida
 */
export async function compressAvatar(file) {
    return compressImage(file, {
        maxWidth: 400,
        maxHeight: 400,
        quality: 0.9
    });
}

/**
 * Comprime imagem para capa de campanha (1200x1200, qualidade média)
 * @param {File|Blob} file - Arquivo de imagem
 * @returns {Promise<Blob>} - Imagem comprimida
 */
export async function compressCampaignCover(file) {
    return compressImage(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.85
    });
}

/**
 * Comprime imagem para personagem (800x800, qualidade alta)
 * @param {File|Blob} file - Arquivo de imagem
 * @returns {Promise<Blob>} - Imagem comprimida
 */
export async function compressCharacterPhoto(file) {
    return compressImage(file, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.9
    });
}

/**
 * Compressão adaptativa baseada no tamanho original
 * Imagens maiores = mais compressão
 * @param {File|Blob} file - Arquivo de imagem
 * @param {string} type - Tipo ('avatar', 'character', 'campaign')
 * @returns {Promise<Blob>} - Imagem comprimida
 */
export async function compressAdaptive(file, type = 'character') {
    const sizeMB = file.size / (1024 * 1024);
    
    // Define qualidade baseada no tamanho
    let quality;
    if (sizeMB > 5) {
        quality = 0.6; // Imagens muito grandes: compressão agressiva
    } else if (sizeMB > 2) {
        quality = 0.75; // Imagens grandes: compressão média
    } else if (sizeMB > 1) {
        quality = 0.85; // Imagens médias: compressão leve
    } else {
        quality = 0.92; // Imagens pequenas: qualidade alta
    }
    
    // Define dimensões baseadas no tipo
    const dimensions = {
        avatar: { maxWidth: 400, maxHeight: 400 },
        character: { maxWidth: 600, maxHeight: 600 },
        campaign: { maxWidth: 1000, maxHeight: 1000 }
    };
    
    const { maxWidth, maxHeight } = dimensions[type] || dimensions.character;
    
    console.log(`[COMPRESSION] Adaptativa: ${sizeMB.toFixed(2)}MB -> qualidade ${quality}, max ${maxWidth}x${maxHeight}`);
    
    return compressImage(file, {
        maxWidth,
        maxHeight,
        quality
    });
}

/**
 * Gera preview de imagem comprimida
 * @param {Blob} blob - Blob da imagem comprimida
 * @returns {Promise<string>} - Data URL para preview
 */
export function generatePreview(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Erro ao gerar preview'));
        reader.readAsDataURL(blob);
    });
}

/**
 * Calcula economia de espaço
 * @param {number} originalSize - Tamanho original em bytes
 * @param {number} compressedSize - Tamanho comprimido em bytes
 * @returns {object} - Estatísticas de compressão
 */
export function getCompressionStats(originalSize, compressedSize) {
    const savedBytes = originalSize - compressedSize;
    const savedPercentage = ((savedBytes / originalSize) * 100).toFixed(1);
    
    return {
        originalSize,
        compressedSize,
        savedBytes,
        savedPercentage,
        originalSizeFormatted: formatBytes(originalSize),
        compressedSizeFormatted: formatBytes(compressedSize),
        savedBytesFormatted: formatBytes(savedBytes)
    };
}

/**
 * Formata bytes para leitura humana
 * @param {number} bytes - Bytes
 * @returns {string} - String formatada (ex: "2.5 MB")
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Verifica se o navegador suporta WebP
 * @returns {Promise<boolean>} - True se suporta WebP
 */
export function supportsWebP() {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        
        canvas.toBlob(
            (blob) => {
                resolve(blob !== null);
            },
            'image/webp'
        );
    });
}

/**
 * Wrapper para upload com compressão automática
 * @param {File} file - Arquivo original
 * @param {string} type - Tipo de imagem ('avatar', 'character', 'campaign')
 * @returns {Promise<{blob: Blob, stats: object}>} - Blob comprimido e estatísticas
 */
export async function compressForUpload(file, type = 'character') {
    const originalSize = file.size;
    
    let compressedBlob;
    
    switch (type) {
        case 'avatar':
            compressedBlob = await compressAvatar(file);
            break;
        case 'campaign':
            compressedBlob = await compressCampaignCover(file);
            break;
        case 'character':
        default:
            compressedBlob = await compressCharacterPhoto(file);
            break;
    }
    
    const stats = getCompressionStats(originalSize, compressedBlob.size);
    
    return {
        blob: compressedBlob,
        stats
    };
}

export default {
    compressImage,
    compressAvatar,
    compressCampaignCover,
    compressCharacterPhoto,
    compressAdaptive,
    generatePreview,
    getCompressionStats,
    supportsWebP,
    compressForUpload
};
