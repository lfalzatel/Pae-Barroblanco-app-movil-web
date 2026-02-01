# Manual Técnico - Sistema PAE Barroblanco

## 1. Arquitectura del Sistema
- **Frontend**: Next.js 14 (App Router), React, TailwindCSS.
- **Backend / BaaS**: Supabase (PostgreSQL, Auth, Realtime).
- **Despliegue**: Vercel (Frontend + Edge Functions).
- **PWA**: Configuración de `manifest.json` y Service Workers.

## 2. Requisitos de Instalación
### Prerrequisitos
- Node.js v18+
- NPM o PNPM
- Cuenta en Supabase
- Cuenta en Vercel

### Comandos Locales
```bash
npm install
npm run dev
```

## 3. Estructura de Base de Datos
- **Tablas Principales**: `estudiantes`, `asistencia_pae`, `sedes`, `usuarios`.
- **Politicas RLS**: Seguridad a nivel de fila configurada para roles (admin/docente).

## 4. Flujo de Autenticación
- Login con correo/contraseña.
- Persistencia de sesión con cookies de Next.js.
