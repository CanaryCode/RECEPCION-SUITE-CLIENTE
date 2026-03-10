import { Api } from '../core/Api.js';
import { sessionService } from './SessionService.js';

/**
 * SERVICIO DE USUARIO (UserService)
 * --------------------------------
 * Gestiona la obtención y actualización de datos del perfil del recepconista.
 */
class UserService {
    /**
     * OBTENER PERFIL ACTUAL
     * @returns {Promise<Object>} Datos del usuario logueado.
     */
    async getCurrentProfile() {
        const username = sessionService.getUser();
        if (!username) return null;

        return await Api.get('users/current');
    }

    /**
     * ACTUALIZAR PERFIL
     * @param {Object} data Datos a actualizar (display_name, email, current_password, new_password, avatar_url).
     * @returns {Promise<Object>} Resultado de la operación.
     */
    async updateProfile(data) {
        const username = sessionService.getUser();
        if (!username) throw new Error('Usuario no identificado');

        return await Api.post('users/update', data);
    }

    /**
     * SUBIR AVATAR
     * @param {File} file Archivo de imagen.
     * @returns {Promise<string>} Ruta del archivo guardado.
     */
    async uploadAvatar(file) {
        const username = sessionService.getUser();
        
        // Convertir a Base64 para usar el endpoint de upload existente
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async () => {
                try {
                    const fileName = `avatar_${username}_${Date.now()}.${file.name.split('.').pop()}`;
                    const res = await Api.post('storage/upload', {
                        fileName,
                        fileData: reader.result,
                        folder: 'avatars'
                    });
                    resolve(res.path);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
}

export const userService = new UserService();
