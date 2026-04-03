# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start development server (also cleans PWA service worker files)
npm run build      # Production build
npm run start      # Run production server
npm run lint       # ESLint
npm run clean-pwa  # Remove service worker and workbox files manually
```

There are no automated tests in this project.

## What This App Is

**Sistema PAE Barroblanco** — School Meal Program (PAE) attendance management system for IE Barroblanco (Rionegro, Antioquia, Colombia). It tracks which students receive school meals across three campuses:

- **Sede Principal** — Grades 6–11 (Bachillerato)
- **Sede Primaria** — Grades 1–5
- **María Inmaculada** — Grades 1–5

## Architecture

**Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Supabase (auth + PostgreSQL), PWA via `@ducanh2912/next-pwa`.

### Routes

| Route | Purpose |
|---|---|
| `/` | Login (email/password, Google OAuth, WebAuthn/biometric) |
| `/dashboard` | Main dashboard with real-time attendance stats |
| `/dashboard/registro` | Attendance registration (mark students as received/absent) |
| `/dashboard/gestion` | Student management |
| `/dashboard/reportes` | Reports, Excel/PDF exports |
| `/dashboard/horario` | Academic schedule management |
| `/dashboard/novedades` | Attendance quota adjustments |
| `/dashboard/auditoria` | Audit logs (Admin only) |
| `/dashboard/admin` | Admin panel |

### Role System

Roles are stored in the `perfiles_publicos` Supabase table (not just JWT metadata). The roles are: `admin`, `coordinador`, `docente`, `secretaria`, `operador`, `acudiente`, `estudiante`. External OAuth users default to `acudiente`. Secretaria/Operador users are auto-redirected to `/dashboard/reportes`.

### Key Files

- `app/layout.tsx` — Root layout: ThemeProvider, SplashScreenProvider, InstallPrompt
- `app/page.tsx` — Login page with all auth methods
- `app/dashboard/layout.tsx` — Dashboard shell with sidebar, role-based navigation (~74KB, the largest file)
- `app/dashboard/page.tsx` — Main dashboard with attendance stats (~41KB)
- `app/api/sync-sheets/route.ts` — Google Sheets sync (maps group codes like `6A→SEXTO 1`, handles schedule cancellations)
- `app/api/admin/list-users/route.ts` — Admin user listing (requires Bearer token)
- `lib/supabase.ts` / `lib/supabase-admin.ts` — Supabase clients
- `lib/offlineService.ts` — Offline attendance queue (localStorage)
- `lib/schedule-utils.ts` — Academic block time calculations
- `lib/pdf-generator.ts` — PDF report generation

### Database Tables (Supabase PostgreSQL)

- `estudiantes` — Student records (id, nombre, grupo, sede, estado)
- `asistencia_pae` — Attendance records (fecha, estado: `recibio`/`no-recibio`/`ausente`)
- `novedades_cupos` — Quota adjustments (fecha_inicio, fecha_fin, cupos_afectados, tipo)
- `schedules` — Academic schedule with time slots and group assignments
- `perfiles_publicos` — User profiles and roles

### State Management

- React Context: `ThemeProvider` (dark/light mode), `SplashScreenProvider` (3.5s initial, 2s on refresh)
- localStorage: session, theme preference, splash-screen-seen flag, offline pending attendance
- No external state library (Redux, Zustand, etc.)
- Custom hook `useHaptics()` for mobile vibration feedback

### PWA / Offline

- Service worker via Workbox (disabled in dev mode, enabled in production build)
- `OfflineService` queues attendance in localStorage when offline; syncs automatically on reconnect
- Manifest at `/public/manifest.json` (theme: #4CAF50, standalone display)

### Google Sheets Sync

The `/api/sync-sheets` route uses a Google service account to write attendance totals to a consolidated spreadsheet. It maps internal group codes (e.g., `6A`, `1A`, `AULA MULTINIVEL SORDOS`) to sheet row labels and respects schedule cancellations before writing.

## Required Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GOOGLE_CLIENT_EMAIL
GOOGLE_PRIVATE_KEY
```
