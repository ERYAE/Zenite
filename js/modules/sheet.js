/**
 * ZENITE OS - Sheet Module
 * Responsável pela lógica interna da ficha (Matemática, Inventário, Status).
 */

window.SheetModule = function() {
    return {
        // Recalcula stats derivados (Vida, PF, PDF) baseado em Atributos + Nível
        recalcStats(char) {
            if (!char || !char.class) return char;

            const statsBase = {
                'Titã':        { pv: [15, 4], pf: [12, 2], pdf: [12, 2] },
                'Estrategista':{ pv: [12, 2], pf: [15, 4], pdf: [12, 2] },
                'Infiltrador': { pv: [12, 2], pf: [15, 4], pdf: [12, 3] },
                'Controlador': { pv: [12, 2], pf: [12, 2], pdf: [15, 4] },
                'Psíquico':    { pv: [12, 2], pf: [13, 3], pdf: [14, 3] }
            };

            const cfg = statsBase[char.class] || statsBase['Titã'];
            const lvl = parseInt(char.level) || 1;
            
            // Helpers para garantir número
            const getAttr = (key) => parseInt(char.attrs[key] || 0);

            // Fórmulas Oficiais Zenite
            const maxPV = (cfg.pv[0] + getAttr('for')) + ((cfg.pv[1] + getAttr('for')) * (lvl - 1));
            const maxPF = (cfg.pf[0] + getAttr('pod')) + ((cfg.pf[1] + getAttr('pod')) * (lvl - 1));
            const maxPDF = (cfg.pdf[0] + getAttr('von')) + ((cfg.pdf[1] + getAttr('von')) * (lvl - 1));

            // Atualiza Maximos
            char.stats.pv.max = maxPV;
            char.stats.pf.max = maxPF;
            char.stats.pdf.max = maxPDF;

            // Cura automática se o atual for maior que o máximo (bug prevention)
            if(char.stats.pv.current > maxPV) char.stats.pv.current = maxPV;
            if(char.stats.pf.current > maxPF) char.stats.pf.current = maxPF;
            if(char.stats.pdf.current > maxPDF) char.stats.pdf.current = maxPDF;
            
            return char;
        },

        // Modifica Atributo e atualiza gráfico + stats
        modAttr(char, key, val) {
            if (!char) return char;
            const current = char.attrs[key];
            
            // Limites (-1 a 5)
            if ((val > 0 && current < 6) || (val < 0 && current > -1)) {
                char.attrs[key] += val;
                char = this.recalcStats(char);
                
                // Atualiza gráfico visual se existir a função utilitária
                if(window.UTILS && window.UTILS.renderChart) {
                    const d = [char.attrs.for, char.attrs.agi, char.attrs.int, char.attrs.von, char.attrs.pod];
                    window.UTILS.renderChart('radarChart', d);
                }
            }
            return char;
        },

        // Gerenciamento de Inventário
        addItem(char, category) {
            const defs = {
                weapons: { name: 'Nova Arma', dmg: '1d6', range: 'Curto', type: 'Físico' },
                armor: { name: 'Novo Traje', def: '1', pen: '0' },
                gear: { name: 'Item', desc: '', qty: 1 },
                social_people: { name: 'Nome', role: 'Contato' },
                social_objects: { name: 'Objeto Importante', desc: '' }
            };

            // Garante estrutura
            if(!char.inventory.social) char.inventory.social = { people: [], objects: [] };

            if (category.startsWith('social_')) {
                const sub = category.split('_')[1];
                char.inventory.social[sub].push({ ...defs[category] });
            } else {
                char.inventory[category].push({ ...defs[category] });
            }
            return char;
        },

        removeItem(char, category, index, subCategory = null) {
            if (subCategory) {
                char.inventory.social[subCategory].splice(index, 1);
            } else {
                char.inventory[category].splice(index, 1);
            }
            return char;
        }
    };
};