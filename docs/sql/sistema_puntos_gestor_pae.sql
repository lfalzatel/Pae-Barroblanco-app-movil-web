-- =============================================================================
-- SISTEMA DE PUNTOS "GESTOR PAE"
-- =============================================================================

-- 1. Contador rápido en el perfil
ALTER TABLE "public"."perfiles_publicos"
ADD COLUMN IF NOT EXISTS "puntos_gestor_pae" INTEGER NOT NULL DEFAULT 0;

-- 2. Historial de puntos (para ranking por grupo y auditoría)
CREATE TABLE IF NOT EXISTS "public"."puntos_pae_historial" (
    id BIGSERIAL PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    asistencia_id BIGINT NOT NULL REFERENCES "public"."asistencia_pae"(id) ON DELETE CASCADE,
    estudiante_id BIGINT NOT NULL,
    grupo TEXT NOT NULL,
    grado TEXT,
    puntos INTEGER NOT NULL DEFAULT 1,
    fecha DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_puntos_usuario ON "public"."puntos_pae_historial"(usuario_id);
CREATE INDEX IF NOT EXISTS idx_puntos_grupo ON "public"."puntos_pae_historial"(grupo);

-- 3. Función del trigger: solo se ejecuta en INSERT (nunca en UPDATE)
CREATE OR REPLACE FUNCTION public.otorgar_punto_gestor_pae()
RETURNS TRIGGER AS $$
DECLARE
    v_grupo TEXT;
    v_grado TEXT;
BEGIN
    -- Obtenemos el grupo/grado del estudiante del registro nuevo
    SELECT grupo, grado INTO v_grupo, v_grado
    FROM public.estudiantes
    WHERE id = NEW.estudiante_id;

    -- Solo otorgamos punto si hay un usuario válido que registró
    IF NEW.registrado_por IS NOT NULL THEN
        INSERT INTO public.puntos_pae_historial
            (usuario_id, asistencia_id, estudiante_id, grupo, grado, puntos, fecha)
        VALUES
            (NEW.registrado_por, NEW.id, NEW.estudiante_id, COALESCE(v_grupo, 'Sin grupo'), v_grado, 1, NEW.fecha);

        UPDATE public.perfiles_publicos
        SET puntos_gestor_pae = puntos_gestor_pae + 1
        WHERE id = NEW.registrado_por;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger SOLO en INSERT — esto es lo que garantiza que editar no sume puntos
DROP TRIGGER IF EXISTS trg_otorgar_punto_gestor_pae ON "public"."asistencia_pae";
CREATE TRIGGER trg_otorgar_punto_gestor_pae
    AFTER INSERT ON "public"."asistencia_pae"
    FOR EACH ROW
    EXECUTE FUNCTION public.otorgar_punto_gestor_pae();

-- 5. RLS: cualquier autenticado puede leer el historial (para el ranking),
--    pero nadie puede escribir directo (solo lo hace el trigger, con SECURITY DEFINER)
ALTER TABLE "public"."puntos_pae_historial" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura ranking puntos" ON "public"."puntos_pae_historial";
CREATE POLICY "Lectura ranking puntos" ON "public"."puntos_pae_historial"
    FOR SELECT TO authenticated
    USING (true);

-- 6. RPC: ranking de grupos ordenado por puntos totales
CREATE OR REPLACE FUNCTION public.ranking_grupos_pae()
RETURNS TABLE (grupo TEXT, grado TEXT, total_puntos BIGINT) AS $$
    SELECT grupo, MAX(grado) AS grado, COUNT(*) AS total_puntos
    FROM public.puntos_pae_historial
    GROUP BY grupo
    ORDER BY total_puntos DESC;
$$ LANGUAGE sql STABLE;

-- 7. RPC: gestores que aportaron puntos a un grupo específico
CREATE OR REPLACE FUNCTION public.ranking_gestores_por_grupo(p_grupo TEXT)
RETURNS TABLE (usuario_id UUID, nombre TEXT, avatar_url TEXT, puntos BIGINT) AS $$
    SELECT h.usuario_id, p.nombre, p.avatar_url, COUNT(*) AS puntos
    FROM public.puntos_pae_historial h
    JOIN public.perfiles_publicos p ON p.id = h.usuario_id
    WHERE h.grupo = p_grupo
    GROUP BY h.usuario_id, p.nombre, p.avatar_url
    ORDER BY puntos DESC;
$$ LANGUAGE sql STABLE;

-- 8. Backfill opcional: puntos retroactivos SOLO DEL MES ACTUAL
-- (ejecútalo UNA sola vez; comenta/borra si no lo quieres)
-- INSERT INTO public.puntos_pae_historial (usuario_id, asistencia_id, estudiante_id, grupo, grado, puntos, fecha)
-- SELECT a.registrado_por, a.id, a.estudiante_id, e.grupo, e.grado, 1, a.fecha
-- FROM public.asistencia_pae a
-- JOIN public.estudiantes e ON e.id = a.estudiante_id
-- WHERE a.registrado_por IS NOT NULL 
--   AND a.fecha >= date_trunc('month', current_date);

-- UPDATE public.perfiles_publicos p SET puntos_gestor_pae = sub.total
-- FROM (SELECT usuario_id, COUNT(*) total FROM public.puntos_pae_historial GROUP BY usuario_id) sub
-- WHERE p.id = sub.usuario_id;
