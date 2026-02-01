-- MIGRACIÓN: SISTEMA DE AUDITORÍA (HISTORIAL DE CAMBIOS DETALLADO)
-- Ejecutar en Supabase SQL Editor

-- 1. Crear tabla de logs centralizada
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL, -- ID del registro afectado (asistencia, estudiante, etc)
    operation TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    old_data JSONB, -- Valor anterior (para UPDATE/DELETE)
    new_data JSONB, -- Valor nuevo (para INSERT/UPDATE)
    changed_by UUID REFERENCES auth.users(id), -- Usuario que hizo el cambio
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitar RLS en la tabla de logs (Solo lectura para admins, inserción automática)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins pueden ver logs" ON public.audit_logs
    FOR SELECT TO authenticated
    USING ((auth.jwt() -> 'user_metadata' ->> 'rol') = 'admin');

-- 3. Función Trigger Genérica
CREATE OR REPLACE FUNCTION public.handle_audit_log()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.audit_logs (
        table_name,
        record_id,
        operation,
        old_data,
        new_data,
        changed_by
    )
    VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id), -- Asume que las tablas tienen columna 'id' UUID
        TG_OP,
        CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
        CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
        auth.uid() -- ID del usuario autenticado actual
    );
    RETURN NULL; -- Trigger after, no necesita retornar valor
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Aplicar Trigger a la tabla CRÍTICA (Asistencia)
DROP TRIGGER IF EXISTS audit_asistencia_trigger ON public.asistencia_pae;

CREATE TRIGGER audit_asistencia_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.asistencia_pae
FOR EACH ROW EXECUTE FUNCTION public.handle_audit_log();

-- Opcional: Aplicar a Estudiantes si se desea auditar cambios de estado/grupo
DROP TRIGGER IF EXISTS audit_estudiantes_trigger ON public.estudiantes;

CREATE TRIGGER audit_estudiantes_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.estudiantes
FOR EACH ROW EXECUTE FUNCTION public.handle_audit_log();
