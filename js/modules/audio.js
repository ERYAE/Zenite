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

const playTone = (freq, type, duration, vol = 0.05) => {
    if (!audioCtx || !isSfxEnabled) return;
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
    if (audioCtx?.state === 'suspended') audioCtx.resume();

    try {
        if (type === 'click') {
            // Clique super curto e seco (0.05s) - Não irrita
            playTone(600, 'sine', 0.05, 0.1); 
        } else if (type === 'hover') {
            // Hover quase imperceptível
            playTone(200, 'sine', 0.03, 0.02);
        } else if (type === 'success') {
            playTone(800, 'sine', 0.1, 0.1);
            setTimeout(() => playTone(1200, 'sine', 0.2, 0.1), 100);
        } else if (type === 'error') {
            playTone(150, 'sawtooth', 0.2, 0.1);
        }
    } catch (e) {}
};