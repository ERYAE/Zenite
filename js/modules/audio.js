let audioCtx = null;
let noiseBuffer = null;
let userHasInteracted = false;
let isSfxEnabled = true;

export const setSfxEnabled = (enabled) => {
    isSfxEnabled = enabled;
    // Se desabilitar, suspende o contexto para economizar recurso
    if (!enabled && audioCtx && audioCtx.state === 'running') {
        audioCtx.suspend();
    } else if (enabled && audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
};

export const initAudio = () => {
    if (audioCtx) return; 
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
        
        // Buffer de ruído suave para hover (Lowpass noise)
        const bufferSize = audioCtx.sampleRate * 2; // 2 segundos
        noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            // Ruído rosa (mais suave que o branco)
            const white = Math.random() * 2 - 1;
            output[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = output[i];
            output[i] *= 3.5; 
        }
    } catch(e) {
        console.warn("Audio Context blocked");
    }
};

let lastOut = 0;

// Inicializa no primeiro clique
document.addEventListener('click', () => {
    if (!userHasInteracted) {
        userHasInteracted = true;
        initAudio();
        if (audioCtx && audioCtx.state === 'suspended' && isSfxEnabled) {
            audioCtx.resume();
        }
    }
}, { once: true });

// Função auxiliar para criar tons suaves
const playTone = (freq, type, duration, vol = 0.1) => {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    
    gain.connect(audioCtx.destination);
    osc.connect(gain);
    
    // Envelope Suave (Aveludado)
    const now = audioCtx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.02); // Ataque suave
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration); // Decay suave
    
    osc.start(now);
    osc.stop(now + duration + 0.1);
};

export const playSFX = (type) => {
    if (!userHasInteracted || !audioCtx || !isSfxEnabled) return;

    // Se o contexto estiver suspenso (ex: navegador pausou), tenta retomar
    if (audioCtx.state === 'suspended') audioCtx.resume();

    try {
        const now = audioCtx.currentTime;

        if (type === 'hover') {
            // Hover muito sutil e grave
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(200, now);
            gain.connect(audioCtx.destination);
            osc.connect(gain);
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.02, now + 0.05);
            gain.gain.linearRampToValueAtTime(0, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.15);

        } else if (type === 'click') {
            // Clique "aveludado" (Sine wave aguda com decay rápido)
            playTone(800, 'sine', 0.1, 0.1);
            // Um segundo tom mais grave para dar corpo
            playTone(300, 'triangle', 0.1, 0.05);

        } else if (type === 'save') { 
            // Acorde maior suave
            playTone(440, 'sine', 0.4, 0.1); // La
            setTimeout(() => playTone(554, 'sine', 0.4, 0.1), 50); // Do#
            setTimeout(() => playTone(659, 'sine', 0.6, 0.1), 100); // Mi

        } else if (type === 'discard') { 
            // Tom descendente suave
            playTone(300, 'sine', 0.3, 0.1);
            setTimeout(() => playTone(200, 'sine', 0.4, 0.1), 100);

        } else if (type === 'glitch') {
            // Mantido um pouco de ruído, mas filtrado
            const src = audioCtx.createBufferSource();
            src.buffer = noiseBuffer;
            const gain = audioCtx.createGain();
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 500;
            
            src.connect(filter);
            filter.connect(gain);
            gain.connect(audioCtx.destination);
            
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.5);
            src.start(now);
            src.stop(now + 0.5);
            
        } else if (type === 'success') {
            playTone(523.25, 'sine', 0.3, 0.1); // Do
            setTimeout(() => playTone(1046.50, 'sine', 0.5, 0.1), 100); // Do Oitava

        } else if (type === 'error') {
            // Tom grave dissonante (Trítono)
            playTone(150, 'triangle', 0.4, 0.15);
            playTone(215, 'triangle', 0.4, 0.15);
        }
    } catch(e) {
        console.error("SFX Error", e);
    }
};