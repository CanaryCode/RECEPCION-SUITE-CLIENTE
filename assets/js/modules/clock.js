/**
 * MÓDULO DE RELOJ (Clock)
 * ----------------------
 * Muestra la fecha y hora actual en la cabecera.
 */
export const clock = {
    init() {
        this.update();
        setInterval(() => this.update(), 1000);
    },

    update() {
        const now = new Date();
        const elDate = document.getElementById('header-date');
        const elTime = document.getElementById('header-time');

        // Formato visual amigable
        // Fecha: "Lunes, 25 de Enero"
        // Hora: "14:30:05"

        if (elDate) {
            elDate.textContent = now.toLocaleDateString('es-ES', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
        }

        if (elTime) {
            elTime.textContent = now.toLocaleTimeString('es-ES', { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
            });
        }
    }
};
