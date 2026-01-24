-- Tablas para Novedades Institucionales (Independiente del PAE)
-- Ejecutar en el SQL Editor de Supabase

-- 1. Crear tabla
DROP TABLE IF EXISTS novedades_institucionales;

CREATE TABLE novedades_institucionales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha DATE NOT NULL,
  hora TEXT, -- Ej: "07:00 AM", "11:30 AM"
  titulo TEXT NOT NULL, -- Ej: "Reunión de Docentes"
  descripcion TEXT, -- Ej: "Se tratarán temas de convivencia"
  afectados TEXT, -- Ej: "Grados 7", "Todo el plantel", "Docentes"
  prioridad TEXT DEFAULT 'normal', -- 'alta', 'normal'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Habilitar RLS
ALTER TABLE novedades_institucionales ENABLE ROW LEVEL SECURITY;

-- 3. Políticas
CREATE POLICY "Lectura pública de novedades" ON novedades_institucionales
FOR SELECT USING (true);

CREATE POLICY "Gestión de novedades para admins" ON novedades_institucionales
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM perfiles_publicos
    WHERE id = auth.uid() AND rol IN ('admin', 'coordinador_pae')
  )
);

-- 4. Índice para velocidad
CREATE INDEX idx_novedades_fecha ON novedades_institucionales(fecha);
