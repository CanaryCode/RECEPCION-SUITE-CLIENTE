import { BaseService } from "./BaseService.js";
import { RAW_AGENDA_DATA } from "../data/AgendaData.js";
import { Modal } from "../core/Modal.js";
import { LocalStorage } from "../core/LocalStorage.js";

/**
 * SERVICIO DE AGENDA (AgendaService)
 * ---------------------------------
 * Gestiona miles de contactos con optimización para grandes volúmenes.
 */
class AgendaService extends BaseService {
  constructor() {
    super('agenda_contactos');
    this.importKey = "riu_agenda_v_FINAL_v4_EXPRESS"; 
    
    // Esquema de validación para contactos
    this.schema = {
      nombre: 'string',
      telefonos: 'object', // Array de teléfonos
      vinculo: 'string',
      categoria: 'string'
    };
  }

  async init() {
     await super.init();
     const data = this.getAll();
     await this.verificarDatosIniciales(data);
     return data;
  }

  /**
   * OBTENER TODOS LOS CONTACTOS
   */
  getContactos() {
     return this.getAll();
  }

  /**
   * GUARDAR/ACTUALIZAR CONTACTO
   */
  async saveContacto(contacto) {
      return this.update(contacto.id, contacto);
  }

  /**
   * ELIMINAR CONTACTO
   */
  async removeContacto(id) {
      return this.delete(id);
  }

  /**
   * VERIFICACIÓN INICIAL
   * Comprueba si la agenda está vacía o dañada al arrancar.
   */
  async verificarDatosIniciales(data) {
    const esIncompleta = !Array.isArray(data) || data.length < 50;

    if (LocalStorage.get(this.importKey) === "true" && !esIncompleta) {

      return;
    }

    // Caso A: Los datos ya están completos, marcar y salir
    if (!esIncompleta) {
      LocalStorage.set(this.importKey, "true");
      return; // Added return here as per the logic implied by the diff
    }

    // Caso B: Los datos están incompletos o corruptos, iniciar auto-reparación
    console.warn("Agenda incompleta o corrupta. Iniciando auto-reparación...");
    await this.restaurarAgendaForzada(false); 
  }

  async restaurarAgendaForzada(interactive = true) {
    if (!RAW_AGENDA_DATA || RAW_AGENDA_DATA.length === 0) {
      if (interactive) await Modal.showAlert("Error Crítico: No hay datos maestros.", "error");
      return;
    }
    // The diff snippet for this function was incomplete and seemed to introduce new variables like masterData and chunkSize.
    // Assuming the intent was to replace localStorage.setItem with LocalStorage.set for the importKey.
    await this.importarDesdeTexto(RAW_AGENDA_DATA, true, interactive);
    LocalStorage.set(this.importKey, "true"); // Changed from localStorage.setItem
  }

  /**
   * IMPORTAR DESDE TEXTO (Proceso de Alto Rendimiento)
   * Utiliza 'Chunked Processing' para no bloquear el hilo principal.
   */
  async importarDesdeTexto(textoOrArray, mergeMode = false, interactive = true) {
    console.log(`Importando agenda... (Fusión: ${mergeMode})`);

    let bloques = Array.isArray(textoOrArray) ? textoOrArray : 
      textoOrArray.split("-----").map(b => b.trim()).filter(b => b.length > 0);

    const contactosActuales = this.getAll();
    const mapNombres = new Set(contactosActuales.map(c => c.nombre.trim().toLowerCase()));
    const nuevosContactos = [];
    let idCounter = Date.now();

    const CHUNK_SIZE = 50; 

    const processChunk = async (startIndex) => {
      return new Promise(async (resolve) => {
        const endIndex = Math.min(startIndex + CHUNK_SIZE, bloques.length);
        for (let i = startIndex; i < endIndex; i++) {
          const bloque = bloques[i];
          const lineas = bloque.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
          if (lineas.length === 0) continue;

          const nombre = lineas[0];
          if (mergeMode && mapNombres.has(nombre.toLowerCase())) continue;

          const telefonos = [];
          const extraLines = [];
          
          for (let j = 1; j < lineas.length; j++) {
            const linea = lineas[j];
            if (!/[0-9]/.test(linea)) {
                extraLines.push(linea);
                continue;
            }
            const posibleTel = linea.match(/[0-9\.\-\s\+]{6,}/);
            if (posibleTel) {
              telefonos.push({ 
                tipo: linea.toLowerCase().includes("ext") ? "Ext" : "Tel", 
                prefijo: "", numero: linea, flag: "" 
              });
            } else {
              extraLines.push(linea);
            }
          }

          nuevosContactos.push({
            id: idCounter++,
            nombre,
            telefonos,
            vinculo: "Otro",
            categoria: "Información",
            comentarios: extraLines.join(". "),
            favorito: false,
          });
        }
        setTimeout(() => resolve(endIndex < bloques.length ? endIndex : null), 5);
      });
    };

    let currentIndex = 0;
    while (currentIndex !== null) {
      currentIndex = await processChunk(currentIndex);
    }

    if (nuevosContactos.length > 0) {
      this.save([...contactosActuales, ...nuevosContactos]);
      if (interactive) {
          await Modal.showAlert(`✅ Agenda restaurada (+${nuevosContactos.length} contactos).`, "success");
          location.reload();
      } else if (window.showToast) {
          window.showToast(`Agenda reparada: +${nuevosContactos.length} contactos`, "success");
      }
    }
  }
}

export const agendaService = new AgendaService();
