-- =============================================================================
-- PODIO MENSUAL PAE (Oro / Plata / Bronce) + PUNTOS DE DOCENTES
-- Ejecutar completo en el SQL Editor de Supabase, en este orden:
--   1. Docentes vuelven a ganar puntos en cualquier grupo
--   2. Recálculo de puntos desde julio 2026
--   3. Tabla y funciones del podio mensual (solo estudiantes PAE)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Regla de puntos
--    - Estudiante PAE: solo gana con su grupo principal
--    - Docentes / coordinador / admin: ganan en cualquier grupo
--    - Un solo punto por grupo y día (para quien lo registra primero)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_puntos_asistencia(p_asistencia_id public.asistencia_pae.id%TYPE)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_usuario UUID;
    v_estudiante_id public.asistencia_pae.estudiante_id%TYPE;
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

    UPDATE public.perfiles_publicos
    SET puntos_gestor_pae = puntos_gestor_pae + v_puntos
    WHERE id = v_usuario;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Recálculo de puntos desde el 1 de julio de 2026 (todo o nada)
-- ---------------------------------------------------------------------------
BEGIN;

CREATE TABLE IF NOT EXISTS public.perfiles_puntos_respaldo_2026_11b AS
SELECT id, nombre, puntos_gestor_pae FROM public.perfiles_publicos;
ALTER TABLE public.perfiles_puntos_respaldo_2026_11b ENABLE ROW LEVEL SECURITY;

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

-- ---------------------------------------------------------------------------
-- 3. Podio mensual (solo estudiantes PAE)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.podio_mensual_pae (
    anio INT NOT NULL,
    mes INT NOT NULL,
    puesto INT NOT NULL CHECK (puesto BETWEEN 1 AND 3),
    usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre TEXT,
    grupo TEXT,
    puntos INT NOT NULL,
    dias INT NOT NULL,
    visto BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (anio, mes, puesto)
);

CREATE INDEX IF NOT EXISTS idx_podio_usuario ON public.podio_mensual_pae(usuario_id);

-- Lectura para todos los autenticados; escritura solo por las funciones de abajo
ALTER TABLE public.podio_mensual_pae ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura podio mensual" ON public.podio_mensual_pae;
CREATE POLICY "Lectura podio mensual" ON public.podio_mensual_pae
    FOR SELECT TO authenticated
    USING (true);

-- Top 3 de estudiantes PAE de un mes.
-- Empates: más días registrando su grupo; luego quien llegó antes a su puntaje (último día con puntos más temprano).
CREATE OR REPLACE FUNCTION public.calcular_podio_pae(p_anio INT, p_mes INT)
RETURNS TABLE (puesto INT, usuario_id UUID, nombre TEXT, grupo TEXT, puntos INT, dias INT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    WITH rango AS (
        SELECT make_date(p_anio, p_mes, 1) AS ini,
               (make_date(p_anio, p_mes, 1) + interval '1 month - 1 day')::DATE AS fin
    ),
    totales AS (
        SELECT h.usuario_id,
               SUM(h.puntos)::INT AS puntos,
               MAX(h.fecha) AS ultimo_dia
        FROM public.puntos_pae_historial h, rango r
        WHERE h.fecha BETWEEN r.ini AND r.fin
        GROUP BY h.usuario_id
    ),
    candidatos AS (
        SELECT t.usuario_id, p.nombre, p.grupo_principal AS grupo, t.puntos, t.ultimo_dia,
               (SELECT COUNT(DISTINCT a.fecha)::INT
                  FROM public.asistencia_pae a
                  JOIN public.estudiantes e ON e.id = a.estudiante_id, rango r
                 WHERE a.registrado_por = t.usuario_id
                   AND e.grupo = p.grupo_principal
                   AND a.fecha BETWEEN r.ini AND r.fin) AS dias
        FROM totales t
        JOIN public.perfiles_publicos p ON p.id = t.usuario_id
        WHERE p.rol = 'estudiante_pae' AND t.puntos > 0
    )
    SELECT (ROW_NUMBER() OVER (ORDER BY c.puntos DESC, c.dias DESC, c.ultimo_dia ASC, c.usuario_id))::INT AS puesto,
           c.usuario_id, c.nombre, c.grupo, c.puntos, c.dias
    FROM candidatos c
    ORDER BY puesto
    LIMIT 3;
$$;

-- Cierra los meses terminados que aún no tienen podio (desde julio 2026).
-- Se llama al abrir la app. Solo el último mes cerrado queda con visto = false (animación).
CREATE OR REPLACE FUNCTION public.cerrar_meses_pae()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_hoy DATE := (now() AT TIME ZONE 'America/Bogota')::DATE;
    v_mes DATE := '2026-07-01'::DATE;
    v_ultimo DATE := (date_trunc('month', v_hoy) - interval '1 month')::DATE;
BEGIN
    WHILE v_mes <= v_ultimo LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.podio_mensual_pae
            WHERE anio = EXTRACT(YEAR FROM v_mes) AND mes = EXTRACT(MONTH FROM v_mes)
        ) THEN
            INSERT INTO public.podio_mensual_pae (anio, mes, puesto, usuario_id, nombre, grupo, puntos, dias, visto)
            SELECT EXTRACT(YEAR FROM v_mes)::INT, EXTRACT(MONTH FROM v_mes)::INT,
                   c.puesto, c.usuario_id, c.nombre, c.grupo, c.puntos, c.dias,
                   v_mes < v_ultimo
            FROM public.calcular_podio_pae(EXTRACT(YEAR FROM v_mes)::INT, EXTRACT(MONTH FROM v_mes)::INT) c
            ON CONFLICT DO NOTHING;
        END IF;
        v_mes := (v_mes + interval '1 month')::DATE;
    END LOOP;
END;
$$;

-- El ganador marca su animación como vista (no se repite en otro dispositivo)
CREATE OR REPLACE FUNCTION public.marcar_podio_visto(p_anio INT, p_mes INT)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE public.podio_mensual_pae
    SET visto = true
    WHERE anio = p_anio AND mes = p_mes AND usuario_id = auth.uid();
$$;

-- Cerrar de una vez julio a octubre 2026
SELECT public.cerrar_meses_pae();

-- Resultado
SELECT anio, mes, puesto, nombre, grupo, puntos, dias, visto
FROM public.podio_mensual_pae
ORDER BY anio, mes, puesto;
