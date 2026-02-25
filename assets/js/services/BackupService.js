/**
 * SERVICIO DE COPIAS DE SEGURIDAD (BackupService)
 * ---------------------------------------------
 * Se encarga de coordinar la persistencia de todos los módulos del sistema.
 * Su función principal es recolectar los datos de cada servicio y forzar su 
 * sincronización/guardado, actuando como un seguro contra pérdida de información.
 */

import { agendaService } from './AgendaService.js';
import { notasService } from './NotasService.js';
import { novedadesService } from './NovedadesService.js';
import { atencionesService } from './AtencionesService.js';
import { desayunoService } from './DesayunoService.js';
import { despertadorService } from './DespertadorService.js';
import { estanciaService } from './EstanciaService.js';
import { preciosService } from './PreciosService.js';
import { safeService } from './SafeService.js';
import { systemAlarmsService } from './SystemAlarmsService.js';
import { ayudaService } from './AyudaService.js';
import { riuService } from './RiuService.js';
import { transfersService } from './TransfersService.js';
import { cenaFriaService } from './CenaFriaService.js';
import { rackService } from './RackService.js';
import { lostFoundService } from './LostFoundService.js';
import { cajaService } from './CajaService.js';
import { configService } from './ConfigService.js';
import { reservasInstalacionesService } from './ReservasInstalacionesService.js';

class BackupService {
    constructor() {
        this.services = [
            { name: "Agenda", svc: agendaService },
            { name: "Notas", svc: notasService },
            { name: "Novedades", svc: novedadesService },
            { name: "Atenciones", svc: atencionesService },
            { name: "Desayunos", svc: desayunoService },
            { name: "Despertadores", svc: despertadorService },
            { name: "Estancias", svc: estanciaService },
            { name: "Precios", svc: preciosService },
            { name: "Safe", svc: safeService },
            { name: "Alarmas Sistema", svc: systemAlarmsService },
            { name: "Guías Ayuda", svc: ayudaService },
            { name: "RIU Class", svc: riuService },
            { name: "Transfers", svc: transfersService },
            { name: "Cenas Frias", svc: cenaFriaService },
            { name: "Rack", svc: rackService },
            { name: "Objetos Perdidos", svc: lostFoundService },
            { name: "Caja (Arqueo)", svc: cajaService },
            { name: "Configuración", svc: configService },
            { name: "Reservas Instalaciones", svc: reservasInstalacionesService }
        ];
    }

    /**
     * EJECUTAR BACKUP COMPLETO
     * Recorre todos los servicios registrados, extrae sus datos actuales y 
     * activa el mecanismo de guardado de cada uno para asegurar la persistencia.
     */
    async performFullBackup() {
        console.log("Iniciando copia de seguridad integral...");
        const results = { success: [], error: [] };

        for (const item of this.services) {
            try {
                // Force read from local storage to ensure we have latest in memory
                const data = item.svc.getAll();
                
                // Trigger save mechanism which pushes to SyncManager
                if (item.svc.saveAll) {
                    item.svc.saveAll(data);
                } else {
                    item.svc.save(data);
                }
                
                results.success.push(item.name);
            } catch (e) {
                console.error(`Backup failed for ${item.name}`, e);
                results.error.push(`${item.name}: ${e.message}`);
            }
            // Small delay to yield to UI
            await new Promise(r => setTimeout(r, 50));
        }

        return results;
    }
}

export const backupService = new BackupService();
