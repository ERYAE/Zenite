let audioCtx = null;
let noiseBuffer = null;
let userHasInteracted = false;
let isSfxEnabled = true; // Variável interna do módulo

// Função para atualizar o estado do SFX vindo do app.js
export const setSfxEnabled = (enabled) => {
    isSfxEnabled = enabled;
};

export const initAudio = () => {
    if (audioCtx) return; 
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
        const bufferSize = audioCtx.sampleRate * 2;
        noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
    } catch(e) {
        console.warn("Audio Context not supported or blocked");
    }
};

document.addEventListener('click', () => {
    userHasInteracted = true;
    initAudio();
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}, { once: true });

export const playSFX = (type) => {
    if (!userHasInteracted || !audioCtx || !isSfxEnabled) return;

    try {
        const now = audioCtx.currentTime;
        const gain = audioCtx.createGain();
        gain.connect(audioCtx.destination);

        if (type === 'hover') {
            const src = audioCtx.createBufferSource();
            src.buffer = noiseBuffer;
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 800;
            filter.Q.value = 10;
            src.connect(filter);
            filter.connect(gain);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            src.start(now); src.stop(now + 0.05);

        } else if (type === 'click') {
            const osc = audioCtx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1200, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            osc.connect(gain);
            osc.start(now); osc.stop(now + 0.05);

        } else if (type === 'save') { 
            const osc = audioCtx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, now);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
            osc.connect(gain);
            osc.start(now); osc.stop(now + 0.6);

        } else if (type === 'discard') { 
            const osc = audioCtx.createOscillator();
            osc.type = 'sawtooth';
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            osc.frequency.setValueAtTime(100, now);
            osc.frequency.linearRampToValueAtTime(10, now + 0.3);
            filter.frequency.setValueAtTime(500, now);
            filter.frequency.linearRampToValueAtTime(50, now + 0.3);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
            osc.connect(filter); filter.connect(gain);
            osc.start(now); osc.stop(now + 0.3);

        } else if (type === 'glitch') {
            const src = audioCtx.createBufferSource();
            src.buffer = noiseBuffer;
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 400;
            src.connect(filter);
            filter.connect(gain);
            gain.gain.setValueAtTime(0.8, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 2.0);
            src.start(now); src.stop(now + 2.0);
        } else if (type === 'success') {
            const osc = audioCtx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.linearRampToValueAtTime(880, now + 0.2);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.4);
            osc.connect(gain);
            osc.start(now); osc.stop(now + 0.4);
        } else if (type === 'error') {
            const osc = audioCtx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.3);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.3);
            osc.connect(gain);
            osc.start(now); osc.stop(now + 0.3);
        }
    } catch(e) {
        console.error("SFX Error", e);
    }
};