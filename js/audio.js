window.audioCtx = null;
window.sfxEnabled = true;
let lastHoverTime = 0;

// Buffer de ruído para sons de textura (High Tech)
let noiseBuffer = null;

window.initAudio = () => {
    if (!window.audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) {
            window.audioCtx = new AC();
            // Cria buffer de ruído
            const size = window.audioCtx.sampleRate * 2;
            noiseBuffer = window.audioCtx.createBuffer(1, size, window.audioCtx.sampleRate);
            const out = noiseBuffer.getChannelData(0);
            for(let i=0; i<size; i++) out[i] = Math.random() * 2 - 1;
        }
    }
    if (window.audioCtx && window.audioCtx.state === 'suspended') {
        window.audioCtx.resume().catch(e => console.log("Audio resume failed", e));
    }
};

window.SFX = {
    play(type) {
        if (!window.sfxEnabled) return;
        window.initAudio();
        if (!window.audioCtx || !noiseBuffer) return;

        const now = window.audioCtx.currentTime;
        
        // Anti-Spam para Hover (250ms)
        if (type === 'hover') {
            if (now - lastHoverTime < 0.25) return;
            lastHoverTime = now;
        }

        const gain = window.audioCtx.createGain();
        gain.connect(window.audioCtx.destination);

        if (type === 'hover') {
            // Som de ar comprimido curto (Tech UI)
            const src = window.audioCtx.createBufferSource();
            src.buffer = noiseBuffer;
            const filter = window.audioCtx.createBiquadFilter();
            filter.type = 'bandpass'; filter.frequency.value = 2000;
            src.connect(filter).connect(gain);
            
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            src.start(now); src.stop(now + 0.05);

        } else if (type === 'click') {
            // Click cristalino
            const osc = window.audioCtx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            osc.connect(gain); osc.start(now); osc.stop(now + 0.05);

        } else if (type === 'save') {
            // Confirmação suave
            const osc = window.audioCtx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.linearRampToValueAtTime(880, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.2);
            osc.connect(gain); osc.start(now); osc.stop(now + 0.2);

        } else if (type === 'discard') {
            // Erro / Cancelar
            const osc = window.audioCtx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.linearRampToValueAtTime(50, now + 0.15);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.15);
            osc.connect(gain); osc.start(now); osc.stop(now + 0.15);

        } else if (type === 'roll') {
            const osc = window.audioCtx.createOscillator();
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.linearRampToValueAtTime(600, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc.connect(gain); osc.start(now); osc.stop(now + 0.1);

        } else if (type === 'glitch') {
            // BSOD Sound
            const osc = window.audioCtx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(50, now);
            
            const lfo = window.audioCtx.createOscillator();
            lfo.frequency.value = 30;
            const lfoGain = window.audioCtx.createGain();
            lfoGain.gain.value = 500;
            lfo.connect(lfoGain).connect(osc.frequency);
            lfo.start(now); lfo.stop(now+1.5);
            
            gain.gain.setValueAtTime(0.5, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 1.5);
            osc.connect(gain); osc.start(now); osc.stop(now + 1.5);
        }
    },
    toggle(val) { window.sfxEnabled = val; }
};