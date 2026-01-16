-- Optimización de Carga de Grupos
-- Ejecuta este script en el Editor SQL de Supabase para acelerar la pantalla de selección de grupos.

CREATE OR REPLACE FUNCTION get_grupos_stats(target_sede TEXT, target_date DATE)
RETURNS TABLE (
    nombre TEXT,
    grado TEXT,
    estudiantes BIGINT,
    estudiantes_activos BIGINT,
    asistencias_contadas BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH student_counts AS (
        -- Contamos estudiantes totales y activos por grupo en una sola pasada
        SELECT 
            grupo, 
            grado, 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE estado = 'activo' OR estado IS NULL) as activos
        FROM public.estudiantes
        WHERE sede = target_sede
        GROUP BY grupo, grado
    ),
    attendance_counts AS (
        -- Contamos cuántas asistencias se han registrado ya para ese día
        SELECT 
            e.grupo, 
            COUNT(*) as asistencias
        FROM public.asistencia_pae a
        INNER JOIN public.estudiantes e ON a.estudiante_id = e.id
        WHERE a.fecha = target_date AND e.sede = target_sede
        GROUP BY e.grupo
    )
    SELECT 
        sc.grupo,
        sc.grado,
        sc.total,
        sc.activos,
        COALESCE(ac.asistencias, 0)
    FROM student_counts sc
    LEFT JOIN attendance_counts ac ON sc.grupo = ac.grupo;
END;
$$ LANGUAGE plpgsql;
