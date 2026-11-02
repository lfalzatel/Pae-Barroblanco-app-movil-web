-- =============================================================================
-- SEGURIDAD PAE (noviembre 2026)
-- Ejecutar DESPUÉS de las consultas de verificación (pg_policies). Si esas
-- consultas muestran en asistencia_pae o audit_logs políticas con otros nombres
-- que los borrados abajo, hay que borrarlas también: las políticas se suman (OR).
--
-- 1. El rol se lee de perfiles_publicos, nunca de user_metadata (editable por el usuario)
-- 2. Solo admin, coordinador_pae, docente y estudiante_pae registran asistencia
-- 3. Fechas: nada futuro, ni fines de semana ni festivos; estudiante PAE solo hoy
-- 4. Puntos solo por registros hechos el mismo día
-- 5. Nadie cambia su propio rol ni sus puntos
-- =============================================================================

-- 0. Helper: ¿el usuario actual tiene alguno de estos roles?
CREATE OR REPLACE FUNCTION public.es_rol_pae(p_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.perfiles_publicos
        WHERE id = auth.uid() AND rol = ANY (p_roles)
    );
$$;

-- 1. Políticas de asistencia_pae
DROP POLICY IF EXISTS "Registrar asistencia autenticados" ON public.asistencia_pae;
DROP POLICY IF EXISTS "Profesores pueden crear registros" ON public.asistencia_pae;
DROP POLICY IF EXISTS "Profesores solo editan sus propios registros" ON public.asistencia_pae;
DROP POLICY IF EXISTS "Admins tienen control total" ON public.asistencia_pae;
DROP POLICY IF EXISTS "Admins tienen control total de borrado" ON public.asistencia_pae;

CREATE POLICY "Registro por roles PAE" ON public.asistencia_pae
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = registrado_por
        AND public.es_rol_pae(ARRAY['admin', 'coordinador_pae', 'docente', 'estudiante_pae'])
    );

CREATE POLICY "Edicion propia o admin" ON public.asistencia_pae
    FOR UPDATE TO authenticated
    USING (
        (auth.uid() = registrado_por AND public.es_rol_pae(ARRAY['admin', 'coordinador_pae', 'docente', 'estudiante_pae']))
        OR public.es_rol_pae(ARRAY['admin'])
    )
    WITH CHECK (
        (auth.uid() = registrado_por AND public.es_rol_pae(ARRAY['admin', 'coordinador_pae', 'docente', 'estudiante_pae']))
        OR public.es_rol_pae(ARRAY['admin'])
    );

CREATE POLICY "Borrado solo admin" ON public.asistencia_pae
    FOR DELETE TO authenticated
    USING (public.es_rol_pae(ARRAY['admin']));

-- 1b. Registro de auditoría (solo si la tabla existe)
DO $$
BEGIN
    IF to_regclass('public.audit_logs') IS NOT NULL THEN
        DROP POLICY IF EXISTS "Admins pueden ver logs" ON public.audit_logs;
        CREATE POLICY "Admins pueden ver logs" ON public.audit_logs
            FOR SELECT TO authenticated
            USING (public.es_rol_pae(ARRAY['admin']));
    END IF;
END;
$$;

-- 2. Validación de fechas al registrar (se suma a días sin PAE y grupos NO ASISTE)
CREATE OR REPLACE FUNCTION public.validar_asistencia_pae()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_grupo TEXT;
    v_sede TEXT;
    v_motivo TEXT;
    v_hoy DATE := (now() AT TIME ZONE 'America/Bogota')::DATE;
BEGIN
    -- Desde el SQL Editor (sin sesión) no se valida: correcciones manuales
    IF auth.uid() IS NOT NULL THEN
        IF NEW.fecha > v_hoy THEN
            RAISE EXCEPTION 'PAE_BLOQUEO: No se puede registrar asistencia de una fecha futura.' USING ERRCODE = 'P0001';
        END IF;

        IF public.es_dia_no_lectivo(NEW.fecha) THEN
            RAISE EXCEPTION 'PAE_BLOQUEO: El % es fin de semana o festivo.', to_char(NEW.fecha, 'DD/MM/YYYY') USING ERRCODE = 'P0001';
        END IF;

        IF NEW.fecha <> v_hoy AND public.es_rol_pae(ARRAY['estudiante_pae']) THEN
            RAISE EXCEPTION 'PAE_BLOQUEO: Solo puedes registrar la asistencia del día de hoy.' USING ERRCODE = 'P0001';
        END IF;
    END IF;

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

-- 3. Puntos: solo registros hechos el mismo día (created_at en hora de Colombia)
CREATE OR REPLACE FUNCTION public.registrar_puntos_asistencia(p_asistencia_id public.asistencia_pae.id%TYPE)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_usuario UUID;
    v_estudiante_id public.asistencia_pae.estudiante_id%TYPE;
    v_fecha DATE;
    v_dia_registro DATE;
    v_grupo TEXT;
    v_grado TEXT;
    v_rol TEXT;
    v_grupo_principal TEXT;
    v_racha INT;
    v_puntos INT := 1;
BEGIN
    SELECT registrado_por, estudiante_id, fecha, (created_at AT TIME ZONE 'America/Bogota')::DATE
    INTO v_usuario, v_estudiante_id, v_fecha, v_dia_registro
    FROM public.asistencia_pae
    WHERE id = p_asistencia_id;

    IF v_usuario IS NULL OR v_dia_registro IS DISTINCT FROM v_fecha THEN
        RETURN;
    END IF;

    SELECT grupo, grado INTO v_grupo, v_grado FROM public.estudiantes WHERE id = v_estudiante_id;
    v_grupo := COALESCE(v_grupo, 'Sin grupo');

    SELECT rol, grupo_principal INTO v_rol, v_grupo_principal
    FROM public.perfiles_publicos
    WHERE id = v_usuario;

    IF v_rol = 'estudiante_pae' AND (v_grupo_principal IS NULL OR v_grupo_principal <> v_grupo) THEN
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

    PERFORM set_config('pae.sistema', 'on', true);
    UPDATE public.perfiles_publicos
    SET puntos_gestor_pae = puntos_gestor_pae + v_puntos
    WHERE id = v_usuario;
    PERFORM set_config('pae.sistema', 'off', true);
END;
$$;

-- 4. Nadie cambia su propio rol ni sus puntos (solo admin, el sistema o el SQL Editor)
CREATE OR REPLACE FUNCTION public.proteger_campos_perfil()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.rol IS DISTINCT FROM OLD.rol AND NOT public.es_rol_pae(ARRAY['admin']) THEN
        RAISE EXCEPTION 'PAE_BLOQUEO: Solo un administrador puede cambiar roles.' USING ERRCODE = 'P0001';
    END IF;

    IF NEW.puntos_gestor_pae IS DISTINCT FROM OLD.puntos_gestor_pae
       AND COALESCE(current_setting('pae.sistema', true), '') <> 'on'
       AND NOT public.es_rol_pae(ARRAY['admin']) THEN
        RAISE EXCEPTION 'PAE_BLOQUEO: Los puntos solo los asigna el sistema.' USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_campos_perfil ON public.perfiles_publicos;
CREATE TRIGGER trg_proteger_campos_perfil
    BEFORE UPDATE ON public.perfiles_publicos
    FOR EACH ROW
    EXECUTE FUNCTION public.proteger_campos_perfil();

SELECT 'Seguridad PAE aplicada' AS status;
