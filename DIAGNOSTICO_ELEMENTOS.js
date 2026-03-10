// SCRIPT DE DIAGNÓSTICO PARA ELEMENTOS INVISIBLES
// Pega esto en la consola del navegador

console.log("=== DIAGNÓSTICO DE ELEMENTOS ===");

// 1. Chat Toggle Button
const chatBtn = document.getElementById('chat-toggle-btn');
console.log("\n--- CHAT TOGGLE BUTTON ---");
console.log("Elemento encontrado:", !!chatBtn);
if (chatBtn) {
    const styles = window.getComputedStyle(chatBtn);
    const rect = chatBtn.getBoundingClientRect();
    console.log("Estilos computados:", {
        display: styles.display,
        visibility: styles.visibility,
        opacity: styles.opacity,
        position: styles.position,
        zIndex: styles.zIndex,
        width: styles.width,
        height: styles.height,
        bottom: styles.bottom,
        right: styles.right,
        transform: styles.transform
    });
    console.log("Rectángulo (posición en pantalla):", {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        bottom: rect.bottom,
        right: rect.right
    });
    console.log("¿Está en el viewport?",
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= window.innerHeight &&
        rect.right <= window.innerWidth
    );
}

// 2. Chat Mute Button
const muteBtn = document.getElementById('chat-mute-btn');
console.log("\n--- CHAT MUTE BUTTON ---");
console.log("Elemento encontrado:", !!muteBtn);
if (muteBtn) {
    const styles = window.getComputedStyle(muteBtn);
    const rect = muteBtn.getBoundingClientRect();
    console.log("Estilos computados:", {
        display: styles.display,
        visibility: styles.visibility,
        opacity: styles.opacity,
        position: styles.position,
        zIndex: styles.zIndex,
        width: styles.width,
        height: styles.height,
        bottom: styles.bottom,
        right: styles.right
    });
    console.log("Rectángulo:", rect);
}

// 3. Calculadora
const calc = document.getElementById('calculadora-flotante');
console.log("\n--- CALCULADORA ---");
console.log("Elemento encontrado:", !!calc);
if (calc) {
    const styles = window.getComputedStyle(calc);
    console.log("Estilos computados:", {
        display: styles.display,
        visibility: styles.visibility,
        opacity: styles.opacity,
        position: styles.position,
        zIndex: styles.zIndex,
        top: styles.top,
        right: styles.right
    });
}

// 4. Spotify
const spotify = document.getElementById('spotify-footer-player');
console.log("\n--- SPOTIFY ---");
console.log("Elemento encontrado:", !!spotify);
if (spotify) {
    const styles = window.getComputedStyle(spotify);
    const rect = spotify.getBoundingClientRect();
    console.log("Estilos computados:", {
        display: styles.display,
        visibility: styles.visibility,
        opacity: styles.opacity,
        position: styles.position,
        zIndex: styles.zIndex,
        bottom: styles.bottom,
        height: styles.height
    });
    console.log("Rectángulo:", rect);
}

// 5. Verificar todos los elementos con z-index muy alto
console.log("\n--- ELEMENTOS CON Z-INDEX ALTO ---");
const allElements = document.querySelectorAll('*');
const highZIndex = [];
allElements.forEach(el => {
    const z = window.getComputedStyle(el).zIndex;
    if (z !== 'auto' && parseInt(z) > 1000) {
        highZIndex.push({
            id: el.id || 'sin-id',
            class: el.className,
            zIndex: z,
            element: el
        });
    }
});
console.log("Elementos con z-index > 1000:", highZIndex.sort((a, b) => parseInt(b.zIndex) - parseInt(a.zIndex)));

console.log("\n=== FIN DEL DIAGNÓSTICO ===");
