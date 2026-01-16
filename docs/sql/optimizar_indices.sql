-- Optimización de Índices para Carga Rápida
-- Ejecuta este script en el Editor SQL de Supabase para acelerar la función get_grupos_stats

-- 1. Índice para filtrar por Sede (Crítico para la primera parte de la query)
CREATE INDEX IF NOT EXISTS "idx_estudiantes_sede" ON "public"."estudiantes"("sede");

-- 2. Índice compuesto para filtrar activos por sede (Acelera el conteo de activos)
CREATE INDEX IF NOT EXISTS "idx_estudiantes_sede_estado" ON "public"."estudiantes"("sede", "estado");

-- 3. Índice compuesto para asistencias (Acelera el JOIN y WHERE fecha + estudiante)
-- El índice existente idx_asistencia_fecha puede no ser suficiente si filtramos también por alumno
CREATE INDEX IF NOT EXISTS "idx_asistencia_estudiante_fecha" ON "public"."asistencia_pae"("estudiante_id", "fecha");

-- 4. Índice para la clave foránea (Buena práctica general)
CREATE INDEX IF NOT EXISTS "idx_estudiantes_grado_grupo" ON "public"."estudiantes"("grado", "grupo");

-- Confirmación
SELECT 'Índices de optimización creados correctamente' as mensaje;
