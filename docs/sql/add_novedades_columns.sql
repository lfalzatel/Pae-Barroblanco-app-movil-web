-- Add columns for storing novelties in attendance records
ALTER TABLE "public"."asistencia_pae" 
ADD COLUMN IF NOT EXISTS "novedad_tipo" TEXT,
ADD COLUMN IF NOT EXISTS "novedad_descripcion" TEXT;
