// Engine de Áudio (WebAudio API)
let audioCtx = null;
let noiseBuffer = null;
let sfxEnabled = true;
let interacted = false;

export function setSfxState(enabled) { sfxEnabled = enabled; }

export const initAudio = () => {
    if (audioCtx) return; 
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
        // Cria buffer de ruído branco para efeitos glitch/tech
        const bufferSize = audioCtx.sampleRate * 2;
        noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
    } catch(e) { console.warn("Audio blocked"); }
};

document.addEventListener('click', () => {
    interacted = true; initAudio();
    if (audioCtx?.state === 'suspended') audioCtx.resume();
}, { once: true });

export const playSFX = (type) => {
    if (!interacted || !audioCtx || !sfxEnabled) return;
    const t = audioCtx.currentTime;
    const g = audioCtx.createGain();
    g.connect(audioCtx.destination);

    // Sintetizador simples para evitar carregar arquivos MP3
    const osc = (type, f1, f2, dur, wave='sine') => {
        const o = audioCtx.createOscillator(); o.type = wave;
        o.frequency.setValueAtTime(f1, t);
        if(f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur/2);
        g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g); o.start(t); o.stop(t + dur);
    };

    switch(type) {
        case 'click': osc('click', 1200, 100, 0.05); break;
        case 'hover': 
            // Ruído filtrado para hover
            const src = audioCtx.createBufferSource(); src.buffer = noiseBuffer;
            const f = audioCtx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=800;
            src.connect(f); f.connect(g);
            g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.05);
            src.start(t); src.stop(t+0.05);
            break;
        case 'save': osc('save', 880, null, 0.6); break;
        case 'error': osc('error', 150, 100, 0.3, 'sawtooth'); break;
        case 'success': osc('success', 440, 880, 0.4, 'triangle'); break;
        case 'discard': osc('discard', 100, 10, 0.3, 'sawtooth'); break;
        case 'glitch': 
            const n = audioCtx.createBufferSource(); n.buffer = noiseBuffer;
            g.gain.setValueAtTime(0.8, t); g.gain.linearRampToValueAtTime(0.001, t+2);
            n.connect(g); n.start(t); n.stop(t+2);
            break;
    }
};