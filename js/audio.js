// --- AUDIO ENGINE v81 (SAFE) ---
let audioCtx = null;
let sfxEnabled = true;

// Inicializa somente sob demanda para evitar erro de Autoplay do navegador
const initAudio = () => {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
};

const SFX = {
    play(type) {
        if (!sfxEnabled) return;
        initAudio(); // Tenta iniciar contexto
        if (!audioCtx) return;

        const now = audioCtx.currentTime;
        const gain = audioCtx.createGain();
        gain.connect(audioCtx.destination);

        // --- SONS ---
        if (type === 'hover') {
            // Click tech muito breve
            const osc = audioCtx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.03);
            gain.gain.setValueAtTime(0.02, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
            osc.connect(gain); osc.start(now); osc.stop(now + 0.03);

        } else if (type === 'click') {
            const osc = audioCtx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc.connect(gain); osc.start(now); osc.stop(now + 0.1);

        } else if (type === 'save') {
            const osc = audioCtx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.setValueAtTime(880, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.3);
            osc.connect(gain); osc.start(now); osc.stop(now + 0.3);

        } else if (type === 'discard') {
            const osc = audioCtx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.linearRampToValueAtTime(50, now + 0.2);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.2);
            osc.connect(gain); osc.start(now); osc.stop(now + 0.2);

        } else if (type === 'glitch') {
            const osc = audioCtx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(50, now);
            gain.gain.setValueAtTime(0.5, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
            
            // Modulação simples
            const lfo = audioCtx.createOscillator();
            lfo.frequency.value = 50;
            const lfoGain = audioCtx.createGain();
            lfoGain.gain.value = 500;
            lfo.connect(lfoGain).connect(osc.frequency);
            
            lfo.start(now); osc.connect(gain); osc.start(now);
            lfo.stop(now + 2.0); osc.stop(now + 2.0);
        }
    },
    
    toggle(val) { sfxEnabled = val; }
};

// Expõe globalmente
window.SFX = SFX;