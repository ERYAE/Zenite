// --- AUDIO ENGINE V3 (SAFE MODE) ---
let audioCtx = null;
let sfxEnabled = true;
let ambianceOscillators = [];
let lastHoverElement = null; // Rastreia o último elemento para evitar spam

// Inicialização Segura do AudioContext
try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
} catch (e) {
    console.warn("Web Audio API não suportada ou bloqueada.");
}

// Buffer de Ruído (Criado apenas se o contexto existir)
let noiseBuffer = null;
if (audioCtx) {
    try {
        const bufferSize = audioCtx.sampleRate * 2;
        noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
    } catch(e) { console.error("Erro no buffer de audio", e); }
}

const SFX = {
    play(type) {
        if (!audioCtx || !sfxEnabled || !noiseBuffer) return;
        if (audioCtx.state === 'suspended') audioCtx.resume().catch(()=>{});

        const now = audioCtx.currentTime;
        const gain = audioCtx.createGain();
        gain.connect(audioCtx.destination);

        if (type === 'hover') {
            // Som de UI Tech (Suave)
            const src = audioCtx.createBufferSource();
            src.buffer = noiseBuffer;
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 1200; 
            src.connect(filter).connect(gain);
            
            gain.gain.setValueAtTime(0.03, now); // Volume baixo
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
            src.start(now); src.stop(now + 0.04);

        } else if (type === 'click') {
            // Click Físico
            const osc = audioCtx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.05);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            osc.connect(gain); osc.start(now); osc.stop(now + 0.05);

        } else if (type === 'save') {
            // Feedback Positivo
            const osc = audioCtx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.15);
            osc.connect(gain); osc.start(now); osc.stop(now + 0.15);

        } else if (type === 'discard') {
            // Feedback Negativo
            const osc = audioCtx.createOscillator();
            osc.type = 'square';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.linearRampToValueAtTime(50, now + 0.15);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.15);
            osc.connect(gain); osc.start(now); osc.stop(now + 0.15);
        } else if (type === 'glitch') {
            // ERRO FATAL
            const osc = audioCtx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(50, now);
            // LFO para tremer o som
            const lfo = audioCtx.createOscillator();
            lfo.frequency.value = 15;
            const lfoGain = audioCtx.createGain();
            lfoGain.gain.value = 500;
            lfo.connect(lfoGain).connect(osc.frequency);
            
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 2.0);
            
            lfo.start(now); osc.connect(gain); osc.start(now);
            lfo.stop(now + 2.0); osc.stop(now + 2.0);
        }
    },

    // Ambiente (Chuva/Drone)
    setAmbiance(type) {
        if (!audioCtx) return;
        // Para sons anteriores
        ambianceOscillators.forEach(node => { try{node.stop();}catch(e){} });
        ambianceOscillators = [];
        
        if(!sfxEnabled) return;

        const gain = audioCtx.createGain();
        gain.connect(audioCtx.destination);

        if (type === 'rain') {
            // Ruído Rosa Filtrado
            const src = audioCtx.createBufferSource();
            src.buffer = noiseBuffer;
            src.loop = true;
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass'; filter.frequency.value = 400;
            gain.gain.value = 0.05;
            src.connect(filter).connect(gain);
            src.start();
            ambianceOscillators.push(src);
        }
    },
    
    toggle(val) { 
        sfxEnabled = val; 
        if(!val) this.setAmbiance(null); 
    }
};