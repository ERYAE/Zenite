// Utilitários genéricos (Matemática, Tempo, Eventos)

export function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

export function rollDice(faces) {
    const arr = new Uint32Array(1); 
    window.crypto.getRandomValues(arr); 
    return (arr[0] % faces) + 1;
}

export function generateId() {
    return 'z_' + Date.now();
}