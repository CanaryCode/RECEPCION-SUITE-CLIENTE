const { query, pool } = require('../db');

function getTodayISO() {
    return new Date().toISOString().split('T')[0];
}

async function seed() {
    console.log('🌱 Starting enhanced database seeding...');

    try {
        // 1. DUMMY VALES
        console.log('Inserting dummy vales...');
        const vales = [
            ['1709136000000', '101', 'Compra de flores para habitación VIP', 25.50, 'Admin'],
            ['1709136060000', '205', 'Reembolso por depósito de caja fuerte', 10.00, 'Receptionist1'],
            ['1709136120000', '302', 'Pago a mensajería urgente (MRW)', 15.75, 'Admin'],
            ['1709136180000', '410', 'Compra de bombones bienvenida', 12.00, 'Receptionist2'],
            ['1709136240000', '105', 'Servicio de lavandería externa', 45.00, 'Admin']
        ];
        for (const v of vales) {
            await query('REPLACE INTO vales (id, habitacion, concepto, importe, autor) VALUES (?, ?, ?, ?, ?)', v);
        }

        // 2. DUMMY CALENDAR EVENTS
        console.log('Inserting dummy calendar events...');
        const todayStr = getTodayISO();
        const events = [
            [Date.now(), 'Reunión de Departamento Recepción', todayStr, '10:00', 'Información', 'Urgente', '#dc3545', 'Reunión semanal de coordinación'],
            [Date.now() + 1000, 'Llegada de Grupo VIP', todayStr, '14:30', 'Información', 'Normal', '#0d6efd', 'Llegada de 40 pax de Microsoft'],
            [Date.now() + 2000, 'Mantenimiento preventivo Ascensor 2', todayStr, '09:00', 'Extensión', 'Normal', '#ffc107', 'Revisión mensual'],
            [Date.now() + 86400000, 'Ensayo Gala de Navidad', new Date(Date.now() + 86400000).toISOString().split('T')[0], '20:00', 'Información', 'Normal', '#6610f2', 'Ensayo general']
        ];
        for (const e of events) {
            await query('REPLACE INTO calendario_eventos (id, titulo, fecha, hora, categoria, priority, color, descripcion) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', e);
        }

        // 3. YEAR OF OCCUPANCY DATA (Full 366 days to cover leap years and today)
        console.log('Inserting a year of occupancy data...');
        const startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 1);
        const totalRooms = 150;
        
        for (let i = 0; i <= 366; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            
            // Generate some random occupancy (60% to 95%)
            const occupied = Math.floor(Math.random() * (142 - 90 + 1)) + 90;
            const empty = totalRooms - occupied;
            
            await query('REPLACE INTO estancia_diaria (fecha, ocupadas, vacias, total_hab) VALUES (?, ?, ?, ?)', [dateStr, occupied, empty, totalRooms]);
        }

        // 4. FACILITY RESERVATIONS (Today and some future)
        console.log('Inserting dummy facility reservations...');
        const rDate = todayStr;
        const reservations = [
            ['RES-101', 'SPA', '101', rDate, '10:00', '11:00', 2, 'John Doe', 'Admin', 'Reserva de circuito termal'],
            ['RES-102', 'Tennis 1', '202', rDate, '11:00', '12:00', 4, 'Grupo Amigos', 'Recepcion1', ''],
            ['RES-103', 'Padel 1', '305', rDate, '12:00', '13:00', 2, 'John Doe', 'Admin', ''],
            ['RES-104', 'Spa Privado', '410', rDate, '17:00', '18:00', 2, 'Pareja VIP', 'Recepcion1', 'Cava'],
            ['RES-105', 'Gimnasio PT', '501', rDate, '08:00', '09:00', 1, 'Entrenamiento', 'Admin', 'Coach']
        ];
        for (const r of reservations) {
            await query('REPLACE INTO reservas_instalaciones (id, instalacion, habitacion, fecha, hora_inicio, hora_fin, personas, nombre, autor, comentarios) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', r);
        }

        // 5. NOVEDADES
        console.log('Inserting dummy novedades...');
        const novedades = [
            [todayStr, '08:00', 'Baja', 'Admin', 'Entrega de material oficina', '', '["Recepcion"]', 'Terminada'],
            [todayStr, '09:30', 'Urgente', 'Recepcion1', 'Inundación baño 205', 'Avisados fontaneros', '["Mantenimiento"]', 'Pendiente'],
            [todayStr, '10:15', 'Normal', 'Admin', 'Reunión directiva a las 12:00', 'Sala VIP', '["Administracion", "Recepcion"]', 'Pendiente']
        ];
        for (const n of novedades) {
            await query('INSERT INTO novedades (fecha, hora, prioridad, autor, texto, comentario, departamentos, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', n);
        }

        // 6. RIU CLIENTES
        console.log('Inserting dummy RIU customers...');
        const riu = [
            ['JUAN PEREZ', '987654321', '101', todayStr, new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0], 2, 0, 'Gold', 'VIP'],
            ['MARIA GARCIA', '123456789', '202', todayStr, new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0], 1, 1, 'Classic', 'Firma']
        ];
        for (const r of riu) {
            await query('INSERT INTO clientes_riu (titular, num_tarjeta, habitacion, fecha_entrada, fecha_salida, adultos, ninos, nivel, comentario) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', r);
        }

        console.log('✅ Enhanced seeding completed successfully!');
    } catch (err) {
        console.error('❌ Error during seeding:', err);
    } finally {
        pool.end();
    }
}

seed();
