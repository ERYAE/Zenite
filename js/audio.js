const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let sfxEnabled = true;
let ambianceOscillators = [];
let lastHoverTime = 0; // Controle de spam

// Ruído Branco (Buffer) para sons de textura
const bufferSize = audioCtx.sampleRate * 2;
const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
const output = noiseBuffer.getChannelData(0);
for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
}

const SFX = {
    play(type) {
        if (!sfxEnabled || audioCtx.state === 'suspended') {
            if(audioCtx.state === 'suspended') audioCtx.resume();
            if(!sfxEnabled) return;
        }

        const now = audioCtx.currentTime;
        
        // --- ANTI-SPAM (THROTTLE) ---
        // Se for 'hover', só toca se passou 100ms desde o último
        if (type === 'hover') {
            if (now - lastHoverTime < 0.1) return; 
            lastHoverTime = now;
        }

        const gain = audioCtx.createGain();
        gain.connect(audioCtx.destination);

        if (type === 'hover') {
            // Click Tech Sutil (Filtrado)
            const src = audioCtx.createBufferSource();
            src.buffer = noiseBuffer;
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 2000; 
            src.connect(filter).connect(gain);
            
            gain.gain.setValueAtTime(0.08, now); // Volume
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            src.start(now); src.stop(now + 0.05);

        } else if (type === 'click') {
            // Click Mecânico
            const osc = audioCtx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
            
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            
            osc.connect(gain); osc.start(now); osc.stop(now + 0.1);

        } else if (type === 'roll') {
            // Som de dados (Rápido agudo)
            const osc = audioCtx.createOscillator();
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.linearRampToValueAtTime(1200, now + 0.2);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.2);
            osc.connect(gain); osc.start(now); osc.stop(now + 0.2);

        } else if (type === 'save') {
            // Sucesso / Salvo (Acorde Ascendente)
            const osc = audioCtx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.setValueAtTime(880, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.3);
            osc.connect(gain); osc.start(now); osc.stop(now + 0.3);

        } else if (type === 'discard') {
            // Cancelar / Fechar (Descendente)
            const osc = audioCtx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.linearRampToValueAtTime(50, now + 0.2);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.2);
            osc.connect(gain); osc.start(now); osc.stop(now + 0.2);

        } else if (type === 'glitch') {
            // ERRO FATAL (Assustador)
            const osc = audioCtx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(50, now); // Grave
            
            // Modulação de amplitude para tremer
            const lfo = audioCtx.createOscillator();
            lfo.frequency.value = 20; // 20hz tremor
            const lfoGain = audioCtx.createGain();
            lfoGain.gain.value = 500;
            lfo.connect(lfoGain).connect(osc.frequency);
            
            gain.gain.setValueAtTime(0.5, now); // Alto!
            gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
            
            lfo.start(now); osc.connect(gain); osc.start(now);
            lfo.stop(now + 2.0); osc.stop(now + 2.0);
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
            filter.type = 'lowpass'; filter.frequency.value = 400;
            gain.gain.value = 0.08;
            src.connect(filter).connect(gain);
            src.start();
            ambianceOscillators.push(src);
        } else if (type === 'drone') {
            const osc = audioCtx.createOscillator();
            osc.frequency.value = 60;
            gain.gain.value = 0.05;
            osc.connect(gain);
            osc.start();
            ambianceOscillators.push(osc);
        }
    },
    
    toggle(val) { sfxEnabled = val; if(!val) this.setAmbiance(null); }
};