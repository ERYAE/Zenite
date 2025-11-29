const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let sfxEnabled = true;
let ambianceOscillators = [];
let lastHoverTime = 0; // Controle de spam

// --- RUÍDO BRANCO (Buffer) ---
const createNoiseBuffer = () => {
    const bufferSize = audioCtx.sampleRate * 2;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    return buffer;
};
const noiseBuffer = createNoiseBuffer();

const SFX = {
    play(type) {
        // Verifica estado do áudio
        if (!sfxEnabled || audioCtx.state === 'suspended') {
            if(audioCtx.state === 'suspended') audioCtx.resume();
            if(!sfxEnabled) return;
        }

        const now = audioCtx.currentTime;
        
        // --- THROTTLE (Anti-Metralhadora) ---
        if (type === 'hover') {
            // 200ms de espera mínima entre sons de hover
            if (now - lastHoverTime < 0.2) return; 
            lastHoverTime = now;
        }

        const gain = audioCtx.createGain();
        gain.connect(audioCtx.destination);

        if (type === 'hover') {
            // Click Tech Sutil (Filtered Noise)
            const src = audioCtx.createBufferSource();
            src.buffer = noiseBuffer;
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 1500; 
            src.connect(filter).connect(gain);
            
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
            src.start(now); src.stop(now + 0.06);

        } else if (type === 'click') {
            // Click Mecânico (Triangle Wave)
            const osc = audioCtx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
            
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            
            osc.connect(gain); osc.start(now); osc.stop(now + 0.1);

        } else if (type === 'roll') {
            // Rolar Dados
            const osc = audioCtx.createOscillator();
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.linearRampToValueAtTime(800, now + 0.2);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.2);
            osc.connect(gain); osc.start(now); osc.stop(now + 0.2);

        } else if (type === 'save') {
            // Sucesso / Save (Acorde Ascendente)
            const osc = audioCtx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, now); // C5
            osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.4);
            osc.connect(gain); osc.start(now); osc.stop(now + 0.4);

        } else if (type === 'discard') {
            // Cancelar / Fechar (Sawtooth Descendente)
            const osc = audioCtx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.linearRampToValueAtTime(50, now + 0.2);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.2);
            osc.connect(gain); osc.start(now); osc.stop(now + 0.2);

        } else if (type === 'glitch') {
            // ERRO FATAL (Grave e Distorcido)
            const osc = audioCtx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(60, now); // Sub-grave
            
            // Tremolo Effect
            const lfo = audioCtx.createOscillator();
            lfo.frequency.value = 20; 
            const lfoGain = audioCtx.createGain();
            lfoGain.gain.value = 500;
            lfo.connect(lfoGain).connect(osc.frequency);
            
            gain.gain.setValueAtTime(0.6, now); // Alto
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
            
            lfo.start(now); osc.connect(gain); osc.start(now);
            lfo.stop(now + 1.5); osc.stop(now + 1.5);
        }
    },

    setAmbiance(type) {
        ambianceOscillators.forEach(o => { try{o.stop();}catch(e){} });
        ambianceOscillators = [];
        if(!sfxEnabled) return;

        const gain = audioCtx.createGain();
        gain.connect(audioCtx.destination);

        if (type === 'rain') {
            const src = audioCtx.createBufferSource();
            src.buffer = noiseBuffer;
            src.loop = true;
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass'; filter.frequency.value = 600;
            gain.gain.value = 0.05; 
            src.connect(filter).connect(gain);
            src.start();
            ambianceOscillators.push(src);
        }
    },
    
    toggle(val) { sfxEnabled = val; if(!val) this.setAmbiance(null); }
};