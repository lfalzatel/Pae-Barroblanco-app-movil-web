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
        { header: 'Estudiantes', dataKey: 'count' },
        { header: 'Menú / Observaciones', dataKey: 'notes' },
    ];

    // Map data to table format
    const rows = scheduleData.map(item => ({
        time: item.time,
        group: item.group,
        count: item.studentCount || '-',
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
            textColor: 50,
            halign: 'center' // Center align for cleaner look
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 35 },
            1: { halign: 'center', fontStyle: 'bold', cellWidth: 35 },
            2: { halign: 'center', cellWidth: 30 },
            3: { halign: 'left' } // Notes left aligned for readability
        },
        alternateRowStyles: {
            fillColor: [240, 253, 250] // Cyan-50
        },
        styles: {
            cellPadding: 5,
            valign: 'middle'
        }
    });

    // Footer (Notes & Reminders)
    const finalY = (doc as any).lastAutoTable.finalY || 50;
    let currentY = finalY + 15;

    doc.setTextColor(0, 0, 0); // Black
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('NOTA: ESTAR ATENTOS A LAS NOVEDADES.', 20, currentY);
    currentY += 7;

    doc.setFontSize(11);
    doc.text('CONSEJO ACADÉMICO DE DOCENTES', 20, currentY);
    currentY += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('RECORDEMOS QUE EL HORARIO DE BACHILLERATO DE 7 A.M A 1.00. PM', 20, currentY);
    currentY += 7;

    doc.setFont('helvetica', 'bold');
    doc.text('RECUERDA', 20, currentY);
    currentY += 6;

    doc.setFont('helvetica', 'normal');
    const reminders = [
        '• Puntualidad',
        '• Uso adecuado del uniforme',
        '• Seguir las recomendaciones escritas en estas novedades'
    ];
    reminders.forEach(r => {
        doc.text(r, 25, currentY);
        currentY += 5;
    });

    currentY += 5;
    doc.setFont('helvetica', 'bold');
    doc.text('Equipo directivo', 20, currentY);
    currentY += 5;
    doc.text('I.E Barro Blanco', 20, currentY);

    // Page Numbers
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Página ${i} de ${pageCount}`, 105, 287, { align: 'center' });
        doc.text(`Generado por: Sistema PAE`, 20, 287);
    }

    doc.save(`Horario_Restaurante_${date}.pdf`);
};

export const generateWeeklySchedulePDF = (weeklyData: any[], weekStart: Date) => {
    const doc = new jsPDF();
    const weekRange = `${weekStart.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} - ${new Date(new Date(weekStart).setDate(weekStart.getDate() + 4)).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`;

    // Header
    doc.setFontSize(22);
    doc.setTextColor(22, 78, 99);
    doc.text('Institución Educativa Barroblanco', 105, 20, { align: 'center' });

    doc.setFontSize(16);
    doc.setTextColor(71, 85, 105);
    doc.text('Consolidado Semanal de Novedades PAE', 105, 30, { align: 'center' });

    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Semana: ${weekRange}`, 105, 40, { align: 'center' });

    let currentY = 50;

    weeklyData.forEach((day, index) => {
        // Add a new page if we're running out of space
        if (currentY > 230) {
            doc.addPage();
            currentY = 20;
        }

        doc.setFillColor(245, 245, 245);
        doc.rect(15, currentY, 180, 8, 'F');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(22, 78, 99);
        doc.text(day.label.toUpperCase(), 20, currentY + 6);
        currentY += 12;

        if (day.items.length > 0) {
            const columns = ['Grupo', 'Hora / Acción', 'Novedad / Observación'];
            const rows = day.items.map((item: any) => [
                item.group,
                (item.time === 'NO_ASISTE' || item.time_start === 'NO_ASISTE') ? 'NO ASISTE' : (item.time?.split(' - ')[0] || item.time_start),
                item.notes || 'Normal'
            ]);

            autoTable(doc, {
                head: [columns],
                body: rows,
                startY: currentY,
                theme: 'grid',
                headStyles: { fillColor: [71, 85, 105], fontSize: 9, halign: 'center' },
                bodyStyles: { fontSize: 8, halign: 'center' },
                columnStyles: {
                    0: { cellWidth: 40, fontStyle: 'bold' },
                    1: { cellWidth: 35 },
                    2: { halign: 'left' }
                },
                styles: { cellPadding: 3 }
            });

            currentY = (doc as any).lastAutoTable.finalY + 10;
        } else {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(9);
            doc.setTextColor(150);
            doc.text('Sin novedades registradas para este día.', 25, currentY);
            currentY += 10;
        }
    });

    // Unified Footer (Reminders)
    if (currentY > 240) {
        doc.addPage();
        currentY = 20;
    }

    doc.setDrawColor(200);
    doc.line(20, currentY, 190, currentY);
    currentY += 10;

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('RECUERDA: Puntualidad y uso adecuado del uniforme.', 20, currentY);
    currentY += 6;
    doc.text('Equipo directivo - I.E Barro Blanco', 20, currentY);

    // Page Numbers
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Página ${i} de ${pageCount}`, 105, 287, { align: 'center' });
    }

    doc.save(`Horario_Semanal_${weekRange.replace(/ /g, '_')}.pdf`);
};
