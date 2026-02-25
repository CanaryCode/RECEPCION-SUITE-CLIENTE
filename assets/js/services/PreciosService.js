import { BaseService } from "./BaseService.js";
import { RAW_PRECIOS_DATA } from "../data/PreciosData.js";

/**
 * SERVICIO DE TARIFAS Y PRECIOS (PreciosService)
 * ---------------------------------------------
 * Gestiona el listado de cargos extra que se pueden aplicar.
 */
class PreciosService extends BaseService {
  constructor() {
    super("riu_precios", RAW_PRECIOS_DATA);

    // Esquema de validación para tarifas
    this.schema = {
      id: "any",
      nombre: "string", // Match UI field
      precio: "number",
      departamento: "string",
      comentario: "string" // Added to matches precios.js
    };
  }

  async init() {
    await this.syncWithServer();
    this.migrateLegacyData();
    this.checkAndSeedDefaults();
    return this.getAll();
  }

  /**
   * MIGRACIÓN DE DATOS LEGACY
   * Asegura que todos los productos tengan el nuevo formato de campos
   * y que no falten requerimientos de validación (como departamento).
   */
  migrateLegacyData() {
    const data = this.getAll();
    if (!Array.isArray(data)) return;
    
    let changed = false;
    const seenIds = new Set();
    
    const cleanedData = data.filter(item => item && typeof item === 'object').map((item, index) => {
      // Normalizar campos básicos
      item.nombre = item.nombre || item.concepto || "Producto sin nombre";
      item.departamento = item.departamento || "Recepción";
      item.comentario = item.comentario || item.descripcion || "";
      item.favorito = !!item.favorito;

      // Generar ID único garantizado si el actual falla o colisiona
      let currentId = item.id ? String(item.id).trim() : null;
      
      if (!currentId || currentId === "undefined" || seenIds.has(currentId)) {
        currentId = `p_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 5)}`;
        changed = true;
      }
      
      seenIds.add(currentId);
      item.id = currentId;

      if (typeof item.precio === 'string') {
        item.precio = parseFloat(item.precio.replace(',', '.')) || 0;
        changed = true;
      }

      return item;
    });

    if (changed) {
      this.cache = cleanedData;
      this.save(cleanedData);
    }
  }

  /**
   * VERIFICACIÓN DE DATOS MAESTROS
   */
  checkAndSeedDefaults() {
    const current = this.getAll();
    let changed = false;

    RAW_PRECIOS_DATA.forEach((defItem) => {
      const exists = current.some((p) => p.id === defItem.id);
      if (!exists) {
        current.push(defItem);
        changed = true;
      }
    });

    if (changed) {
      this.save(current);
    }
  }

  /**
   * OBTENER TODOS LOS PRECIOS
   */
  getPrecios() {
    return this.getAll();
  }

  /**
   * GUARDAR O ACTUALIZAR PRECIO
   */
  async savePrecio(precio) {
    if (!precio.id) precio.id = String(Date.now());
    else precio.id = String(precio.id);
    return this.update(precio.id, precio);
  }

  /**
   * ELIMINAR PRECIO
   */
  async deletePrecio(id) {
    return this.delete(id);
  }

  /**
   * BUSCAR POR ID
   */
  getPrecioById(id) {
    return this.getByKey(id);
  }

  /**
   * MARCAR/DESMARCAR FAVORITO
   */
  async toggleFavorito(id) {
    const item = this.getByKey(id);
    if (item) {
      item.favorito = !item.favorito;
      return this.update(id, item);
    }
  }
}

export const preciosService = new PreciosService();
