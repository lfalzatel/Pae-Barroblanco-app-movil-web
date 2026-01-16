-- MIGRACIÓN PARA SEGURIDAD POR NIVELES (RLS) - SISTEMA PAE
-- Ejecuta este script en el SQL Editor de Supabase

-- 1. Habilitar RLS en la tabla de asistencia (si no está habilitado)
ALTER TABLE "public"."asistencia_pae" ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas antiguas para evitar duplicados
DROP POLICY IF EXISTS "Registrar asistencia autenticados" ON "public"."asistencia_pae";
DROP POLICY IF EXISTS "Profesores pueden ver todas las asistencias" ON "public"."asistencia_pae";
DROP POLICY IF EXISTS "Profesores solo editan sus propios registros" ON "public"."asistencia_pae";
DROP POLICY IF EXISTS "Admins tienen control total" ON "public"."asistencia_pae";

-- 3. Crear políticas granulares

-- POLÍTICA DE LECTURA: Todos los autenticados pueden ver todo
CREATE POLICY "Profesores pueden ver todas las asistencias" ON "public"."asistencia_pae"
    FOR SELECT TO authenticated
    USING (true);

-- POLÍTICA DE INSERCIÓN: Todos pueden insertar (el trigger o la app deben asignar el ID)
CREATE POLICY "Profesores pueden crear registros" ON "public"."asistencia_pae"
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = registrado_por);

-- POLÍTICA DE ACTUALIZACIÓN: Solo el dueño o el admin pueden editar
CREATE POLICY "Profesores solo editan sus propios registros" ON "public"."asistencia_pae"
    FOR UPDATE TO authenticated
    USING (auth.uid() = registrado_por OR (auth.jwt() -> 'user_metadata' ->> 'rol') = 'admin')
    WITH CHECK (auth.uid() = registrado_por OR (auth.jwt() -> 'user_metadata' ->> 'rol') = 'admin');

-- POLÍTICA DE ELIMINACIÓN: Solo administradores pueden borrar
CREATE POLICY "Admins tienen control total de borrado" ON "public"."asistencia_pae"
    FOR DELETE TO authenticated
    USING ((auth.jwt() -> 'user_metadata' ->> 'rol') = 'admin');

-- Confirmación de estado
SELECT 'Políticas de seguridad actualizadas correctamente' as status;
