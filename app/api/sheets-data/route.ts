import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const DEFAULT_SHEET_ID = '1NIp7IaTps7E-QqkBc5Yt0rx36HGc-k5d4EiKmtOLFeE';

// ── Metadata helpers ──────────────────────────────────────────────────────────
const DIA_MAP: Record<string, number> = {
    'LUNES': 0, 'MARTES': 1, 'MIERCOLES': 2, 'MIÉRCOLES': 2, 'JUEVES': 3, 'VIERNES': 4,
};
const MES_MAP: Record<string, number> = {
    'ENE': 0, 'ENERO': 0, 'FEB': 1, 'FEBRERO': 1, 'MAR': 2, 'MARZO': 2,
    'ABR': 3, 'ABRIL': 3, 'MAY': 4, 'MAYO': 4, 'JUN': 5, 'JUNIO': 5,
    'JUL': 6, 'JULIO': 6, 'AGO': 7, 'AGOSTO': 7, 'SEP': 8, 'SEPT': 8,
    'SEPTIEMBRE': 8, 'OCT': 9, 'OCTUBRE': 9, 'NOV': 10, 'NOVIEMBRE': 10,
    'DIC': 11, 'DICIEMBRE': 11,
};

function parseSheetMeta(name: string) {
    const upper = name.toUpperCase();
    let month: number | null = null;
    let day: number | null = null;
    for (const [k, v] of Object.entries(DIA_MAP)) { if (upper.includes(k)) { day = v; break; } }
    for (const [k, v] of Object.entries(MES_MAP)) { if (upper.includes(k)) { month = v; break; } }
    if (month === null) {
        const m = upper.match(/(\d{4})-(\d{2})-\d{2}/);
        if (m) month = parseInt(m[2], 10) - 1;
    }
    return { month, day };
}

// ── Number parser ─────────────────────────────────────────────────────────────
function n(val: any): number {
    if (val === null || val === undefined || val === '') return 0;
    const parsed = parseInt(String(val).replace(/[^0-9]/g, ''), 10);
    return isNaN(parsed) ? 0 : parsed;
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface GroupRow {
    nombre: string;
    riAm: number;
    riPm: number;
    cajm: number;
    cajt: number;
    almuerzo: number;
    total: number;
}

export interface Sede {
    nombre: string;
    riAm: number;
    riPm: number;
    cajm: number;
    cajt: number;
    almuerzo: number;
    total: number;
    grupos: GroupRow[];
}

export interface School {
    nombre: string;
    riAm: number;
    riPm: number;
    cajm: number;
    cajt: number;
    almuerzo: number;
    total: number;
    grupos: GroupRow[];   // plano — compatibilidad
    sedes: Sede[];        // agrupado por sede; siempre >= 1 elemento
}

export interface Totals {
    riAm: number;
    riPm: number;
    cajm: number;
    cajt: number;
    almuerzo: number;
    total: number;
}

// ── Known institutions ────────────────────────────────────────────────────────
function normalize(s: string): string {
    return s
        .toUpperCase()
        .replace(/[ÁÀÂÄ]/g, 'A').replace(/[ÉÈÊË]/g, 'E').replace(/[ÍÌÎÏ]/g, 'I')
        .replace(/[ÓÒÔÖ]/g, 'O').replace(/[ÚÙÛÜ]/g, 'U').replace(/Ñ/g, 'N')
        .replace(/\./g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

const KNOWN_SCHOOLS = new Set([
    'IE ANA GOMEZ DE SIERRA',
    'IE ANTONIO DONADO CAMACAHO',
    'IE BALTAZAR SALAZAR',
    'IE BARRO BLANCO',
    'IE GILBERTO ECHEVERRI MEJIA',
    'IE DOMINGO SAVIO',
    'IE ESCUELA NORMAL SUPERIOR DE MARIA',
    'IE CONCEJO MUNICIPAL EL PORVENIR',
    'IE GUILLERMO GAVIRIA CORREA',
    'IE LICEO JOSE MARIA CORDOBA',
    'IE JOSEFINA MUNOZ GONZALEZ',
    'IE LA MOSQUITA',
    'IE BALDOMERO SANIN CANO',
    'IE SAN ANTONIO',
    'IE SAN JOSE DE LAS CUCHILLAS',
    'IE SANTA BARBARA',
    'IE TECNICO INDUSTRIAL SANTIAGO DE ARMA',
]);

// ── Parser ────────────────────────────────────────────────────────────────────
function isSchoolHeader(cell: string): boolean {
    return KNOWN_SCHOOLS.has(normalize(cell));
}

function isTotalRow(cell: string): boolean {
    const v = cell.toUpperCase().trim();
    return v.startsWith('TOTAL COMPLEMENTOS') || v.startsWith('TOTAL A ENTREGAR') || v === 'TOTAL';
}

/** Encabezado de sede: texto con "SEDE", sin datos numéricos en B-H, no es colegio ni total */
function isSedeHeader(cell: string, row: any[]): boolean {
    if (!cell || isSchoolHeader(cell) || isTotalRow(cell)) return false;
    if (!cell.toUpperCase().includes('SEDE')) return false;
    return ![1, 2, 3, 4, 5, 6, 7].some(idx => n(row[idx]) > 0);
}

function parseRow(row: any[]): Omit<GroupRow, 'nombre'> {
    // Columns: A=name, B=RI/AM, C=RI/PM, D=CAJM, E=CAJT, F=Almuerzo, G=? (skip), H=Total
    const riAm    = n(row[1]);
    const riPm    = n(row[2]);
    const cajm    = n(row[3]);
    const cajt    = n(row[4]);
    const almuerzo = n(row[5]);
    // Total: try col H (index 7), then G (6), then sum
    const rawTotal = n(row[7]) || n(row[6]) || (riAm + riPm + cajm + cajt + almuerzo);
    const total = rawTotal > 0 ? rawTotal : (riAm + riPm + cajm + cajt + almuerzo);
    return { riAm, riPm, cajm, cajt, almuerzo, total };
}

function parseSchoolsFromRows(rows: any[][]): School[] {
    const schools: School[] = [];
    let current: School | null = null;
    let currentSede: Sede | null = null;

    function newSede(nombre: string): Sede {
        return { nombre, riAm: 0, riPm: 0, cajm: 0, cajt: 0, almuerzo: 0, total: 0, grupos: [] };
    }

    function flushSede() {
        if (!current || !currentSede) return;
        // No empujar sedes vacías
        if (currentSede.grupos.length === 0) {
            currentSede = null;
            return;
        }
        if (currentSede.total === 0) {
            currentSede.riAm     = currentSede.grupos.reduce((s, g) => s + g.riAm, 0);
            currentSede.riPm     = currentSede.grupos.reduce((s, g) => s + g.riPm, 0);
            currentSede.cajm     = currentSede.grupos.reduce((s, g) => s + g.cajm, 0);
            currentSede.cajt     = currentSede.grupos.reduce((s, g) => s + g.cajt, 0);
            currentSede.almuerzo = currentSede.grupos.reduce((s, g) => s + g.almuerzo, 0);
            currentSede.total    = currentSede.riAm + currentSede.riPm + currentSede.cajm
                                 + currentSede.cajt + currentSede.almuerzo;
        }
        current.sedes.push(currentSede);
        currentSede = null;
    }

    for (const row of rows) {
        const cell = String(row[0] || '').trim();
        if (!cell) continue;

        // ── Encabezado de colegio ──────────────────────────────────────────────
        if (isSchoolHeader(cell)) {
            flushSede();
            if (current) {
                current.grupos   = current.sedes.flatMap(s => s.grupos);
                current.riAm     = current.sedes.reduce((s, se) => s + se.riAm, 0);
                current.riPm     = current.sedes.reduce((s, se) => s + se.riPm, 0);
                current.cajm     = current.sedes.reduce((s, se) => s + se.cajm, 0);
                current.cajt     = current.sedes.reduce((s, se) => s + se.cajt, 0);
                current.almuerzo = current.sedes.reduce((s, se) => s + se.almuerzo, 0);
                current.total    = current.riAm + current.riPm + current.cajm
                                 + current.cajt + current.almuerzo;
                schools.push(current);
            }
            current = { nombre: cell, riAm: 0, riPm: 0, cajm: 0, cajt: 0, almuerzo: 0, total: 0, grupos: [], sedes: [] };
            currentSede = newSede('');
            continue;
        }

        if (!current) continue;

        // ── Cualquier fila TOTAL ───────────────────────────────────────────────
        // Si la sede actual tiene grupos → es el sub-total de esa sede, cerrarla.
        // Si no hay grupos → es el grand total del colegio, ignorar (siempre se computa de sedes).
        if (isTotalRow(cell)) {
            if (currentSede && currentSede.grupos.length > 0) {
                const vals = parseRow(row);
                if (vals.total > 0) {
                    currentSede.riAm     = vals.riAm;
                    currentSede.riPm     = vals.riPm;
                    currentSede.cajm     = vals.cajm;
                    currentSede.cajt     = vals.cajt;
                    currentSede.almuerzo = vals.almuerzo;
                    currentSede.total    = vals.total;
                }
                flushSede();
            }
            continue;
        }

        // ── Encabezado de sede (texto sin datos numéricos) ────────────────────
        if (isSedeHeader(cell, row)) {
            if (currentSede && currentSede.grupos.length === 0 && currentSede.nombre === '') {
                // Renombrar la sede por defecto antes de que lleguen grupos
                currentSede.nombre = cell;
            } else {
                flushSede();
                currentSede = newSede(cell);
            }
            continue;
        }

        // ── Fila de grupo con datos numéricos ─────────────────────────────────
        const vals = parseRow(row);
        if (vals.riAm + vals.riPm + vals.cajm + vals.cajt + vals.almuerzo > 0) {
            if (!currentSede) currentSede = newSede('');
            currentSede.grupos.push({ nombre: cell, ...vals });
        }
    }

    // ── Flush del último colegio ───────────────────────────────────────────────
    if (current) {
        flushSede();
        current.grupos   = current.sedes.flatMap(s => s.grupos);
        current.riAm     = current.sedes.reduce((s, se) => s + se.riAm, 0);
        current.riPm     = current.sedes.reduce((s, se) => s + se.riPm, 0);
        current.cajm     = current.sedes.reduce((s, se) => s + se.cajm, 0);
        current.cajt     = current.sedes.reduce((s, se) => s + se.cajt, 0);
        current.almuerzo = current.sedes.reduce((s, se) => s + se.almuerzo, 0);
        current.total    = current.riAm + current.riPm + current.cajm
                         + current.cajt + current.almuerzo;
        schools.push(current);
    }

    return schools;
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const sheetId   = searchParams.get('sheetId')   || DEFAULT_SHEET_ID;
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

        // Sheet list
        const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
        const sheetList = (meta.data.sheets || []).map(s => ({
            name: s.properties?.title || '',
            ...parseSheetMeta(s.properties?.title || ''),
        }));

        // Target sheet
        const target =
            sheetName ||
            sheetList.find(s => s.name.toUpperCase().includes('CONSOLIDADO'))?.name ||
            sheetList[0]?.name;

        if (!target) {
            return NextResponse.json({ error: 'No se encontró ninguna hoja.' }, { status: 404 });
        }

        // Read columns A:H (name, RI/AM, RI/PM, CAJM, CAJT, Almuerzo, extra, total)
        const resp = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: `'${target}'!A:H`,
        });

        const rows = resp.data.values || [];
        const schools = parseSchoolsFromRows(rows);

        // Grand totals = sum of each school's official TOTAL COMPLEMENTOS row
        const totals: Totals = schools.reduce(
            (acc, s) => ({
                riAm:    acc.riAm    + s.riAm,
                riPm:    acc.riPm    + s.riPm,
                cajm:    acc.cajm    + s.cajm,
                cajt:    acc.cajt    + s.cajt,
                almuerzo: acc.almuerzo + s.almuerzo,
                total:   acc.total   + s.total,
            }),
            { riAm: 0, riPm: 0, cajm: 0, cajt: 0, almuerzo: 0, total: 0 }
        );

        return NextResponse.json({ sheets: sheetList, currentSheet: target, schools, totals });
    } catch (err: any) {
        console.error('[sheets-data]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
