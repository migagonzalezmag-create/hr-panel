Cómo activar el login seguro del panel HRnini (Apps Script "Hr nini"). Última actualización: 25/11/2026.

# Activar el login seguro de HRnini

## Qué cambia

**Antes:**
- El panel traía dentro del código la nómina completa (con DNI y CUIL), el ausentismo, las licencias y las contraseñas.
- Además, cualquiera podía pedirle al Apps Script cualquier hoja (`?sheet=Usuarios`, `?sheet=Sueldos`, etc.) sin loguearse.

**Ahora:**
- El panel no trae ningún dato. Para ver algo hay que loguearse, y el usuario y la contraseña se validan en el Apps Script.
- Al entrar, el servidor da una sesión de 6 horas.
- Cada rol recibe solo lo suyo:

| Rol | Ve |
|---|---|
| Admin | Todo |
| Dirección | Todo, incluidos Sueldos y Negociaciones |
| Analista | Nómina, ausentismo, licencias y fotos. Si tiene sucursal asignada, solo esa sucursal. No ve Sueldos ni Negociaciones |
| Supervisor | Solo la gente de su sector (y de su sucursal, si tiene). No ve Sueldos ni Negociaciones |

- La hoja **Usuarios** no sale nunca del servidor.
- **DNI y CUIL** no se envían nunca (el panel no los usaba).
- Después de **5 intentos fallidos**, ese usuario queda bloqueado 15 minutos.
- Planificación Horaria usa el mismo login. Si ya entraste al panel, abre directo.

## Pasos (en este orden)

### 1. Actualizar el Apps Script
1. Abrí la planilla **Base Nini** → **Extensiones → Apps Script** (proyecto "Hr nini").
2. En **Código.gs**, borrá **solo** las funciones `doGet` y `doPost`, las dos primeras. Todo lo demás queda igual: `guardarPlanificacion`, `actualizarEstado`, `mapearFotos`, etc.
3. Creá un archivo nuevo con **＋ → Secuencia de comandos** y llamalo `Seguridad`.
4. Pegá todo el contenido de `apps-script/Seguridad.gs` de este repo.
5. Guardá con Ctrl+S.

### 2. Publicar la nueva versión sin cambiar la URL
1. **Implementar → Gestionar implementaciones**.
2. Buscá la implementación cuya URL termina en `...6sKeQF4vGg/exec`: es la que usa el panel.
3. Tocá el lápiz ✏️ → en **Versión**, elegí **Nueva versión** → **Implementar**.
4. Dejá **Ejecutar como: Yo** y **Quién tiene acceso: Cualquier usuario**. Eso tiene que quedar así para que el panel pueda conectarse. La protección ahora la da el login.
5. Si no encontrás esa URL en este proyecto, avisale a Claude: hay que cambiar la URL en el panel.

### 3. Avisarle a Claude para publicar el panel nuevo
- Los cambios del panel están en la rama `seguridad-datos`.
- Se pasan a `main` (lo que se ve en GitHub Pages) recién después del paso 2. Si se pasan antes, el panel no puede entrar.

### 4. Cerrar las puertas viejas (después del paso 3)
1. **Implementaciones viejas:** en **Gestionar implementaciones**, archivá todas las que no sean la del paso 2. Ojo con la de Planificación (`...KdOSrjwvKQ/exec`), que todavía responde con el código viejo. Revisá también los otros proyectos de Apps Script ("Horario Trafico", "Proyecto sin título") y archivá sus implementaciones si ya no se usan.
2. **Hojas publicadas en la web:** en Base Nini, **Archivo → Compartir → Publicar en la Web**. Abrí "Contenido publicado y configuración" y tocá **Detener la publicación**. Antes estaban publicadas al menos la nómina, Usuarios, Sueldos y Licencias, y cualquiera con el link podía leerlas.
3. **Contraseñas:** las que estaban en el código ya son públicas, así que cambialas todas en la hoja Usuarios. Como mínimo, las de Aiello, Chazarreta y Gonzalez.

### 5. Opcional: contraseñas con hash
- En el editor de Apps Script, elegí la función `hashearContrasenas` y tocá ▶ Ejecutar.
- Cada contraseña de la hoja Usuarios pasa a verse como `sha256:...`. Así nadie que abra la planilla puede leerlas.
- Para cambiar una contraseña: escribila en texto en la hoja y volvé a ejecutar la función.

## Cómo probar
1. Entrá con un usuario supervisor: tiene que ver solo su sector.
2. Entrá con un admin: tiene que ver todo y poder elegir entre LP / MO / Ambas.
3. Abrí Planificación Horaria desde el panel: tiene que entrar sin pedir la contraseña.
4. En una pestaña de incógnito, abrí la URL del Apps Script: tiene que mostrar solo `{"ok":true,"servicio":"HR Nini",...}`, sin datos.

## Pendiente (no incluido en este cambio)
- **Historial de GitHub:** los commits viejos del repo todavía tienen los datos embebidos. Para borrarlos hay que reescribir el historial o crear un repo limpio.
- **Fotos:** la carpeta "Fotos Empleados" está compartida como "cualquiera con el link". El panel la necesita así para mostrar las fotos.
- **Academia:** el Apps Script de Academia (`statsRH`) no se revisó. Conviene revisar qué devuelve sin login.
