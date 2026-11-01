-- =============================================================================
-- LIMPIEZA DE REGISTROS INVÁLIDOS Y RECÁLCULO DE PUNTOS (Paso 2 de 2)
-- Requiere haber ejecutado control_grupos_pae.sql y asignado los grupos
-- principales de los estudiantes PAE en Gestión.
--
-- PARTE A: diagnóstico (solo lectura). Ejecutar primero y revisar.
-- PARTE B: respaldo + borrado + recálculo. Ejecutar solo si A es correcto.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PARTE A. DIAGNÓSTICO
-- ---------------------------------------------------------------------------

-- A1. Registros que se van a borrar, por motivo y fecha
WITH invalidos AS (
    SELECT a.id, a.fecha, a.registrado_por, e.grupo,
           CASE WHEN public.es_dia_sin_pae(a.fecha, e.sede) THEN 'Día sin PAE' ELSE 'Grupo NO ASISTE' END AS motivo
    FROM public.asistencia_pae a
    JOIN public.estudiantes e ON e.id = a.estudiante_id
    WHERE public.es_dia_sin_pae(a.fecha, e.sede)
       OR public.grupo_no_asiste(e.grupo, a.fecha)
)
SELECT motivo, fecha, COUNT(*) AS registros, COUNT(DISTINCT grupo) AS grupos
FROM invalidos
GROUP BY motivo, fecha
ORDER BY fecha;

-- A2. Quién hizo esos registros
WITH invalidos AS (
    SELECT a.id, a.fecha, a.registrado_por, e.grupo
    FROM public.asistencia_pae a
    JOIN public.estudiantes e ON e.id = a.estudiante_id
    WHERE public.es_dia_sin_pae(a.fecha, e.sede)
       OR public.grupo_no_asiste(e.grupo, a.fecha)
)
SELECT p.nombre, p.rol, COUNT(*) AS registros, COUNT(DISTINCT (i.fecha, i.grupo)) AS grupos_dia
FROM invalidos i
LEFT JOIN public.perfiles_publicos p ON p.id = i.registrado_por
GROUP BY p.nombre, p.rol
ORDER BY registros DESC;

-- A3. Estudiantes PAE: grupo asignado vs grupos donde ganaron puntos desde julio
SELECT p.nombre, p.grupo_principal,
       SUM(h.puntos) FILTER (WHERE h.grupo = p.grupo_principal) AS puntos_grupo_propio,
       SUM(h.puntos) FILTER (WHERE h.grupo IS DISTINCT FROM p.grupo_principal) AS puntos_otros_grupos,
       p.puntos_gestor_pae AS total_actual
FROM public.perfiles_publicos p
LEFT JOIN public.puntos_pae_historial h ON h.usuario_id = p.id AND h.fecha >= '2026-07-01'
WHERE p.rol = 'estudiante_pae'
GROUP BY p.id, p.nombre, p.grupo_principal, p.puntos_gestor_pae
ORDER BY puntos_otros_grupos DESC NULLS LAST;

-- A4. Estudiantes PAE que aún no tienen grupo principal (asignarlos antes de la Parte B)
SELECT nombre, email
FROM public.perfiles_publicos
WHERE rol = 'estudiante_pae' AND grupo_principal IS NULL
ORDER BY nombre;


-- ---------------------------------------------------------------------------
-- PARTE B. RESPALDO, BORRADO Y RECÁLCULO (todo o nada)
-- ---------------------------------------------------------------------------
BEGIN;

-- B1. Respaldos
-- Solo registros hechos por estudiantes PAE: los de docentes/admin en días NO ASISTE
-- corresponden a horarios mal marcados y se conservan.
CREATE TABLE IF NOT EXISTS public.asistencia_pae_respaldo_2026_11 AS
SELECT a.*
FROM public.asistencia_pae a
JOIN public.estudiantes e ON e.id = a.estudiante_id
JOIN public.perfiles_publicos p ON p.id = a.registrado_por
WHERE p.rol = 'estudiante_pae'
  AND (public.es_dia_sin_pae(a.fecha, e.sede)
       OR public.grupo_no_asiste(e.grupo, a.fecha));

CREATE TABLE IF NOT EXISTS public.puntos_pae_historial_respaldo_2026_11 AS
SELECT * FROM public.puntos_pae_historial;

CREATE TABLE IF NOT EXISTS public.perfiles_puntos_respaldo_2026_11 AS
SELECT id, nombre, puntos_gestor_pae FROM public.perfiles_publicos;

-- B2. Borrar asistencias inválidas (sus puntos se borran en cascada)
DELETE FROM public.asistencia_pae
WHERE id IN (SELECT id FROM public.asistencia_pae_respaldo_2026_11);

-- B3. Recalcular puntos desde el 1 de julio con las reglas nuevas, en orden cronológico
DELETE FROM public.puntos_pae_historial WHERE fecha >= '2026-07-01'::DATE;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT id FROM (
            SELECT DISTINCT ON (a.fecha, e.grupo, a.registrado_por)
                a.id, a.fecha, a.created_at
            FROM public.asistencia_pae a
            JOIN public.estudiantes e ON e.id = a.estudiante_id
            WHERE a.registrado_por IS NOT NULL
              AND a.fecha >= '2026-07-01'::DATE
            ORDER BY a.fecha, e.grupo, a.registrado_por, a.created_at, a.id
        ) primeros
        ORDER BY fecha, created_at, id
    LOOP
        PERFORM public.registrar_puntos_asistencia(r.id);
    END LOOP;
END;
$$;

-- B4. Sincronizar contadores con el historial real
UPDATE public.perfiles_publicos SET puntos_gestor_pae = 0;

UPDATE public.perfiles_publicos p
SET puntos_gestor_pae = sub.total
FROM (
    SELECT usuario_id, SUM(puntos) AS total
    FROM public.puntos_pae_historial
    GROUP BY usuario_id
) sub
WHERE p.id = sub.usuario_id;

COMMIT;

-- B5. Comparación antes / después
SELECT r.nombre, r.puntos_gestor_pae AS antes, p.puntos_gestor_pae AS despues,
       p.puntos_gestor_pae - r.puntos_gestor_pae AS diferencia
FROM public.perfiles_puntos_respaldo_2026_11 r
JOIN public.perfiles_publicos p ON p.id = r.id
WHERE r.puntos_gestor_pae <> p.puntos_gestor_pae
ORDER BY diferencia;
