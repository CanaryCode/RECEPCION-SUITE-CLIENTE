const { query, pool } = require('../db');

/**
 * Script to fill exactly 3 years (1095 days) of occupancy data
 * with seasonal variations to make charts look realistic.
 */
async function fillOccupancy3Years() {
    console.log('📊 Filling 3 Years of Occupancy Data (Seasonal Variation)...');

    try {
        const totalRooms = 150;
        const today = new Date();
        const daysToPopulate = 1095; // 3 years
        
        for (let i = 0; i < daysToPopulate; i++) {
            const date = new Date();
            date.setDate(today.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const month = date.getMonth(); // 0-11
            
            let minOcc, maxOcc;

            // Seasonal Logic for a typical hotel in a holiday destination
            if (month === 6 || month === 7) { // July, August (Summer Peak)
                minOcc = 135; maxOcc = 148; // 90% - 98%
            } else if (month === 11 || month === 0) { // Dec, Jan (Winter Peak / Xmas)
                minOcc = 120; maxOcc = 145; // 80% - 96%
            } else if (month === 3) { // April (Spring / Easter approx)
                minOcc = 115; maxOcc = 140; // 76% - 93%
            } else { // Rest of the year (Mid/Low season)
                minOcc = 90; maxOcc = 125; // 60% - 83%
            }

            // Weekend boost (Friday, Saturday)
            const dayOfWeek = date.getDay(); 
            if (dayOfWeek === 5 || dayOfWeek === 6) {
                minOcc = Math.min(totalRooms, minOcc + 10);
                maxOcc = Math.min(totalRooms, maxOcc + 5);
            }
            
            const occupied = Math.floor(Math.random() * (maxOcc - minOcc + 1)) + minOcc;
            const empty = totalRooms - occupied;
            
            await query('REPLACE INTO estancia_diaria (fecha, ocupadas, vacias, total_hab) VALUES (?, ?, ?, ?)', 
                [dateStr, occupied, empty, totalRooms]);
            
            if (i % 100 === 0) console.log(`...processed ${i} days`);
        }

        console.log(`✅ Success: ${daysToPopulate} days of occupancy data inserted/updated.`);
    } catch (err) {
        console.error('❌ Error filling occupancy:', err);
    } finally {
        pool.end();
    }
}

fillOccupancy3Years();
