import { Api } from '../core/Api.js';

/**
 * SERVICIO DE MEDIOS (MediaService)
 * -------------------------------
 * Gestiona la carga de archivos al servidor.
 */
export const MediaService = {
    /**
     * SUBIR IMAGEN
     * @param {File} file - El objeto File del input
     * @param {string} folder - Carpeta destino dentro de storage/media/
     * @returns {Promise<string>} Ruta relativa del archivo guardado
     */
    async uploadImage(file, folder = 'misc') {
        try {
            // Generar un nombre único para evitar colisiones
            const timestamp = Date.now();
            const cleanName = file.name.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
            const fileName = `${timestamp}_${cleanName}`;
            
            // Convertir a Base64 para el envío (el servidor lo convertirá a buffer)
            const fileData = await this._fileToBase64(file);
            
            const response = await Api.post('storage/upload', {
                fileName,
                fileData,
                folder
            });
            
            if (response.success && response.path) {
                // Asegurar que guardamos la ruta de forma limpia (sin / inicial para que sea consistente)
                let savedPath = response.path;
                if (savedPath.startsWith('/')) savedPath = savedPath.substring(1);
                return savedPath;
            } else {
                console.error('Error del servidor en upload. Respuesta recibida:', JSON.stringify(response));
                throw new Error(response.error || 'Error desconocido al subir imagen (path faltante o success=false)');
            }
        } catch (error) {
            console.error('MediaService.uploadImage CRITICAL Error:', error);
            throw error;
        }
    },

    /**
     * Helper para convertir File a Base64
     */
    _fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }
};
