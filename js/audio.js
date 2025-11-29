const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let sfxEnabled = true;
let ambianceOscillators = []; // Para controlar o clima

// --- RUÍDO BRANCO/ROSA (Base para chuva/vento) ---
const createNoiseBuffer = () => {
    const bufferSize = audioCtx.sampleRate * 2;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * white)) / 1.02; // Pink noise approx
        lastOut = output[i];
        output[i] *= 3.5; 
    }
    return buffer;
};
let lastOut = 0;
const noiseBuffer = createNoiseBuffer();

const SFX = {
    play(type) {
        if (!sfxEnabled || audioCtx.state === 'suspended') {
            if(audioCtx.state === 'suspended') audioCtx.resume();
            if(!sfxEnabled) return;
        }
        const now = audioCtx.currentTime;
        const gain = audioCtx.createGain();
        gain.connect(audioCtx.destination);

        // ... (Mesma lógica de SFX do anterior, mas encapsulada) ...
        // Vou resumir aqui para focar no novo:
        if(type === 'click') { /* ... */ } // Use o código anterior aqui
        // Adicionar som de "Dice Roll"
        if(type === 'roll') {
            const osc = audioCtx.createOscillator();
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.exponentialRampToValueAtTime(10, now + 0.3);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.connect(gain); osc.start(now); osc.stop(now + 0.3);
        }
    },

    setAmbiance(type) {
        // Limpa ambiente anterior
        ambianceOscillators.forEach(o => { try{o.stop();}catch(e){} });
        ambianceOscillators = [];

        if (type === 'rain') {
            // Simula Chuva Digital
            const src = audioCtx.createBufferSource();
            src.buffer = noiseBuffer;
            src.loop = true;
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass'; filter.frequency.value = 800;
            const gain = audioCtx.createGain();
            gain.gain.value = 0.05; // Baixo volume
            src.connect(filter).connect(gain).connect(audioCtx.destination);
            src.start();
            ambianceOscillators.push(src);
        } else if (type === 'drone') {
            // Drone Sci-Fi Grave
            const osc = audioCtx.createOscillator();
            osc.frequency.value = 55; // Grave
            const gain = audioCtx.createGain();
            gain.gain.value = 0.03;
            osc.connect(gain).connect(audioCtx.destination);
            osc.start();
            ambianceOscillators.push(osc);
        }
    },
    
    toggle(val) { sfxEnabled = val; if(!val) this.setAmbiance(null); }
};