-- 1. Crear función para calcular la racha escolar de un usuario hasta una fecha dada
CREATE OR REPLACE FUNCTION public.calcular_racha_usuario_fecha(p_usuario_id UUID, p_fecha DATE)
RETURNS INTEGER
LANGUAGE plpgsql STABLE
AS $$
DECLARE
    v_racha INT := 1; -- Iniciamos en 1 porque hoy se está registrando
    v_fecha_check DATE := p_fecha;
    v_prev_day DATE;
    v_existe BOOLEAN;
BEGIN
    LOOP
        -- Calcular el día escolar previo
        IF EXTRACT(ISODOW FROM v_fecha_check) = 1 THEN -- Si es Lunes (1), el anterior es Viernes (v_fecha_check - 3)
            v_prev_day := v_fecha_check - 3;
        ELSE -- De Martes a Viernes (2 a 5) o fines de semana (por si acaso), restamos 1 día
            v_prev_day := v_fecha_check - 1;
        END IF;

        -- Ajuste de seguridad: si v_prev_day cae en fin de semana (sábado=6, domingo=7), retroceder hasta el viernes
        WHILE EXTRACT(ISODOW FROM v_prev_day) IN (6, 7) LOOP
            v_prev_day := v_prev_day - 1;
        END LOOP;

        -- Verificar si el usuario registró asistencia en v_prev_day
        SELECT EXISTS (
            SELECT 1 FROM public.puntos_pae_historial
            WHERE usuario_id = p_usuario_id AND fecha = v_prev_day
        ) INTO v_existe;

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

-- 2. Modificar la función del trigger para calcular e insertar puntos con bonos de racha (Opción A)
CREATE OR REPLACE FUNCTION public.otorgar_punto_gestor_pae()
RETURNS TRIGGER 
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_grupo TEXT;
    v_grado TEXT;
    v_racha INT;
    v_puntos INT := 1;
    v_ya_registro_hoy BOOLEAN;
BEGIN
    SELECT grupo, grado INTO v_grupo, v_grado
    FROM public.estudiantes
    WHERE id = NEW.estudiante_id;

    IF NEW.registrado_por IS NOT NULL THEN
        -- Validar si ya existe un registro para este grupo y fecha en el historial
        IF NOT EXISTS (
            SELECT 1 FROM public.puntos_pae_historial 
            WHERE grupo = COALESCE(v_grupo, 'Sin grupo') AND fecha = NEW.fecha
        ) THEN
            -- Verificar si el usuario ya registró algún grupo hoy para no duplicar bono de racha
            SELECT EXISTS (
                SELECT 1 FROM public.puntos_pae_historial
                WHERE usuario_id = NEW.registrado_por AND fecha = NEW.fecha
            ) INTO v_ya_registro_hoy;

            IF NOT v_ya_registro_hoy THEN
                -- Es el primer grupo registrado hoy: calcular racha y aplicar bonificaciones
                v_racha := public.calcular_racha_usuario_fecha(NEW.registrado_por, NEW.fecha);
                
                -- Opción A: Ciclo continuo cada 5 días
                IF v_racha % 5 = 0 THEN
                    v_puntos := 3; -- 1 base + 2 bono
                ELSIF v_racha % 5 = 3 THEN
                    v_puntos := 2; -- 1 base + 1 bono
                ELSE
                    v_puntos := 1; -- 1 base
                END IF;
            ELSE
                -- Ya registró otro grupo hoy: gana 1 punto base sin bonificación extra
                v_puntos := 1;
            END IF;

            INSERT INTO public.puntos_pae_historial
                (usuario_id, asistencia_id, estudiante_id, grupo, grado, puntos, fecha)
            VALUES
                (NEW.registrado_por, NEW.id, NEW.estudiante_id, COALESCE(v_grupo, 'Sin grupo'), v_grado, v_puntos, NEW.fecha);

            UPDATE public.perfiles_publicos
            SET puntos_gestor_pae = puntos_gestor_pae + v_puntos
            WHERE id = NEW.registrado_por;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- 3. Bloque anónimo para limpiar y recalcular históricamente desde el 1 de Julio de 2026
DO $$
DECLARE
    r RECORD;
    v_racha INT;
    v_puntos INT;
    v_ya_registro_hoy BOOLEAN;
BEGIN
    -- Limpiar registros del historial desde el 1 de Julio de 2026
    DELETE FROM public.puntos_pae_historial WHERE fecha >= '2026-07-01'::DATE;

    -- Recorrer cronológicamente los registros de asistencia agrupados por fecha y grupo
    FOR r IN 
        SELECT DISTINCT ON (a.fecha, e.grupo)
            a.registrado_por, a.id AS asistencia_id, a.estudiante_id, e.grupo, e.grado, a.fecha
        FROM public.asistencia_pae a
        JOIN public.estudiantes e ON e.id = a.estudiante_id
        WHERE a.registrado_por IS NOT NULL 
          AND a.fecha >= '2026-07-01'::DATE
        ORDER BY a.fecha ASC, e.grupo ASC
    LOOP
        -- Validar si el usuario ya registró algo en esta fecha en el historial recalculado
        SELECT EXISTS (
            SELECT 1 FROM public.puntos_pae_historial
            WHERE usuario_id = r.registrado_por AND fecha = r.fecha
        ) INTO v_ya_registro_hoy;

        IF NOT v_ya_registro_hoy THEN
            -- Calcular racha e indicar puntos con bonos
            v_racha := public.calcular_racha_usuario_fecha(r.registrado_por, r.fecha);
            
            IF v_racha % 5 = 0 THEN
                v_puntos := 3;
            ELSIF v_racha % 5 = 3 THEN
                v_puntos := 2;
            ELSE
                v_puntos := 1;
            END IF;
        ELSE
            v_puntos := 1;
        END IF;

        -- Insertar en el historial reconstruido
        INSERT INTO public.puntos_pae_historial
            (usuario_id, asistencia_id, estudiante_id, grupo, grado, puntos, fecha)
        VALUES
            (r.registrado_por, r.asistencia_id, r.estudiante_id, COALESCE(r.grupo, 'Sin grupo'), r.grado, v_puntos, r.fecha);
    END LOOP;

    -- 4. Sincronizar perfiles_publicos.puntos_gestor_pae sumando la totalidad de puntos históricos reales
    UPDATE public.perfiles_publicos SET puntos_gestor_pae = 0;
    
    UPDATE public.perfiles_publicos p
    SET puntos_gestor_pae = sub.total
    FROM (
        SELECT usuario_id, SUM(puntos) AS total
        FROM public.puntos_pae_historial
        GROUP BY usuario_id
    ) sub
    WHERE p.id = sub.usuario_id;
END;
$$;
