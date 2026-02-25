import json

legacy_json_str = """
{
    "SYSTEM": {
        "USE_API": false,
        "USE_SYNC_SERVER": true,
        "API_URL": "/api",
        "SYNC_INTERVAL": 10000,
        "LAUNCHERS": [
            { "label": "SIHOT", "path": "", "icon": "display" },
            { "label": "ALTA RIU", "path": "", "icon": "house" },
            { "label": "GESTATUR", "path": "", "icon": "receipt" },
            { "label": "SUPREMO", "path": "", "icon": "tablet" },
            { "label": "ATLANTICO EXCURSIONES", "path": "", "icon": "camera" },
            { "label": "EXTRANET RIU", "path": "", "icon": "globe" }
        ],
        "GALLERY_PATH": "C:/Users/usuario/Desktop/ANTONIO/RECURSOS/INFORMACIÓN",
        "ADMIN_PASSWORD": "1234",
        "GALLERY_FOLDERS": [
            { "label": "ESCANER", "path": "Z:\\\\ESCANER" }
        ]
    },
    "HOTEL": {
        "NOMBRE": "Hotel Garoé",
        "ALARMAS_SISTEMA": [
            { "hora": "23:30", "mensaje": "Realizar lecturas de las VISAS", "dias": "todos" }
        ],
        "STATS_CONFIG": {
            "RANGOS": [
                { "planta": 0, "min": 10, "max": 28 },
                { "planta": 1, "min": 101, "max": 153 },
                { "planta": 2, "min": 201, "max": 253 },
                { "planta": 3, "min": 301, "max": 349 },
                { "planta": 4, "min": 401, "max": 416 }
            ],
            "FILTROS": {
                "TIPOS": [
                    { "label": "Estándar", "icon": "🛏️" },
                    { "label": "Doble Superior", "icon": "🌟" },
                    { "label": "Suite Estándar", "icon": "🛋️" },
                    { "label": "Master Suite", "icon": "👑" }
                ],
                "VISTAS": [
                    { "label": "Vista Mar", "icon": "🌊" },
                    { "label": "Vista Piscina", "icon": "🏊" },
                    { "label": "Vista Calle", "icon": "🏙️" }
                ],
                "CARACTERISTICAS": [
                    { "label": "Sofá Cama", "icon": "🛋️" },
                    { "label": "Cheslong", "icon": "🛋️" },
                    { "label": "Sofá Estándar", "icon": "🛋️" },
                    { "label": "Adaptada", "icon": "♿" },
                    { "label": "Comunicada", "icon": "↔️" },
                    { "label": "Ruidosa", "icon": "🔊" },
                    { "label": "Tranquila", "icon": "🔇" }
                ]
            }
        },
        "RECEPCIONISTAS": [
            "Pavel", "Javi", "Anadelia", "Marta", "Carmen", "Alberto", "Nerea", "Emiliano", "Domingo", "Antonio"
        ],
        "INSTALACIONES": [
            { "nombre": "Cancha de tennis", "apertura": "08:00", "cierre": "18:00", "icono": "🏠" },
            { "nombre": "Cancha de squash", "apertura": "08:00", "cierre": "18:00", "icono": "calendar" }
        ]
    },
    "AGENDA": {
        "PAISES": [
            { "c": "+34", "n": "España", "f": "🇪🇸" },
            { "c": "+49", "n": "Alemania", "f": "🇩🇪" },
            { "c": "+44", "n": "Reino Unido", "f": "🇬🇧" },
            { "c": "+33", "n": "Francia", "f": "🇫🇷" },
            { "c": "+39", "n": "Italia", "f": "🇮🇹" },
            { "c": "+351", "n": "Portugal", "f": "🇵🇹" },
            { "c": "+1", "n": "EE.UU.", "f": "🇺🇸" },
            { "c": "+52", "n": "México", "f": "🇲🇽" }
        ]
    },
    "NOVEDADES": {
        "DEPARTAMENTOS": [
            "Servicio Técnico", "Recepción", "Cocina", "Administración", "Dirección", "Economato", "Vigilancia", "Bar Hall", "Bar Piscina", "Alimentación y Bebidas", "Restaurante", "Pisos", "Jardinería", "Propiedad", "Externo"
        ]
    },
    "CAJA": {
        "BILLETES": [ 500, 200, 100, 50, 20, 10, 5 ],
        "MONEDAS": [ 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01 ],
        "FONDO": -2000
    },
    "COBRO": {
        "VALORES": [ 500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01 ]
    },
    "SAFE": { "PRECIO_DIARIO": 2 },
    "TRANSFERS": { "DESTINOS": [ "Aeropuerto Norte", "Aeropuerto Sur" ] },
    "EXCURSIONES_CATALOGO": [
        {
            "id": "CAT-1769894964475",
            "nombre": "loro parque",
            "operador": "atlantico",
            "precioAdulto": 23,
            "precioNiño": 12,
            "precioGrupo": 0,
            "esTicket": false
        }
    ]
}
"""

def deep_merge(current, legacy):
    if not isinstance(current, dict) or not isinstance(legacy, dict):
        return legacy
    
    result = current.copy()
    for key, value in legacy.items():
        if key in result:
            if isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = deep_merge(result[key], value)
            elif isinstance(result[key], list) and isinstance(value, list):
                # Specific logic for arrays depending on the key
                if key == "LAUNCHERS":
                    # Union by label
                    merged_list = value.copy()
                    labels = [item.get('label') for item in value]
                    for item in current[key]:
                        if item.get('label') not in labels:
                            merged_list.append(item)
                    result[key] = merged_list
                elif key == "GALLERY_FOLDERS":
                    # Union by path
                    merged_list = value.copy()
                    paths = [item.get('path') for item in value]
                    for item in current[key]:
                        if item.get('path') not in paths:
                            merged_list.append(item)
                    result[key] = merged_list
                elif key == "INSTALACIONES":
                    # Union by nombre
                    merged_list = value.copy()
                    names = [item.get('nombre') for item in value]
                    for item in current[key]:
                        if item.get('nombre') not in names:
                            merged_list.append(item)
                    result[key] = merged_list
                elif key == "PAISES":
                    # Union by n (name)
                    merged_list = value.copy()
                    names = [item.get('n') for item in value]
                    for item in current[key]:
                        if item.get('n') not in names:
                            merged_list.append(item)
                    result[key] = merged_list
                elif key == "FILTROS":
                     # FILTROS is a dict containing lists (TIPOS, VISTAS, etc)
                     # It will be handled by the dict recursion
                     pass
                else:
                    # For simple lists (RECEPCIONISTAS, DEPARTAMENTOS, etc), legacy replaces current if different
                    # but if current has things missing in legacy and they don't conflict, it's hard to tell.
                    # "Legacy prevails in discrepancy" suggests legacy array replaces current array.
                    result[key] = value
            else:
                # Discrepancy in primitive values - Legacy wins
                result[key] = value
        else:
            # Key only in legacy - Add it
            result[key] = value
    return result

with open('c:/Users/jesus/Documents/VSCode/RECEPCION SUITE v2/storage/config.json', 'r', encoding='utf-8') as f:
    current_config = json.load(f)

legacy_config = json.loads(legacy_json_str)

merged_config = deep_merge(current_config, legacy_config)

with open('c:/Users/jesus/Documents/VSCode/RECEPCION SUITE v2/storage/config.json', 'w', encoding='utf-8') as f:
    json.dump(merged_config, f, indent=4, ensure_ascii=False)

print("Merge completed successfully.")
