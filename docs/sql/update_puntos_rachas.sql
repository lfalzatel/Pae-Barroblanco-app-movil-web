-- 1. Crear tabla de Festivos Oficiales de Colombia
CREATE TABLE IF NOT EXISTS public.festivos_colombia (
    fecha DATE PRIMARY KEY,
    nombre TEXT NOT NULL
);

-- Poblar festivos oficiales de Colombia para 2026 y 2027
INSERT INTO public.festivos_colombia (fecha, nombre) VALUES
('2026-01-01', 'Año Nuevo'),
('2026-01-12', 'Día de los Reyes Magos'),
('2026-03-23', 'Día de San José'),
('2026-04-02', 'Jueves Santo'),
('2026-04-03', 'Viernes Santo'),
('2026-05-01', 'Día del Trabajo'),
('2026-05-18', 'Día de la Ascensión'),
('2026-06-08', 'Corpus Christi'),
('2026-06-15', 'Sagrado Corazón de Jesús'),
('2026-06-29', 'San Pedro y San Pablo'),
('2026-07-20', 'Día de la Independencia'),
('2026-08-07', 'Batalla de Boyacá'),
('2026-08-17', 'La Asunción de la Virgen'),
('2026-10-12', 'Día de la Raza'),
('2026-11-02', 'Día de todos los Santos'),
('2026-11-16', 'Independencia de Cartagena'),
('2026-12-08', 'Día de la Inmaculada Concepción'),
('2026-12-25', 'Navidad'),
('2027-01-01', 'Año Nuevo'),
('2027-01-11', 'Día de los Reyes Magos'),
('2027-03-22', 'Día de San José'),
('2027-03-25', 'Jueves Santo'),
('2027-03-26', 'Viernes Santo'),
('2027-05-01', 'Día del Trabajo'),
('2027-05-10', 'Día de la Ascensión'),
('2027-05-31', 'Corpus Christi'),
('2027-06-07', 'Sagrado Corazón de Jesús'),
('2027-07-05', 'San Pedro y San Pablo'),
('2027-07-20', 'Día de la Independencia'),
('2027-08-07', 'Batalla de Boyacá'),
('2027-08-16', 'La Asunción de la Virgen'),
('2027-10-18', 'Día de la Raza'),
('2027-11-01', 'Día de todos los Santos'),
('2027-11-15', 'Independencia de Cartagena'),
('2027-12-08', 'Día de la Inmaculada Concepción'),
('2027-12-25', 'Navidad')
ON CONFLICT (fecha) DO NOTHING;

-- 2. Función helper para validar si una fecha es día no lectivo (Fin de semana o Festivo Colombia)
CREATE OR REPLACE FUNCTION public.es_dia_no_lectivo(p_fecha DATE)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE
AS $$
BEGIN
    -- Fin de semana (Sábado = 6, Domingo = 7)
    IF EXTRACT(ISODOW FROM p_fecha) IN (6, 7) THEN
        RETURN TRUE;
    END IF;

    -- Festivo oficial en Colombia
    IF EXISTS (SELECT 1 FROM public.festivos_colombia WHERE fecha = p_fecha) THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$;

-- 3. Crear o reemplazar función para calcular la racha escolar de un usuario omitiendo días no lectivos
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
BEGIN
    LOOP
        -- Iniciar buscando desde el día inmediatamente anterior
        v_prev_day := v_fecha_check - 1;

        -- Retroceder omitiendo fines de semana y festivos oficiales de Colombia
        WHILE public.es_dia_no_lectivo(v_prev_day) LOOP
            v_prev_day := v_prev_day - 1;
        END LOOP;

        -- Si el día lectivo anterior cae fuera del mes actual, la racha del mes finaliza
        IF v_prev_day < v_inicio_mes THEN
            EXIT;
        END IF;

        -- Verificar si el usuario registró asistencia en ese día lectivo previo
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
