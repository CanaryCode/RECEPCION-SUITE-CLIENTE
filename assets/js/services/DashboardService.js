import { estanciaService } from './EstanciaService.js';
import { novedadesService } from './NovedadesService.js';
import { systemAlarmsService } from './SystemAlarmsService.js';
import { despertadorService } from './DespertadorService.js';

/**
 * SERVICIO DE DASHBOARD (DashboardService)
 * ---------------------------------------
 * Recolecta métricas en tiempo real de diversos servicios para mostrar
 * en el panel principal. No persiste datos propios.
 */
class DashboardService {
    
    /**
     * OBTENER ESTADÍSTICAS GLOBALES
     */
    getStats() {
        const estancias = estanciaService.getAll() || [];
        const novedades = novedadesService.getAll() || [];
        const alarmas = systemAlarmsService.getActiveAlarms() || [];
        const despertadores = despertadorService.getAll() || [];

        // 1. Ocupación
        // Filtrar habitaciones realmente ocupadas (ignorar salidas pasadas si no se han limpiado, etc)
        // Por simplicidad, contamos registros activos en estanciaService
        const occupiedCount = estancias.length;
        // Asumimos un total fijo o configurado (Hotel Garoé tiene ~426 segun info, pero usaremos base 100 para demo si no hay config)
        const totalRooms = 150; // TODO: Pull from ConfigService if available
        const occupancyRate = Math.round((occupiedCount / totalRooms) * 100);

        // 2. Movimientos (Entradas/Salidas hoy)
        const today = new Date().toISOString().split('T')[0];
        const arrivals = estancias.filter(e => e.fechaEntrada === today).length;
        const departures = estancias.filter(e => e.fechaSalida === today).length;

        // 3. Novedades Recientes
        // Ordenar por ID desc (asumiendo ID incremental) o fecha
        const recentNovedades = [...novedades]
            .sort((a, b) => (b.id || 0) - (a.id || 0))
            .slice(0, 5);

        // 4. Despertadores Pendientes (Hoy)
        const pendingWakeups = despertadores.filter(d => !d.completado).length;

        return {
            occupancy: {
                current: occupiedCount,
                total: totalRooms,
                rate: occupancyRate
            },
            movements: {
                arrivals,
                departures
            },
            alarms: {
                active: alarmas.length,
                critical: alarmas.filter(a => a.nivel === 'CRITICO').length
            },
            novedades: recentNovedades,
            pendingWakeups
        };
    }
}

export const dashboardService = new DashboardService();
