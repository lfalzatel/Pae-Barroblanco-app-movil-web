# Sistema PAE Barroblanco

Sistema de Asistencia del Programa de Alimentación Escolar - Institución Educativa Barroblanco

## 📋 Descripción

Aplicación web completa para la gestión de asistencia y control del Programa de Alimentación Escolar (PAE) en la Institución Educativa Barroblanco, Rionegro, Antioquia.

### Características Principales

✅ **Sistema de Login** con 4 roles de usuario (Admin, Coordinador, Docente, Estudiante)
✅ **Dashboard Interactivo** con estadísticas en tiempo real
✅ **Gestión por Sedes** (Principal, Primaria, María Inmaculada)
✅ **Registro de Asistencia** por grupo con interfaz intuitiva
✅ **Gestión de Estudiantes** con historiales individuales
✅ **Reportes y Estadísticas** con filtros por período y sede
✅ **Diseño Responsivo** optimizado para móviles y tablets
✅ **Interfaz Moderna** con Tailwind CSS

## 🚀 Tecnologías Utilizadas

- **Next.js 14** - Framework React con App Router
- **TypeScript** - Tipado estático
- **Tailwind CSS** - Estilos modernos y responsivos
- **Lucide React** - Iconos SVG
- **React Hooks** - Estado y efectos

## 📦 Instalación

### Prerequisitos

- Node.js 18.x o superior
- npm o yarn

### Pasos de Instalación

1. **Descargar y extraer el proyecto**
   ```bash
   # Extrae el archivo ZIP descargado
   unzip sistema-pae-web.zip
   cd sistema-pae-web
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Ejecutar en modo desarrollo**
   ```bash
   npm run dev
   ```

4. **Abrir en el navegador**
   ```
   http://localhost:3000
   ```

## 👥 Usuarios de Demostración

### Acceso de Prueba

| Rol | Email | Contraseña |
|-----|-------|------------|
| Admin | admin@barroblanco.edu.co | admin123 |
| Coordinador | coordinador@barroblanco.edu.co | coord123 |
| Docente | docente1@barroblanco.edu.co | doc123 |
| Estudiante | estudiante@barroblanco.edu.co | est123 |

## 📱 Funcionalidades por Módulo

### 1. Login
- Autenticación por roles
- Validación de credenciales
- Redirección automática al dashboard

### 2. Dashboard
- Estadísticas del día
- Total de estudiantes por sede
- Porcentaje de asistencia
- Acceso rápido a registro

### 3. Registro de Asistencia
**Flujo de trabajo:**
1. Seleccionar Sede (Principal, Primaria, María Inmaculada)
2. Seleccionar Grupo
3. Registrar asistencia individual:
   - ✅ Recibió alimentación
   - ❌ No recibió alimentación
   - 👤 Ausente
4. Opción de marcar todos como "Recibieron"
5. Guardar registro

### 4. Gestión de Estudiantes
- Lista completa de estudiantes
- Búsqueda por nombre o matrícula
- Filtro por grupo
- Ver historial individual
- Exportar reportes

### 5. Reportes y Estadísticas
- Filtros por período (Hoy, Semana, Mes)
- Filtros por sede
- Estadísticas visuales
- Exportar a Excel/PDF

## 📊 Estructura de Datos

### Sedes
- **Sede Principal:** Grados 6° - 11° (Bachillerato)
- **Sede Primaria:** Grados 1° - 5°
- **María Inmaculada:** Grados 1° - 5°

### Grupos
Total: 29 grupos distribuidos en las 3 sedes
- Sede Principal: 14 grupos
- Sede Primaria: 10 grupos
- María Inmaculada: 5 grupos

### Estudiantes
- Datos demo generados automáticamente
- Nombres realistas colombianos
- Matrículas únicas
- Historial de 30 días de asistencia

## 🎨 Diseño y UX

### Paleta de Colores
- **Primario:** Azul (#2563eb)
- **Secundario:** Verde (#10b981)
- **Acento:** Naranja (#f59e0b)
- **Estados:**
  - Recibió: Verde
  - No recibió: Rojo
  - Ausente: Gris

### Responsive Design
- Mobile First
- Adaptable a tablets
- Optimizado para desktop
- Sidebar colapsable en móvil

## 📁 Estructura del Proyecto

```
sistema-pae-web/
├── app/
│   ├── components/        # Componentes reutilizables
│   ├── data/
│   │   └── demoData.ts   # Datos de demostración
│   ├── dashboard/
│   │   ├── page.tsx      # Dashboard principal
│   │   ├── registro/
│   │   │   └── page.tsx  # Registro de asistencia
│   │   ├── gestion/
│   │   │   └── page.tsx  # Gestión de estudiantes
│   │   └── reportes/
│   │       └── page.tsx  # Reportes y estadísticas
│   ├── globals.css       # Estilos globales
│   ├── layout.tsx        # Layout principal
│   └── page.tsx          # Página de login
├── public/               # Archivos estáticos
├── next.config.js        # Configuración de Next.js
├── tailwind.config.js    # Configuración de Tailwind
├── tsconfig.json         # Configuración de TypeScript
└── package.json          # Dependencias del proyecto
```

## 🔧 Comandos Disponibles

```bash
# Desarrollo
npm run dev         # Inicia servidor de desarrollo

# Producción
npm run build       # Construye para producción
npm run start       # Inicia servidor de producción

# Utilidades
npm run lint        # Ejecuta el linter
```

## 🌐 Despliegue

### Opción 1: Vercel (Recomendado)
1. Crea cuenta en [vercel.com](https://vercel.com)
2. Importa el proyecto desde GitHub
3. Vercel detectará Next.js automáticamente
4. Click en "Deploy"

### Opción 2: Netlify
1. Instala Netlify CLI: `npm install -g netlify-cli`
2. Build del proyecto: `npm run build`
3. Despliega: `netlify deploy --prod`

### Opción 3: Servidor Propio
```bash
npm run build
npm run start
# La app estará en http://localhost:3000
```

## 💾 Próximas Características

- [ ] Integración con base de datos (Supabase/PostgreSQL)
- [ ] Autenticación JWT
- [ ] Exportación real a Excel
- [ ] Generación de PDFs
- [ ] Notificaciones por correo
- [ ] Panel de administración avanzado
- [ ] Gráficos de estadísticas
- [ ] Sistema de permisos granular
- [ ] API REST para integración externa
- [ ] Backup automático de datos

## 📝 Notas Importantes

- **Datos Demo:** La aplicación actualmente usa datos de demostración
- **LocalStorage:** Las sesiones se guardan localmente
- **Sin Backend:** No requiere servidor backend inicialmente
- **Offline-Ready:** Funciona sin conexión (datos en memoria)

## 🐛 Solución de Problemas

### El servidor no inicia
```bash
# Eliminar node_modules y reinstalar
rm -rf node_modules
npm install
npm run dev
```

### Error de compilación TypeScript
```bash
# Verificar versión de Node.js
node --version  # Debe ser 18.x o superior

# Limpiar caché de Next.js
rm -rf .next
npm run dev
```

### Errores de Tailwind CSS
```bash
# Verificar archivo tailwind.config.js
# Asegurarse de que los paths estén correctos
```

## 👨‍💻 Desarrollado Por

**Luis Fernando Alzate López**
- Docente - Institución Educativa Barroblanco
- Estudiante SENA - Talento Tech MinTIC
- Rionegro, Antioquia, Colombia

## 📄 Licencia

Proyecto educativo desarrollado para la Institución Educativa Barroblanco.
Todos los derechos reservados © 2026

## 📞 Soporte

Para reportar problemas o sugerencias:
- Email institucional: admin@barroblanco.edu.co
- Sistema de tickets: (Próximamente)

---

**¡Gracias por usar el Sistema PAE Barroblanco!** 🎓
