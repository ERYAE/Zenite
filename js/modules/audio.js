let audioCtx = null;
let isSfxEnabled = true;

// CORREÇÃO CRÍTICA: Adicionado 'export' para o app.js conseguir ler
export const initAudio = () => {
    if (audioCtx) return;
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
    } catch (e) {
        console.warn("AudioContext bloqueado ou não suportado");
    }
};

export const setSfxEnabled = (enabled) => {
    isSfxEnabled = enabled;
    if (audioCtx) {
        if (enabled && audioCtx.state === 'suspended') audioCtx.resume();
        if (!enabled && audioCtx.state === 'running') audioCtx.suspend();
    }
};

// Sintetizador de Cliques (Estilo Teclado Mecânico / "Thock")
const playUiClick = (isHacker) => {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    if (!isHacker) {
        // Som "Glassy" (Normal) - Suave e Premium
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.08);
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3000, t);

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.2, t + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    } else {
        // Som "Glitch" (Hacker) - Áspero e Retro
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.linearRampToValueAtTime(50, t + 0.1);
        
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1000, t);

        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    }

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(t);
    osc.stop(t + 0.1);
};

const playHover = () => {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(80, t); // Subgrave (apenas "pressão")
    
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.04, t + 0.01);
    gain.gain.linearRampToValueAtTime(0, t + 0.04);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.05);
};

const playTone = (freq, type, duration, vol = 0.1) => {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + duration);
};

export const playSFX = (type) => {
    if (!audioCtx) initAudio();
    if (!isSfxEnabled || !audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const isHacker = document.body.classList.contains('theme-hacker');

    try {
        switch (type) {
            case 'click':
            case 'save': 
                playUiClick(isHacker);
                break;
            case 'hover':
                playHover();
                break;
            case 'success':
                playTone(440, 'sine', 0.3);
                setTimeout(() => playTone(554, 'sine', 0.3), 50);
                break;
            case 'error':
            case 'discard':
                playTone(150, 'sawtooth', 0.2);
                setTimeout(() => playTone(140, 'sawtooth', 0.2), 50);
                break;
        }
    } catch (e) {
        // Silently fail to avoid console spam
    }
};