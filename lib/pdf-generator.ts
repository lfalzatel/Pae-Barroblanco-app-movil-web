import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateSchedulePDF = (scheduleData: any[], date: string) => {
    const doc = new jsPDF();

    // Header
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 210, 297, 'F');

    doc.setFontSize(22);
    doc.setTextColor(22, 78, 99); // Cyan-900 like
    doc.text('Institución Educativa Barroblanco', 105, 20, { align: 'center' });

    doc.setFontSize(16);
    doc.setTextColor(71, 85, 105); // Slate-600
    doc.text('Horario de Restaurante Escolar', 105, 30, { align: 'center' });

    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Fecha: ${date}`, 105, 40, { align: 'center' });

    // Columns for the table
    const columns = [
        { header: 'Bloque / Hora', dataKey: 'time' },
        { header: 'Grupo', dataKey: 'group' },
        { header: 'Menú / Observaciones', dataKey: 'notes' },
    ];

    // Map data to table format
    const rows = scheduleData.map(item => ({
        time: item.time,
        group: item.group,
        notes: item.notes || '-'
    }));

    // Create table
    autoTable(doc, {
        head: [columns.map(c => c.header)],
        body: rows.map(r => Object.values(r)),
        startY: 50,
        theme: 'grid',
        headStyles: {
            fillColor: [6, 182, 212], // Cyan-500
            textColor: 255,
            fontSize: 12,
            fontStyle: 'bold',
            halign: 'center'
        },
        bodyStyles: {
            fontSize: 10,
            textColor: 50
        },
        alternateRowStyles: {
            fillColor: [240, 253, 250] // Cyan-50
        },
        styles: {
            cellPadding: 5,
            valign: 'middle'
        }
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text(`Página ${i} de ${pageCount}`, 105, 287, { align: 'center' });
        doc.text(`Generado por: Sistema PAE`, 20, 287);
    }

    doc.save(`Horario_Restaurante_${date}.pdf`);
};
