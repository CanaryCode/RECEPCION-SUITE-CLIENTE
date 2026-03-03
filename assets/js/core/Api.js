import { APP_CONFIG } from './Config.js';
import { SecurityBarrier } from './SecurityBarrier.js';

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
            cleanEndpoint.startsWith('health');

        let isForcedLocal = false;

        // Si tenemos un servidor remoto y el endpoint no es local-only, usamos el remoto
        if (remoteUrl && !isLocalOnly) {
            apiUrl = remoteUrl;
        } else if (isLocalOnly) {
            // Forzar URL del agente local explícita SIEMPRE para endpoints locales
            apiUrl = sessionStorage.getItem('RS_LOCAL_AGENT_URL') || 'http://localhost:3001';
            isForcedLocal = true;
        }

        const base = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
        const prefix = isForcedLocal ? `${base}/api` : base;
        return `${prefix}/${cleanEndpoint}`;
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
            const version = APP_CONFIG.SYSTEM.VERSION || Date.now();
            const url = `${finalUrl}${separator}v=${version}`;

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
                'X-Station-Key': sessionStorage.getItem('RS_STATION_KEY') || '',
                'X-Fingerprint': sessionStorage.getItem('RS_FINGERPRINT') || ''
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
                'X-Station-Key': sessionStorage.getItem('RS_STATION_KEY') || '',
                'X-Fingerprint': sessionStorage.getItem('RS_FINGERPRINT') || ''
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
     * HANDSHAKE DE ESTACIÓN (device-level)
     * Llama directamente al Agente Local en localhost:3001.
     * Solo funciona en el equipo donde está instalado el agente.
     * INTENCIONADO: NO hay fallback al proxy del servidor.
     * Si el agente no está en este equipo → bloqueado.
     */
    async validateStation() {
        try {
            // 1. Obtener token DIRECTAMENTE del agente local (device-specific)
            // El agente responde en localhost:3001/local-token.
            // Solo el equipo que tiene el agente instalado puede acceder a localhost.
            // Cualquier otro equipo de la misma red → ECONNREFUSED → null → bloqueado.
            // PRIORIDAD HTTP: La mayoría de PCs no tienen certificados TLS configurados.
            let localToken = null;
            const testUrls = [
                `http://localhost:3001/local-token?_t=${Date.now()}`,
                `http://127.0.0.1:3001/local-token?_t=${Date.now()}`,
                `https://localhost:3001/local-token?_t=${Date.now()}`,
                `https://127.0.0.1:3001/local-token?_t=${Date.now()}`
            ];

            for (const url of testUrls) {
                try {
                    console.log(`[AUTH] Intentando obtener token de: ${url}`);
                    const directRes = await fetch(url, {
                        headers: { 'Accept': 'application/json' }
                    });
                    if (directRes.ok) {
                        const data = await directRes.json();
                        localToken = data.token || null;
                        const fingerprint = data.fingerprint;
                        if (localToken) {
                            console.log(`[AUTH] Token obtenido con éxito de: ${url}`);
                            if (fingerprint) {
                                sessionStorage.setItem('RS_FINGERPRINT', fingerprint);
                                console.log(`[AUTH] Fingerprint guardado: ${fingerprint.substring(0, 12)}...`);
                            }
                            
                            // Guardar la URL base del agente detectado para resolver peticiones locales de forma absoluta
                            const baseUrlMatch = url.match(/^(https?:\/\/[^\/]+)/);
                            if (baseUrlMatch) {
                                sessionStorage.setItem('RS_LOCAL_AGENT_URL', baseUrlMatch[1]);
                                console.log(`[AUTH] Local Agent URL base guardada: ${baseUrlMatch[1]}`);
                            }
                            break;
                        }
                    }
                } catch (e) {
                    console.warn(`[AUTH] Fallo al conectar con ${url}:`, e.message);
                }
            }

            if (!localToken) {
                console.warn('[AUTH] No se pudo obtener token. El agente debe estar instalado EN ESTE EQUIPO.');
                return null;
            }

            // 2. Validar con el Servidor Central enviando el Token
            // El servidor verifica que el token corresponde a un agente activo.
            // Ya no valida IP — la seguridad de dispositivo la da el paso 1 (localhost).
            const authUrl = APP_CONFIG.SYSTEM.API_URL
                ? `${APP_CONFIG.SYSTEM.API_URL}/admin/agent-proxy/auth/id?token=${localToken}`
                : `/api/admin/agent-proxy/auth/id?token=${localToken}`;

            // Retry 401: el agente puede tardar unos segundos en registrar su token
            let attempts = 0;
            let response = null;

            while (attempts < 3) {
                attempts++;
                response = await fetch(authUrl, { headers: { 'Accept': 'application/json' } });
                if (response.ok) break;
                if (response.status === 401 && attempts < 3) {
                    console.warn(`[AUTH] Intento ${attempts}/3: 401. Esperando heartbeat del agente...`);
                    await new Promise(r => setTimeout(r, 4000));
                    continue;
                }
                break;
            }

            if (!response || !response.ok) {
                const errData = await response?.json().catch(() => ({}));
                console.error(`[AUTH] Error validación (${response?.status}):`, errData?.message || 'Error');
                if (response?.status === 401) sessionStorage.removeItem('RS_STATION_KEY');
                return null;
            }

            const data = await response.json();
            sessionStorage.setItem('RS_STATION_KEY', data.stationKey);
            return data;
        } catch (e) {
            console.error('[AUTH] Error crítico en handshake:', e);
            return null;
        }
    }
};
