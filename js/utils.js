/**
 * ZENITE OS - Utils Module
 * Funções auxiliares, Gráficos e Manipulação de Arquivos.
 */

window.UTILS = {
    // Gera IDs únicos para personagens/itens
    generateID(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    // Debounce: Evita salvar/executar funções muitas vezes seguidas
    debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },

    // --- CHART.JS (Radar Chart) ---
    renderChart(elementId, dataAttributes, isWizard = false) {
        const ctx = document.getElementById(elementId);
        if (!ctx) return;
        
        // Pega a cor do tema atual do CSS
        const style = getComputedStyle(document.documentElement);
        const colorHex = style.getPropertyValue('--neon-core').trim();
        
        // Converte Hex para RGB para transparência
        let r = 0, g = 0, b = 0;
        if (colorHex.length === 7) {
            r = parseInt(colorHex.slice(1, 3), 16);
            g = parseInt(colorHex.slice(3, 5), 16);
            b = parseInt(colorHex.slice(5, 7), 16);
        }

        const labels = ['FOR', 'AGI', 'INT', 'VON', 'POD'];
        const dataset = {
            data: dataAttributes, // [for, agi, int, von, pod]
            backgroundColor: `rgba(${r}, ${g}, ${b}, 0.2)`,
            borderColor: `rgba(${r}, ${g}, ${b}, 1)`,
            borderWidth: 2,
            pointBackgroundColor: '#fff',
            pointRadius: isWizard ? 4 : 3
        };

        if (ctx.chart) {
            ctx.chart.data.datasets[0] = dataset;
            ctx.chart.update();
        } else {
            ctx.chart = new Chart(ctx, {
                type: 'radar',
                data: { labels: labels, datasets: [dataset] },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        r: {
                            min: -1,
                            max: isWizard ? 4 : 6,
                            ticks: { display: false, stepSize: 1 },
                            grid: { color: 'rgba(255,255,255,0.1)', circular: false },
                            angleLines: { color: 'rgba(255,255,255,0.1)' },
                            pointLabels: { color: 'rgba(255,255,255,0.7)', font: { size: 10, family: 'Rajdhani' } }
                        }
                    },
                    plugins: { legend: { display: false } }
                }
            });
        }
    },

    // --- IMAGEM & CROPPER ---
    initCropper(file, imgElementId, callback) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const img = document.getElementById(imgElementId);
            if (img) {
                img.src = evt.target.result;
                if (callback) callback();
            }
        };
        reader.readAsDataURL(file);
    },

    getCroppedImage(cropperInstance) {
        if (!cropperInstance) return null;
        // Otimiza para 300x300 JPEG 80% para economizar espaço
        return cropperInstance.getCroppedCanvas({
            width: 300, 
            height: 300
        }).toDataURL('image/jpeg', 0.8);
    },

    // --- IMPORT/EXPORT ---
    exportJSON(data, filename = 'zenite_backup.json') {
        const s = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
        const a = document.createElement('a');
        a.href = s;
        a.download = filename;
        a.click();
        a.remove();
    },

    readJSON(file, callback) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = JSON.parse(evt.target.result);
                callback(data, null);
            } catch (e) {
                console.error("Erro JSON", e);
                callback(null, e);
            }
        };
        reader.readAsText(file);
    }
};