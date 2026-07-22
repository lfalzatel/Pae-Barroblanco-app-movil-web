-- =============================================================================
-- ACTUALIZACIÓN DEL SISTEMA DE PUNTOS: FILTROS Y 1 PUNTO POR GRUPO AL DÍA
-- =============================================================================

-- 1. Limpiar historial y contadores (ya que cambiaremos la lógica de puntuación)
TRUNCATE TABLE public.puntos_pae_historial;
UPDATE public.perfiles_publicos SET puntos_gestor_pae = 0;

-- 2. Modificar la función del trigger para que valide si ya se dio punto
CREATE OR REPLACE FUNCTION public.otorgar_punto_gestor_pae()
RETURNS TRIGGER AS $$
DECLARE
    v_grupo TEXT;
    v_grado TEXT;
BEGIN
    SELECT grupo, grado INTO v_grupo, v_grado
    FROM public.estudiantes
    WHERE id = NEW.estudiante_id;

    IF NEW.registrado_por IS NOT NULL THEN
        -- Si no existe un registro previo para este grupo en esta misma fecha
        IF NOT EXISTS (
            SELECT 1 FROM public.puntos_pae_historial 
            WHERE grupo = COALESCE(v_grupo, 'Sin grupo') AND fecha = NEW.fecha
        ) THEN
            INSERT INTO public.puntos_pae_historial
                (usuario_id, asistencia_id, estudiante_id, grupo, grado, puntos, fecha)
            VALUES
                (NEW.registrado_por, NEW.id, NEW.estudiante_id, COALESCE(v_grupo, 'Sin grupo'), v_grado, 1, NEW.fecha);

            UPDATE public.perfiles_publicos
            SET puntos_gestor_pae = puntos_gestor_pae + 1
            WHERE id = NEW.registrado_por;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Nuevo backfill: agrupando por fecha y grupo para dar 1 solo punto por día
INSERT INTO public.puntos_pae_historial (usuario_id, asistencia_id, estudiante_id, grupo, grado, puntos, fecha)
SELECT DISTINCT ON (e.grupo, a.fecha) 
    a.registrado_por, a.id, a.estudiante_id, e.grupo, e.grado, 1, a.fecha
FROM public.asistencia_pae a
JOIN public.estudiantes e ON e.id = a.estudiante_id
WHERE a.registrado_por IS NOT NULL 
  AND a.fecha >= date_trunc('month', current_date);

-- Actualizar el contador de los perfiles con la nueva tabla más justa
UPDATE public.perfiles_publicos p SET puntos_gestor_pae = sub.total
FROM (SELECT usuario_id, COUNT(*) total FROM public.puntos_pae_historial GROUP BY usuario_id) sub
WHERE p.id = sub.usuario_id;


-- 4. Actualizar RPC para soportar filtros de período en Ranking Grupos
CREATE OR REPLACE FUNCTION public.ranking_grupos_pae(p_periodo TEXT DEFAULT 'mes')
RETURNS TABLE (grupo TEXT, grado TEXT, total_puntos BIGINT) AS $$
DECLARE
    v_start DATE;
    v_end DATE;
BEGIN
    IF p_periodo = 'hoy' THEN
        v_start := current_date;
        v_end := current_date;
    ELSIF p_periodo = 'semana' THEN
        v_start := date_trunc('week', current_date)::DATE;
        v_end := (date_trunc('week', current_date) + interval '6 days')::DATE;
    ELSIF p_periodo = 'mes' THEN
        v_start := date_trunc('month', current_date)::DATE;
        v_end := (date_trunc('month', current_date) + interval '1 month - 1 day')::DATE;
    ELSE
        -- 'todos' o cualquier otro valor
        v_start := '2000-01-01'::DATE;
        v_end := '2100-01-01'::DATE;
    END IF;

    RETURN QUERY
    SELECT h.grupo, MAX(h.grado) AS grado, COUNT(*) AS total_puntos
    FROM public.puntos_pae_historial h
    WHERE h.fecha >= v_start AND h.fecha <= v_end
    GROUP BY h.grupo
    ORDER BY total_puntos DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- 5. Actualizar RPC para soportar filtros de período en Ranking Gestores
CREATE OR REPLACE FUNCTION public.ranking_gestores_por_grupo(p_grupo TEXT, p_periodo TEXT DEFAULT 'mes')
RETURNS TABLE (usuario_id UUID, nombre TEXT, avatar_url TEXT, puntos BIGINT) AS $$
DECLARE
    v_start DATE;
    v_end DATE;
BEGIN
    IF p_periodo = 'hoy' THEN
        v_start := current_date;
        v_end := current_date;
    ELSIF p_periodo = 'semana' THEN
        v_start := date_trunc('week', current_date)::DATE;
        v_end := (date_trunc('week', current_date) + interval '6 days')::DATE;
    ELSIF p_periodo = 'mes' THEN
        v_start := date_trunc('month', current_date)::DATE;
        v_end := (date_trunc('month', current_date) + interval '1 month - 1 day')::DATE;
    ELSE
        v_start := '2000-01-01'::DATE;
        v_end := '2100-01-01'::DATE;
    END IF;

    RETURN QUERY
    SELECT h.usuario_id, p.nombre, p.avatar_url, COUNT(*) AS puntos
    FROM public.puntos_pae_historial h
    JOIN public.perfiles_publicos p ON p.id = h.usuario_id
    WHERE h.grupo = p_grupo
      AND h.fecha >= v_start AND h.fecha <= v_end
    GROUP BY h.usuario_id, p.nombre, p.avatar_url
    ORDER BY puntos DESC;
END;
$$ LANGUAGE plpgsql STABLE;
