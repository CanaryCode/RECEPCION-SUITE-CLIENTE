import { BaseService } from './BaseService.js';
import { LocalStorage } from '../core/LocalStorage.js';

/**
 * SERVICIO DE NOTAS PERMANENTES (NotasService)
 * -------------------------------------------
 * Gestiona el tablón de anuncios o notas que no caducan cada día.
 */
class NotasService extends BaseService {
    constructor() {
        super('riu_notas_permanentes');
        
        // Esquema de validación para notas
        this.schema = {
            id: 'number',
            titulo: 'string',
            contenido: 'string',
            color: 'string',
            fecha: 'string',
            protegida: 'boolean',
            favorito: 'boolean',
            modifiedAt: 'number'
        };
    }

    async init() {
        await this.syncWithServer();
        const notas = this.getAll();
        
        // NORMALIZACIÓN: Asegurar que notas antiguas tengan los campos nuevos
        // Esto evita errores de validación en BaseService
        let changed = false;
        notas.forEach(nota => {
            if (nota.protegida === undefined) { nota.protegida = false; changed = true; }
            if (nota.favorito === undefined) { nota.favorito = false; changed = true; }
            if (nota.modifiedAt === undefined) { nota.modifiedAt = nota.id || Date.now(); changed = true; }
            if (nota.fecha === undefined) { 
                const dateId = new Date(nota.id || Date.now());
                nota.fecha = dateId.toLocaleDateString() + ' ' + dateId.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); 
                changed = true; 
            }
            if (nota.titulo === undefined) { nota.titulo = 'Nota'; changed = true; }
            if (nota.contenido === undefined) { nota.contenido = ''; changed = true; }
            if (nota.color === undefined) { nota.color = 'note-yellow'; changed = true; }
        });

        if (changed) {
            console.log(`[NotasService] Normalizadas ${notas.length} notas con nuevos campos.`);
            this.cache = notas;
            LocalStorage.set(this.endpoint, notas); // Guardamos sin pasar por validate() si fuera necesario
        }

        return notas;
    }

    /**
     * OBTENER TODAS LAS NOTAS
     */
    getNotas() {
        return this.getAll();
    }

    /**
     * GUARDAR O ACTUALIZAR NOTA
     */
    async saveNota(nota) {
        if (!nota.id) nota.id = Date.now();
        return this.update(nota.id, nota);
    }

    /**
     * ELIMINAR NOTA
     */
    async deleteNota(id) {
        return this.delete(id);
    }

    /**
     * BUSCAR POR ID
     */
    getNotaById(id) {
        return this.getByKey(id);
    }

    /**
     * GUARDAR TODAS (Reordenar)
     */
    async saveNotas(notas) {
        return this.save(notas);
    }
}

export const notasService = new NotasService();
