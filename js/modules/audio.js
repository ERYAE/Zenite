let audioCtx = null;
let isSfxEnabled = true;

// CORREÇÃO: Adicionado 'export' para não dar erro no app.js
export const initAudio = () => {
    if (audioCtx) return;
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
    } catch (e) {
        console.warn("AudioContext não suportado ou bloqueado");
    }
};

export const setSfxEnabled = (enabled) => {
    isSfxEnabled = enabled;
    if (audioCtx) {
        if (enabled && audioCtx.state === 'suspended') audioCtx.resume();
        if (!enabled && audioCtx.state === 'running') audioCtx.suspend();
    }
};

const playTone = (freq, type, duration, vol = 0.05) => {
    if (!audioCtx || !isSfxEnabled) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
};

export const playSFX = (type) => {
    if (!audioCtx) initAudio();
    if (!audioCtx) return;

    try {
        if (type === 'click') {
            playTone(600, 'sine', 0.05, 0.1); 
        } else if (type === 'hover') {
            playTone(200, 'sine', 0.03, 0.02);
        } else if (type === 'success' || type === 'save') {
            playTone(800, 'sine', 0.1, 0.1);
            setTimeout(() => playTone(1200, 'sine', 0.2, 0.1), 100);
        } else if (type === 'error') {
            playTone(150, 'sawtooth', 0.2, 0.1);
        }
    } catch (e) {
        console.error(e);
    }
};