// UI e Efeitos Visuais

export function applyTheme(color) {
    const map = { 'cyan': '#0ea5e9', 'purple': '#d946ef', 'gold': '#eab308' };
    const hex = map[color] || map['cyan'];
    const r = parseInt(hex.slice(1,3), 16), g = parseInt(hex.slice(3,5), 16), b = parseInt(hex.slice(5,7), 16);
    
    document.documentElement.style.setProperty('--neon-core', hex); 
    document.documentElement.style.setProperty('--neon-rgb', `${r}, ${g}, ${b}`);
    
    const trail = document.getElementById('mouse-trail');
    if(trail) trail.style.background = `radial-gradient(circle, rgba(${r}, ${g}, ${b}, 0.2), transparent 70%)`;
}

export function updateChart(canvasId, values, isWizard=false) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    const color = getComputedStyle(document.documentElement).getPropertyValue('--neon-core').trim();
    // Simples conversão de hex para rgb para o alpha
    const r = parseInt(color.slice(1,3),16), g = parseInt(color.slice(3,5),16), b = parseInt(color.slice(5,7),16);
    const rgb = `${r},${g},${b}`;

    const config = {
        type: 'radar',
        data: {
            labels: ['FOR','AGI','INT','VON','POD'],
            datasets: [{
                data: values,
                backgroundColor: `rgba(${rgb}, 0.2)`,
                borderColor: `rgba(${rgb}, 1)`,
                borderWidth: 2,
                pointBackgroundColor: '#fff',
                pointRadius: isWizard ? 4 : 3
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { r: { min: -1, max: isWizard?4:6, ticks: { display: false, stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.1)' }, angleLines: { color: 'rgba(255,255,255,0.1)' } } },
            plugins: { legend: { display: false } },
            animation: { duration: 600 }
        }
    };

    if (ctx.chart) {
        ctx.chart.data.datasets[0].data = values;
        ctx.chart.data.datasets[0].backgroundColor = `rgba(${rgb}, 0.2)`;
        ctx.chart.data.datasets[0].borderColor = `rgba(${rgb}, 1)`;
        ctx.chart.update();
    } else {
        ctx.chart = new Chart(ctx, config);
    }
}

export function initCursor(isActiveFunc) {
    const trail = document.getElementById('mouse-trail');
    if (!trail || !window.matchMedia("(pointer: fine)").matches) return;
    
    let tx = 0, ty = 0, cx = -100, cy = -100, hover = false;
    document.addEventListener('mousemove', e => { cx=e.clientX; cy=e.clientY; hover = !!e.target.closest('.cursor-pointer, button, a, input'); });
    
    const loop = () => {
        if (isActiveFunc()) {
            tx += (cx - tx) * 0.45; ty += (cy - ty) * 0.45;
            trail.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
            trail.classList.toggle('hover-active', hover);
            trail.style.opacity = '1';
        } else { trail.style.opacity = '0'; }
        requestAnimationFrame(loop);
    };
    loop();
}