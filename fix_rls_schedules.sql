
-- Habilitar lectura pública para los horarios y novedades institucionales
-- Esto permite que estudiantes y acudientes vean la programación del restaurante.

ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on schedules" ON public.schedules FOR SELECT USING (true);

ALTER TABLE public.novedades_institucionales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on novedades_institucionales" ON public.novedades_institucionales FOR SELECT USING (true);

