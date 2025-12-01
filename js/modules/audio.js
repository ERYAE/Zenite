let audioCtx = null;
let userHasInteracted = false;
let isSfxEnabled = true;

export const setSfxEnabled = (enabled) => {
    isSfxEnabled = enabled;
    if (!enabled && audioCtx && audioCtx.state === 'running') audioCtx.suspend();
    else if (enabled && audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
};

export const initAudio = () => {
    if (audioCtx) return; 
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
};

// Inicializa no primeiro clique
document.addEventListener('click', () => {
    if (!userHasInteracted) {
        userHasInteracted = true;
        initAudio();
        if (audioCtx && audioCtx.state === 'suspended' && isSfxEnabled) audioCtx.resume();
    }
}, { once: true });

/* --- SINTETIZADORES --- */

// Som Mecânico/Aveludado (Modo Normal)
const playMechanical = (freqStart, duration) => {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    osc.type = 'triangle'; // Menos estridente que sine puro
    
    // Filtro Lowpass para tirar o "brilho" digital irritante
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, t);
    filter.frequency.exponentialRampToValueAtTime(100, t + duration);

    // Envelope de volume (Click curto e seco)
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.15, t + 0.005); // Ataque ultra-rápido
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    // Pitch Drop (Simula peso físico)
    osc.frequency.setValueAtTime(freqStart, t);
    osc.frequency.exponentialRampToValueAtTime(freqStart * 0.5, t + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(t);
    osc.stop(t + duration + 0.05);
};

// Som Glitch/Digital (Modo Hacker)
const playGlitch = (freq, type, duration) => {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const bitCrush = audioCtx.createScriptProcessor(4096, 1, 1); // Simulação simples de distorção

    osc.type = type; // square ou sawtooth
    osc.frequency.setValueAtTime(freq, t);
    
    // Pequena modulação aleatória de frequência
    if(Math.random() > 0.5) osc.frequency.linearRampToValueAtTime(freq + 100, t + 0.05);

    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start(t);
    osc.stop(t + duration + 0.05);
};

// Gerador de Ruído (Hover)
const playNoise = (isHacker) => {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    const bufferSize = audioCtx.sampleRate * 0.1; // 0.1s
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const filter = audioCtx.createBiquadFilter();
    const gain = audioCtx.createGain();

    if(isHacker) {
        filter.type = 'highpass';
        filter.frequency.value = 3000; // Chiado agudo
        gain.gain.setValueAtTime(0.05, t);
    } else {
        filter.type = 'lowpass';
        filter.frequency.value = 400; // Sopro grave suave
        gain.gain.setValueAtTime(0.02, t);
    }
    gain.gain.linearRampToValueAtTime(0, t + 0.05);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    noise.start(t);
};

export const playSFX = (type) => {
    if (!userHasInteracted || !audioCtx || !isSfxEnabled) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const isHacker = document.body.classList.contains('theme-hacker');

    try {
        if (type === 'hover') {
            playNoise(isHacker);
        } 
        else if (type === 'click') {
            if (isHacker) playGlitch(150, 'square', 0.1);
            else playMechanical(300, 0.08); // "Thock" satisfatório
        } 
        else if (type === 'success' || type === 'save') {
            if (isHacker) {
                setTimeout(() => playGlitch(880, 'square', 0.1), 0);
                setTimeout(() => playGlitch(1760, 'square', 0.1), 100);
            } else {
                playMechanical(440, 0.2); // Acorde suave
                setTimeout(() => playMechanical(554, 0.2), 50);
                setTimeout(() => playMechanical(659, 0.2), 100);
            }
        } 
        else if (type === 'error' || type === 'glitch') {
            playGlitch(100, 'sawtooth', 0.3);
            playGlitch(50, 'square', 0.3);
        }
    } catch(e) { console.error(e); }
};