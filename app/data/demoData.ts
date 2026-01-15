// Tipos de datos
export interface Usuario {
  email: string;
  password: string;
  rol: 'admin' | 'coordinador' | 'docente' | 'estudiante';
  nombre: string;
}

export interface Sede {
  id: string;
  nombre: string;
  descripcion: string;
  gradosMinMax: string;
  estudiantesTotal: number;
}

export interface Grupo {
  id: string;
  nombre: string;
  grado: string;
  estudiantes: number;
  sedeId: string;
}

export interface Estudiante {
  id: string;
  nombre: string;
  matricula: string;
  grado: string;
  grupo: string;
  sedeId: string;
  asistencias: AsistenciaRecord[];
}

export interface AsistenciaRecord {
  fecha: string;
  estado: 'recibio' | 'no-recibio' | 'ausente';
  novedad?: string;
}

// Usuarios de demostración
export const usuariosDemo: Usuario[] = [
  {
    email: 'admin@barroblanco.edu.co',
    password: 'admin123',
    rol: 'admin',
    nombre: 'Administrador Sistema'
  },
  {
    email: 'coordinador@barroblanco.edu.co',
    password: 'coord123',
    rol: 'coordinador',
    nombre: 'Coordinador PAE'
  },
  {
    email: 'docente1@barroblanco.edu.co',
    password: 'doc123',
    rol: 'docente',
    nombre: 'Docente Grupo 801'
  },
  {
    email: 'estudiante@barroblanco.edu.co',
    password: 'est123',
    rol: 'estudiante',
    nombre: 'Estudiante Demo'
  }
];

// Sedes
export const sedes: Sede[] = [
  {
    id: 'principal',
    nombre: 'Sede Principal',
    descripcion: 'Grados 6° - 11°',
    gradosMinMax: 'Grados 6° - 11°',
    estudiantesTotal: 0
  },
  {
    id: 'primaria',
    nombre: 'Sede Primaria',
    descripcion: 'Educación Primaria',
    gradosMinMax: 'Educación Primaria',
    estudiantesTotal: 0
  },
  {
    id: 'maria-inmaculada',
    nombre: 'María Inmaculada',
    descripcion: 'Educación Primaria',
    gradosMinMax: 'Educación Primaria',
    estudiantesTotal: 0
  }
];

// Grupos por sede
export const grupos: Grupo[] = [
  // Sede Principal (Bachillerato)
  { id: '1001', nombre: '1001', grado: '10°', estudiantes: 26, sedeId: 'principal' },
  { id: '1002', nombre: '1002', grado: '10°', estudiantes: 23, sedeId: 'principal' },
  { id: '1004', nombre: '1004', grado: '10°', estudiantes: 4, sedeId: 'principal' },
  { id: '1101', nombre: '1101', grado: '11°', estudiantes: 28, sedeId: 'principal' },
  { id: '1102', nombre: '1102', grado: '11°', estudiantes: 34, sedeId: 'principal' },
  { id: '1104', nombre: '1104', grado: '11°', estudiantes: 1, sedeId: 'principal' },
  { id: '601', nombre: '601', grado: '6°', estudiantes: 32, sedeId: 'principal' },
  { id: '602', nombre: '602', grado: '6°', estudiantes: 30, sedeId: 'principal' },
  { id: '701', nombre: '701', grado: '7°', estudiantes: 35, sedeId: 'principal' },
  { id: '702', nombre: '702', grado: '7°', estudiantes: 33, sedeId: 'principal' },
  { id: '801', nombre: '801', grado: '8°', estudiantes: 35, sedeId: 'principal' },
  { id: '802', nombre: '802', grado: '8°', estudiantes: 32, sedeId: 'principal' },
  { id: '901', nombre: '901', grado: '9°', estudiantes: 30, sedeId: 'principal' },
  { id: '902', nombre: '902', grado: '9°', estudiantes: 28, sedeId: 'principal' },
  
  // Sede Primaria
  { id: '101', nombre: '101', grado: '1°', estudiantes: 25, sedeId: 'primaria' },
  { id: '102', nombre: '102', grado: '1°', estudiantes: 24, sedeId: 'primaria' },
  { id: '201', nombre: '201', grado: '2°', estudiantes: 26, sedeId: 'primaria' },
  { id: '202', nombre: '202', grado: '2°', estudiantes: 25, sedeId: 'primaria' },
  { id: '301', nombre: '301', grado: '3°', estudiantes: 28, sedeId: 'primaria' },
  { id: '302', nombre: '302', grado: '3°', estudiantes: 27, sedeId: 'primaria' },
  { id: '401', nombre: '401', grado: '4°', estudiantes: 30, sedeId: 'primaria' },
  { id: '402', nombre: '402', grado: '4°', estudiantes: 29, sedeId: 'primaria' },
  { id: '501', nombre: '501', grado: '5°', estudiantes: 31, sedeId: 'primaria' },
  { id: '502', nombre: '502', grado: '5°', estudiantes: 30, sedeId: 'primaria' },
  
  // María Inmaculada
  { id: 'mi-101', nombre: '101', grado: '1°', estudiantes: 22, sedeId: 'maria-inmaculada' },
  { id: 'mi-201', nombre: '201', grado: '2°', estudiantes: 23, sedeId: 'maria-inmaculada' },
  { id: 'mi-301', nombre: '301', grado: '3°', estudiantes: 24, sedeId: 'maria-inmaculada' },
  { id: 'mi-401', nombre: '401', grado: '4°', estudiantes: 25, sedeId: 'maria-inmaculada' },
  { id: 'mi-501', nombre: '501', grado: '5°', estudiantes: 26, sedeId: 'maria-inmaculada' },
];

// Calcular total de estudiantes por sede
sedes.forEach(sede => {
  sede.estudiantesTotal = grupos
    .filter(g => g.sedeId === sede.id)
    .reduce((sum, g) => sum + g.estudiantes, 0);
});

// Función para generar estudiantes demo
function generarNombreEstudiante(index: number): string {
  const nombres = [
    'ACEVEDO ESCALANTE SANTIAGO ANDRES',
    'AGUDELO ECHEVERRI XIMENA',
    'ABADIA RINCON DANNA SOFIA',
    'ALZATE GALLEGO SANTIAGO',
    'AREIZA GIL VALERIA',
    'BEDOYA MONTOYA CAMILA',
    'BOTERO GARCIA JUAN PABLO',
    'CASTAÑO LOPEZ MARIA JOSE',
    'CORREA RAMIREZ DANIEL',
    'DUQUE HERNANDEZ VALENTINA',
    'ESTRADA MUÑOZ SEBASTIAN',
    'FRANCO RUIZ LAURA',
    'GARCIA SANCHEZ MARIA SALOME',
    'GOMEZ BRAVO NIKOL ANDREA',
    'HENAO TORRES DAVID',
    'JIMENEZ VILLA ISABELLA',
    'LOPEZ MARTINEZ CARLOS',
    'MEJIA CARDONA SOFIA',
    'MONTOYA ALVAREZ MATEO',
    'OSORIO ARBELAEZ VALERIA'
  ];
  
  return nombres[index % nombres.length];
}

// Generar estudiantes para grupos
export function generarEstudiantesGrupo(grupoId: string, cantidad: number): Estudiante[] {
  const grupo = grupos.find(g => g.id === grupoId);
  if (!grupo) return [];
  
  const estudiantes: Estudiante[] = [];
  
  for (let i = 1; i <= cantidad; i++) {
    const estudianteId = `${grupoId}-${i.toString().padStart(3, '0')}`;
    const matricula = `${210000 + Math.floor(Math.random() * 10000)}`;
    
    // Generar asistencias de los últimos 30 días
    const asistencias: AsistenciaRecord[] = [];
    const hoy = new Date();
    
    for (let dia = 0; dia < 30; dia++) {
      const fecha = new Date(hoy);
      fecha.setDate(fecha.getDate() - dia);
      
      // Solo días laborables
      if (fecha.getDay() !== 0 && fecha.getDay() !== 6) {
        const rand = Math.random();
        let estado: 'recibio' | 'no-recibio' | 'ausente';
        
        if (rand > 0.95) {
          estado = 'ausente';
        } else if (rand > 0.9) {
          estado = 'no-recibio';
        } else {
          estado = 'recibio';
        }
        
        asistencias.push({
          fecha: fecha.toISOString().split('T')[0],
          estado,
          novedad: estado !== 'recibio' ? (estado === 'ausente' ? 'Ausente' : 'No recibió alimentación') : undefined
        });
      }
    }
    
    estudiantes.push({
      id: estudianteId,
      nombre: generarNombreEstudiante(i),
      matricula,
      grado: grupo.grado,
      grupo: grupo.nombre,
      sedeId: grupo.sedeId,
      asistencias: asistencias.reverse() // Más reciente primero
    });
  }
  
  return estudiantes;
}

// Estadísticas del día
export function calcularEstadisticasHoy() {
  const totalEstudiantes = grupos.reduce((sum, g) => sum + g.estudiantes, 0);
  const presentesHoy = Math.floor(totalEstudiantes * 0.919); // 91.9% según la imagen
  
  return {
    totalEstudiantes,
    presentesHoy,
    porcentajeAsistencia: 91.9,
    recibieron: Math.floor(presentesHoy * 0.98),
    noRecibieron: Math.floor(presentesHoy * 0.02),
    ausentes: totalEstudiantes - presentesHoy
  };
}
