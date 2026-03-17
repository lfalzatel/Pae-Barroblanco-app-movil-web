---
trigger: always_on
---

📋 REGLAS DE DESARROLLO — Sistema PAE (Asistencia)

Hablar siempre en español para agilizar la lectura y cambios

Adjunta este archivo al inicio de cada sesión de trabajo con Claude.
Estas reglas garantizan que los cambios solicitados sean quirúrgicos, seguros y predecibles.


🛠️ Stack tecnológico del proyecto
CapaTecnologíaFrameworkNext.js con App RouterBase de datos + AuthSupabaseLenguajeTypeScriptEstilosTailwind CSSDespliegueVercel

🔒 REGLA PRINCIPAL — Alcance mínimo

Claude SOLO debe modificar lo que se le pide explícitamente. Nada más.


Si se pide cambiar un componente, no tocar otros componentes aunque parezca relacionado.
Si se pide corregir un bug, no refactorizar ni "mejorar" código que funciona.
Si se pide agregar una función, no eliminar ni reordenar funciones existentes.
Ante cualquier duda sobre el alcance, preguntar antes de actuar.


🎨 Reglas de Estilos (Tailwind CSS)

NUNCA modificar clases Tailwind de elementos que no sean parte del cambio solicitado.
NUNCA reorganizar la estructura JSX/HTML de un componente salvo que se pida explícitamente.
Si se agrega un elemento nuevo, usar clases Tailwind coherentes con el componente existente (mismo tamaño de texto, paleta de colores, espaciado).
NUNCA agregar estilos en línea (style={{}}) si el proyecto ya usa Tailwind, salvo casos muy específicos justificados.
NUNCA tocar archivos globals.css, tailwind.config.* o layout.tsx a menos que se indique expresamente.


⚙️ Reglas de TypeScript y Lógica JS

NUNCA cambiar interfaces, tipos (type, interface) ni enums existentes sin pedido explícito.
NUNCA eliminar ni renombrar funciones, hooks o variables que ya existen.
Si se agrega nueva lógica, debe ir en su propio bloque o función, sin mezclar con lógica existente.
NUNCA modificar hooks personalizados (use*.ts) ni context providers sin que se solicite.
Respetar los tipos existentes: no usar any para resolver errores de tipado sin antes consultar.


🗂️ Reglas de Módulos y Archivos

Cada módulo es independiente. Un cambio en el módulo de asistencia no debe afectar el módulo de sedes, reportes u otros.
NUNCA mover, renombrar ni eliminar archivos o carpetas sin autorización explícita.
Si la solución requiere crear un nuevo archivo, confirmarlo antes de crearlo.
NUNCA modificar archivos de configuración** sin pedido explícito:

next.config.*
supabase/ (migraciones, políticas RLS)
.env, .env.local
middleware.ts
package.json / package-lock.json




🗄️ Reglas de Supabase (Base de datos + Auth)

NUNCA modificar consultas SQL o llamadas a Supabase que ya funcionan correctamente.
NUNCA cambiar políticas RLS ni permisos de tablas sin solicitud expresa.
Si se agrega una consulta nueva, debe ser aditiva: no reemplazar la existente.
Al modificar una query existente, mostrar primero la versión original y la propuesta para aprobación.
NUNCA ejecutar migraciones ni cambios de esquema directamente.


📦 Reglas de Componentes Next.js

NUNCA cambiar el comportamiento de Server Components vs Client Components sin pedido.
NUNCA agregar ni quitar directivas "use client" sin justificación aprobada.
Si se modifica un componente compartido (usado en varias páginas), advertirlo antes del cambio.
NUNCA modificar los archivos page.tsx o layout.tsx de rutas no relacionadas con la tarea.


✅ Protocolo de respuesta de Claude
Antes de entregar cualquier cambio de código, Claude debe:

Listar explícitamente los archivos que va a modificar.
Indicar qué líneas o secciones serán afectadas.
Advertir si el cambio podría tener efecto secundario en otro módulo.
Si el cambio toca un componente compartido, pedir confirmación antes de proceder.
Entregar el código en bloques separados por archivo, nunca mezclados.


🚫 Prohibiciones absolutas
Sin importar el contexto o la razón, Claude NUNCA debe:

Reescribir un archivo completo cuando solo se pidió un cambio parcial.
Cambiar el nombre de rutas, páginas o carpetas de Next.js App Router.
Alterar la lógica de autenticación de Supabase.
Eliminar comentarios de código existentes.
"Limpiar" o "optimizar" código que no fue parte de la solicitud.
Cambiar imports existentes que ya funcionan.


💬 Cómo hacer solicitudes efectivas (recomendaciones)
Para obtener los mejores resultados, al pedir un cambio especifica:

Qué archivo o componente involucra.
Qué comportamiento actual tiene y qué comportamiento quieres.
Qué NO debe cambiar (si hay riesgo de confusión).

Ejemplo:

"En el componente AsistenciaTable.tsx, quiero que al hacer clic en una fila se resalte en azul. No toques el modal ni los filtros de fecha que ya funcionan."


Última actualización: Marzo 2026 | Proyecto: Sistema PAE — IE Barroblanco