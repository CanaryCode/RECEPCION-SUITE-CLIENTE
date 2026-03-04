/**
 * Módulo de Inactividad (Idle Mode)
 * Detecta cuando el usuario no interactúa con la aplicación para activar efectos visuales.
 */

export async function inicializarIdle() {
  console.log('[IdleManager] Inicializando detector de inactividad...');
  
  let idleTimer;
  const IDLE_TIMEOUT = 25000; // 25 segundos para entrar en modo idle
  
  // No arrancar si no encontramos el header
  const titleEl = document.querySelector('.app-header-panel h1');
  if (!titleEl) return;

  function resetIdle() {
    clearTimeout(idleTimer);
    if (titleEl.classList.contains('idle-mode')) {
      titleEl.classList.remove('idle-mode');
    }
    idleTimer = setTimeout(enterIdle, IDLE_TIMEOUT);
  }

  function enterIdle() {
    titleEl.classList.add('idle-mode');
  }

  // Listeners para detectar actividad en la ventana
  window.addEventListener('mousemove', resetIdle);
  window.addEventListener('keydown', resetIdle);
  window.addEventListener('mousedown', resetIdle);
  window.addEventListener('touchstart', resetIdle);
  window.addEventListener('scroll', resetIdle, true);

  // Iniciar timer
  resetIdle();
}
