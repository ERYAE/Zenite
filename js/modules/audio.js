let audioCtx = null;
let isSfxEnabled = true;

const initAudio = () => {
    if (audioCtx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
};

export const setSfxEnabled = (enabled) => {
    isSfxEnabled = enabled;
    if (audioCtx) enabled ? audioCtx.resume() : audioCtx.suspend();
};

// Som de "Thock" (Clique satisfatório estilo teclado mecânico)
const playThock = (isHacker) => {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    // Normal: Senoidal Pura (Glassy). Hacker: Quadrada (Retro)
    osc.type = isHacker ? 'square' : 'sine';
    
    // Frequência: Cai rápido para simular impacto físico
    // Normal: 600Hz -> 100Hz. Hacker: 150Hz -> 50Hz (mais grave/sujo)
    osc.frequency.setValueAtTime(isHacker ? 150 : 600, t);
    osc.frequency.exponentialRampToValueAtTime(isHacker ? 50 : 100, t + 0.08);

    // Filtro para amaciar o som
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3000, t);
    
    // Envelope de Volume: Ataque instantâneo, decay muito curto
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(isHacker ? 0.1 : 0.15, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(t);
    osc.stop(t + 0.1);
};

// Som de Hover (Sopro sutil de ar)
const playAir = () => {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(80, t); // Subgrave imperceptível, só "sensação"
    
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.03, t + 0.01);
    gain.gain.linearRampToValueAtTime(0, t + 0.04);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.05);
};

export const playSFX = (type) => {
    if (!audioCtx) initAudio();
    if (audioCtx?.state === 'suspended') audioCtx.resume();
    if (!isSfxEnabled || !audioCtx) return;

    const isHacker = document.body.classList.contains('theme-hacker');

    try {
        switch (type) {
            case 'click':
            case 'save': // Reutilizando o clique bom para save
                playThock(isHacker);
                break;
            case 'hover':
                playAir();
                break;
            case 'success':
                // Pequeno acorde feliz
                setTimeout(() => playThock(isHacker), 0);
                setTimeout(() => playThock(isHacker), 80);
                break;
            case 'error':
            case 'discard':
                // Som grave e seco
                const t = audioCtx.currentTime;
                const osc = audioCtx.createOscillator();
                const g = audioCtx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(100, t);
                osc.frequency.linearRampToValueAtTime(50, t + 0.15);
                g.gain.setValueAtTime(0.1, t);
                g.gain.linearRampToValueAtTime(0, t + 0.15);
                osc.connect(g);
                g.connect(audioCtx.destination);
                osc.start(t);
                osc.stop(t + 0.2);
                break;
        }
    } catch (e) {}
};