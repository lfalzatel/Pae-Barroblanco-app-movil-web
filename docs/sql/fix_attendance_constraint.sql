-- Migración: Corrección de restricción única para Upsert
-- Ejecuta esto en el Editor SQL de Supabase para corregir el error 42P10

-- 1. Limpiar posibles duplicados antes de aplicar la restricción
-- Esto mantiene solo el registro más reciente para cada estudiante en una fecha específica
DELETE FROM "public"."asistencia_pae" a
WHERE a.id NOT IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY estudiante_id, fecha ORDER BY created_at DESC) as rn
        FROM "public"."asistencia_pae"
    ) t
    WHERE t.rn = 1
);

-- 2. Añadir la restricción UNIQUE requerida por la función Upsert
-- Sin esto, Supabase no sabe qué registro actualizar cuando ya existe uno para ese estudiante y día
ALTER TABLE "public"."asistencia_pae" 
DROP CONSTRAINT IF EXISTS "asistencia_pae_estudiante_id_fecha_key";

ALTER TABLE "public"."asistencia_pae" 
ADD CONSTRAINT "asistencia_pae_estudiante_id_fecha_key" UNIQUE ("estudiante_id", "fecha");

-- 3. (Opcional) Asegurar columnas de novedades si no se ejecutaron antes
ALTER TABLE "public"."asistencia_pae" 
ADD COLUMN IF NOT EXISTS "novedad_tipo" TEXT,
ADD COLUMN IF NOT EXISTS "novedad_descripcion" TEXT;
