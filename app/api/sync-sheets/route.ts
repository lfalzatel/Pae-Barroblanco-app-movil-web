import { google } from 'googleapis';
import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// --- CONFIGURATION ---
const SORDOS_CODES = [
    '010400', '024000', '020400', '030400', '044000', '050400', // Primaria ?
    '060400', '070400', '080400', '090400', '110400'  // Secundaria
];

// Excel Header Mapping (0-based index)
// Assuming headers: [Names, Start, Start, CAJM, CAJT, ALMUERZO, ...]
// Based on image:
// Col A (0): Names
// Col D (3): CAJM
// Col E (4): CAJT
// Col F (5): ALMUERZO
const COLS = {
    NAME: 0,
    CAJM: 3, // D
    CAJT: 4, // E
    ALMUERZO: 5 // F
};

// Helper to translate DB group code to Excel Name
// DB Format Assumption: '0060100' -> Grade 06, Group 01
const getFriendlyGroupName = (dbCode: string, sede: string) => {
    // Sordos special case handled separately before calling this

    // Parse code
    // Try to extract Grade and Group. 
    // Example: 0060100 -> 6, 1
    // Example: 0110200 -> 11, 2

    // Simple heuristic parser (customize based on real patterns)
    // 6th char might be group? 
    // Let's assume standard pattern or map manually if patterns vary too much.

    // Manual Map for common patterns if parser is risky:
    const map: Record<string, string> = {
        '0060100': 'SEXTO 1', '0060200': 'SEXTO 2', '0060300': 'SEXTO 3', '0060400': 'SEXTO 4',
        '0070100': 'SEPTIMO 1', '0070200': 'SEPTIMO 2', '0070300': 'SEPTIMO 3',
        '0080100': 'OCTAVO 1', '0080200': 'OCTAVO 2',
        '0090100': 'NOVENO 1', '0090200': 'NOVENO 2',
        '0100100': 'DÉCIMO 1', '0100200': 'DÉCIMO 2', // Check accent in Excel
        '0110100': 'ONCE 1', '0110200': 'ONCE 2',

        // Primaria
        '0010100': 'PRIMERO', '0010200': 'PRIMERO', // If multiple groups map to one row
        '0020100': 'SEGUNDO',
        '0030100': 'TERCERO',
        '0040100': 'CUARTO 1', '0040200': 'CUARTO 2',
        '0050100': 'QUINTO 1', '0050200': 'QUINTO 2',

        // Preescolar
        '0000100': 'PREESCOLAR'
    };

    // Try map
    if (map[dbCode]) return map[dbCode];

    // Fallback parser if not in map (implement if needed)
    return '';
};

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { sheetId, weekStart } = body;

        if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
            return NextResponse.json({ error: 'Faltan credenciales de Google en el servidor.' }, { status: 500 });
        }

        // Auth
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_CLIENT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const sheets = google.sheets({ version: 'v4', auth });

        // --- 1. FETCH DATA FROM SUPABASE ---
        // Fetch ALL Active students with their group and sede
        // We need 'estudiantes' table to know which group/code they belong to.
        // And 'asistencia_pae' counts.

        // Simplified Logic: 
        // 1. Get List of Groups and their counts (Students Active)
        // 2. Adjust counts based on 'novedades_cupos' (Reductions)
        // 3. Adjust counts based on 'asistencia_pae' (if report is based on REAL attendance, or Entitlement?)
        // Usually, the report asks for "Complementos a Entregar" (Entitlement - Novedades).
        // Let's assume: (Total Matriculados - Novedades) = Reported Number.

        // Get Estudiantes (Active)
        const { data: students, error: stError } = await supabase
            .from('estudiantes') // Verify table name
            .select('grupo, sede, id'); // Removido codigo_grupo

        if (stError) throw stError;

        // Group by Code
        const groupCounts: Record<string, number> = {};
        const sordosCount = { total: 0 };

        students.forEach((s: any) => {
            // Asumimos que la columna 'grupo' tiene el código (ej: 0060100)
            const code = s.grupo || 'UNKNOWN';

            if (SORDOS_CODES.includes(code)) {
                sordosCount.total++;
            } else {
                groupCounts[code] = (groupCounts[code] || 0) + 1;
            }
        });

        // Apply Novedades (Reductions)
        // Fetch Novedades for this week
        // ... (Logic to Subtract Novedades from groupCounts) ...
        // For MVP, lets just send HEADCOUNT (Total Matriculados) or clarify if Novedades should subtract.
        // Assuming simple Headcount for now.


        // --- 2. UPDATE GOOGLE SHEET ---
        // Fetch Metadata to find the REAL Sheet Name
        const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
        const sheetList = meta.data.sheets || [];

        // Try to find a sheet with "CONSOLIDADO" or "CUPOS"
        let targetSheet = sheetList.find(s => s.properties?.title?.toUpperCase().includes('CONSOLIDADO'));

        // Fallback: Use the very first sheet if not found
        if (!targetSheet && sheetList.length > 0) {
            targetSheet = sheetList[0];
        }

        if (!targetSheet || !targetSheet.properties?.title) {
            return NextResponse.json({ error: 'No se encontró ninguna hoja válida en el archivo.' }, { status: 404 });
        }

        const sheetName = targetSheet.properties.title;
        const gid = targetSheet.properties.sheetId;

        // Construct range with verified name (quoted)
        const range = `'${sheetName}'!A:A`;

        const response = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range });
        const rows = response.data.values || [];

        // Prepare Batch Updates
        const dataToUpdate: { range: string, values: any[][] }[] = [];

        // Helper to find row index
        const findRow = (search: string, startIdx: number = 0) => {
            const idx = rows.findIndex((r, i) => i >= startIdx && r[0] && r[0].toString().trim().toUpperCase() === search.toUpperCase());
            return idx !== -1 ? idx + 1 : null; // returns 1-based row number
        };

        // Find Anchor for BARRO BLANCO
        // Look for "I.E. BARRO BLANCO" or similar
        let anchorIdx = rows.findIndex(r => r.some(c => c && c.toString().toUpperCase().includes('BARRO BLANCO')));

        if (anchorIdx === -1) {
            console.warn('Could not find I.E. BARRO BLANCO anchor, searching from top.');
            anchorIdx = 0;
        }

        // A. SORDOS (Special Case)
        const sordosRow = findRow('AULA SORDOS', anchorIdx);
        if (sordosRow && sordosCount.total > 0) {
            dataToUpdate.push({
                range: `'${sheetName}'!D${sordosRow}:F${sordosRow}`,
                values: [[sordosCount.total, '', sordosCount.total]]
            });
        }

        // B. REGULAR GROUPS
        Object.entries(groupCounts).forEach(([code, count]) => {
            const excelName = getFriendlyGroupName(code, '');
            if (!excelName) return;

            const rowNum = findRow(excelName, anchorIdx);

            if (rowNum) {
                const isPrimaria = code.startsWith('001') || code.startsWith('002') || code.startsWith('003') || code.startsWith('004') || code.startsWith('005') || code.startsWith('000');
                const isBachillerato = !isPrimaria;

                const valCAJM = count;
                const valAlmuerzo = isPrimaria ? count : '';

                dataToUpdate.push({
                    range: `'${sheetName}'!D${rowNum}:F${rowNum}`,
                    values: [[valCAJM, '', valAlmuerzo]]
                });
            }
        });

        // Execute Batch Update (Values)
        if (dataToUpdate.length > 0) {
            // 1. Update Values
            await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: sheetId,
                requestBody: {
                    valueInputOption: 'USER_ENTERED',
                    data: dataToUpdate
                }
            });

            // 2. Highlight Updated Cells
            try {
                if (gid !== undefined && gid !== null) {
                    const requests: any[] = [];

                    dataToUpdate.forEach(update => {
                        const match = /([A-Z]+)(\d+):([A-Z]+)(\d+)/.exec(update.range);
                        if (match) {
                            const startRow = parseInt(match[2]) - 1;
                            const endRow = parseInt(match[4]);

                            requests.push({
                                repeatCell: {
                                    range: {
                                        sheetId: gid,
                                        startRowIndex: startRow,
                                        endRowIndex: endRow,
                                        startColumnIndex: 3, // D
                                        endColumnIndex: 6    // G
                                    },
                                    cell: {
                                        userEnteredFormat: {
                                            backgroundColor: {
                                                red: 0.85, green: 0.95, blue: 1.0
                                            },
                                            textFormat: {
                                                bold: true,
                                                foregroundColor: { red: 0, green: 0.2, blue: 0.4 }
                                            }
                                        }
                                    },
                                    fields: 'userEnteredFormat(backgroundColor,textFormat)'
                                }
                            });
                        }
                    });

                    if (requests.length > 0) {
                        await sheets.spreadsheets.batchUpdate({
                            spreadsheetId: sheetId,
                            requestBody: { requests }
                        });
                    }
                }
            } catch (formatError) {
                console.warn('Formatting failed', formatError);
            }

            return NextResponse.json({
                success: true,
                updated: dataToUpdate.length,
                sheetUsed: sheetName,
                debug: {
                    matched: dataToUpdate.map(d => d.range),
                    totalStudents: students.length
                }
            });
        } else {
            // Debug Failure
            const sampleRows = rows.slice(0, 150).map(r => r[0]).filter(r => r);
            const keys = Object.keys(groupCounts).slice(0, 10);
            return NextResponse.json({
                success: true,
                updated: 0,
                message: 'No matching rows found.',
                sheetUsed: sheetName,
                debug: {
                    sampleRowsFromSheet: sampleRows,
                    studentGroupsFoundInDB: keys,
                    firstFriendlyNameAttempt: keys.length > 0 ? getFriendlyGroupName(keys[0], '') : 'None',
                    totalStudents: students.length
                }
            });
        }

    } catch (error: any) {
        console.error('Sheet Sync Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
