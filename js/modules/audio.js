let audioCtx = null;
let noiseBuffer = null;
let userHasInteracted = false;
let isSfxEnabled = true;

export const setSfxEnabled = (enabled) => {
    isSfxEnabled = enabled;
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
        
        // Buffer de ruído para Glitch e Hover (Textura)
        const bufferSize = audioCtx.sampleRate * 2; 
        noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let lastOut = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            output[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = output[i];
            output[i] *= 3.5; 
        }
    } catch(e) {
        console.warn("Audio Context blocked");
    }
};

document.addEventListener('click', () => {
    if (!userHasInteracted) {
        userHasInteracted = true;
        initAudio();
        if (audioCtx && audioCtx.state === 'suspended' && isSfxEnabled) audioCtx.resume();
    }
}, { once: true });

// NOVO: Função para sons percussivos (Thock/Tap) em vez de Bipes
const playPercussive = (freqStart, freqEnd, duration) => {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    // Filtro para tirar o "brilho" irritante
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 3000;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    
    // Queda de tom rápida (Simula impacto físico)
    osc.frequency.setValueAtTime(freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, now + duration);
    
    // Envelope de volume curto e seco
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.01); // Ataque rápido
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.start(now);
    osc.stop(now + duration + 0.05);
};

// Mantido para sons melódicos (Success/Save)
const playTone = (freq, type, duration, vol = 0.1) => {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.connect(audioCtx.destination);
    osc.connect(gain);
    const now = audioCtx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.start(now);
    osc.stop(now + duration + 0.1);
};

export const playSFX = (type) => {
    if (!userHasInteracted || !audioCtx || !isSfxEnabled) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    try {
        const now = audioCtx.currentTime;

        if (type === 'hover') {
            // Hover ultra sutil (quase imperceptível, apenas "presença")
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.frequency.setValueAtTime(150, now); // Mais grave
            gain.connect(audioCtx.destination);
            osc.connect(gain);
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.02);
            gain.gain.linearRampToValueAtTime(0, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.1);

        } else if (type === 'click') {
            // SUBSTITUÍDO: "Thock" mecânico em vez de "Biip"
            // Começa em 300Hz e cai para 50Hz em 0.08s
            playPercussive(300, 50, 0.08);

        } else if (type === 'save') { 
            playTone(440, 'sine', 0.3, 0.05); 
            setTimeout(() => playTone(659, 'sine', 0.4, 0.05), 80); 

        } else if (type === 'discard') { 
            playTone(200, 'sine', 0.2, 0.05);

        } else if (type === 'glitch') {
            const src = audioCtx.createBufferSource();
            src.buffer = noiseBuffer;
            const gain = audioCtx.createGain();
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'highpass'; // Mudado para highpass para soar mais "elétrico"
            filter.frequency.value = 2000;
            src.connect(filter);
            filter.connect(gain);
            gain.connect(audioCtx.destination);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.2);
            src.start(now);
            src.stop(now + 0.2);
            
        } else if (type === 'success') {
            // Acorde de sucesso mais "brilhante" mas suave
            playTone(523.25, 'triangle', 0.2, 0.05); 
            setTimeout(() => playTone(1046.50, 'sine', 0.4, 0.05), 50);

        } else if (type === 'error') {
            playTone(150, 'sawtooth', 0.2, 0.05);
            setTimeout(() => playTone(140, 'sawtooth', 0.2, 0.05), 100);
        }
    } catch(e) {
        console.error("SFX Error", e);
    }
};