/**
 * ZENITE OS - Utilities Module
 * Responsável por: Gráficos, Imagens, Importação/Exportação.
 */

const UTILS = {
    // --- CHART.JS (Radar Chart) ---
    renderChart(id, data, isWizard=false) {
        const ctx = document.getElementById(id);
        if(!ctx) return;
        
        // Pega a cor do tema atual
        const style = getComputedStyle(document.documentElement);
        const color = style.getPropertyValue('--neon-core').trim();
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        const rgb = `${r},${g},${b}`;

        if (ctx.chart) {
            ctx.chart.data.datasets[0].data = data;
            ctx.chart.data.datasets[0].backgroundColor = `rgba(${rgb}, 0.2)`;
            ctx.chart.data.datasets[0].borderColor = `rgba(${rgb}, 1)`;
            ctx.chart.update();
        } else {
            ctx.chart = new Chart(ctx, {
                type: 'radar',
                data: {
                    labels: ['FOR','AGI','INT','VON','POD'],
                    datasets: [{
                        data: data,
                        backgroundColor: `rgba(${rgb}, 0.2)`,
                        borderColor: `rgba(${rgb}, 1)`,
                        borderWidth: 2,
                        pointBackgroundColor: '#fff',
                        pointRadius: isWizard ? 4 : 3
                    }]
                },
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
                            pointLabels: { color: 'white', font: { size: 10, family: 'JetBrains Mono' } }
                        }
                    },
                    plugins: { legend: { display: false } },
                    transitions: { active: { animation: { duration: 600 } } }
                }
            });
        }
    },

    // --- CROPPER.JS (Editor de Imagem) ---
    initCropper(file, imgElementId, callback) {
        if(!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const img = document.getElementById(imgElementId);
            if(img) {
                img.src = evt.target.result;
                if (callback) callback();
            }
        };
        reader.readAsDataURL(file);
    },

    getCroppedImage(cropperInstance) {
        if(!cropperInstance) return null;
        return cropperInstance.getCroppedCanvas({
            width: 300, 
            height: 300
        }).toDataURL('image/jpeg', 0.8);
    },

    // --- FILE SYSTEM (Backup) ---
    exportJSON(data, filename) {
        const s = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
        const a = document.createElement('a');
        a.href = s;
        a.download = filename;
        a.click();
        a.remove();
    },

    readJSON(file, callback) {
        if(!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = JSON.parse(evt.target.result);
                callback(data);
            } catch(e) {
                console.error("Erro ao ler JSON", e);
                callback(null, e);
            }
        };
        reader.readAsText(file);
    }
};