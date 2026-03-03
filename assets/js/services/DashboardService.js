import { estanciaService } from './EstanciaService.js';
import { novedadesService } from './NovedadesService.js';
import { systemAlarmsService } from './SystemAlarmsService.js';
import { despertadorService } from './DespertadorService.js';
import { transfersService } from './TransfersService.js';
import { calendarioService } from './CalendarioService.js';
import { tareasService } from './TareasService.js';

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
    async getStats() {
        const estancias = estanciaService.getAll() || [];
        const novedades = novedadesService.getAll() || [];
        const alarmas = systemAlarmsService.getActiveAlarms() || [];
        const despertadores = despertadorService.getAll() || [];
        const tareas = tareasService.getAll() || [];

        // 1. Ocupación
        // Filtrar habitaciones realmente ocupadas (ignorar salidas pasadas si no se han limpiado, etc)
        // Por simplicidad, contamos registros activos en estanciaService
        const occupiedCount = estancias.length;
        // Asumimos un total fijo o configurado (Hotel Garoé tiene ~426 segun info, pero usaremos base 100 para demo si no hay config)
        const totalRooms = 150; // TODO: Pull from ConfigService if available
        const occupancyRate = Math.round((occupiedCount / totalRooms) * 100);

        // 2. Movimientos (Entradas/Salidas hoy)
        // Usar el mismo formato que el calendario para evitar desfases de zona horaria
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        
        const arrivals = estancias.filter(e => e.fechaEntrada === today).length;
        const departures = estancias.filter(e => e.fechaSalida === today).length;

        // 3. Novedades Recientes
        // Ordenar por ID desc (asumiendo ID incremental) o fecha
        const recentNovedades = [...novedades]
            .sort((a, b) => (b.id || 0) - (a.id || 0))
            .slice(0, 5);

        // 4. Pendientes (Hoy)
        const pendingWakeups = despertadores.filter(d => !d.completado).length;
        
        // 5. Traslados de Hoy
        let todayTransfers = 0;
        try {
            const transfers = transfersService.getTransfers() || [];
            todayTransfers = transfers.filter(t => t.fecha === today).length;
        } catch (e) {
            console.warn('[DashboardService] Error leyendo transfers:', e);
        }

        // 6. Eventos de Hoy
        let todayEvents = 0;
        try {
            const events = await calendarioService.getEventosDia(today);
            todayEvents = events ? events.length : 0;
        } catch (e) {
            console.warn('[DashboardService] Error leyendo eventos del calendario:', e);
        }

        // 7. Tareas de Hoy
        const todayTasks = tareas.filter(t => t.fecha === today && t.estado !== 'Terminada').length;

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
            pendingWakeups,
            todayTransfers,
            todayEvents,
            todayTasks
        };
    }
}

export const dashboardService = new DashboardService();
