import { Utils } from '../core/Utils.js';
import { BaseService } from './BaseService.js';

/**
 * SERVICIO DE RACK (RackService)
 * -----------------------------
 * Gestiona la base de datos de habitaciones, sus características estáticas 
 * (vistas, tipos) y el estado operativo dinámico (notas, bloqueos).
 */

// --- BASE DE DATOS ESTRÁTICA DEL HOTEL ---

// Clasificación por Vistas
const DATA_VISTAS = {
    PISCINA: [
        "019", "021", "023", "025", "027",
        "101", "103", "105", "107", "109", "113", "115", "117", "119", "120", "121", "122", "123", "124", "125", "127", "129", "131", "133", "145", "147", "149", "151", "153",
        "201", "203", "205", "207", "209", "213", "215", "217", "219", "220", "221", "222", "223", "224", "225", "227", "229", "231", "233", "245", "247", "249", "251", "253",
        "313", "315", "317", "319", "321", "325", "327", "329", "331", "332", "333", "334",
        "345", "335", "336", "337", "413", "415", "416", "347", "349", "407", "409", "411"
    ],
    MAR: [
        "010", "011", "014", "015", "016", "017", "018", "020", "022", "024", "026", "028", 
        "102", "104", "106", "108", "110", "111", "112", "114", "116", "118", "126", "128", "130", "132", "134", "135", "136", "137", "138", "139", "140", "141", "142", "143", "144", "146", "148", "150", "152",
        "202", "204", "206", "208", "210", "211", "212", "214", "216", "218", "226", "228", "230", "232", "234", "235", "236", "237", "238", "239", "240", "241", "242", "243", "244", "246", "248", "250", "252",
        "314", "316", "318", "320", "322", "323", "324", "326", "328", "330",
        "338", "339", "340", "341", "342", "343", "344", "346", "348", "406", "408", "410", "412", "414",
        "012", "013" 
    ],
    CALLE: [
        "301", "302", "303", "304", "305", "306", "307", "308", "309", "310", "311", "312",
        "401", "402", "403", "404", "405"
    ]
};

// Clasificación por Tipos de Habitación
const DATA_TIPOS = {
    MASTER_SUITE: ["341"],
    SUITE_STANDARD: ["338", "339", "340", "343", "412", "414"],
    DOBLE_SUPERIOR: ["335", "336", "337", "413", "415", "416", "405"] 
};

// Habitaciones Comunicadas (Parejas)
const DATA_PAREJAS_COMUNICADAS = [
    ["213", "215"], ["217", "219"], ["220", "221"],
    ["212", "214"], ["216", "218"]
];

// Características Especiales (Mobiliario)
const DATA_EXTRAS = {
    SOFA_CAMA: ["335", "336", "337", "413", "415", "416", "405"],
    CHESLONG: ["344", "346", "406", "345"],
    SOFA_STD: ["347", "349", "407", "409", "411", "342", "348", "408", "410"],
    ADAPTADA: ["401", "402"],
    RUIDOSA: [], // Se pueden marcar manualmente
    TRANQUILA: [], // Se pueden marcar manualmente
};

class RackService extends BaseService {
    constructor() {
        super('riu_rack', {});
        this.cacheDetails = null; // Caché para detalles calculados pesados
        
        // Esquema para validación (se guarda un objeto de objetos de habitación)
        this.schema = null; // Al ser un mapa dinámico { "hab": {} }, no aplicamos schema rígido aquí
    }

    /**
     * INICIALIZACIÓN ASÍNCRONA
     */
    async init() {
        await this.syncWithServer();
        return this.getAll();
    }

    /**
     * ACTUALIZAR HABITACIÓN
     * Guarda cambios manuales (ej: una nota sobre una avería o un cambio de sofá).
     */
    saveRoomData(roomNum, updates) {
        const currentData = this.getAll() || {};
        
        // Unimos los cambios nuevos con lo que ya teníamos
        if (!currentData[roomNum]) currentData[roomNum] = {};
        currentData[roomNum] = { ...currentData[roomNum], ...updates };
        
        this.save(currentData);
        
        // Limpiamos la caché de detalles calculados
        this.cacheDetails = null;
    }

    /**
     * OBTENER DETALLES DE UNA HABITACIÓN
     */
    getRoomDetails(num) {
        const savedData = this.getAll() || {};
        return {
            num,
            ...this._getRoomDetails(num, savedData)
        };
    }

    /**
     * OBTENER TODAS LAS HABITACIONES CON DETALLES
     * Une la lista básica de números de habitación con toda la "inteligencia"
     * estática y manual para que el Rack pueda dibujarlas con colores e iconos.
     */
    getRoomsWithDetails() {
        if (this.cacheDetails) return this.cacheDetails;

        // Obtenemos la lista plana de habitaciones (ej: 001 a 416)
        const rawRooms = Utils.getHabitaciones();
        
        // Obtenemos datos guardados (manuales)
        const savedData = this.getAll();

        this.cacheDetails = rawRooms.map(r => {
            const details = this._getRoomDetails(r.num, savedData);
            return {
                ...r,
                ...details
            };
        });

        return this.cacheDetails;
    }

    /**
     * CALCULAR DETALLES DE UNA HABITACIÓN (Método Interno)
     * Determina vista, tipo, extras y estado actual cruzando todas las tablas.
     */
    _getRoomDetails(num, savedData) {
        // ... (Logic remains similar but uses passed savedData) ...
        // 1. Determinar Vista
        let vista = 'DESCONOCIDO';
        if (DATA_VISTAS.PISCINA.includes(num)) vista = 'PISCINA';
        else if (DATA_VISTAS.MAR.includes(num)) vista = 'MAR';
        else if (DATA_VISTAS.CALLE.includes(num)) vista = 'CALLE';
        
        if (vista === 'DESCONOCIDO') {
             if (parseInt(num) % 2 !== 0) vista = 'PISCINA'; 
             else vista = 'MAR';
        }

        // 2. Determinar Tipo
        let tipo = 'ESTANDAR';
        if (DATA_TIPOS.MASTER_SUITE.includes(num)) tipo = 'MASTER_SUITE';
        else if (DATA_TIPOS.SUITE_STANDARD.includes(num)) tipo = 'SUITE_STANDARD';
        else if (DATA_TIPOS.DOBLE_SUPERIOR.includes(num)) tipo = 'DOBLE_SUPERIOR';

        // 3. Lógica de Habitaciones Comunicadas
        let comunicadaCon = null;
        const pareja = DATA_PAREJAS_COMUNICADAS.find(pair => pair.includes(num));
        if (pareja) {
            comunicadaCon = pareja.find(h => h !== num);
        }

        // 4. Extras Estáticos (Mobiliario)
        const extras = {
            sofaCama: DATA_EXTRAS.SOFA_CAMA.includes(num),
            cheslong: DATA_EXTRAS.CHESLONG.includes(num),
            sofa: DATA_EXTRAS.SOFA_STD.includes(num),
            comunicada: !!comunicadaCon,
            comunicadaCon: comunicadaCon,
            adaptada: DATA_EXTRAS.ADAPTADA.includes(num),
            ruidosa: DATA_EXTRAS.RUIDOSA.includes(num),
            tranquila: DATA_EXTRAS.TRANQUILA.includes(num)
        };

        // 5. Aplicar Sobrescrituras Manuales (Guardadas por el usuario)
        const saved = savedData[num];
        if (saved && saved.extras) {
            if (typeof saved.extras.sofa !== 'undefined') extras.sofa = saved.extras.sofa;
            if (typeof saved.extras.sofaCama !== 'undefined') extras.sofaCama = saved.extras.sofaCama;
            if (typeof saved.extras.cheslong !== 'undefined') extras.cheslong = saved.extras.cheslong;
            if (typeof saved.extras.ruidosa !== 'undefined') extras.ruidosa = saved.extras.ruidosa;
            if (typeof saved.extras.tranquila !== 'undefined') extras.tranquila = saved.extras.tranquila;
        }

        return {
            tipo,
            vista,
            extras,
            // Estado operativo y comentarios manuales
            status: (saved && saved.status) ? saved.status : 'DISPONIBLE',
            comments: (saved && saved.comments) ? saved.comments : ''
        };
    }

    // ... (getAllFilters remains unchanged) ...

    /**
     * OBTENER OPCIONES DE FILTRO
     * Se usa para rellenar los desplegables del buscador del Rack.
     */
    getAllFilters() {
        return {
            tipos: [
                { id: 'MASTER_SUITE', label: 'Master Suite' },
                { id: 'SUITE_STANDARD', label: 'Suite Estándar' },
                { id: 'DOBLE_SUPERIOR', label: 'Doble Superior' },
                { id: 'ESTANDAR', label: 'Estándar' }
            ],
            vistas: [
                { id: 'PISCINA', label: 'Vista Piscina' },
                { id: 'MAR', label: 'Vista Mar' },
                { id: 'CALLE', label: 'Vista Calle' }
            ],
            estados: [
                { id: 'DISPONIBLE', label: 'Disponible' },
                { id: 'BLOQUEADA', label: 'Bloqueada' }
            ],
            extras: [
                { id: 'comunicada', label: 'Comunicada' },
                { id: 'adaptada', label: 'Adaptada' },
                { id: 'sofaCama', label: 'Sofá Cama' },
                { id: 'cheslong', label: 'Cheslong' },
                { id: 'sofa', label: 'Sofá Estándar' },
                { id: 'ruidosa', label: 'Ruidosa' },
                { id: 'tranquila', label: 'Tranquila' }
            ]
        };
    }
}

export const rackService = new RackService();
