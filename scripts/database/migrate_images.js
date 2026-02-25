/**
 * MIGRACIÓN DE IMÁGENES BASE64 A ARCHIVOS FÍSICOS
 * -----------------------------------------------
 * Este script lee el archivo riu_lost_found.json y convierte todas las 
 * imágenes Base64 en archivos reales en storage/media/lost_found/
 */
import { lostFoundService } from './assets/js/services/LostFoundService.js';
import { Api } from './assets/js/core/Api.js';

export async function migrateLostFoundImages() {
    console.log("Iniciando migración de imágenes...");
    
    try {
        const items = await lostFoundService.getItems();
        let totalMigrated = 0;
        let totalItemsProcessed = 0;

        for (const item of items) {
            let itemChanged = false;
            
            if (item.imagenes && Array.isArray(item.imagenes)) {
                for (let i = 0; i < item.imagenes.length; i++) {
                    const img = item.imagenes[i];
                    
                    // Si empieza por 'data:image', es Base64
                    if (img.startsWith('data:image')) {
                        console.log(`Migrando imagen de objeto: ${item.objeto} (#${item.id})`);
                        
                        // Generar nombre genérico
                        const timestamp = Date.now();
                        const fileName = `migrated_${item.id}_${i}_${timestamp}.jpg`;
                        
                        try {
                            const response = await Api.post('storage/upload', {
                                fileName,
                                fileData: img,
                                folder: 'lost_found'
                            });
                            
                            if (response.success) {
                                item.imagenes[i] = response.path;
                                itemChanged = true;
                                totalMigrated++;
                            }
                        } catch (err) {
                            console.error(`Error al migrar imagen ${i} de ${item.id}:`, err);
                        }
                    }
                }
            }
            
            if (itemChanged) {
                await lostFoundService.saveItem(item);
                totalItemsProcessed++;
            }
        }

        const msg = `Migración completada. ${totalMigrated} imágenes movidas a archivos en ${totalItemsProcessed} objetos.`;
        console.log(msg);
        return msg;

    } catch (error) {
        console.error("Error crítico durante la migración:", error);
        throw error;
    }
}

// Exponer a la consola del navegador para ejecución manual si se desea
window.migrateLostFoundImages = migrateLostFoundImages;
