import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const DEFAULT_SHEET_ID = '1NIp7IaTps7E-QqkBc5Yt0rx36HGc-k5d4EiKmtOLFeE';

// Day name mapping (ES → 0-based weekday index Mon=0)
const DIA_MAP: Record<string, number> = {
    'LUNES': 0, 'MARTES': 1, 'MIERCOLES': 2, 'MIÉRCOLES': 2,
    'JUEVES': 3, 'VIERNES': 4,
};

// Month name mapping (ES → 0-based month index)
const MES_MAP: Record<string, number> = {
    'ENE': 0, 'ENERO': 0, 'FEB': 1, 'FEBRERO': 1, 'MAR': 2, 'MARZO': 2,
    'ABR': 3, 'ABRIL': 3, 'MAY': 4, 'MAYO': 4, 'JUN': 5, 'JUNIO': 5,
    'JUL': 6, 'JULIO': 6, 'AGO': 7, 'AGOSTO': 7, 'SEP': 8, 'SEPT': 8,
    'SEPTIEMBRE': 8, 'OCT': 9, 'OCTUBRE': 9, 'NOV': 10, 'NOVIEMBRE': 10,
    'DIC': 11, 'DICIEMBRE': 11,
};

function parseSheetMeta(name: string): { month: number | null; day: number | null } {
    const upper = name.toUpperCase();
    let month: number | null = null;
    let day: number | null = null;

    for (const [key, val] of Object.entries(DIA_MAP)) {
        if (upper.includes(key)) { day = val; break; }
    }
    for (const [key, val] of Object.entries(MES_MAP)) {
        if (upper.includes(key)) { month = val; break; }
    }

    // Try to extract month from ISO date substring (YYYY-MM-DD)
    if (month === null) {
        const dateMatch = upper.match(/(\d{4})-(\d{2})-\d{2}/);
        if (dateMatch) month = parseInt(dateMatch[2], 10) - 1;
    }

    return { month, day };
}

function parseNumber(val: any): number {
    if (val === null || val === undefined || val === '') return 0;
    const n = parseInt(String(val).replace(/[^0-9-]/g, ''), 10);
    return isNaN(n) || n < 0 ? 0 : n;
}

interface School {
    nombre: string;
    riAm: number;
    riPm: number;
    cajm: number;
    cajt: number;
    almuerzo: number;
}

function isSchoolHeader(cellValue: string): boolean {
    const v = cellValue.toUpperCase().trim();
    return (
        v.startsWith('I.E.') ||
        v.startsWith('INSTITUCIÓN') ||
        v.startsWith('INSTITUCION') ||
        v.startsWith('IE ') ||
        v.startsWith('COLEGIO') ||
        v.includes('I.E ') ||
        // Named blocks that represent different schools/sections
        (v.length > 4 && !v.startsWith('SEDE') && !v.startsWith('SUBTOTAL') &&
            !v.startsWith('TOTAL') && !v.startsWith('PREESCOLAR') &&
            !v.startsWith('PRIMERO') && !v.startsWith('SEGUNDO') &&
            !v.startsWith('TERCERO') && !v.startsWith('CUARTO') &&
            !v.startsWith('QUINTO') && !v.startsWith('SEXTO') &&
            !v.startsWith('SEPTIMO') && !v.startsWith('SÉPTIMO') &&
            !v.startsWith('OCTAVO') && !v.startsWith('NOVENO') &&
            !v.startsWith('DECIMO') && !v.startsWith('DÉCIMO') &&
            !v.startsWith('ONCE') && !v.startsWith('AULA') &&
            !v.startsWith('TRANSICION') && !v.startsWith('TRANSICIÓN') &&
            !v.startsWith('PRIMARIA') && !v.startsWith('BACHILLERATO') &&
            !v.startsWith('MARIA') && !v.startsWith('MARÍA') &&
            !v.match(/^[A-Z][\dA-Z]{0,2}$/) // Short codes like 6A, 1B
        )
    );
}

function parseSchoolsFromRows(rows: any[][]): School[] {
    const schools: School[] = [];
    let current: School | null = null;

    for (const row of rows) {
        const name = String(row[0] || '').trim();
        if (!name) continue;

        if (isSchoolHeader(name)) {
            if (current) schools.push(current);
            current = { nombre: name, riAm: 0, riPm: 0, cajm: 0, cajt: 0, almuerzo: 0 };
        } else if (current) {
            // col B=RI/AM, C=RI/PM, D=CAJM, E=CAJT, F=ALMUERZO
            current.riAm    += parseNumber(row[1]);
            current.riPm    += parseNumber(row[2]);
            current.cajm    += parseNumber(row[3]);
            current.cajt    += parseNumber(row[4]);
            current.almuerzo += parseNumber(row[5]);
        }
    }

    if (current) schools.push(current);
    return schools.filter(s => s.cajm + s.cajt + s.almuerzo + s.riAm + s.riPm > 0 || schools.length <= 3);
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const sheetId = searchParams.get('sheetId') || DEFAULT_SHEET_ID;
        const sheetName = searchParams.get('sheetName') || null;

        if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
            return NextResponse.json({ error: 'Faltan credenciales de Google.' }, { status: 500 });
        }

        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_CLIENT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const sheets = google.sheets({ version: 'v4', auth });

        // Get all sheet names with their metadata
        const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
        const sheetList = (meta.data.sheets || []).map(s => ({
            name: s.properties?.title || '',
            ...parseSheetMeta(s.properties?.title || ''),
        }));

        // Determine which sheet to read
        const target =
            sheetName ||
            sheetList.find(s => s.name.toUpperCase().includes('CONSOLIDADO'))?.name ||
            sheetList[0]?.name;

        if (!target) {
            return NextResponse.json({ error: 'No se encontró ninguna hoja.' }, { status: 404 });
        }

        // Read columns A:F
        const resp = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: `'${target}'!A:F`,
        });

        const rows = resp.data.values || [];
        const schools = parseSchoolsFromRows(rows);

        const totals = schools.reduce(
            (acc, s) => ({
                riAm: acc.riAm + s.riAm,
                riPm: acc.riPm + s.riPm,
                cajm: acc.cajm + s.cajm,
                cajt: acc.cajt + s.cajt,
                almuerzo: acc.almuerzo + s.almuerzo,
            }),
            { riAm: 0, riPm: 0, cajm: 0, cajt: 0, almuerzo: 0 }
        );

        return NextResponse.json({
            sheets: sheetList,
            currentSheet: target,
            schools,
            totals,
        });
    } catch (err: any) {
        console.error('[sheets-data]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
