# Lista de Tareas Pendientes (Backlog)

> [!NOTE]
> **Fuente de Verdad Técnica:** Los archivos de implementación base se encuentran en la carpeta local `4. guía multi tenant`. Esta carpeta contiene las migraciones SQL (`001`, `002`), el contexto de institución y el middleware de subdominios listos para ser copiados al proyecto principal.

## 1. Prioridad UI/UX (Solicitud Usuario)
- [x] **Optimización Menú Perfil** <!-- id: 50 -->
    - [x] **Biometría en Dropdown**: Mover botón "Vincular Huella/FaceID" de `perfil/page.tsx` al menú desplegable en `layout.tsx`. <!-- id: 51 -->
    - [x] **Instalar App en Dropdown**: Agregar opción "Instalar App" en el menú desplegable (visible solo si es instalable). <!-- id: 52 -->
- [x] **Revisión Dark Mode Perfil**: Verificar y corregir contrastes en `app/dashboard/perfil/page.tsx` (especialmente gráficas y tarjetas). <!-- id: 53 -->

## 2. PWA & Experiencia Móvil
- [ ] **Optimización Service Worker**: Implementar caché robusto para funcionamiento offline básico. <!-- id: 10 -->
- [ ] **Mobile Touch**: Mejorar áreas táctiles en botones pequeños. <!-- id: 12 -->

## 3. Funcionalidad y Datos
- [ ] **Validación de Formularios**: Mejorar validación en "Crear Estudiante". <!-- id: 30 -->
- [ ] **Backup Automático**: Investigar viabilidad de backups automáticos. <!-- id: 31 -->
- [ ] **Busqueda Global**: Evaluar barra de búsqueda global. <!-- id: 32 -->

## 4. Mantenimiento
- [ ] **Limpieza de Código**: Eliminar componentes no utilizados. <!-- id: 40 -->
- [ ] **Optimización de Imágenes**: Verificar uso de `next/image`. <!-- id: 41 -->

## 5. Futuras Mejoras 🎯 LISTA DE TAREAS PRIORITARIAS

### FASE 1: Fundamentos Multi-Tenant (Crítico)

#### 1. Arquitectura de Base de Datos Multi-Tenant
```sql
-- Crear tabla de instituciones
CREATE TABLE instituciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL, -- ej: "barroblanco", "sanfrancisco"
  nit TEXT UNIQUE,
  direccion TEXT,
  telefono TEXT,
  email_contacto TEXT,
  logo_url TEXT,
  estado TEXT DEFAULT 'activo', -- activo, suspendido, prueba
  plan TEXT DEFAULT 'basico', -- basico, premium, enterprise
  fecha_creacion TIMESTAMP DEFAULT NOW(),
  fecha_vencimiento TIMESTAMP, -- Para subscripciones
  configuracion JSONB DEFAULT '{}'::jsonb -- Configuración personalizada
);

-- Agregar columna institution_id a todas las tablas
ALTER TABLE estudiantes ADD COLUMN institucion_id UUID REFERENCES instituciones(id);
ALTER TABLE asistencia_pae ADD COLUMN institucion_id UUID REFERENCES instituciones(id);
ALTER TABLE schedules ADD COLUMN institucion_id UUID REFERENCES instituciones(id);
ALTER TABLE perfiles_publicos ADD COLUMN institucion_id UUID REFERENCES instituciones(id);

-- Crear índices para performance
CREATE INDEX idx_estudiantes_institucion ON estudiantes(institucion_id);
CREATE INDEX idx_asistencia_institucion ON asistencia_pae(institucion_id);
CREATE INDEX idx_perfiles_institucion ON perfiles_publicos(institucion_id);

-- Row Level Security (RLS) por institución
ALTER TABLE estudiantes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their institution's students"
ON estudiantes FOR ALL
USING (institucion_id = (
  SELECT institucion_id FROM perfiles_publicos 
  WHERE id = auth.uid()
));
```

#### 2. Sistema de Contexto de Institución (Frontend)
```typescript
// lib/institution-context.tsx
'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabase';

interface Institution {
  id: string;
  nombre: string;
  slug: string;
  logo_url: string;
  configuracion: any;
}

const InstitutionContext = createContext<{
  institution: Institution | null;
  setInstitution: (inst: Institution) => void;
}>({
  institution: null,
  setInstitution: () => {},
});

export function InstitutionProvider({ children }) {
  const [institution, setInstitution] = useState<Institution | null>(null);

  useEffect(() => {
    loadUserInstitution();
  }, []);

  const loadUserInstitution = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('perfiles_publicos')
      .select('institucion_id, instituciones(*)')
      .eq('id', user.id)
      .single();

    if (profile?.instituciones) {
      setInstitution(profile.instituciones);
    }
  };

  return (
    <InstitutionContext.Provider value={{ institution, setInstitution }}>
      {children}
    </InstitutionContext.Provider>
  );
}

export const useInstitution = () => useContext(InstitutionContext);
```

#### 3. Panel de Super Admin
- Gestionar todas las instituciones: Crear/editar/suspender instituciones.
- Ver estadísticas globales, gestionar planes y facturación.
- Acceso a todas las instituciones (switch).

#### 4. Sistema de Registro/Onboarding de Instituciones
- Formulario público para que nuevas instituciones se registren.
- Información básica (nombre, NIT, contacto).
- Creación de usuario administrador inicial y selección de plan.

### FASE 2: Funcionalidades Empresariales

#### 5. Sistema de Planes y Facturación
- Integración con pasarela de pagos (Stripe, PayU, Bold, Wompi).
- Planes: Básico, Premium, Enterprise.
- Límites por plan (estudiantes, usuarios, almacenamiento).
- Facturación automática mensual/anual y panel de facturación institucional.

#### 6. Personalización por Institución
```typescript
// Configuración almacenada en JSONB
interface InstitutionConfig {
  // Branding
  colores: {
    primario: string;
    secundario: string;
    acento: string;
  };
  logo: string;
  favicon: string;
  
  // Estructura Organizacional
  sedes: Array<{
    id: string;
    nombre: string;
    direccion: string;
  }>;
  
  jornadas: string[]; // ['Mañana', 'Tarde', 'Noche']
  niveles: string[]; // ['Primaria', 'Bachillerato']
  
  // Configuraciones PAE
  horarios_comedor: {
    desayuno: { inicio: string; fin: string };
    almuerzo: { inicio: string; fin: string };
    refrigerio: { inicio: string; fin: string };
  };
  
  // Notificaciones
  emails_notificacion: string[];
  whatsapp_enabled: boolean;
  
  // Módulos habilitados
  modulos: {
    inventario: boolean;
    rutas: boolean;
    pagos: boolean;
    reportes_avanzados: boolean;
  };
}
```

#### 7. Dashboard Multi-Tenant
- Aislamiento de datos: Cada institución ve solo sus datos.
- Switch rápido para Super Admin entre instituciones.
- Estadísticas globales vs por institución.

#### 8. Gestión de Usuarios y Permisos Avanzada
- Roles por institución: Super Admin (global), Admin Institucional, Coordinador PAE, Docente/Monitor, Padre de Familia.
- Permisos granulares por módulo (crear, editar, eliminar, ver).

### FASE 3: Funcionalidades Avanzadas

- [ ] **Sistema de Inventario y Menús**: Gestión de ingredientes, proveedores y planificación semanal.
- [ ] **App Móvil para Padres**: Ver asistencia en tiempo real, menús y notificaciones push.
- [ ] **Portal Web Público por Institución**: Subdominios personalizados (ej: barroblanco.sistemapae.com).
- [ ] **Reportes Avanzados**: Dashboards con Chart.js/Recharts y exportación avanzada.
- [ ] **Geolocalización y Rutas**: Seguimiento GPS de rutas escolares y mapas en tiempo real.
- [ ] **Integración WhatsApp Business**: Notificaciones automatizadas y confirmación de asistencia.

### FASE 4: Escalabilidad y DevOps

- [ ] **Infraestructura Cloud**: Migración a AWS/GCP/Azure con CDN y bases de datos replicadas.
- [ ] **Performance y Optimización**: Caché con Redis y lazy loading.
- [ ] **Seguridad Empresarial**: Autenticación 2FA, Biometría, logs de auditoría completos.
- [ ] **Testing y CI/CD**: Tests unitarios (Jest), E2E (Playwright) y pipeline automatizado.

---

## 🏗️ ARQUITECTURA MULTI-TENANT PROPUESTA

### Estrategia: Shared Database with Isolated Schema
- **Frontend**: Next.js App Router con Contexto de Institución y subdominios.
- **Backend**: Supabase Edge Functions con Row Level Security (RLS).
- **Datos**: PostgreSQL con tabla de instituciones vinculada por FK `institucion_id`.

---

## 🔐 ESTRATEGIA DE ACCESO Y LOGIN (MULTI-TENANT)

### OPCIÓN C: HÍBRIDA (RECOMENDADA) ⭐
Lo mejor de ambos mundos: Flexibilidad para Super Admins y facilidad para usuarios finales.

#### Flujo de Usuario:
1. **Landing** → 2. **Login Universal** → 3. **Auto-detect o Selección** → 4. **Dashboard**

#### Implementación Técnica:
```typescript
// 1. URL de acceso determina el flujo
// barroblanco.sistemapae.com → Login directo con branding
// app.sistemapae.com → Login universal

async function handlePostLogin(user) {
  const { data: instituciones } = await supabase
    .from('perfiles_publicos')
    .select('institucion_id, instituciones (*)')
    .eq('id', user.id);

  if (instituciones.length === 1) {
    // Solo una institución → Ir directo al dashboard
    setInstitution(instituciones[0].instituciones);
    router.push('/dashboard');
  } else if (instituciones.length > 1) {
    // Múltiples instituciones → Mostrar selector
    router.push('/seleccionar-institucion');
  }
}
```

#### Características Especiales:
1. **Recordar última institución**: Uso de `localStorage` para redirigir automáticamente al dashboard más frecuente.
2. **Switcher de instituciones**: Siempre visible en el sidebar para usuarios que gestionan múltiples sedes.
3. **Middleware de Subdominios**: Detección automática de la institución vía hostname (`barroblanco.sistemapae.com`).

### 📊 COMPARATIVA SEGÚN TIPO DE USUARIO

| Tipo de Usuario | Mejor Opción |
|-----------------|--------------|
| **Docente de una sola sede** | Opción A (Subdominio directo) |
| **Super Admin / Alcaldía** | Opción B (Login universal + Switcher) |
| **Coordinador que rota** | Opción Híbrida |
| **Padre de Familia** | Opción A (Subdominio) |

### 🎯 MI RECOMENDACIÓN: IMPLEMENTACIÓN PASO A PASO

1.  **Arquitectura de URLs:** Landing en `www`, App Universal en `app`, e Institucionales en `slug.*`.
2.  **Branding Dinámico:** El login carga el logo y colores de la institución si se accede vía subdominio o parámetro `?inst=slug`.
3.  **Selector de Institución:** Pantalla elegante tipo "card" para usuarios con más de un perfil activo.

**DECISIÓN FINAL:** Implementar la **OPCIÓN HÍBRIDA** para maximizar la escalabilidad comercial y la facilidad de uso institucional.

---

## 🔐 ESTRATEGIA: AUTENTICACIÓN POR DOMINIO DE EMAIL

Esta estrategia permite automatizar la asignación de usuarios y restringir el acceso basándose exclusivamente en correos corporativos/institucionales (ej: `@barroblanco.edu.co`).

### ✅ CÓMO FUNCIONA
- **Detección Automática:** Al ingresar el email, el sistema identifica el dominio y carga el logo/branding de la institución vinculada.
- **Acceso Restringido:** Solo dominios autorizados (`@barroblanco.edu.co`) pueden registrarse o loguearse en su instancia respectiva.
- **Seguridad Empresarial:** Similar al funcionamiento de Slack o Microsoft Teams.

### 🏗️ IMPLEMENTACIÓN TÉCNICA
1.  **Base de Datos:**
    - Se añade la columna `email_domain` (UNIQUE) a la tabla `instituciones`.
    - Se crean índices para búsquedas ultra-rápidas por dominio.
2.  **Validación (Frontend/Backend):**
    - Lógica para extraer el dominio y consultar a Supabase antes de permitir el registro.
    - Pre-asignación de `institucion_id` basada en el dominio validado.
3.  **Seguridad (RLS):**
    - Función PL/SQL para obtener el ID de la institución del usuario actual basándose en su email de sesión.
    - Políticas de RLS que aseguran aislamiento total de los datos.

### 🔐 CASOS ESPECIALES
- **Invitaciones para Padres:** Sistema de tokens temporales de un solo uso para permitir registros con emails personales (`@gmail.com`).
- **Coordinadores Multi-Sede:** Gestión de múltiples registros vinculados a una sola identidad.
- **Cambio de Institución:** Triggers automáticos que detectan cambios de email y reasignan perfiles de forma segura.

> [!TIP]
> **Guía Detallada:** Consulta la [Guía de Implementación de Email](file:///c:/6.%20Viaje%20a%20san%20andres/3.Sistema-pae-barroblanco%20v-vercel-Converting%20to%20Progressive%20Web%20App%20(PWA)/docs/GUIA_IMPLEMENTACION_EMAIL.md) para ver el código SQL, TypeScript y ejemplos de UI completos.

## 🚀 ROADMAP SUGERIDO

*   **Q1 2026 (Meses 1-3): Fundamentos Multi-Tenant**
    *   Refactorizar base de datos e implementar contexto.
    *   Panel super admin básico y registro de instituciones.
*   **Q2 2026 (Meses 4-6): Comercialización**
    *   Sistema de facturación y portal público.
    *   Onboarding de primeras 5 instituciones.
*   **Q3 2026 (Meses 7-9): Expansión**
    *   App móvil padres, inventario y WhatsApp.
*   **Q4 2026 (Meses 10-12): Consolidación**

---

## 🏫 LISTADO DE INSTITUCIONES OBJETIVO (Rionegro)

### 1. Instituciones Públicas (Gestión Alcaldía/PAE)
Sedes donde el proyecto tiene aplicación directa para la gestión centralizada:
- [ ] **I.E. Barro Blanco** (Sede Actual)
- [ ] I.E. Josefina Muñoz González (Principal y sedes anexas)
- [ ] I.E. San Antonio
- [ ] I.E. Industrial Santiago de Arma
- [ ] I.E. José María Córdoba (El "Pascual")
- [ ] I.E. Escuela Normal Superior de María
- [ ] I.E. Concejo Municipal El Porvenir
- [ ] I.E. Gilberto Echeverri Mejía (Vereda Cabeceras)
- [ ] I.E. Ana Gómez de Sierra (Vereda La Playa)
- [ ] I.E. Baltazar Salazar (Vereda Pontezuela)
- [ ] I.E. Domingo Savio (Vereda Guayabito / Llanogrande)
- [ ] I.E. San José de las Cuchillas
- [ ] I.E. Antonio Donado Camacho (Vereda El Tablazo)
- [ ] I.E. Guillermo Gaviria Correa (Vereda Yarumal)
- [ ] I.E. La Mosquita
- [ ] I.E. Baldomero Sanín Cano

### 2. Colegios Privados (Potenciales Clientes - Versión Comercial)
Instituciones con autonomía para adquisición de software:
- [ ] Colegio Monseñor Alfonso Uribe Jaramillo (UCO)
- [ ] Colegio La Presentación Rionegro
- [ ] Colegio El Triángulo (Llanogrande)
- [ ] Colegio Montessori (Sede Llanogrande)
- [ ] Colegio Gimnasio Vermont
- [ ] Colegio Horizontes
- [ ] Colegio Leonardo da Vinci
- [ ] Cosmo Schools (Sede Rionegro)
- [ ] Colegio de la UPB (Sede Marinilla/Rionegro)
