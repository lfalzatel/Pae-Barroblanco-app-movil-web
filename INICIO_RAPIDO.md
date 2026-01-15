# 🚀 GUÍA DE INICIO RÁPIDO
## Sistema PAE Barroblanco

### ✅ PASO 1: INSTALACIÓN

1. **Extrae el archivo descargado**
   - Descomprime `sistema-pae-web.zip`
   - Esto creará una carpeta `sistema-pae-web`

2. **Abre la terminal o PowerShell**
   - Windows: Click derecho en la carpeta → "Abrir en Terminal"
   - Mac/Linux: Terminal en la ubicación de la carpeta

3. **Instala las dependencias**
   ```
   npm install
   ```
   ⏱️ Esto tomará 2-3 minutos

4. **Inicia el servidor**
   ```
   npm run dev
   ```

5. **Abre tu navegador**
   ```
   http://localhost:3000
   ```

### 🔐 PASO 2: INICIAR SESIÓN

Usa cualquiera de estos usuarios:

**👤 Administrador**
- Email: admin@barroblanco.edu.co
- Contraseña: admin123

**👤 Coordinador**
- Email: coordinador@barroblanco.edu.co
- Contraseña: coord123

**👤 Docente**
- Email: docente1@barroblanco.edu.co
- Contraseña: doc123

**👤 Estudiante**
- Email: estudiante@barroblanco.edu.co
- Contraseña: est123

### 📋 PASO 3: REGISTRAR ASISTENCIA

1. Click en "Registrar" (botón azul arriba a la derecha)
2. Selecciona una sede:
   - Sede Principal (Bachillerato 6°-11°)
   - Sede Primaria (1°-5°)
   - María Inmaculada (1°-5°)
3. Selecciona un grupo (ejemplo: 601, 801, 1002)
4. Registra asistencia de cada estudiante:
   - ✅ Verde = Recibió alimentación
   - ❌ Rojo = No recibió alimentación
   - 👤 Gris = Ausente
5. Click en "Guardar"

### 📊 CARACTERÍSTICAS PRINCIPALES

✅ **Dashboard**
- Estadísticas en tiempo real
- Total de estudiantes: 1,460
- Asistencia del día: 91.9%

✅ **Registro**
- Por sede y grupo
- 3 estados de asistencia
- Búsqueda de estudiantes
- Botón "Todos Recibieron"

✅ **Gestión**
- Lista de todos los estudiantes
- Historial individual (últimos 30 días)
- Exportar reportes

✅ **Reportes**
- Filtros por período (Hoy/Semana/Mes)
- Filtros por sede
- Exportar Excel/PDF

### 💡 CONSEJOS

🔹 **Búsqueda rápida:** Usa la barra de búsqueda en cada pantalla
🔹 **Móvil:** La app funciona perfectamente en celulares
🔹 **Offline:** Los datos se guardan localmente
🔹 **Usuarios demo:** Prueba con los 4 roles disponibles

### ⚠️ IMPORTANTE

📌 **Datos de Demostración**
- Los datos actuales son de prueba
- Los estudiantes y registros son simulados
- Ideal para aprender el sistema

📌 **Navegadores Compatibles**
- Chrome (Recomendado)
- Firefox
- Safari
- Edge

### 🆘 ¿PROBLEMAS?

**No inicia el servidor:**
```
rm -rf node_modules
npm install
npm run dev
```

**Puerto 3000 ocupado:**
```
npm run dev -- -p 3001
```
Luego abre: http://localhost:3001

**Errores de instalación:**
- Verifica que tengas Node.js 18 o superior
- Ejecuta: `node --version`

### 📱 PRÓXIMOS PASOS

1. ✅ Familiarízate con la interfaz
2. ✅ Prueba registrar asistencia en varios grupos
3. ✅ Explora el historial de estudiantes
4. ✅ Genera reportes de diferentes períodos
5. ⚙️ Personaliza según tus necesidades

### 📞 CONTACTO

**Luis Fernando Alzate López**
- Institución Educativa Barroblanco
- Rionegro, Antioquia

---

**¡Listo para comenzar! 🎉**

Para más información detallada, consulta el archivo README.md
