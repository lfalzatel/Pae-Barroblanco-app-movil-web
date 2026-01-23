const XLSX = require('xlsx');

const filename = 'listado con numero de orden - 2026-01-21T153101.258.xlsx';

try {
    const workbook = XLSX.readFile(filename);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    // Get rows 10 to 25
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 10, defval: '' }); // Start reading from row 10 (index 10)

    console.log('--- ROWS 10 to 25 ---');
    // slice(0, 15) gives us 15 rows starting from row 10 (so 10-25)
    data.slice(0, 15).forEach((row, index) => {
        // index is relative to the start (0 = row 10)
        console.log(`ROW_${index + 10}: ${JSON.stringify(row)}`);
    });

} catch (error) {
    console.error('ERROR:' + error.message);
}
