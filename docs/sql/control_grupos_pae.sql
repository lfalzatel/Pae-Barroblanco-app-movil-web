-- =============================================================================
-- CONTROL DE GRUPOS PAE (Paso 1 de 2)
-- - Grupo principal por estudiante PAE: solo gana puntos registrando su grupo
-- - Días sin servicio PAE (semana institucional, jornadas, etc.)
-- - Bloqueo de registros en grupos marcados NO_ASISTE en el horario
-- - La racha no se pierde cuando el grupo propio no asiste
-- Ejecutar completo en el SQL Editor de Supabase.
-- Después: asignar grupos en Gestión y correr limpieza_puntos_pae_2026.sql
-- =============================================================================

-- 1. Grupo principal en el perfil
ALTER TABLE public.perfiles_publicos
ADD COLUMN IF NOT EXISTS grupo_principal TEXT;

CREATE INDEX IF NOT EXISTS idx_perfiles_grupo_principal ON public.perfiles_publicos(grupo_principal);

-- Nadie puede cambiar su propio grupo: solo vía RPC de admin o desde el SQL Editor
CREATE OR REPLACE FUNCTION public.proteger_grupo_principal()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.grupo_principal IS DISTINCT FROM OLD.grupo_principal
       AND auth.uid() IS NOT NULL
       AND COALESCE(current_setting('pae.asignando_grupo', true), '') <> 'on' THEN
        RAISE EXCEPTION 'PAE_BLOQUEO: Solo un administrador puede cambiar el grupo principal.' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_grupo_principal ON public.perfiles_publicos;
CREATE TRIGGER trg_proteger_grupo_principal
    BEFORE UPDATE ON public.perfiles_publicos
    FOR EACH ROW
    EXECUTE FUNCTION public.proteger_grupo_principal();

-- RPC: asignar grupo principal (solo admin)
CREATE OR REPLACE FUNCTION public.asignar_grupo_principal(p_usuario_id UUID, p_grupo TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.perfiles_publicos WHERE id = auth.uid() AND rol = 'admin') THEN
        RAISE EXCEPTION 'PAE_BLOQUEO: Solo un administrador puede asignar grupos.' USING ERRCODE = 'P0001';
    END IF;

    IF p_grupo IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.estudiantes WHERE grupo = p_grupo) THEN
        RAISE EXCEPTION 'PAE_BLOQUEO: El grupo % no existe.', p_grupo USING ERRCODE = 'P0001';
    END IF;

    PERFORM set_config('pae.asignando_grupo', 'on', true);
    UPDATE public.perfiles_publicos SET grupo_principal = p_grupo WHERE id = p_usuario_id;
    PERFORM set_config('pae.asignando_grupo', 'off', true);
END;
$$;

-- RPC: sugerencia de grupo (moda por días registrados) para el selector de Gestión
CREATE OR REPLACE FUNCTION public.sugerir_grupo_principal(p_usuario_id UUID)
RETURNS TABLE (grupo TEXT, dias BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT e.grupo, COUNT(DISTINCT a.fecha) AS dias
    FROM public.asistencia_pae a
    JOIN public.estudiantes e ON e.id = a.estudiante_id
    WHERE a.registrado_por = p_usuario_id
      AND e.grupo IS NOT NULL
      AND e.grupo NOT ILIKE '%2025%'
    GROUP BY e.grupo
    ORDER BY dias DESC, e.grupo
    LIMIT 5;
$$;

-- 2. Días sin servicio PAE (sede NULL = todas las sedes)
CREATE TABLE IF NOT EXISTS public.dias_sin_pae (
    id BIGSERIAL PRIMARY KEY,
    fecha DATE NOT NULL,
    sede TEXT,
    motivo TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dias_sin_pae_fecha_sede ON public.dias_sin_pae(fecha, COALESCE(sede, ''));

ALTER TABLE public.dias_sin_pae ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura dias sin PAE" ON public.dias_sin_pae;
CREATE POLICY "Lectura dias sin PAE" ON public.dias_sin_pae
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Gestion dias sin PAE" ON public.dias_sin_pae;
CREATE POLICY "Gestion dias sin PAE" ON public.dias_sin_pae
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.perfiles_publicos WHERE id = auth.uid() AND rol IN ('admin', 'coordinador_pae')))
    WITH CHECK (EXISTS (SELECT 1 FROM public.perfiles_publicos WHERE id = auth.uid() AND rol IN ('admin', 'coordinador_pae')));

-- Semana institucional octubre 2026 (las tres sedes)
INSERT INTO public.dias_sin_pae (fecha, sede, motivo)
SELECT d::DATE, NULL, 'Semana institucional'
FROM generate_series('2026-10-05'::DATE, '2026-10-09'::DATE, interval '1 day') d
ON CONFLICT DO NOTHING;

-- 3. Helpers
CREATE OR REPLACE FUNCTION public.es_dia_sin_pae(p_fecha DATE, p_sede TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.dias_sin_pae
        WHERE fecha = p_fecha AND (sede IS NULL OR sede = p_sede)
    );
$$;

-- TRUE si el horario de esa fecha marca al grupo como NO_ASISTE
CREATE OR REPLACE FUNCTION public.grupo_no_asiste(p_grupo TEXT, p_fecha DATE)
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.schedules s,
             jsonb_array_elements(s.items::jsonb) i
        WHERE s.date::DATE = p_fecha
          AND (i->>'time' = 'NO_ASISTE' OR i->>'time_start' = 'NO_ASISTE')
          AND UPPER(TRIM(i->>'group')) = UPPER(TRIM(p_grupo))
    );
$$;

-- 4. Bloqueo de registros en días sin servicio o grupos que no asisten
CREATE OR REPLACE FUNCTION public.validar_asistencia_pae()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_grupo TEXT;
    v_sede TEXT;
    v_motivo TEXT;
BEGIN
    SELECT grupo, sede INTO v_grupo, v_sede
    FROM public.estudiantes
    WHERE id = NEW.estudiante_id;

    SELECT motivo INTO v_motivo
    FROM public.dias_sin_pae
    WHERE fecha = NEW.fecha AND (sede IS NULL OR sede = v_sede)
    LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION 'PAE_BLOQUEO: El % no hay servicio PAE (%).', to_char(NEW.fecha, 'DD/MM/YYYY'), v_motivo
            USING ERRCODE = 'P0001';
    END IF;

    IF v_grupo IS NOT NULL AND public.grupo_no_asiste(v_grupo, NEW.fecha) THEN
        RAISE EXCEPTION 'PAE_BLOQUEO: El grupo % está marcado como NO ASISTE el %.', v_grupo, to_char(NEW.fecha, 'DD/MM/YYYY')
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_asistencia_pae ON public.asistencia_pae;
CREATE TRIGGER trg_validar_asistencia_pae
    BEFORE INSERT OR UPDATE ON public.asistencia_pae
    FOR EACH ROW
    EXECUTE FUNCTION public.validar_asistencia_pae();

-- 5. Racha: salta fines de semana, festivos, días sin PAE y días en que el grupo propio no asiste.
--    Para estudiantes PAE solo cuenta haber registrado su grupo principal.
CREATE OR REPLACE FUNCTION public.calcular_racha_usuario_fecha(p_usuario_id UUID, p_fecha DATE)
RETURNS INTEGER
LANGUAGE plpgsql STABLE
AS $$
DECLARE
    v_racha INT := 1; -- Iniciamos en 1 porque hoy se está registrando
    v_fecha_check DATE := p_fecha;
    v_prev_day DATE;
    v_existe BOOLEAN;
    v_inicio_mes DATE := date_trunc('month', p_fecha)::DATE;
    v_grupo TEXT;
    v_sede TEXT;
BEGIN
    SELECT grupo_principal INTO v_grupo FROM public.perfiles_publicos WHERE id = p_usuario_id;
    IF v_grupo IS NOT NULL THEN
        SELECT sede INTO v_sede FROM public.estudiantes WHERE grupo = v_grupo LIMIT 1;
    END IF;

    LOOP
        v_prev_day := v_fecha_check - 1;

        -- Retroceder omitiendo días que no dependen del usuario
        WHILE v_prev_day >= v_inicio_mes AND (
            public.es_dia_no_lectivo(v_prev_day)
            OR public.es_dia_sin_pae(v_prev_day, v_sede)
            OR (v_grupo IS NOT NULL AND public.grupo_no_asiste(v_grupo, v_prev_day))
        ) LOOP
            v_prev_day := v_prev_day - 1;
        END LOOP;

        -- Si el día anterior válido cae fuera del mes actual, la racha del mes finaliza
        IF v_prev_day < v_inicio_mes THEN
            EXIT;
        END IF;

        IF v_grupo IS NOT NULL THEN
            SELECT EXISTS (
                SELECT 1
                FROM public.asistencia_pae a
                JOIN public.estudiantes e ON e.id = a.estudiante_id
                WHERE a.registrado_por = p_usuario_id AND a.fecha = v_prev_day AND e.grupo = v_grupo
            ) INTO v_existe;
        ELSE
            SELECT EXISTS (
                SELECT 1 FROM public.puntos_pae_historial
                WHERE usuario_id = p_usuario_id AND fecha = v_prev_day
            ) INTO v_existe;
        END IF;

        IF v_existe THEN
            v_racha := v_racha + 1;
            v_fecha_check := v_prev_day;
        ELSE
            EXIT;
        END IF;
    END LOOP;

    RETURN v_racha;
END;
$$;

-- 6. Puntos: lógica en una función reutilizable (trigger y recálculo histórico)
--    - Estudiante PAE: solo gana con su grupo principal
--    - Otros roles: solo ganan en grupos que no tienen estudiante PAE asignado
--    - Un solo punto por grupo y día
CREATE OR REPLACE FUNCTION public.registrar_puntos_asistencia(p_asistencia_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_usuario UUID;
    v_estudiante_id BIGINT;
    v_fecha DATE;
    v_grupo TEXT;
    v_grado TEXT;
    v_rol TEXT;
    v_grupo_principal TEXT;
    v_racha INT;
    v_puntos INT := 1;
BEGIN
    SELECT registrado_por, estudiante_id, fecha INTO v_usuario, v_estudiante_id, v_fecha
    FROM public.asistencia_pae
    WHERE id = p_asistencia_id;

    IF v_usuario IS NULL THEN
        RETURN;
    END IF;

    SELECT grupo, grado INTO v_grupo, v_grado FROM public.estudiantes WHERE id = v_estudiante_id;
    v_grupo := COALESCE(v_grupo, 'Sin grupo');

    SELECT rol, grupo_principal INTO v_rol, v_grupo_principal
    FROM public.perfiles_publicos
    WHERE id = v_usuario;

    IF v_rol = 'estudiante_pae' THEN
        IF v_grupo_principal IS NULL OR v_grupo_principal <> v_grupo THEN
            RETURN;
        END IF;
    ELSIF EXISTS (
        SELECT 1 FROM public.perfiles_publicos
        WHERE rol = 'estudiante_pae' AND grupo_principal = v_grupo
    ) THEN
        RETURN;
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.puntos_pae_historial
        WHERE grupo = v_grupo AND fecha = v_fecha
    ) THEN
        RETURN;
    END IF;

    -- Bono de racha solo en el primer grupo con puntos del día (Opción A: ciclo cada 5 días)
    IF NOT EXISTS (
        SELECT 1 FROM public.puntos_pae_historial
        WHERE usuario_id = v_usuario AND fecha = v_fecha
    ) THEN
        v_racha := public.calcular_racha_usuario_fecha(v_usuario, v_fecha);
        IF v_racha % 5 = 0 THEN
            v_puntos := 3; -- 1 base + 2 bono
        ELSIF v_racha % 5 = 3 THEN
            v_puntos := 2; -- 1 base + 1 bono
        END IF;
    END IF;

    INSERT INTO public.puntos_pae_historial
        (usuario_id, asistencia_id, estudiante_id, grupo, grado, puntos, fecha)
    VALUES
        (v_usuario, p_asistencia_id, v_estudiante_id, v_grupo, v_grado, v_puntos, v_fecha);

    UPDATE public.perfiles_publicos
    SET puntos_gestor_pae = puntos_gestor_pae + v_puntos
    WHERE id = v_usuario;
END;
$$;

-- Trigger SOLO en INSERT: editar no suma puntos
CREATE OR REPLACE FUNCTION public.otorgar_punto_gestor_pae()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.registrar_puntos_asistencia(NEW.id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_otorgar_punto_gestor_pae ON public.asistencia_pae;
CREATE TRIGGER trg_otorgar_punto_gestor_pae
    AFTER INSERT ON public.asistencia_pae
    FOR EACH ROW
    EXECUTE FUNCTION public.otorgar_punto_gestor_pae();

SELECT 'Control de grupos PAE instalado' AS status;
