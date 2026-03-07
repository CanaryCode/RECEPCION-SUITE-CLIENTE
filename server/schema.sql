-- Database Schema for Hotel Management System

CREATE DATABASE IF NOT EXISTS hotel_manager;
USE hotel_manager;

-- 1. RIU CLASS CUSTOMERS
CREATE TABLE IF NOT EXISTS clientes_riu (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    titular VARCHAR(255) NOT NULL,
    num_tarjeta VARCHAR(50) NOT NULL,
    habitacion VARCHAR(10),
    fecha_entrada DATE,
    fecha_salida DATE,
    adultos INT DEFAULT 1,
    ninos INT DEFAULT 0,
    nivel VARCHAR(20) DEFAULT 'Classic', -- Classic, Gold, Diamond
    comentario TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. SAFE RENTALS
CREATE TABLE IF NOT EXISTS safe_rentals (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    habitacion VARCHAR(10) NOT NULL UNIQUE,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    dias INT,
    coste DECIMAL(10, 2),
    pagado BOOLEAN DEFAULT FALSE,
    comentario TEXT,
    recepcionista VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. DESPERTADORES
CREATE TABLE IF NOT EXISTS despertadores (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    habitacion VARCHAR(10) NOT NULL,
    hora VARCHAR(5) NOT NULL, -- Format HH:mm
    comentario TEXT,
    autor VARCHAR(100),
    estado VARCHAR(20) DEFAULT 'Pendiente', -- Pendiente, Realizado
    fecha_programada DATE DEFAULT (CURRENT_DATE),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. ESTANCIA (OCCUPANCY STATS)
CREATE TABLE IF NOT EXISTS estancia_diaria (
    fecha DATE PRIMARY KEY,
    ocupadas INT DEFAULT 0,
    vacias INT DEFAULT 0,
    total_hab INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. NOVEDADES (LOGBOOK)
CREATE TABLE IF NOT EXISTS novedades (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    fecha DATE NOT NULL,
    hora VARCHAR(5) NOT NULL,
    prioridad VARCHAR(20) NOT NULL, -- Normal, Urgente
    autor VARCHAR(100) NOT NULL,
    texto TEXT NOT NULL,
    comentario TEXT, -- Seguimiento
    departamentos JSON, -- Array of strings e.g. ["Recepción", "Pisos"]
    estado VARCHAR(20) DEFAULT 'Pendiente', -- Pendiente, En Proceso, Terminada
    fecha_modificacion VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. NOTAS PERMANENTES
CREATE TABLE IF NOT EXISTS notas (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(255),
    contenido TEXT,
    color VARCHAR(20) DEFAULT 'note-yellow',
    rotacion VARCHAR(10) DEFAULT '0',
    fecha_creacion VARCHAR(50), -- String format stored in frontend currently
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. PRECIOS (PRODUCT LIST)
CREATE TABLE IF NOT EXISTS precios (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    precio DECIMAL(10, 2) NOT NULL,
    icono TEXT, -- Emoji or Base64 Image
    comentario VARCHAR(255),
    favorito BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. AGENDA CONTACTOS
CREATE TABLE IF NOT EXISTS agenda_contactos (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    vinculo VARCHAR(50), -- Empresa, Cliente, Hotel, Otro
    categoria VARCHAR(50), -- Urgencia, Información, Extensión
    telefonos JSON, -- Array of objects { tipo, prefijo, numero, flag }
    email VARCHAR(255),
    web VARCHAR(255),
    direccion JSON, -- { pais, ciudad, calle, numero, cp }
    comentarios TEXT,
    favorito BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. AYUDA (CHECKLISTS GUIDE)
CREATE TABLE IF NOT EXISTS guia_checks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    turno VARCHAR(20) NOT NULL, -- mañana, tarde, noche
    texto TEXT NOT NULL,
    hecho BOOLEAN DEFAULT FALSE,
    orden INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- 10. ARQUEO DE CAJA
CREATE TABLE IF NOT EXISTS arqueo_caja (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    fecha VARCHAR(50),
    turno VARCHAR(20),
    vales JSON,
    desembolsos JSON,
    comentarios TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. RESERVAS INSTALACIONES
CREATE TABLE IF NOT EXISTS reservas_instalaciones (
    id VARCHAR(50) PRIMARY KEY, -- ID generado en frontend (p.e. RES-123)
    instalacion VARCHAR(100),
    habitacion VARCHAR(10),
    fecha DATE,
    hora_inicio VARCHAR(5),
    hora_fin VARCHAR(5),
    personas INT DEFAULT 1,
    nombre VARCHAR(255),
    autor VARCHAR(100),
    comentarios TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 12. ATENCIONES (VIP/Room Amenities)
CREATE TABLE IF NOT EXISTS atenciones (
    habitacion VARCHAR(10) PRIMARY KEY,
    tipos JSON, -- ["Fruta", "Vino", "Flores"]
    comentario TEXT,
    autor VARCHAR(100),
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 13. CENAS FRÍAS
DROP TABLE IF EXISTS cenas_frias;
CREATE TABLE cenas_frias (
    id VARCHAR(50) PRIMARY KEY,
    habitacion VARCHAR(10),
    fecha DATE,
    cantidad INT DEFAULT 1,
    pax INT DEFAULT 1,
    obs TEXT,
    comentarios TEXT,
    autor VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 13b. DESAYUNOS (Early/Late)
DROP TABLE IF EXISTS desayunos;
CREATE TABLE desayunos (
    id VARCHAR(50) PRIMARY KEY,
    habitacion VARCHAR(10),
    fecha DATE,
    cantidad INT DEFAULT 1,
    pax INT DEFAULT 1,
    hora VARCHAR(5),
    obs TEXT,
    comentarios TEXT,
    autor VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 14. LOST & FOUND
CREATE TABLE IF NOT EXISTS lost_found (
    id VARCHAR(50) PRIMARY KEY,
    objeto VARCHAR(255),
    lugar VARCHAR(255),
    quien VARCHAR(255),
    estado VARCHAR(50) DEFAULT 'Almacenado',
    comentarios TEXT,
    imagenes JSON, -- ["path/to/img1", "path/to/img2"]
    fecha DATE,
    autor VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 15. TRANSFERS
DROP TABLE IF EXISTS transfers;
CREATE TABLE transfers (
    id VARCHAR(50) PRIMARY KEY,
    fecha DATE,
    tipo VARCHAR(50), -- Shuttle, Privado, Bus
    pasajeros INT DEFAULT 1,
    habitacion VARCHAR(10),
    hora VARCHAR(5),
    lugar_destino VARCHAR(255),
    nombre_cliente VARCHAR(255),
    externo BOOLEAN DEFAULT FALSE,
    notas TEXT,
    compania VARCHAR(100),
    vuelo VARCHAR(50),
    autor VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 16. EXCURSIONES (Registro de Ventas)
CREATE TABLE IF NOT EXISTS registro_excursiones (
    id VARCHAR(50) PRIMARY KEY,
    tipo_id VARCHAR(50), -- Referencia al catálogo
    huesped VARCHAR(255),
    habitacion VARCHAR(10),
    fecha_excursion DATE,
    adultos INT DEFAULT 0,
    ninos INT DEFAULT 0,
    total DECIMAL(10, 2),
    estado VARCHAR(20) DEFAULT 'Pendiente',
    vendedor VARCHAR(100),
    autor VARCHAR(100),
    fecha_venta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 17. RACK STATUS OVERRIDES (Limpieza/Comentarios)
CREATE TABLE IF NOT EXISTS rack_status (
    habitacion VARCHAR(10) PRIMARY KEY,
    estado VARCHAR(50), -- SUCIA, LIMPIA, OCUPADA
    comentarios TEXT,
    extras JSON, -- { sofa: true, etc }
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 18. ALARMAS DEL SISTEMA
CREATE TABLE IF NOT EXISTS system_alarms (
    id VARCHAR(50) PRIMARY KEY,
    msg TEXT NOT NULL,
    prioridad VARCHAR(20) DEFAULT 'Normal',
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 19. VALES / VOUCHERS
CREATE TABLE IF NOT EXISTS vales (
    id VARCHAR(50) PRIMARY KEY,
    habitacion VARCHAR(10),
    concepto TEXT,
    importe DECIMAL(10, 2),
    autor VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 20. GUÍA OPERATIVA (Checklist por turnos)
CREATE TABLE IF NOT EXISTS guia_operativa (
    turno VARCHAR(20) PRIMARY KEY, -- mañana, tarde, noche
    tareas JSON, -- Array de tareas [{id, texto, hecho}]
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 21. FAVORITOS DE GALERÍA
CREATE TABLE IF NOT EXISTS gallery_favorites (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    path TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 22. ADMIN USERS (Consola de Administración)
CREATE TABLE IF NOT EXISTS admin_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE,
    password_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inserción del usuario administrador inicial (password: gravina82)
-- El hash corresponde al SHA-256 de 'gravina82'
INSERT IGNORE INTO admin_users (username, password_hash) 
VALUES ('admin', '9e3953e9fea7ab3622aed509723766bff8e7500da19fba8e091d13504913af40');

-- 23. APP CONFIGURACIONES GLOBALES
CREATE TABLE IF NOT EXISTS app_config (
    config_key VARCHAR(100) PRIMARY KEY,
    config_value JSON
);

-- 24. EVENTOS DE CALENDARIO
CREATE TABLE IF NOT EXISTS calendario_eventos (
    id BIGINT PRIMARY KEY, -- Usamos el timestamp generado en el cliente
    titulo VARCHAR(255) NOT NULL,
    fecha DATE NOT NULL,
    hora VARCHAR(5) NOT NULL,
    categoria VARCHAR(50),
    priority VARCHAR(50),
    color VARCHAR(20),
    descripcion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 25. CHAT MESSAGES (Global Internal Chat)
CREATE TABLE IF NOT EXISTS chat_messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sender VARCHAR(100) NOT NULL,
    recipient VARCHAR(100) DEFAULT NULL,
    message TEXT NOT NULL,
    is_system BOOLEAN DEFAULT FALSE,
    is_read BOOLEAN DEFAULT 0,
    read_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 26. TURNOS EMPLEADOS
CREATE TABLE IF NOT EXISTS turnos_empleados (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    usuario VARCHAR(100) NOT NULL,
    fecha DATE NOT NULL,
    tipo_turno VARCHAR(50),
    es_pedido BOOLEAN DEFAULT FALSE,
    es_debido INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY (usuario, fecha)
);
