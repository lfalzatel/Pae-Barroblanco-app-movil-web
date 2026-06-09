import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generateSchedulePDF = (scheduleData: any[], date: string, sede: string = 'Todas', returnBlob: boolean = false) => {
    const doc = new jsPDF();

    // Header
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 210, 297, 'F');

    doc.setFontSize(16);
    doc.setTextColor(22, 78, 99); // Cyan-900 like
    doc.text('Institución Educativa Barroblanco', 105, 16, { align: 'center' });

    doc.setFontSize(13);
    doc.setTextColor(71, 85, 105); // Slate-600
    doc.text(`Horario de Restaurante Escolar${sede !== 'Todas' ? ` - Sede ${sede}` : ''}`, 105, 24, { align: 'center' });

    doc.setFontSize(11);
    doc.setTextColor(100);
    const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    doc.text(`Fecha: ${formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)}`, 105, 32, { align: 'center' });

    // Columns for the table (sin columna Estudiantes)
    const columns = [
        { header: 'Bloque / Hora', dataKey: 'time' },
        { header: 'Grupos', dataKey: 'groups' },
    ];

    // Separar los que no asisten
    const noAsistenGroups = scheduleData
        .filter(item => item.time === 'NO_ASISTE')
        .map(item => item.group.replace('-2026', ''));

    // Agrupar por hora: una fila por hora única, grupos separados por coma
    const groupedByTime: Record<string, { groups: string[], notes: string[] }> = {};
    scheduleData
        .filter(item => item.time !== 'NO_ASISTE')
        .forEach(item => {
            const timeKey = item.time;
            if (!groupedByTime[timeKey]) {
                groupedByTime[timeKey] = { groups: [], notes: [] };
            }
            const groupName = item.group.replace('-2026', '');
            groupedByTime[timeKey].groups.push(groupName);
            if (item.notes) {
                // Incluir nota solo si ya no está duplicada
                const noteWithGroup = item.notes ? `${groupName}: ${item.notes}` : '';
                if (noteWithGroup && !groupedByTime[timeKey].notes.includes(noteWithGroup)) {
                    groupedByTime[timeKey].notes.push(noteWithGroup);
                }
            }
        });

    // Ordenar cronológicamente por hora
    const sortedTimes = Object.keys(groupedByTime).sort((a, b) => {
        const toMinutes = (t: string) => {
            const match = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
            if (!match) return 0;
            let h = parseInt(match[1]);
            const m = parseInt(match[2]);
            const period = match[3].toUpperCase();
            if (period === 'PM' && h !== 12) h += 12;
            if (period === 'AM' && h === 12) h = 0;
            return h * 60 + m;
        };
        return toMinutes(a.split(' - ')[0]) - toMinutes(b.split(' - ')[0]);
    });

    const rows = sortedTimes.map(time => ({
        time: time.split(' - ')[0], // Solo la hora de inicio
        groups: groupedByTime[time].groups.join(', '),
    }));

    // Agregar fila de NO ASISTEN al final si hay grupos
    if (noAsistenGroups.length > 0) {
        rows.push({
            time: 'NO ASISTEN',
            groups: noAsistenGroups.join(', '),
        });
    }

    // Create table
    autoTable(doc, {
        head: [columns.map(c => c.header)],
        body: rows.map(r => Object.values(r)),
        startY: 42,
        theme: 'grid',
        headStyles: {
            fillColor: [6, 182, 212], // Cyan-500
            textColor: 255,
            fontSize: 11,
            fontStyle: 'bold',
            halign: 'center'
        },
        bodyStyles: {
            fontSize: 10,
            textColor: 50,
            halign: 'center'
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 45 },
            1: { halign: 'center', fontStyle: 'bold' }
        },
        alternateRowStyles: {
            fillColor: [240, 253, 250] // Cyan-50
        },
        styles: {
            cellPadding: { top: 4, bottom: 4, left: 8, right: 8 },
            valign: 'middle'
        },
        didParseCell: (data) => {
            // Fila de NO ASISTEN: fondo rojizo
            if (data.row.raw && (data.row.raw as string[])[0] === 'NO ASISTEN') {
                data.cell.styles.fillColor = [254, 226, 226]; // rojo claro
                data.cell.styles.textColor = [153, 27, 27];   // rojo oscuro
                data.cell.styles.fontStyle = 'bold';
            }
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
    currentY += 10;

    // Address Footer
    doc.setDrawColor(200);
    doc.line(20, currentY, 190, currentY); // Horizontal Line
    currentY += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100); // Gray text for footer

    // Centered Address Info
    const centerX = 105;
    doc.text('www.barroblanco.edu.co | Correo Electrónico info@barroblanco.edu.co', centerX, currentY, { align: 'center' });
    currentY += 4;
    doc.text('Sede principal. Km. 4 Vía al aeropuerto Barrio Barro Blanco, Rionegro, Ant.', centerX, currentY, { align: 'center' });
    currentY += 4;
    doc.text('Tel. (604) 473 4386 Cel. 324 591 6685', centerX, currentY, { align: 'center' });
    currentY += 4;
    doc.text('Sede María Inmaculada, Vereda Abreu Cel. 324 591 6687', centerX, currentY, { align: 'center' });

    // Page Numbers
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Página ${i} de ${pageCount}`, 105, 287, { align: 'center' });
        doc.text(`Generado por: Sistema PAE`, 20, 287);
    }

    if (returnBlob) {
        return doc.output('bloburl');
    } else {
        doc.save(`Horario_Restaurante_${date}.pdf`);
    }
};

export const generateWeeklySchedulePDF = (weeklyData: any[], weekStart: Date, returnBlob: boolean = false) => {
    const doc = new jsPDF();
    const weekRange = `${weekStart.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} - ${new Date(new Date(weekStart).setDate(weekStart.getDate() + 4)).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`;

    // Header
    doc.setFontSize(22);
    doc.setTextColor(22, 78, 99);
    doc.text('Institución Educativa Barroblanco', 105, 20, { align: 'center' });

    doc.setFontSize(16);
    doc.setTextColor(71, 85, 105);
    doc.text(`Consolidado Semanal - Agenda Institucional`, 105, 30, { align: 'center' });

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

        // --- Institutional Agenda Table ---
        if (day.instEvents && day.instEvents.length > 0) {
            const instColumns = ['Hora', 'Actividad', 'Dirigido a / Detalles'];
            const instRows = day.instEvents.map((e: any) => [
                e.hora || 'S/H',
                e.titulo,
                `${e.afectados || ''} ${e.descripcion ? `(${e.descripcion})` : ''}`.trim() || '-'
            ]);

            autoTable(doc, {
                head: [instColumns],
                body: instRows,
                startY: currentY,
                theme: 'grid',
                headStyles: { fillColor: [6, 182, 212], fontSize: 8, halign: 'center' },
                bodyStyles: { fontSize: 7, halign: 'center' },
                columnStyles: {
                    0: { cellWidth: 25 },
                    1: { cellWidth: 45, fontStyle: 'bold' },
                    2: { halign: 'left' }
                },
                styles: { cellPadding: 2 }
            });
            currentY = (doc as any).lastAutoTable.finalY + 10;
        } else {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(9);
            doc.setTextColor(150);
            doc.text('Sin actividades registradas para este día.', 25, currentY);
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

    if (returnBlob) {
        return doc.output('bloburl');
    } else {
        doc.save(`Horario_Semanal_${weekRange.replace(/ /g, '_')}.pdf`);
    }
};

export const generateDetailedReportPDF = (params: {
    allPeriodRecords: any[],
    allStudents: any[],
    stats: any,
    filters: { periodo: string, sede: string, grupo: string, startDate: string, endDate: string },
    sedeStats?: any[],
    grupoStats?: any[],
    studentStats?: any[],
    returnBlob?: boolean
}) => {
    const { allPeriodRecords, allStudents, stats, filters, sedeStats, grupoStats, studentStats } = params;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const todayStr = new Date().toLocaleDateString('es-CO');

    // 1. Título y Estética Premium
    doc.setFillColor(22, 101, 52); // Verde esmeralda oscuro
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('REPORTE DE ASISTENCIA PAE', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('INSTITUCIÓN EDUCATIVA BARROBLANCO', pageWidth / 2, 28, { align: 'center' });
    doc.text(`Generado el: ${todayStr}`, pageWidth / 2, 34, { align: 'center' });

    // 2. Información de Filtros
    let currentY = 50;
    doc.setTextColor(50);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Parámetros del Reporte', 14, currentY);
    currentY += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const filterLines = [
        `Periodo: ${filters.startDate} al ${filters.endDate} (${filters.periodo.toUpperCase()})`,
        `Sede: ${filters.sede === 'todas' ? 'TODAS LAS SEDES' : filters.sede.toUpperCase()}`,
        `Grupo: ${filters.grupo === 'todos' ? 'TODOS LOS GRUPOS' : filters.grupo}`
    ];
    filterLines.forEach(line => {
        doc.text(line, 14, currentY);
        currentY += 5;
    });

    // 3. Resumen Estadístico (Dashboard style)
    currentY += 5;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Consolidado General', 14, currentY);
    
    autoTable(doc, {
        startY: currentY + 5,
        head: [['Métrica', 'Valor']],
        body: [
            ['Total Estudiantes (Activos)', stats.totalEstudiantes.toString()],
            ['Total Raciones Entregadas', stats.recibieron.toString()],
            ['No Recibieron Ración', stats.noRecibieron.toString()],
            ['Estudiantes Ausentes', stats.ausentes.toString()],
            ['Tasa de Asistencia', `${stats.porcentajeAsistencia}%`]
        ],
        theme: 'striped',
        headStyles: { fillColor: [22, 101, 52] },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 } }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // 4. Lógica de Matriz Semanal (Solo si hay un grupo seleccionado)
    if (filters.grupo !== 'todos' && (filters.periodo === 'mes' || filters.periodo === 'semana')) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`Matriz de Asistencia Diaria - Grupo ${filters.grupo}`, 14, currentY);
        currentY += 8;

        // Agrupar registros por fecha y estudiante
        const attendanceMap: Record<string, Record<string, string>> = {};
        allPeriodRecords.forEach(r => {
            const est = Array.isArray(r.estudiantes) ? r.estudiantes[0] : r.estudiantes;
            if (!est?.id) return;
            if (!attendanceMap[est.id]) attendanceMap[est.id] = {};
            attendanceMap[est.id][r.fecha] = r.estado;
        });

        // Generar lista de fechas (solo días de semana) entre startDate y endDate
        const allDates: string[] = [];
        let curr = new Date(filters.startDate + 'T00:00:00');
        const end = new Date(filters.endDate + 'T00:00:00');
        while (curr <= end) {
            if (curr.getDay() !== 0 && curr.getDay() !== 6) {
                allDates.push(new Date(curr.getTime() - curr.getTimezoneOffset() * 60000).toISOString().split('T')[0]);
            }
            curr.setDate(curr.getDate() + 1);
        }

        // Agrupar fechas por semanas
        const weeks: string[][] = [];
        let currentWeek: string[] = [];
        allDates.forEach((date, i) => {
            currentWeek.push(date);
            const d = new Date(date + 'T00:00:00');
            // Si es viernes o la última fecha, cerrar semana
            if (d.getDay() === 5 || i === allDates.length - 1) {
                weeks.push(currentWeek);
                currentWeek = [];
            }
        });

        // Renderizar una tabla por cada semana
        const sortedStudents = [...allStudents].sort((a, b) => a.nombre.localeCompare(b.nombre));

        weeks.forEach((weekDates, weekIdx) => {
            if (currentY > 230) {
                doc.addPage();
                currentY = 20;
            }

            const weekLabel = `Semana ${weekIdx + 1} (${weekDates[0]} al ${weekDates[weekDates.length - 1]})`;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(22, 101, 52);
            doc.text(weekLabel, 14, currentY);
            
            const matrixHead = [['Estudiante', ...weekDates.map(d => {
                const day = new Date(d + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'short' });
                const dayNum = d.split('-')[2];
                return `${day} ${dayNum}`;
            })]];

            const matrixBody = sortedStudents.map(student => {
                const row: string[] = [student.nombre];
                weekDates.forEach(date => {
                    const estado = attendanceMap[student.id]?.[date];
                    if (estado === 'recibio') row.push('SI');
                    else if (estado === 'no_recibio') row.push('NO');
                    else if (estado === 'ausente') row.push('AUS');
                    else row.push('-');
                });
                return row;
            });

            autoTable(doc, {
                startY: currentY + 4,
                head: matrixHead,
                body: matrixBody,
                theme: 'grid',
                headStyles: { fillColor: [51, 65, 85], fontSize: 7, halign: 'center' },
                bodyStyles: { fontSize: 7, halign: 'center' },
                columnStyles: { 0: { halign: 'left', cellWidth: 45 } },
                styles: { cellPadding: 1 },
                didParseCell: (data) => {
                    if (data.cell.text[0] === 'SI') data.cell.styles.textColor = [22, 101, 52];
                    if (data.cell.text[0] === 'NO') data.cell.styles.textColor = [220, 38, 38];
                    if (data.cell.text[0] === 'AUS') data.cell.styles.textColor = [156, 163, 175];
                }
            });

            currentY = (doc as any).lastAutoTable.finalY + 12;
        });
    }

    // Reporte Consolidado (Siempre visible, con o sin matriz)
        if (sedeStats && sedeStats.length > 0) {
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Resumen Detallado por Sede', 14, currentY);
            
            autoTable(doc, {
                startY: currentY + 5,
                head: [['Sede', 'Total Est. (Act)', 'Est. Inactivos', 'Recibieron', 'No Recibieron', 'Ausentes', '% Asist.']],
                body: sedeStats.map(s => [
                    s.sede, 
                    s.total.toString(), 
                    s.inactivos.toString(),
                    s.recibieron.toString(), 
                    s.noRecibieron.toString(), 
                    s.ausentes.toString(), 
                    `${s.porcentaje}%`
                ]),
                theme: 'grid',
                headStyles: { fillColor: [15, 118, 110] },
                styles: { fontSize: 8 }
            });
            currentY = (doc as any).lastAutoTable.finalY + 15;
        }

        if (grupoStats && grupoStats.length > 0) {
            if (currentY > 250) { doc.addPage(); currentY = 20; }
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Rendimiento por Grupos', 14, currentY);

            autoTable(doc, {
                startY: currentY + 5,
                head: [['Grupo', 'Sede', 'Total(Act)', 'Inactivos', 'Recibieron', 'Ausentes', 'Días Reg.', 'Rac. Esp.', '% Asist.', 'Estado']],
                body: grupoStats.map(g => [
                    g.grupo, g.sede, g.total.toString(), g.inactivos.toString(), g.recibieron.toString(), g.ausentes.toString(), g.diasRegistrados?.toString() || '0', g.racionesEsperadas?.toString() || '0', `${g.porcentaje}%`, g.estado
                ]),
                theme: 'striped',
                headStyles: { fillColor: [71, 85, 105] },
                styles: { fontSize: 7 },
                didParseCell: (data) => {
                    if (data.column.index === 8) {
                        const val = data.cell.text[0];
                        if (val === 'Excelente') data.cell.styles.textColor = [22, 101, 52];
                        if (val === 'Crítico') data.cell.styles.textColor = [220, 38, 38];
                    }
                }
            });
            currentY = (doc as any).lastAutoTable.finalY + 15;
        }

        if (filters.grupo !== 'todos' && studentStats && studentStats.length > 0) {
            if (currentY > 250) { doc.addPage(); currentY = 20; }
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Detalle de Estudiantes', 14, currentY);

            autoTable(doc, {
                startY: currentY + 5,
                head: [['Estudiante', 'Recibió', 'Ausente', 'Días Reg.', '% Asist.', 'Estado']],
                body: studentStats.map(s => [
                    s.nombre,
                    s.recibio.toString(),
                    s.ausentes.toString(),
                    s.diasRegistrados.toString(),
                    `${s.porcentaje}%`,
                    s.estado
                ]),
                theme: 'grid',
                headStyles: { fillColor: [8, 145, 178] },
                styles: { fontSize: 8 },
                didParseCell: (data) => {
                    if (data.column.index === 5) {
                        const val = data.cell.text[0];
                        if (val === 'Excelente') data.cell.styles.textColor = [22, 101, 52];
                        if (val === 'Crítico') data.cell.styles.textColor = [220, 38, 38];
                    }
                }
            });
            currentY = (doc as any).lastAutoTable.finalY + 15;
        }

    // Pie de Página
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
            `Página ${i} de ${pageCount} - I.E. Barroblanco Sistema PAE - Documento Oficial`,
            pageWidth / 2,
            doc.internal.pageSize.height - 10,
            { align: 'center' }
        );
    }

    const filename = `Reporte_PAE_${filters.sede}_${filters.grupo}_${filters.startDate}.pdf`;
    
    if (params.returnBlob) {
        return { blob: doc.output('blob'), filename };
    } else {
        doc.save(filename);
    }
};
