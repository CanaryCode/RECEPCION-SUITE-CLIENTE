/**
 * SECURITY BARRIER | SecurityBarrier.js
 * -----------------------------------
 * Gestiona la interfaz de "Acceso No Autorizado" de forma uniforme.
 */
export const SecurityBarrier = {
    /**
     * Muestra la pantalla de bloqueo de seguridad.
     * @param {string} reason - Razón del bloqueo ('AGENT_DOWN', 'UNAUTHORIZED', 'SERVER_DOWN')
     */
    show(reason = 'UNAUTHORIZED') {
        const existing = document.getElementById('rs-security-barrier');
        if (existing) return;

        let title = "ACCESO DENEGADO";
        let message = "No se ha podido validar la autorización de esta estación.";
        let icon = "bi-shield-lock-fill";
        let color = "#ff4444";

        if (reason === 'AGENT_DOWN') {
            title = "AGENTE NO DETECTADO";
            message = "El Agente Local de Recepción Suite no está respondiendo. Por seguridad, el acceso está bloqueado.";
            icon = "bi-plug-fill";
        } else if (reason === 'SERVER_DOWN') {
            title = "SERVIDOR NO DISPONIBLE";
            message = "El servidor central no responde. Es posible que no tengas conexión a la red de Tenerife.";
            icon = "bi-wifi-off";
            color = "#f39c12";
        }

        const overlay = document.createElement('div');
        overlay.id = 'rs-security-barrier';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100vh;
            background: #1a1a1a; color: white; z-index: 99999;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            text-align: center; font-family: 'Outfit', sans-serif;
        `;

        overlay.innerHTML = `
            <div style="font-size:5rem; color:${color}; margin-bottom:20px; animation: pulse 2s infinite;">
                <i class="bi ${icon}"></i>
            </div>
            <h1 style="font-size:2.5rem; margin-bottom:10px; font-weight:800; letter-spacing:-1px;">${title}</h1>
            <p style="font-size:1.2rem; max-width:600px; opacity:0.8; line-height:1.6; padding:0 20px;">
                ${message}
            </p>
            <div style="margin-top:30px; padding:20px; background:rgba(255,255,255,0.05); border-radius:15px; border-left:5px solid ${color}; text-align: left; max-width:550px;">
                <b style="color:${color}">¿Cómo solucionar esto?</b><br>
                <div style="font-size:0.95rem; margin-top:10px; opacity:0.9;">
                    1. Asegúrate de que el <b>Agente Local</b> esté encendido.<br>
                    2. Verifica que el equipo tenga conexión a Internet/Red.<br>
                </div>
            </div>
            <div style="margin-top:40px; display:flex; gap:15px; flex-wrap:wrap; justify-content:center;">
                <button onclick="location.reload()" style="padding:12px 35px; background:${color}; color:white; border:none; border-radius:10px; cursor:pointer; font-weight:bold; font-size:1.1rem; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
                    REINTENTAR CONEXIÓN
                </button>
            </div>
            <style>
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.05); opacity: 0.8; }
                    100% { transform: scale(1); opacity: 1; }
                }
            </style>
        `;

        document.body.appendChild(overlay);
    }
};
