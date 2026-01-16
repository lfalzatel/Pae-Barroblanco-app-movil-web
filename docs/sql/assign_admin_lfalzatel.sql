-- MIGRACIÓN PARA ASIGNAR ROL DE ADMINISTRADOR
-- Ejecuta este script en el SQL Editor de Supabase

-- Actualizar los metadatos del usuario para incluir el rol 'admin'
-- El sistema PAE lee el rol desde user_metadata.rol
UPDATE auth.users
SET raw_user_meta_data = 
    COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"rol": "admin"}'::jsonb
WHERE email = 'lfalzatel@gmail.com';

-- Mensaje de confirmación
SELECT email, raw_user_meta_data->>'rol' as rol_asignado
FROM auth.users
WHERE email = 'lfalzatel@gmail.com';
