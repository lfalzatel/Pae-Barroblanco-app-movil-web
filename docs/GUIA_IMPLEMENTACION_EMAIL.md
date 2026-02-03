# 📧 GUÍA DE IMPLEMENTACIÓN - VALIDACIÓN POR EMAIL DOMAIN

Sistema PAE - Control de Acceso por Dominio de Email Institucional

---

## 🎯 ¿QUÉ ES ESTO?

Este paquete implementa **restricción de acceso basada en dominio de email**, similar a Google Workspace o Slack.

### **Cómo Funciona:**

```
✅ PERMITIDO:
juan@barroblanco.edu.co     → Acceso a Barroblanco
maria@barroblanco.edu.co    → Acceso a Barroblanco

❌ BLOQUEADO:
juan@gmail.com              → NO puede acceder
maria@sanfrancisco.edu.co   → NO puede acceder a Barroblanco
```

### **Características:**

✅ Validación automática en registro  
✅ Validación automática en login  
✅ Detección de institución en tiempo real  
✅ Sistema de invitaciones para emails externos  
✅ Row Level Security basado en email domain  
✅ Triggers automáticos de asignación

---

## 📦 CONTENIDO DEL PAQUETE

```
multi-tenant-email-validation/
├── database/
│   └── 002_email_domain_validation.sql   # Migración SQL completa
├── lib/
│   └── email-validation.ts                # Utilidades de validación
├── app/
│   ├── registro/
│   │   └── page.tsx                       # Registro con validación
│   └── login/
│       └── page.tsx                       # Login con validación
└── docs/
    └── GUIA_IMPLEMENTACION_EMAIL.md       # Este archivo
```

---

## 🚀 INSTALACIÓN RÁPIDA

### **Paso 1: Ejecutar Migración SQL** (5 min)

1. Abrir Supabase Dashboard
2. Ir a SQL Editor
3. Copiar TODO el contenido de `database/002_email_domain_validation.sql`
4. Ejecutar (Run)
5. Verificar: `Success. No rows returned`

### **Paso 2: Copiar Archivos** (2 min)

```bash
# Copiar utilidades
cp lib/email-validation.ts /tu-proyecto/lib/

# Copiar páginas
cp app/registro/page.tsx /tu-proyecto/app/registro/
cp app/login/page.tsx /tu-proyecto/app/login/
```

### **Paso 3: Configurar Dominio de Email** (1 min)

```sql
-- En Supabase SQL Editor:
UPDATE instituciones 
SET email_domain = 'barroblanco.edu.co'
WHERE slug = 'barroblanco';
```

### **Paso 4: Probar** (2 min)

1. Ir a `/registro`
2. Intentar registrar con `test@gmail.com` → ❌ Bloqueado
3. Intentar registrar con `test@barroblanco.edu.co` → ✅ Permitido

**¡Listo!** Total: ~10 minutos

---

## 📋 CONFIGURACIÓN DETALLADA

### **1. Configurar Dominios por Institución**

```sql
-- Barroblanco
UPDATE instituciones 
SET email_domain = 'barroblanco.edu.co'
WHERE slug = 'barroblanco';

-- San Francisco (ejemplo)
INSERT INTO instituciones (nombre, slug, email_domain, estado)
VALUES (
  'Colegio San Francisco',
  'sanfrancisco',
  'sanfrancisco.edu.co',
  'activo'
);

-- La Salle (ejemplo)
INSERT INTO instituciones (nombre, slug, email_domain, estado)
VALUES (
  'Liceo La Salle',
  'lasalle',
  'lasalle.edu.co',
  'activo'
);
```

### **2. Ver Configuración Actual**

```sql
SELECT nombre, slug, email_domain, estado 
FROM instituciones 
ORDER BY nombre;
```

---

## 🔐 CÓMO FUNCIONA LA SEGURIDAD

### **Nivel 1: Validación en Registro**

```typescript
// Cuando alguien intenta registrarse:
const email = 'juan@barroblanco.edu.co';

// 1. Extraer dominio
const domain = email.split('@')[1]; // 'barroblanco.edu.co'

// 2. Buscar institución
const institution = await supabase
  .from('instituciones')
  .select('*')
  .eq('email_domain', domain)
  .eq('estado', 'activo')
  .single();

// 3. Si NO existe → BLOQUEAR
if (!institution) {
  return error('Dominio no autorizado');
}

// 4. Si existe → PERMITIR y asignar institución
```

### **Nivel 2: Trigger Automático**

```sql
-- Cuando un usuario se registra, automáticamente:
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_institution_on_signup();

-- Esta función:
-- 1. Extrae dominio del email
-- 2. Busca institución
-- 3. Crea perfil_publico con institucion_id
-- 4. Crea usuario_instituciones
```

### **Nivel 3: Row Level Security**

```sql
-- Los usuarios SOLO ven datos de su institución
CREATE POLICY "Users can only access their institution students"
ON estudiantes FOR ALL
USING (
  institucion_id = get_current_user_institution_id()
);

-- Esta función extrae la institución del email del usuario actual
CREATE FUNCTION get_current_user_institution_id()
RETURNS UUID AS $$
DECLARE
  user_email TEXT;
  email_domain TEXT;
  inst_id UUID;
BEGIN
  -- Email del usuario autenticado
  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
  
  -- Extraer dominio
  email_domain := split_part(user_email, '@', 2);
  
  -- Buscar institución
  SELECT id INTO inst_id FROM instituciones 
  WHERE email_domain = email_domain;
  
  RETURN inst_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 👥 CASOS ESPECIALES

### **Caso 1: Padres de Familia (Gmail, Outlook, etc.)**

Los padres no tienen email institucional. Solución: **Sistema de Invitaciones**

#### **Flujo:**

```
1. Admin crea invitación para padre@gmail.com
2. Sistema genera token único
3. Envía email con link: sistemapae.com/invitacion/ABC123
4. Padre hace click y se registra
5. Se le asigna automáticamente a la institución
```

#### **Crear Invitación (SQL):**

```sql
INSERT INTO invitaciones (email, institucion_id, rol)
VALUES (
  'padre@gmail.com',
  (SELECT id FROM instituciones WHERE slug = 'barroblanco'),
  'padre'
);

-- El sistema generará automáticamente un token
```

#### **Código para Crear Invitación (TypeScript):**

```typescript
// En panel de admin
async function invitarPadre(email: string, institutionId: string) {
  const { data, error } = await supabase
    .from('invitaciones')
    .insert({
      email: email.toLowerCase(),
      institucion_id: institutionId,
      rol: 'padre',
      creado_por: currentUser.id
    })
    .select()
    .single();

  if (error) throw error;

  // Enviar email con link de invitación
  const inviteLink = `${window.location.origin}/invitacion/${data.token}`;
  await sendInvitationEmail(email, inviteLink);
  
  return data;
}
```

### **Caso 2: Coordinadores que Trabajan en Múltiples Instituciones**

Si un coordinador trabaja en Barroblanco Y San Francisco:

```sql
-- Opción A: Email principal + invitaciones
-- Email: coordinador@barroblanco.edu.co (principal)
-- Recibe invitación para sanfrancisco

-- Opción B: Email genérico + múltiples invitaciones
-- Email: coordinador@gmail.com
-- Invitaciones para ambas instituciones

INSERT INTO usuario_instituciones (usuario_id, institucion_id, rol)
VALUES 
  ('[user-id]', '[barroblanco-id]', 'coordinador_pae'),
  ('[user-id]', '[sanfrancisco-id]', 'coordinador_pae');
```

### **Caso 3: Personal que Cambia de Institución**

Cuando alguien cambia de `barroblanco.edu.co` a `sanfrancisco.edu.co`:

```sql
-- Opción A: Actualizar email en Supabase Auth
-- El trigger automático reasignará la institución

-- Opción B: Mantener access a ambas
INSERT INTO usuario_instituciones (usuario_id, institucion_id, rol)
VALUES ('[user-id]', '[nueva-institucion-id]', 'docente');
```

---

## 🧪 TESTING

### **Test 1: Email Institucional Válido**

```
Email: test@barroblanco.edu.co
Resultado Esperado: ✅ Permitido, institución detectada
```

### **Test 2: Email Gmail**

```
Email: test@gmail.com
Resultado Esperado: ❌ Bloqueado, mensaje: "Dominio no autorizado"
```

### **Test 3: Email de Otra Institución**

```
Email: test@sanfrancisco.edu.co (intentando acceder a Barroblanco)
Resultado Esperado: ❌ Bloqueado
```

### **Test 4: Invitación Válida**

```
1. Admin crea invitación para padre@gmail.com
2. Padre abre link de invitación
3. Se registra
Resultado Esperado: ✅ Permitido, asignado a institución
```

### **Script de Testing:**

```typescript
// tests/email-validation.test.ts
import { validateEmailDomain } from '@/lib/email-validation';

describe('Email Validation', () => {
  it('should allow institutional email', async () => {
    const result = await validateEmailDomain('test@barroblanco.edu.co');
    expect(result.valid).toBe(true);
    expect(result.institution).toBeDefined();
  });

  it('should block public email', async () => {
    const result = await validateEmailDomain('test@gmail.com');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('no está autorizado');
  });

  it('should block wrong institution', async () => {
    const result = await validateEmailDomain('test@otrainstitution.edu.co');
    expect(result.valid).toBe(false);
  });
});
```

---

## 📊 CONSULTAS ÚTILES

### **Ver Todos los Dominios Configurados:**

```sql
SELECT nombre, email_domain, estado, plan
FROM instituciones
ORDER BY nombre;
```

### **Ver Usuarios por Institución:**

```sql
SELECT 
  i.nombre as institucion,
  COUNT(DISTINCT ui.usuario_id) as total_usuarios
FROM instituciones i
LEFT JOIN usuario_instituciones ui ON i.id = ui.institucion_id
WHERE ui.estado = 'activo'
GROUP BY i.nombre
ORDER BY total_usuarios DESC;
```

### **Ver Usuarios con Emails No Institucionales:**

```sql
SELECT 
  u.email,
  pp.nombre,
  i.nombre as institucion
FROM auth.users u
INNER JOIN perfiles_publicos pp ON u.id = pp.id
INNER JOIN instituciones i ON pp.institucion_id = i.id
WHERE split_part(u.email, '@', 2) != i.email_domain;
```

### **Ver Invitaciones Pendientes:**

```sql
SELECT 
  inv.email,
  inv.rol,
  i.nombre as institucion,
  inv.created_at,
  inv.expires_at
FROM invitaciones inv
INNER JOIN instituciones i ON inv.institucion_id = i.id
WHERE inv.estado = 'pendiente'
AND inv.expires_at > NOW()
ORDER BY inv.created_at DESC;
```

---

## 🔧 PERSONALIZACIÓN

### **Cambiar Mensaje de Error:**

```typescript
// En lib/email-validation.ts
// Buscar:
error: `El dominio @${domain} no está autorizado...`

// Cambiar por:
error: `Solo se permiten correos de ${expectedDomain}. Contacta a admin@tuinstitución.edu.co si necesitas acceso.`
```

### **Permitir Dominios Adicionales:**

```sql
-- Agregar configuración de dominios permitidos
UPDATE instituciones 
SET configuracion = jsonb_set(
  configuracion,
  '{email_config, allowed_external_domains}',
  '["gmail.com", "outlook.com"]'::jsonb
)
WHERE slug = 'barroblanco';
```

### **Configurar Tiempo de Expiración de Invitaciones:**

```sql
-- Cambiar de 7 días a 30 días
ALTER TABLE invitaciones 
ALTER COLUMN expires_at SET DEFAULT NOW() + INTERVAL '30 days';
```

---

## ⚠️ ERRORES COMUNES

### **Error: "Email domain already exists"**

```
Causa: Intentas crear dos instituciones con el mismo dominio
Solución: email_domain debe ser ÚNICO por institución
```

### **Error: "Row level security policy violation"**

```
Causa: Usuario no tiene institucion_id asignado
Solución: Verificar que el trigger se ejecutó correctamente

-- Verificar:
SELECT id, email, raw_user_meta_data->>'institucion_id' 
FROM auth.users 
WHERE email = 'usuario@problema.com';

-- Corregir:
UPDATE perfiles_publicos 
SET institucion_id = (SELECT id FROM instituciones WHERE email_domain = 'dominio.edu.co')
WHERE email = 'usuario@problema.com';
```

### **Error: "Institution not found"**

```
Causa: Dominio de email no está registrado en instituciones
Solución: Agregar el dominio

INSERT INTO instituciones (nombre, slug, email_domain)
VALUES ('Nombre Institución', 'slug', 'dominio.edu.co');
```

---

## 📈 MONITOREO

### **Dashboard de Métricas:**

```sql
-- Creación de vista para monitoreo
CREATE OR REPLACE VIEW institution_metrics AS
SELECT 
  i.nombre,
  i.email_domain,
  COUNT(DISTINCT ui.usuario_id) as usuarios_activos,
  COUNT(DISTINCT e.id) as total_estudiantes,
  COUNT(DISTINCT CASE WHEN ui.rol = 'admin' THEN ui.usuario_id END) as admins,
  COUNT(DISTINCT CASE WHEN ui.rol = 'docente' THEN ui.usuario_id END) as docentes
FROM instituciones i
LEFT JOIN usuario_instituciones ui ON i.id = ui.institucion_id AND ui.estado = 'activo'
LEFT JOIN estudiantes e ON i.id = e.institucion_id
WHERE i.estado = 'activo'
GROUP BY i.id, i.nombre, i.email_domain;

-- Ver métricas
SELECT * FROM institution_metrics ORDER BY usuarios_activos DESC;
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

- [ ] **Base de Datos**
  - [ ] Migración SQL ejecutada
  - [ ] Columna `email_domain` agregada
  - [ ] Barroblanco configurado con dominio
  - [ ] Trigger `on_auth_user_created` activo
  - [ ] RLS habilitado y funcionando

- [ ] **Código Frontend**
  - [ ] `lib/email-validation.ts` copiado
  - [ ] `app/registro/page.tsx` actualizado
  - [ ] `app/login/page.tsx` actualizado

- [ ] **Testing**
  - [ ] Email institucional válido funciona
  - [ ] Email Gmail bloqueado
  - [ ] Detección de institución en tiempo real
  - [ ] Mensaje de error apropiado

- [ ] **Documentación**
  - [ ] Usuarios informados del cambio
  - [ ] Admin sabe cómo crear invitaciones
  - [ ] Proceso documentado para nuevas instituciones

---

## 🎯 PRÓXIMOS PASOS

Una vez implementado:

1. **Panel de Invitaciones** - UI para que admins inviten padres
2. **Email Templates** - Emails automáticos de invitación
3. **Validación de Documentos** - Subir carnet institucional
4. **SSO Institucional** - Login con Google Workspace
5. **Auditoría** - Logs de intentos de acceso

---

## 📞 SOPORTE

¿Problemas con la implementación?

1. Revisa los logs de Supabase (Dashboard → Logs)
2. Verifica que el trigger se ejecutó (SQL → ver funciones)
3. Confirma que RLS está habilitado
4. Consulta esta guía

---

**¡Sistema de validación por email domain implementado con éxito!** 🎉
