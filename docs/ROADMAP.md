# Lista de Tareas Pendientes (Backlog)

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

## 5. Futuras Mejoras (Post-Entrega SENA)
- [ ] **Ingreso con Huella Real**: Integración completa de biometric login en pantalla de inicio. <!-- id: 60 -->
- [ ] **Pasarela de Pagos**: Implementación de sistema de recaudos online. <!-- id: 61 -->
- [ ] **Multi-tenant (Otros Colegios)**: <!-- id: 62 -->
    - Arquitectura para soportar múltiples instituciones.
    - Definir flujo: ¿Selección de colegio antes o después del login?
    - Duplicación de instancia vs. Base de datos compartida.
