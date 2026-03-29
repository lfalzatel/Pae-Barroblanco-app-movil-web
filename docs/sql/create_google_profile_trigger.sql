-- =============================================================================
-- TRIGGER: Crear perfil automático para usuarios nuevos de Google OAuth
-- Proyecto: Sistema PAE - IE Barroblanco
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- =============================================================================

-- 1. Función del trigger
CREATE OR REPLACE FUNCTION public.handle_new_google_user()
RETURNS TRIGGER AS $$
DECLARE
  v_provider TEXT;
BEGIN
  -- Supabase almacena el proveedor en raw_app_meta_data->>'provider'
  v_provider := NEW.raw_app_meta_data ->> 'provider';

  -- Solo actuar si el proveedor es 'google'
  IF v_provider = 'google' THEN
    INSERT INTO public.perfiles_publicos (id, email, nombre, rol, avatar_url)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(
        NEW.raw_user_meta_data ->> 'full_name',
        NEW.raw_user_meta_data ->> 'name',
        split_part(NEW.email, '@', 1)
      ),
      'estudiante',  -- Rol por defecto para usuarios de Google
      NEW.raw_user_meta_data ->> 'picture'
    )
    ON CONFLICT (id) DO NOTHING;  -- Si ya existe el perfil (ej: reconexión), no sobreescribir
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Crear el trigger (DROP primero para evitar duplicados)
DROP TRIGGER IF EXISTS on_google_user_created ON auth.users;

CREATE TRIGGER on_google_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_google_user();

-- =============================================================================
-- VERIFICACIÓN: Ejecutar esta query después para confirmar que quedó activo
-- =============================================================================
-- SELECT trigger_name, event_manipulation, action_statement
-- FROM information_schema.triggers
-- WHERE event_object_schema = 'auth' AND event_object_table = 'users';
