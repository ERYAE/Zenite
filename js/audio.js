window.audioCtx = null;
window.sfxEnabled = true;

// Gerenciador de Áudio Ambiente e SFX
window.SFX = {
    ambienceNode: null,
    currentAmbience: null,
    
    init() {
        if (!window.audioCtx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            window.audioCtx = new AC();
        }
        if (window.audioCtx.state === 'suspended') window.audioCtx.resume();
    },

    play(type) {
        if (!window.sfxEnabled || !window.audioCtx) return;
        this.init();
        const t = window.audioCtx.currentTime;
        const osc = window.audioCtx.createOscillator();
        const gain = window.audioCtx.createGain();
        gain.connect(window.audioCtx.destination);

        // Sons de Interface "High Tech" sutis
        if (type === 'hover') {
            // Ruído branco filtrado muito curto
            const buffer = window.audioCtx.createBuffer(1, 22050, 44100);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < 22050; i++) data[i] = Math.random() * 0.1; // Volume baixo
            const src = window.audioCtx.createBufferSource();
            src.buffer = buffer;
            const filter = window.audioCtx.createBiquadFilter();
            filter.type = 'highpass'; filter.frequency.value = 1000;
            src.connect(filter).connect(gain);
            src.start(t); src.stop(t + 0.05);
        } 
        else if (type === 'click') {
            osc.frequency.setValueAtTime(800, t);
            osc.frequency.exponentialRampToValueAtTime(300, t + 0.1);
            gain.gain.setValueAtTime(0.05, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
            osc.connect(gain); osc.start(t); osc.stop(t + 0.1);
        }
        else if (type === 'save') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, t);
            osc.frequency.setValueAtTime(880, t + 0.1);
            gain.gain.setValueAtTime(0.05, t);
            gain.gain.linearRampToValueAtTime(0.001, t + 0.3);
            osc.connect(gain); osc.start(t); osc.stop(t + 0.3);
        }
    },

    // Sistema de Ambiente (Drone Sintetizado)
    setAmbience(type) {
        if (!window.sfxEnabled) return;
        this.init();
        
        if (this.currentAmbience === type) return;
        if (this.ambienceNode) { this.ambienceNode.stop(); this.ambienceNode = null; }
        
        this.currentAmbience = type;
        if (type === 'none') return;

        const osc = window.audioCtx.createOscillator();
        const gain = window.audioCtx.createGain();
        const filter = window.audioCtx.createBiquadFilter();

        // Configurações por tipo de clima
        if (type === 'rain') {
            // Chuva é melhor com Noise Buffer, mas faremos um drone grave aqui por simplicidade
            osc.type = 'triangle';
            osc.frequency.value = 50; 
            filter.type = 'lowpass'; filter.frequency.value = 200;
            // LFO para variar volume
        } else if (type === 'combat') {
            osc.type = 'sawtooth';
            osc.frequency.value = 30; // Grave tenso
            filter.type = 'lowpass'; filter.frequency.value = 100;
        } else {
            // Neutral (Drone espacial)
            osc.type = 'sine';
            osc.frequency.value = 60;
        }

        gain.gain.value = 0.02; // Muito baixo, só fundo
        osc.connect(filter).connect(gain).connect(window.audioCtx.destination);
        osc.start();
        this.ambienceNode = osc;
    },

    toggle(val) { 
        window.sfxEnabled = val; 
        if(!val && this.ambienceNode) { this.ambienceNode.stop(); this.ambienceNode = null; }
    }
};