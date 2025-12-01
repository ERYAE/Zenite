let audioCtx = null;
let isSfxEnabled = true;

// Inicializa o contexto de áudio com interação do usuário
const initAudio = () => {
    if (audioCtx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
};

export const setSfxEnabled = (enabled) => {
    isSfxEnabled = enabled;
    if (audioCtx) {
        enabled ? audioCtx.resume() : audioCtx.suspend();
    }
};

// Sintetizador de Cliques de UI (Estilo macOS/iOS)
const playUiClick = (isHacker) => {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    
    // Oscilador principal
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    // Configuração "Glassy/Premium" (Modo Normal)
    if (!isHacker) {
        osc.type = 'sine'; // Onda senoidal pura (suave)
        
        // Envelope de Pitch (Queda rápida de tom imita impacto físico)
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.08);
        
        // Filtro LowPass para tirar o "brilho" digital excessivo
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3000, t);

        // Envelope de Volume (Muito curto e percussivo)
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.3, t + 0.001); // Ataque instantâneo
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08); // Decay rápido
    } 
    // Configuração "Glitch/Data" (Modo Hacker)
    else {
        osc.type = 'sawtooth'; // Onda dente de serra (áspera)
        
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.linearRampToValueAtTime(50, t + 0.1);
        
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1000, t);
        filter.frequency.linearRampToValueAtTime(100, t + 0.1);

        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    }

    // Conexões: Oscilador -> Filtro -> Ganho -> Saída
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(t);
    osc.stop(t + 0.1);
};

// Sintetizador de Hover (Sutil e "Arejado")
const playHover = (isHacker) => {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'triangle';
    // Frequência muito grave para dar apenas "peso"
    osc.frequency.setValueAtTime(isHacker ? 80 : 50, t);
    
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.05, t + 0.01);
    gain.gain.linearRampToValueAtTime(0, t + 0.04); // Muito curto

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.05);
};

// Sons de Sucesso e Erro (Acordes simples)
const playTone = (freq, type, duration) => {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + duration);
};

export const playSFX = (type) => {
    if (!audioCtx) initAudio(); // Tenta iniciar se ainda não foi
    if (audioCtx?.state === 'suspended') audioCtx.resume();
    if (!isSfxEnabled || !audioCtx) return;

    const isHacker = document.body.classList.contains('theme-hacker');

    try {
        switch (type) {
            case 'click':
                playUiClick(isHacker);
                break;
            case 'hover':
                playHover(isHacker);
                break;
            case 'success':
            case 'save':
                // Acorde Maior Suave
                playTone(440, 'sine', 0.3); // La
                setTimeout(() => playTone(554, 'sine', 0.4), 50); // Do#
                break;
            case 'error':
            case 'discard':
                // Tom dissonante
                playTone(150, 'sawtooth', 0.2);
                setTimeout(() => playTone(142, 'sawtooth', 0.2), 20);
                break;
        }
    } catch (e) {
        console.warn('Audio Error:', e);
    }
};