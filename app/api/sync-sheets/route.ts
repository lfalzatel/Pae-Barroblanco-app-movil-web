import { google } from 'googleapis';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// --- CONFIGURATION ---
const SORDOS_CODES = [
    '010400', '024000', '020400', '030400', '044000', '050400', 
    '060400', '070400', '080400', '090400', '110400',
    'LILIANA', 'SORDOS', 'AULA SORDOS', 'AULA MULTINIVEL SORDOS' // Nombres comunes en la App
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
    // Estandarizar nombre (Mayúsculas y sin espacios extras)
    let original = (dbCode || '').trim().toUpperCase();
    original = original.replace(/-202[56]/g, '').trim();

    // Manual Map for common patterns
    const map: Record<string, string> = {
        // Sexto
        '6A': 'SEXTO 1', '6B': 'SEXTO 2', '6C': 'SEXTO 3', '6D': 'SEXTO 4',
        '0060100': 'SEXTO 1', '0060200': 'SEXTO 2', '0060300': 'SEXTO 3', '0060400': 'SEXTO 4',
        '601': 'SEXTO 1', '602': 'SEXTO 2', '603': 'SEXTO 3', '604': 'SEXTO 4',

        // Otros Secundarios
        '7A': 'SEPTIMO 1', '7B': 'SEPTIMO 2', '7C': 'SEPTIMO 3',
        '0070100': 'SEPTIMO 1', '0070200': 'SEPTIMO 2', '0070300': 'SEPTIMO 3',
        '8A': 'OCTAVO 1', '8B': 'OCTAVO 2',
        '0080100': 'OCTAVO 1', '0080200': 'OCTAVO 2',
        '9A': 'NOVENO 1', '9B': 'NOVENO 2',
        '0090100': 'NOVENO 1', '0090200': 'NOVENO 2',
        '10A': 'DÉCIMO 1', '10B': 'DÉCIMO 2',
        '0100100': 'DÉCIMO 1', '0100200': 'DÉCIMO 2',
        '11A': 'ONCE 1', '11B': 'ONCE 2',
        '0110100': 'ONCE 1', '0110200': 'ONCE 2',

        // Primaria
        '1A': 'PRIMERO', '1B': 'PRIMERO', '0010100': 'PRIMERO',
        '2A': 'SEGUNDO', '2B': 'SEGUNDO', '0020100': 'SEGUNDO',
        '3A': 'TERCERO', '3B': 'TERCERO', '0030100': 'TERCERO',
        '4A': 'CUARTO 1', '4B': 'CUARTO 2', '0040100': 'CUARTO 1', '0040200': 'CUARTO 2',
        '5A': 'QUINTO 1', '5B': 'QUINTO 2', '0050100': 'QUINTO 1', '0050200': 'QUINTO 2',

        // Especiales
        'TRANSICIÓN': 'PREESCOLAR',
        'LILIANA': 'AULA MULTINIVEL SORDOS',
        'SORDOS': 'AULA MULTINIVEL SORDOS',
        '010400': 'AULA MULTINIVEL SORDOS'
    };

    return map[original] || original;
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

        // Group by Sede and Code
        const groupCounts: Record<string, number> = {};
        const sordosCount = { total: 0 };

        students.forEach((s: any) => {
            const code = s.grupo || 'UNKNOWN';
            const sede = s.sede || 'Principal';

            if (SORDOS_CODES.includes(code) || code.toUpperCase().includes('SORDOS')) {
                sordosCount.total++;
            } else {
                const key = `${sede}|${code}`;
                groupCounts[key] = (groupCounts[key] || 0) + 1;
            }
        });

        // --- 1.5 APPLY NOVEDADES (Ajustes Manuales) ---
        const weekEnd = new Date(new Date(weekStart).setDate(new Date(weekStart).getDate() + 6)).toISOString().split('T')[0];
        
        const { data: novedades, error: novError } = await supabase
            .from('novedades_cupos')
            .select('*')
            .gte('fecha_fin', weekStart)
            .lte('fecha_inicio', weekEnd);

        if (!novError && novedades) {
            novedades.forEach((nov: any) => {
                const groupKey = (nov.grupo || '').trim().toUpperCase();
                const sedeKey = nov.sede || 'Principal';
                const type = nov.tipo;
                const count = Math.abs(nov.cupos_afectados || 0);

                if (SORDOS_CODES.includes(groupKey) || groupKey.includes('SORDOS')) {
                    if (['reduccion_cupos', 'no_asiste_grupo'].includes(type)) {
                        sordosCount.total = Math.max(0, sordosCount.total - count);
                    } else if (type === 'aumento_cupos') {
                        sordosCount.total += count;
                    }
                } else {
                    const dictKey = `${sedeKey}|${groupKey}`;
                    if (['reduccion_cupos', 'no_asiste_grupo'].includes(type)) {
                        groupCounts[dictKey] = Math.max(0, (groupCounts[dictKey] || 0) - count);
                    } else if (type === 'aumento_cupos') {
                        groupCounts[dictKey] = (groupCounts[dictKey] || 0) + count;
                    }
                }
            });
        }


        const { data: scheduleData } = await supabase
            .from('schedules')
            .select('items')
            .eq('date', weekStart.split('T')[0])
            .maybeSingle();

        const cancelledBySchedule = new Set<string>();
        if (scheduleData?.items) {
            scheduleData.items.forEach((item: any) => {
                if (item.time === 'NO_ASISTE' || item.time_start === 'NO_ASISTE') {
                    cancelledBySchedule.add((item.group || '').trim().toUpperCase());
                }
            });
        }

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

        // Find Anchors for Sedes 
        const anchorPrincipal = rows.findIndex((r, i) => r[0] && r[0].toString().toUpperCase().includes('BARRO BLANCO') && !r[0].toString().toUpperCase().includes('PRIMARIA') && !r[0].toString().toUpperCase().includes('MARIA'));
        const anchorPrimaria = rows.findIndex((r, i) => r[0] && r[0].toString().toUpperCase().includes('PRIMARIA') && (r[0].toString().toUpperCase().includes('BARRO BLANCO') || r[0].toString().toUpperCase().includes('SEDE')));
        const anchorMaria = rows.findIndex((r, i) => r[0] && r[0].toString().toUpperCase().includes('MARIA INMACULADA'));
        
        // Sordos usually is under the Principal anchor, or we just search globally
        const anchorIdx = anchorPrincipal !== -1 ? anchorPrincipal : 0;

        if (anchorIdx === -1) {
            console.warn('Could not find I.E. BARRO BLANCO anchor, searching from top.');
        }

        const matchLog: string[] = [];

        // A. SORDOS (Special Case)
        let finalSordosCount = sordosCount.total;
        
        // Verificar si algún sub-grupo de Sordos está cancelado o si el grupo general lo está
        const isSordosCancelled = SORDOS_CODES.some(code => cancelledBySchedule.has(code.toUpperCase()));
        if (isSordosCancelled) {
            finalSordosCount = 0;
        }

        const sordosRow = findRow('AULA MULTINIVEL SORDOS', anchorIdx) || findRow('AULA SORDOS', anchorIdx);
        if (sordosRow) {
            dataToUpdate.push({
                range: `'${sheetName}'!D${sordosRow}:F${sordosRow}`,
                values: [[finalSordosCount, '', finalSordosCount > 0 ? finalSordosCount : '']]
            });
        }

        // B. REGULAR GROUPS
        Object.entries(groupCounts).forEach(([dictKey, count]) => {
            const [sede, code] = dictKey.split('|');
            let finalCount = count;
            const groupKey = code.trim().toUpperCase();

            // Aplicar excepción de horario (Forzar 0 si no asiste)
            if (cancelledBySchedule.has(groupKey)) {
                finalCount = 0;
            }

            const excelName = getFriendlyGroupName(code, '');
            if (!excelName) return;

            // Determinar Anchor dependiendo de la sede
            let currentAnchor = anchorPrincipal;
            if (sede.toUpperCase().includes('PRIMARIA')) {
                currentAnchor = anchorPrimaria !== -1 ? anchorPrimaria : anchorPrincipal;
            } else if (sede.toUpperCase().includes('MARIA')) {
                currentAnchor = anchorMaria !== -1 ? anchorMaria : anchorPrincipal;
            }

            const rowNum = findRow(excelName, currentAnchor === -1 ? 0 : currentAnchor);

            if (rowNum) {
                matchLog.push(`✓ [${sede}] ${groupKey} -> ${excelName} (Fila ${rowNum})`);
                
                // Determinación de jornada y beneficios
                const codeStr = code.toUpperCase();
                const isPreescolar = /PREESCOLAR|TRANSICI/i.test(excelName) || codeStr.startsWith('000');
                const isPrimaria = isPreescolar || codeStr.startsWith('001') || codeStr.startsWith('002') || codeStr.startsWith('003') || codeStr.startsWith('004') || codeStr.startsWith('005') || /PRIMERO|SEGUNDO|TERCERO|CUARTO|QUINTO/i.test(excelName);
                const isSexto = codeStr.startsWith('006') || /SEXTO/i.test(excelName);
                
                // CAJM (Mañana) = Primaria + Sexto
                const isCajm = isPrimaria || isSexto;
                // CAJT (Tarde) = Séptimo a Once
                const isCajt = !isCajm;

                const valCAJM = isCajm ? (finalCount > 0 ? finalCount : 0) : '';
                const valCAJT = isCajt ? (finalCount > 0 ? finalCount : 0) : '';
                
                // Preescolar does not receive Almuerzo
                const isAlmuerzable = isPrimaria && !isPreescolar;
                const valAlmuerzo = (isAlmuerzable && finalCount > 0) ? finalCount : (finalCount === 0 && isAlmuerzable ? 0 : '');

                dataToUpdate.push({
                    range: `'${sheetName}'!D${rowNum}:F${rowNum}`,
                    values: [[valCAJM, valCAJT, valAlmuerzo]]
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
            return NextResponse.json({
                success: true,
                updated: 0,
                message: 'No se encontraron coincidencias para los grupos en el Excel.',
                sheetUsed: sheetName,
                debug: {
                    anchorFoundAtRow: anchorIdx !== -1 ? anchorIdx + 1 : 'NO ENCONTRADO',
                    sampleRowsFromSheet: rows.slice(anchorIdx !== -1 ? anchorIdx : 0, (anchorIdx !== -1 ? anchorIdx : 0) + 20).map(r => r[0]),
                    studentGroupsFoundInDB: Object.keys(groupCounts).slice(0, 10),
                    matchLog: matchLog,
                    totalStudents: students.length
                }
            });
        }

    } catch (error: any) {
        console.error('Sheet Sync Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
