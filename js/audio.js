/**
 * ZENITE OS - Audio Engine 2.0
 * SFX de Interface + Gerador de Atmosfera Procedural (Sem arquivos pesados).
 */

window.SFX = {
    ctx: null,
    enabled: true,
    ambienceNodes: [], // Para guardar os osciladores ativos
    currentAmbienceType: null,

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    toggle(state) {
        this.enabled = state;
        if (!state) this.stopAmbience();
        else if (this.currentAmbienceType) this.setAmbience(this.currentAmbienceType);
    },

    // --- UI SOUNDS (Interface Tech) ---
    play(type) {
        if (!this.enabled) return;
        this.init();
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        gain.connect(this.ctx.destination);

        if (type === 'click') {
            // Click agudo e rápido
            osc.frequency.setValueAtTime(1000, t);
            osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
            gain.gain.setValueAtTime(0.05, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
            osc.connect(gain);
            osc.start(t); osc.stop(t + 0.1);
        } 
        else if (type === 'hover') {
            // "Sopro" digital muito sutil
            // (Simulado com senoidal pura baixa para não pesar processamento com buffer de ruído)
            osc.frequency.setValueAtTime(200, t);
            gain.gain.setValueAtTime(0.02, t);
            gain.gain.linearRampToValueAtTime(0.001, t + 0.05);
            osc.connect(gain);
            osc.start(t); osc.stop(t + 0.05);
        }
        else if (type === 'save') {
            // Sucesso (Acorde maior arpejado rápido)
            this.playTone(660, t, 0.1);
            this.playTone(880, t + 0.1, 0.2);
        }
        else if (type === 'error') {
            // Erro (Grave e dissonante)
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, t);
            osc.frequency.linearRampToValueAtTime(100, t + 0.3);
            gain.gain.setValueAtTime(0.1, t);
            gain.gain.linearRampToValueAtTime(0, t + 0.3);
            osc.connect(gain);
            osc.start(t); osc.stop(t + 0.3);
        }
    },

    playTone(freq, time, duration) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.05, time);
        gain.gain.linearRampToValueAtTime(0, time + duration);
        osc.start(time);
        osc.stop(time + duration);
    },

    // --- ATMOSFERA (Ambience Engine) ---
    stopAmbience() {
        this.ambienceNodes.forEach(node => {
            try { node.stop(); } catch(e){}
        });
        this.ambienceNodes = [];
    },

    setAmbience(type) {
        if (!this.enabled) {
            this.currentAmbienceType = type;
            return;
        }
        this.init();
        
        // Se já está tocando o mesmo, ignora
        if (this.currentAmbienceType === type && this.ambienceNodes.length > 0) return;

        // Transição suave: para o anterior
        this.stopAmbience();
        this.currentAmbienceType = type;

        if (type === 'neutral') {
            // Espacial / Sala de Servidor (Drone Grave Constante)
            this.createDrone(60, 'sine', 0.05);
            this.createDrone(110, 'triangle', 0.02);
        } 
        else if (type === 'rain') {
            // Chuva Cyberpunk (Pink Noise simulado com osciladores dessincronizados)
            // É uma aproximação para não usar script processor pesado
            this.createDrone(100, 'sawtooth', 0.01); // Vento
            // Sons aleatórios de gotas seriam feitos no loop principal, 
            // mas aqui deixamos apenas a "bed" sonora.
        }
        else if (type === 'combat') {
            // Tensão (Pulsante)
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.value = 40; // Muito grave
            
            // LFO para pulsar o volume
            const lfo = this.ctx.createOscillator();
            lfo.frequency.value = 2; // 2x por segundo
            const lfoGain = this.ctx.createGain();
            lfoGain.gain.value = 0.02; // Intensidade da pulsação
            
            lfo.connect(lfoGain);
            lfoGain.connect(gain.gain);
            
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(); lfo.start();
            
            this.ambienceNodes.push(osc, lfo);
        }
    },

    createDrone(freq, type, vol) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.value = vol;
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        this.ambienceNodes.push(osc);
    }
};