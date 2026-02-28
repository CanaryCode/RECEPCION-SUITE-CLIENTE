-- HOTEL MANAGER - MASTER TEST DATA POPULATION SCRIPT
-- Limpia y rellena 13 módulos con datos ficticios realistas y variados.

-- LIMPIEZA INICIAL
DELETE FROM desayunos;
DELETE FROM cenas_frias;
DELETE FROM atenciones;
DELETE FROM despertadores;
DELETE FROM transfers;
DELETE FROM registro_excursiones;
DELETE FROM reservas_instalaciones;
DELETE FROM lost_found;
DELETE FROM estancia_diaria;
DELETE FROM vales;
DELETE FROM safe_rentals;
DELETE FROM clientes_riu;
DELETE FROM novedades;

-- 1. DESAYUNOS TEMPRANOS
INSERT INTO desayunos (habitacion, pax, hora, comentarios, autor, fecha) VALUES 
('101', 2, '06:30', 'Picnic Teide', 'Admin', CURDATE()),
('102', 1, '07:00', 'Desayuno rápido', 'Recepcion1', CURDATE()),
('201', 3, '06:15', 'Vuelo temprano', 'Admin', CURDATE()),
('305', 2, '06:45', 'Sin gluten', 'Recepcion1', CURDATE()),
('410', 4, '07:30', 'Familia completa', 'Admin', CURDATE()),
('501', 1, '06:00', 'Business traveller', 'Admin', CURDATE()),
('105', 2, '07:15', 'Regreso excursión nocturna', 'Recepcion2', CURDATE()),
('212', 2, '06:30', 'Salida antes de apertura', 'Admin', CURDATE()),
('314', 3, '06:45', 'Mucha fruta solicitada', 'Recepcion1', CURDATE()),
('402', 2, '07:00', 'Estándar', 'Admin', CURDATE());

-- 2. CENAS FRÍAS
INSERT INTO cenas_frias (habitacion, pax, comentarios, autor, fecha) VALUES 
('104', 2, 'Llegada tarde vuelo', 'Admin', CURDATE()),
('202', 1, 'Viene del aeropuerto', 'Recepcion1', CURDATE()),
('301', 3, 'Vegetarianos', 'Admin', CURDATE()),
('405', 2, 'Sin lactosa', 'Recepcion1', CURDATE()),
('505', 2, 'VIP Bienvenida', 'Admin', CURDATE()),
('110', 1, 'Check-in 01:00 AM', 'Admin', CURDATE()),
('215', 2, 'Excursión terminó tarde', 'Recepcion2', CURDATE()),
('320', 4, 'Pack familiar', 'Admin', CURDATE()),
('411', 2, 'Solo sándwiches', 'Recepcion1', CURDATE()),
('515', 1, 'Sin postre', 'Admin', CURDATE());

-- 3. ATENCIONES VIP
INSERT INTO atenciones (habitacion, tipos, comentario, autor, actualizado_en) VALUES 
('101', '["Fruta", "Cava"]', 'Aniversario', 'Admin', NOW()),
('201', '["Agua", "Carta"]', 'Bienvenida', 'Recepcion1', NOW()),
('301', '["Tarta", "Flores"]', 'Cumpleaños', 'Admin', NOW()),
('401', '["Mojo", "Fruta Especial"]', 'VIP Dirección', 'Admin', NOW()),
('501', '["Vino", "Regalo"]', 'Cliente Platino', 'Recepcion1', NOW()),
('102', '["Agua", "Minibar Bienvenida"]', ' কর্পোরেট', 'Admin', NOW()),
('205', '["Cava", "Tarta"]', 'Luna de miel', 'Recepcion2', NOW()),
('310', '["Regalo Niños", "Fruta"]', 'Familia Repeat', 'Admin', NOW()),
('412', '["SPA", "Flores"]', 'Compensación', 'Recepcion1', NOW()),
('510', '["Cava", "Mojo", "Fruta"]', 'Premium Package', 'Admin', NOW());

-- 4. DESPERTADORES
INSERT INTO despertadores (habitacion, hora, comentario, autor, estado, fecha_programada) VALUES 
('101', '06:00', 'Urgente', 'Noche', 'Pendiente', CURDATE()),
('102', '07:00', 'Normal', 'Noche', 'Pendiente', CURDATE()),
('201', '05:30', 'Vuelo', 'Noche', 'Hecho', CURDATE()),
('301', '08:00', 'Despacio', 'Admin', 'Pendiente', CURDATE()),
('401', '07:15', 'Check out', 'Recepcion1', 'Pendiente', CURDATE()),
('105', '06:45', 'Excursión', 'Noche', 'Pendiente', CURDATE()),
('210', '07:30', 'Normal', 'Noche', 'Pendiente', CURDATE()),
('315', '08:15', 'Perezoso', 'Admin', 'Pendiente', CURDATE()),
('420', '09:00', 'Tarde', 'Recepcion1', 'Pendiente', CURDATE()),
('505', '06:00', 'Diario', 'Noche', 'Hecho', CURDATE());

-- 5. TRANSFERS
INSERT INTO transfers (id, fecha, tipo, pasajeros, habitacion, nombre_cliente, externo, hora, lugar_destino, notas, autor) VALUES 
('TRF-A', CURDATE(), 'TAXI', 2, '101', '', 0, '12:00', 'Aeropuerto Sur', 'Silla bebé', 'Admin'),
('TRF-B', CURDATE(), 'BUS', 12, 'EXTERNO', 'Grupo Golf', 1, '09:00', 'Golf Las Américas', 'Recoger hotel', 'Recepcion1'),
('TRF-C', CURDATE(), 'TAXI', 1, '305', '', 0, '15:30', 'Santa Cruz', 'Pago tarjeta', 'Admin'),
('TRF-D', CURDATE(), 'TAXI', 4, '410', '', 0, '05:00', 'Aeropuerto Norte', 'Mucha maleta', 'Noche'),
('TRF-E', CURDATE(), 'VAN', 6, 'EXTERNO', 'Familia Smith', 1, '20:00', 'Restaurante El Teide', 'Ida y vuelta', 'Admin'),
('TRF-F', CURDATE(), 'TAXI', 2, '105', '', 0, '11:00', 'Los Gigantes', '', 'Recepcion1'),
('TRF-G', CURDATE(), 'TAXI', 3, '212', '', 0, '14:00', 'Siam Park', 'Niños', 'Admin'),
('TRF-H', CURDATE(), 'BUS', 25, 'EXTERNO', 'Evento Empresa', 1, '08:00', 'Centro Congresos', 'Guía incluido', 'Recepcion2'),
('TRF-I', CURDATE(), 'TAXI', 2, '314', '', 0, '10:30', 'CC Meridiano', '', 'Admin'),
('TRF-J', CURDATE(), 'TAXI', 1, '501', '', 0, '19:00', 'Casino', 'VIP car', 'Admin');

-- 6. EXCURSIONES
INSERT INTO registro_excursiones (id, tipo_id, huesped, habitacion, fecha_excursion, adultos, ninos, total, estado, vendedor, autor, fecha_venta) VALUES 
('EXC-1', 'EXC-001', 'John Wick', '101', CURDATE(), 2, 0, 150.00, 'Cobrado', 'Admin', 'Admin', NOW()),
('EXC-2', 'EXC-002', 'Lara Croft', '205', CURDATE(), 1, 0, 80.00, 'Pendiente', 'Recepcion1', 'Recepcion1', NOW()),
('EXC-3', 'EXC-003', 'Indiana Jones', '302', CURDATE(), 2, 1, 210.00, 'Cobrado', 'Admin', 'Admin', NOW()),
('EXC-4', 'EXC-005', 'Rick Sanchez', '405', CURDATE(), 1, 0, 95.00, 'Reclamado', 'Recepcion2', 'Recepcion2', NOW()),
('EXC-5', 'EXC-001', 'Walter White', '501', CURDATE(), 2, 0, 150.00, 'Cobrado', 'Admin', 'Admin', NOW()),
('EXC-6', 'EXC-001', 'Neo Matrix', '110', DATE_ADD(CURDATE(), INTERVAL 1 DAY), 2, 0, 150.00, 'Pendiente', 'Admin', 'Admin', NOW()),
('EXC-7', 'EXC-002', 'Katniss Everdeen', '215', DATE_ADD(CURDATE(), INTERVAL 2 DAY), 1, 2, 220.00, 'Cobrado', 'Recepcion1', 'Recepcion1', NOW()),
('EXC-8', 'EXC-004', 'Sherlock Holmes', '320', CURDATE(), 2, 0, 110.00, 'Cancelado', 'Admin', 'Admin', NOW()),
('EXC-9', 'EXC-001', 'Marty McFly', '411', CURDATE(), 1, 1, 120.00, 'Cobrado', 'Recepcion1', 'Recepcion1', NOW()),
('EXC-10', 'EXC-003', 'Son Goku', '515', CURDATE(), 4, 0, 480.00, 'Pendiente', 'Recepcion2', 'Recepcion2', NOW());

-- 7. RESERVAS INSTALACIONES
INSERT INTO reservas_instalaciones (id, instalacion, habitacion, fecha, hora_inicio, hora_fin, personas, nombre, autor, comentarios) VALUES 
('RES-1', 'Tennis 1', '101', CURDATE(), '10:00', '11:00', 2, 'Juan Pérez', 'Admin', 'Raquetas'),
('RES-2', 'Padel 1', '202', CURDATE(), '11:00', '12:00', 4, 'Grupo Amigos', 'Recepcion1', ''),
('RES-3', 'Tennis 1', '305', CURDATE(), '12:00', '13:00', 2, 'John Doe', 'Admin', ''),
('RES-4', 'Spa Privado', '410', CURDATE(), '17:00', '18:00', 2, 'Pareja VIP', 'Recepcion1', 'Cava'),
('RES-5', 'Gimnasio PT', '501', CURDATE(), '08:00', '09:00', 1, 'Entrenamiento', 'Admin', 'Coach'),
('RES-6', 'Tennis 2', '105', CURDATE(), '09:00', '10:00', 2, 'Player 1', 'Admin', 'Bolas'),
('RES-7', 'Padel 2', '212', CURDATE(), '19:00', '20:30', 4, 'Huésped 212', 'Recepcion2', 'Luz'),
('RES-8', 'Sala Reuniones', '314', CURDATE(), '15:00', '17:00', 10, 'Empresa X', 'Admin', 'Proyector'),
('RES-9', 'Bicicletas', '402', CURDATE(), '10:00', '14:00', 2, 'Ciclistas', 'Recepcion1', 'Cascos'),
('RES-10', 'Ping Pong', '505', CURDATE(), '11:30', '12:00', 2, 'Niños 505', 'Admin', '');

-- 8. LOST & FOUND
INSERT INTO lost_found (id, objeto, lugar, quien, estado, comentarios, fecha, autor) VALUES 
('LF-1', 'Gafas Sol', 'Piscina', 'Socorrista', 'Almacenado', 'Ray-Ban', CURDATE(), 'Recepcion1'),
('LF-2', 'Cargador', 'Bar', 'Camarero', 'Almacenado', 'iPhone 15', CURDATE(), 'Recepcion1'),
('LF-3', 'Reloj', 'Gimnasio', 'Limpieza', 'Reclamado', 'Casio negro', CURDATE(), 'Admin'),
('LF-4', 'Peluche', 'Hab 105', 'Camarera', 'Enviado', 'Oso azul', CURDATE(), 'Recepcion1'),
('LF-5', 'Libro', 'Jardín', 'Jardinero', 'Almacenado', 'Novela negra', CURDATE(), 'Recepcion1'),
('LF-6', 'Llaves', 'Entrada', 'Cliente', 'Almacenado', 'Llavero coche', CURDATE(), 'Admin'),
('LF-7', 'Sombrero', 'Solarium', 'Limpieza', 'Almacenado', 'De paja', CURDATE(), 'Recepcion2'),
('LF-8', 'Bikini', 'Vestuarios', 'Limpieza', 'Desechado', 'Muy mal estado', CURDATE(), 'Recepcion1'),
('LF-9', 'Tablet', 'Restaurante', 'Maitre', 'Almacenado', 'Samsung 10p', CURDATE(), 'Admin'),
('LF-10', 'Cartera', 'Recepción', 'Recepcionista', 'Entregado', 'Sin dinero', CURDATE(), 'Admin');

-- 9. CONTROL ESTANCIA (Histórico 30 días)
INSERT INTO estancia_diaria (fecha, ocupadas, vacias, total_hab) VALUES 
(DATE_SUB(CURDATE(), INTERVAL 30 DAY), 100, 50, 150),
(DATE_SUB(CURDATE(), INTERVAL 29 DAY), 105, 45, 150),
(DATE_SUB(CURDATE(), INTERVAL 28 DAY), 110, 40, 150),
(DATE_SUB(CURDATE(), INTERVAL 27 DAY), 115, 35, 150),
(DATE_SUB(CURDATE(), INTERVAL 26 DAY), 120, 30, 150),
(DATE_SUB(CURDATE(), INTERVAL 25 DAY), 125, 25, 150),
(DATE_SUB(CURDATE(), INTERVAL 24 DAY), 130, 20, 150),
(DATE_SUB(CURDATE(), INTERVAL 23 DAY), 135, 15, 150),
(DATE_SUB(CURDATE(), INTERVAL 22 DAY), 140, 10, 150),
(DATE_SUB(CURDATE(), INTERVAL 21 DAY), 145, 5, 150),
(DATE_SUB(CURDATE(), INTERVAL 20 DAY), 142, 8, 150),
(DATE_SUB(CURDATE(), INTERVAL 19 DAY), 148, 2, 150),
(DATE_SUB(CURDATE(), INTERVAL 18 DAY), 140, 10, 150),
(DATE_SUB(CURDATE(), INTERVAL 17 DAY), 130, 20, 150),
(DATE_SUB(CURDATE(), INTERVAL 16 DAY), 120, 30, 150),
(DATE_SUB(CURDATE(), INTERVAL 15 DAY), 110, 40, 150),
(DATE_SUB(CURDATE(), INTERVAL 14 DAY), 100, 50, 150),
(DATE_SUB(CURDATE(), INTERVAL 13 DAY), 95, 55, 150),
(DATE_SUB(CURDATE(), INTERVAL 12 DAY), 90, 60, 150),
(DATE_SUB(CURDATE(), INTERVAL 11 DAY), 85, 65, 150),
(DATE_SUB(CURDATE(), INTERVAL 10 DAY), 80, 70, 150),
(DATE_SUB(CURDATE(), INTERVAL 9 DAY), 82, 68, 150),
(DATE_SUB(CURDATE(), INTERVAL 8 DAY), 88, 62, 150),
(DATE_SUB(CURDATE(), INTERVAL 7 DAY), 95, 55, 150),
(DATE_SUB(CURDATE(), INTERVAL 6 DAY), 105, 45, 150),
(DATE_SUB(CURDATE(), INTERVAL 5 DAY), 115, 35, 150),
(DATE_SUB(CURDATE(), INTERVAL 4 DAY), 125, 25, 150),
(DATE_SUB(CURDATE(), INTERVAL 3 DAY), 135, 15, 150),
(DATE_SUB(CURDATE(), INTERVAL 2 DAY), 145, 5, 150),
(DATE_SUB(CURDATE(), INTERVAL 1 DAY), 140, 10, 150);

-- 10. VALES
INSERT INTO vales (id, habitacion, concepto, importe, autor) VALUES 
(1709136000000, '101', 'Cena Extra', 50.00, 'Admin'),
(1709136060000, '202', 'Bebidas Cocktail', 15.50, 'Recepcion1'),
(1709136120000, '305', 'Late Checkout', 30.00, 'Admin'),
(1709136180000, '410', 'Pérdida Llave', 10.00, 'Recepcion1'),
(1709136240000, '505', 'Suplemento Mascota', 25.00, 'Admin'),
(1709136300000, '105', 'Limpieza Especial', 100.00, 'Admin'),
(1709136360000, '212', 'Alquiler Bici', 12.00, 'Recepcion2'),
(1709136420000, '314', 'Consumo Minibar', 18.90, 'Admin'),
(1709136480000, '402', 'Parking 2 días', 24.00, 'Recepcion1'),
(1709136540000, '501', 'Acceso SPA', 20.00, 'Admin'),
(1709136600000, '101', 'Vino Habitación', 22.00, 'Admin'),
(1709136660000, '205', 'Upgrade Suite', 150.00, 'Recepcion1'),
(1709136720000, '310', 'Desayuno Room Service', 12.50, 'Admin'),
(1709136780000, '412', 'Tintorería', 45.00, 'Recepcion1'),
(1709136840000, '510', 'Cambio Divisas Fee', 2.00, 'Admin');

-- 11. SAFE RENTALS
INSERT INTO safe_rentals (id, habitacion, fecha_inicio, fecha_fin, dias, coste, pagado, recepcionista) VALUES 
(1, '101', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 7 DAY), 7, 21.00, 1, 'Admin'),
(2, '202', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 3 DAY), 3, 9.00, 1, 'Recepcion1'),
(3, '305', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 14 DAY), 14, 42.00, 0, 'Admin'),
(4, '410', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 5 DAY), 5, 15.00, 1, 'Recepcion1'),
(5, '505', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 10 DAY), 10, 30.00, 1, 'Admin'),
(6, '105', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 7 DAY), 7, 21.00, 1, 'Admin'),
(7, '212', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 3 DAY), 3, 9.00, 0, 'Recepcion2'),
(8, '314', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 1 DAY), 1, 3.00, 1, 'Admin'),
(9, '402', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 4 DAY), 4, 12.00, 1, 'Recepcion1'),
(10, '501', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 7 DAY), 7, 21.00, 1, 'Admin');

-- 12. CLIENTES RIU (RIU CLASS)
INSERT INTO clientes_riu (id, titular, num_tarjeta, habitacion, fecha_entrada, fecha_salida, adultos, ninos, nivel, comentario) VALUES 
(1, 'JUAN PEREZ', '987654321', '101', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 7 DAY), 2, 0, 'Gold', 'VIP'),
(2, 'MARIA GARCIA', '123456789', '202', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 5 DAY), 1, 1, 'Classic', 'Firma'),
(3, 'JOHN DOE', '111122223', '305', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 2 DAY), 2, 0, 'Diamond', 'Urgent'),
(4, 'ALICE SMITH', '444455556', '410', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 10 DAY), 2, 2, 'Gold', ''),
(5, 'BOB BROWN', '777788889', '505', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 3 DAY), 2, 0, 'Classic', ''),
(6, 'CHARLIE GREEN', '999900001', '105', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 7 DAY), 2, 0, 'Gold', ''),
(7, 'DIANA WHITE', '222233334', '212', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 4 DAY), 1, 0, 'Diamond', ''),
(8, 'EDWARD BLACK', '555566667', '314', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 1 DAY), 2, 0, 'Classic', ''),
(9, 'FIONA GREY', '888899990', '402', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 5 DAY), 2, 0, 'Gold', ''),
(10, 'GEORGE BLUE', '121234345', '501', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 14 DAY), 2, 0, 'Diamond', 'Long stay');

-- 13. NOVEDADES
INSERT INTO novedades (fecha, hora, prioridad, autor, texto, comentario, departamentos, estado) VALUES 
(CURDATE(), '08:00', 'Baja', 'Admin', 'Entrega de material oficina', '', '["Recepcion"]', 'Cerrada'),
(CURDATE(), '09:30', 'Alta', 'Recepcion1', 'Inundación baño 205', 'Avisados fontaneros', '["Mantenimiento"]', 'Abierta'),
(CURDATE(), '10:15', 'Media', 'Admin', 'Reunión directiva a las 12:00', 'Sala VIP', '["Administracion", "Recepcion"]', 'Abierta'),
(CURDATE(), '11:45', 'Urgente', 'Recepcion1', 'Fallo servidor reservas', 'IT trabajando', '["IT"]', 'En proceso'),
(CURDATE(), '13:00', 'Normal', 'Recepcion1', 'Pedido flores aniversario hab 101', 'Llega a las 17:00', '["Recepcion"]', 'Abierta'),
(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '14:30', 'Baja', 'Admin', 'Suministro toallas piscina', 'OK', '["Pisos"]', 'Cerrada'),
(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '16:00', 'Alta', 'Recepcion2', 'Rotura cristal restaurante', 'Cambiado', '["Mantenimiento"]', 'Cerrada'),
(DATE_SUB(CURDATE(), INTERVAL 2 DAY), '18:20', 'Media', 'Admin', 'Mantenimiento preventivo ascensores', 'Finalizado', '["Mantenimiento"]', 'Cerrada'),
(DATE_SUB(CURDATE(), INTERVAL 2 DAY), '20:10', 'Baja', 'Noche', 'Luces exteriores apagadas', 'Sensor fallando', '["Mantenimiento"]', 'Abierta'),
(DATE_SUB(CURDATE(), INTERVAL 3 DAY), '22:00', 'Media', 'Noche', 'Ruido en habitación contigua 305', 'Resuelto por seguridad', '["Seguridad"]', 'Cerrada'),
(CURDATE(), '15:30', 'Normal', 'Admin', 'Novedad técnica sistema OCR', 'Actualización aplicada', '["IT"]', 'Cerrada'),
(CURDATE(), '17:45', 'Alta', 'Recepcion1', 'Ampliación horario piscina verano', 'Informar a clientes', '["Direccion", "Recepcion"]', 'Abierta'),
(CURDATE(), '19:15', 'Media', 'Recepcion1', 'Incidencia datáfono bar', 'Reiniciado', '["Comedor"]', 'Cerrada'),
(CURDATE(), '02:00', 'Normal', 'Noche', 'Ronda nocturna completada', 'Sin incidencias', '["Seguridad"]', 'Cerrada'),
(CURDATE(), '05:30', 'Baja', 'Noche', 'Entrega de prensa diaria', 'Repartida', '["Recepcion"]', 'Cerrada');

-- FINAL DEL SCRIPT
