# Guía de Despliegue y Escalabilidad 🚀

Este documento detalla la estrategia para gestionar despliegues mediante ramas y la capacidad de crecimiento del sistema.

## 1. Despliegue con Vercel y Git Branches

Vercel permite visualizar cambios en ramas específicas sin afectar la producción mediante URLs de preview automáticas.

### Estructura de Dominios
*   **Rama `main` (Producción):** `https://sistemapae.com`
*   **Rama `feature/multi-tenant` (Preview):** `https://tu-proyecto-git-feature-multi-tenant.vercel.app`

### Workflow Recomendado
1.  **Crear Rama:** `git checkout -b feature/multi-tenant`
2.  **Push:** Al subir los cambios, Vercel genera una URL única de prueba.
3.  **Variables de Entorno:** Configurar las variables en Vercel Dashboard marcando la opción "Preview".

### Base de Datos de Staging
Para no afectar los datos reales durante las pruebas:
1.  Crear un segundo proyecto en Supabase ("Staging").
2.  Importar el schema de producción.
3.  Vincular las variables de entorno de "Preview" en Vercel a la URL/Key de Staging.

---

## 2. Capacidad y Escalabilidad (Supabase)

### Planes y Límites
| Plan | Capacidad | Soporta Aprox. | Usuarios Concurrentes |
|------|-----------|----------------|----------------------|
| **Free** | 500 MB | ~200 instituciones | ~50 usuarios |
| **Pro ($25)** | 8 GB | ~3,000+ instituciones | ~150 usuarios |

### Optimizaciones para Crecimiento
*   **PgBouncer:** Uso de pooling de conexiones (activado por defecto en Supabase).
*   **Índices:** Uso de índices en `institucion_id` (ya incluidos en migraciones).
*   **Particionamiento:** Para más de 100k estudiantes, particionar tablas por año académico.
*   **Caché Redis:** Implementar para consultas de grupos y perfiles frecuentes.

---

## 📊 Plan de Escalamiento Financiero

1.  **Fase 1 (1-10 inst):** Plan Free ($0). Suficiente para validación inicial.
2.  **Fase 2 (10-50 inst):** Supabase Pro + Vercel Pro (~$45 USD/mes).
3.  **Fase 3 (50-200 inst):** Añadir Redis Cloud y CDN (~$95 USD/mes).
4.  **Fase 4 (200+ inst):** Plan Team + Enterprise (~$1,200 USD/mes).

**Conclusión:** El sistema es altamente rentable; con 50 instituciones y una inversión mínima, el margen de operación es excelente.
