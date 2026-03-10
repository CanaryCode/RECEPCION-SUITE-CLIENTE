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
            modifiedAt: 'number',
            usuario: 'any',  // null = nota global, string = nota personal
            autor: 'any'     // quien creó la nota (puede ser null en notas antiguas)
        };
    }

    async init() {
        await this.syncWithServer();

        // NORMALIZACIÓN: Asegurar que notas antiguas tengan los campos nuevos
        // Esto evita errores de validación en BaseService
        const notas = this.getAll();
        let changed = false;

        notas.forEach(nota => {
            if (nota.protegida === undefined) { nota.protegida = false; changed = true; }
            else if (typeof nota.protegida !== 'boolean') { nota.protegida = !!nota.protegida; changed = true; }

            if (nota.favorito === undefined) { nota.favorito = false; changed = true; }
            else if (typeof nota.favorito !== 'boolean') { nota.favorito = !!nota.favorito; changed = true; }

            // Asegurar que modifiedAt sea un número válido
            if (nota.modifiedAt === undefined || typeof nota.modifiedAt !== 'number' || isNaN(nota.modifiedAt)) {
                nota.modifiedAt = nota.id || Date.now();
                changed = true;
            }
            if (nota.fecha === undefined) { 
                const dateId = new Date(nota.id || Date.now());
                nota.fecha = dateId.toLocaleDateString() + ' ' + dateId.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); 
                changed = true; 
            }
            if (nota.titulo === undefined) { nota.titulo = 'Nota'; changed = true; }
            if (nota.contenido === undefined) { nota.contenido = ''; changed = true; }
            if (nota.color === undefined) { nota.color = 'note-yellow'; changed = true; }
            if (typeof nota.color !== 'string') { nota.color = String(nota.color); changed = true; }
        });

        if (changed) {
            console.log(`[NotasService] Normalizadas ${notas.length} notas con nuevos campos.`);
            this.cache = notas;
            LocalStorage.set(this.endpoint, notas); // Guardamos sin pasar por validate() si fuera necesario
        }

        return notas;
    }

    /**
     * NORMALIZAR NOTA INDIVIDUAL
     * Asegura que una nota tenga todos los campos requeridos con tipos correctos
     */
    normalizeNota(nota) {
        if (nota.protegida === undefined) nota.protegida = false;
        else if (typeof nota.protegida !== 'boolean') nota.protegida = !!nota.protegida;

        if (nota.favorito === undefined) nota.favorito = false;
        else if (typeof nota.favorito !== 'boolean') nota.favorito = !!nota.favorito;

        // Asegurar que modifiedAt sea un número válido
        if (nota.modifiedAt === undefined || typeof nota.modifiedAt !== 'number' || isNaN(nota.modifiedAt)) {
            nota.modifiedAt = nota.id || Date.now();
        }

        if (nota.fecha === undefined) {
            const dateId = new Date(nota.id || Date.now());
            nota.fecha = dateId.toLocaleDateString() + ' ' + dateId.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        if (nota.titulo === undefined) nota.titulo = 'Nota';
        if (nota.contenido === undefined) nota.contenido = '';
        if (nota.color === undefined) nota.color = 'note-yellow';
        if (typeof nota.color !== 'string') nota.color = String(nota.color);

        // Normalizar campos de usuario (null si es global, string si es personal)
        if (nota.usuario === undefined) nota.usuario = null;
        else if (nota.usuario !== null && typeof nota.usuario !== 'string') nota.usuario = String(nota.usuario);

        if (nota.autor === undefined) nota.autor = null;
        else if (nota.autor !== null && typeof nota.autor !== 'string') nota.autor = String(nota.autor);

        return nota;
    }

    /**
     * OBTENER TODAS LAS NOTAS (con normalización automática)
     */
    getNotas() {
        const notas = this.getAll();
        // Normalizar cada nota antes de retornarla
        return notas.map(nota => this.normalizeNota(nota));
    }

    /**
     * GUARDAR O ACTUALIZAR NOTA (con normalización)
     */
    async saveNota(nota) {
        if (!nota.id) nota.id = Date.now();
        // Normalizar antes de guardar
        const notaNormalizada = this.normalizeNota({ ...nota });
        return this.update(notaNormalizada.id, notaNormalizada);
    }

    /**
     * ELIMINAR NOTA
     */
    async deleteNota(id) {
        return this.delete(id);
    }

    /**
     * BUSCAR POR ID (con normalización)
     */
    getNotaById(id) {
        const nota = this.getByKey(id);
        return nota ? this.normalizeNota(nota) : null;
    }

    /**
     * GUARDAR TODAS (Reordenar)
     */
    async saveNotas(notas) {
        return this.save(notas);
    }
}

export const notasService = new NotasService();
