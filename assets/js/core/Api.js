import { APP_CONFIG } from './Config.js?v=V153_DB_CONFIG';
import { SecurityBarrier } from './SecurityBarrier.js?v=V145_VAL_FIX';

/**
 * SERVICIO DE COMUNICACIÓN (Api)
 * -----------------------------
 * Este módulo centraliza todas las llamadas al servidor Node.js.
 * Actúa como un "mensajero" que envía y recibe datos del backend.
 */
export const Api = {
    /**
     * URL BASE DINÁMICA
     * En arquitectura distribuida, elige entre el servidor local (Hardware/Config)
     * y el servidor remoto (Datos centralizados) según el endpoint.
     */
    _getFinalUrl(endpoint) {
        let apiUrl = APP_CONFIG.SYSTEM.API_URL || '/api';
        const remoteUrl = APP_CONFIG.SYSTEM.REMOTE_API_URL;

        const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;

        // Endpoints que SIEMPRE deben ser locales (acceso a hardware, ejecutable, etc)
        const isLocalOnly = cleanEndpoint.startsWith('system/') ||
            cleanEndpoint.startsWith('storage/') ||
            cleanEndpoint.startsWith('health');

        // Si tenemos un servidor remoto y el endpoint no es local-only, usamos el remoto
        if (remoteUrl && !isLocalOnly) {
            apiUrl = remoteUrl;
        }

        const base = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
        return `${base}/${cleanEndpoint}`;
    },

    get baseUrl() {
        return APP_CONFIG.SYSTEM.API_URL || '/api';
    },

    /**
     * PETICIÓN GET (Lectura)
     * Se usa para pedir datos al servidor (ej: leer una nota o un archivo).
     */
    async get(endpoint) {
        try {
            const finalUrl = this._getFinalUrl(endpoint);
            const separator = endpoint.includes('?') ? '&' : '?';
            const url = `${finalUrl}${separator}_t=${Date.now()}`;

            const headers = {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'X-Station-Key': sessionStorage.getItem('RS_STATION_KEY') || ''
            };

            const response = await fetch(url, { headers });
            if (response.status === 403) {
                SecurityBarrier.show('UNAUTHORIZED');
                throw new Error('Unauthorized');
            }
            if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
            return await response.json();
        } catch (error) {
            console.error(`Error en GET ${endpoint}:`, error);
            throw error;
        }
    },

    /**
     * PETICIÓN POST (Creación/Acción)
     * Se usa para enviar datos nuevos o ejecutar acciones (ej: guardar cambios o lanzar una app).
     */
    async post(endpoint, data) {
        try {
            const url = this._getFinalUrl(endpoint);
            const headers = {
                'Content-Type': 'application/json',
                'X-Station-Key': sessionStorage.getItem('RS_STATION_KEY') || ''
            };
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            });
            if (response.status === 403) {
                SecurityBarrier.show('UNAUTHORIZED');
                throw new Error('Unauthorized');
            }
            if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
            return await response.json();
        } catch (error) {
            console.error(`Error en POST ${endpoint}:`, error);
            throw error;
        }
    },

    async put(endpoint, data) {
        try {
            const url = this._getFinalUrl(endpoint);
            const headers = {
                'Content-Type': 'application/json',
                'X-Station-Key': sessionStorage.getItem('RS_STATION_KEY') || ''
            };
            const response = await fetch(url, {
                method: 'PUT',
                headers,
                body: JSON.stringify(data)
            });
            if (response.status === 403) {
                SecurityBarrier.show('UNAUTHORIZED');
                throw new Error('Unauthorized');
            }
            if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
            return await response.json();
        } catch (error) {
            console.error(`Error en PUT ${endpoint}:`, error);
            throw error;
        }
    },

    async delete(endpoint) {
        try {
            const url = this._getFinalUrl(endpoint);
            const headers = {
                'X-Station-Key': sessionStorage.getItem('RS_STATION_KEY') || ''
            };
            const response = await fetch(url, {
                method: 'DELETE',
                headers
            });
            if (response.status === 403) {
                SecurityBarrier.show('UNAUTHORIZED');
                throw new Error('Unauthorized');
            }
            if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
            return await response.json();
        } catch (error) {
            console.error(`Error en DELETE ${endpoint}:`, error);
            throw error;
        }
    },

    /**
     * VERIFICACIÓN DE SALUD (Health Check)
     * Permite probar si una URL específica responde correctamente.
     * Útil para configurar la IP del servidor.
     */
    async checkHealth(testUrl) {
        try {
            const url = testUrl.endsWith('/') ? testUrl.slice(0, -1) : testUrl;
            const fullUrl = `${url}/health?_t=${Date.now()}`;
            const response = await fetch(fullUrl, {
                headers: { 'Cache-Control': 'no-cache' },
                mode: 'cors'
            });
            if (!response.ok) return false;
            const data = await response.json();
            return data.status === 'ok';
        } catch (error) {
            console.warn(`Health check failed for ${testUrl}:`, error);
            return false;
        }
    },

    /**
     * HANDSHAKE DE ESTACIÓN
     * Verifica si el Agente Local está presente y obtiene su clave.
     */
    async validateStation() {
        try {
            // 1. Obtener el Local Token del Agente via proxy del servidor central
            // El navegador NO puede acceder a 127.0.0.1 desde HTTPS (Private Network Access policy).
            // En su lugar, el servidor conoce el token del agente a través del heartbeat.
            let localToken = null;
            try {
                const proxyBase = APP_CONFIG.SYSTEM.API_URL ? APP_CONFIG.SYSTEM.API_URL.replace(/\/api$/, '') : '';
                const tokenUrl = `${proxyBase}/api/admin/agent-proxy/local-token?_t=${Date.now()}`;
                const tokenRes = await fetch(tokenUrl, { headers: { 'Accept': 'application/json' } });
                if (tokenRes.ok) {
                    const tokenData = await tokenRes.json();
                    localToken = tokenData.token || null;
                }
            } catch (e) {
                // Silently fail - will try proxy auth without token
            }

            console.log(`[AUTH] Local Handshake Token: ${localToken ? 'Obtenido' : 'FALLO'}`);
            if (!localToken) {
                console.warn("[AUTH] No se pudo obtener el token local del Agente. ¿Está el proceso iniciado?");
            }

            // 2. Validar con el Servidor Central enviando el Token
            let proxyUrl = APP_CONFIG.SYSTEM.API_URL ? `${APP_CONFIG.SYSTEM.API_URL}/admin/agent-proxy/auth/id` : '/api/admin/agent-proxy/auth/id';
            if (localToken) proxyUrl += `?token=${localToken}`;

            // --- BUCLE DE REINTENTO (Retry 401) ---
            // Si el PC acaba de encender, el Agente puede tener un token nuevo que el servidor central 
            // aún no conoce (el heartbeat tarda unos segundos). Reintentamos 3 veces antes de rendirnos.
            let attempts = 0;
            let response = null;

            while (attempts < 3) {
                attempts++;
                response = await fetch(proxyUrl, { headers: { 'Accept': 'application/json' } });

                if (response.ok) break;

                if (response.status === 401 && attempts < 3) {
                    console.warn(`[AUTH] Intento ${attempts}/3: 401 Unauthorized. Esperando sincronización del Agente...`);
                    await new Promise(r => setTimeout(r, 4000)); // Esperar 4s para dar tiempo al heartbeat
                    continue;
                }
                break;
            }

            if (!response || !response.ok) {
                const errData = await response?.json().catch(() => ({}));
                console.error(`[AUTH] Error en validación Proxy (${response?.status}):`, errData?.message || 'Error desconocido');

                if (response?.status === 401) {
                    sessionStorage.removeItem('RS_STATION_KEY');
                }
                return null;
            }

            const data = await response.json();
            sessionStorage.setItem('RS_STATION_KEY', data.stationKey);
            return data;
        } catch (e) {
            console.error("[AUTH] Error crítico en handshake:", e);
            return null;
        }
    }
};
