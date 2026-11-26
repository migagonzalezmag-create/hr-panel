// ═══════════════════════════════════════════════════════════════════
// HR NINI · SEGURIDAD (login en el servidor + datos según el rol)
// Última actualización: 25/11/2026 (agrega liquidación final)
//
// Qué hace:
//  - El usuario y la contraseña se validan acá, en el servidor. El panel
//    ya no descarga la hoja Usuarios ni tiene contraseñas en su código.
//  - Al entrar, el servidor entrega un "token" (una llave temporal de 6 h).
//    Cada pedido de datos tiene que traer ese token.
//  - Cada rol recibe solo las hojas que le corresponden, y supervisores y
//    analistas con sucursal reciben solo las filas de su gente.
//  - Nunca se envían DNI ni CUIL (el panel no los usa).
//  - Después de 5 intentos fallidos, el usuario queda bloqueado 15 minutos.
//
// Instalación: ver apps-script/INSTRUCTIVO.md en el repo.
// Este archivo reemplaza las funciones doGet y doPost de "Código.gs".
// El resto de Código.gs (guardarPlanificacion, actualizarEstado,
// mapearFotos, etc.) se deja como está.
// ═══════════════════════════════════════════════════════════════════

var SEG = {
  HOJA_USUARIOS: 'Usuarios',
  HOJA_NOMINA: 'mod35071',
  DURACION_SESION_SEG: 6 * 60 * 60,   // 6 horas (máximo que permite CacheService)
  MAX_INTENTOS: 5,
  BLOQUEO_SEG: 15 * 60,

  // Columnas que nunca salen del servidor, en ninguna hoja.
  COLUMNAS_OCULTAS: ['Documento', 'Cuit', 'CUIT', 'CUIL', 'Cuil', 'DNI', 'Contraseña', 'Contrasena', 'contrasena'],

  // Qué roles pueden pedir cada hoja.
  //  modo 'texto': valores como se ven en la planilla (igual que el CSV publicado de antes)
  //  modo 'valores': valores crudos (igual que el Apps Script de antes)
  //  filtro: cómo se recortan las filas para supervisores / analistas con sucursal
  HOJAS: {
    'mod35071':      { roles: ['admin', 'director', 'analyst', 'supervisor'], modo: 'texto',   filtro: 'nomina' },
    'Fotos':         { roles: ['admin', 'director', 'analyst', 'supervisor'], modo: 'valores', filtro: 'legajo' },
    'Ausentismo':    { roles: ['admin', 'director', 'analyst', 'supervisor'], modo: 'valores', filtro: 'legajo' },
    'Licencias':     { roles: ['admin', 'director', 'analyst', 'supervisor'], modo: 'valores', filtro: 'legajo' },
    'Turnos':        { roles: ['admin', 'director', 'analyst', 'supervisor'], modo: 'valores', filtro: null },
    'Planificacion': { roles: ['admin', 'director', 'analyst', 'supervisor'], modo: 'valores', filtro: null },
    'Sueldos':       { roles: ['admin', 'director'],                          modo: 'texto',   filtro: null },
    'Negociaciones': { roles: ['admin', 'director'],                          modo: 'valores', filtro: null },
    // Liquidación final (solo administrador)
    'Topes':                { roles: ['admin'], modo: 'valores', filtro: null },
    'ConceptosLiquidacion': { roles: ['admin'], modo: 'texto', filtro: null },
    'Bajas':                { roles: ['admin', 'director'], modo: 'texto', filtro: null }
    // La hoja Usuarios no figura acá a propósito: no se entrega nunca.
  }
};


// ─── Puntos de entrada ─────────────────────────────────────────────

function doGet(e) {
  // Ya no se entregan datos por GET (antes cualquiera podía pedir ?sheet=...).
  return seg_json_({ ok: true, servicio: 'HR Nini', mensaje: 'Usá el panel para acceder a los datos.' });
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var accion = body.action || body.accion || '';

    if (accion === 'login')  return seg_json_(seg_login_(body));
    if (accion === 'logout') return seg_json_(seg_logout_(body));

    // De acá en adelante, todo requiere una sesión válida.
    var usuario = seg_sesion_(body.token);
    if (!usuario) return seg_json_({ error: 'Sesión vencida o inválida. Volvé a ingresar.', code: 'AUTH' });

    if (accion === 'datos') return seg_json_(seg_datos_(usuario, body.hoja));
    if (accion === 'yo')    return seg_json_({ ok: true, usuario: usuario });
    if (accion === 'alertasVariables') {
      if (usuario.rol !== 'admin') return seg_json_({ error: 'Solo el administrador', code: 'PERM' });
      return seg_json_(seg_alertasVariables_());
    }
    if (accion === 'sancionesLegajo') {
      if (['admin', 'director', 'analyst', 'supervisor'].indexOf(usuario.rol) < 0) return seg_json_({ error: 'Sin permiso', code: 'PERM' });
      return seg_json_(seg_sancionesLegajo_(usuario, body.legajo));
    }
    if (accion === 'sueldosLegajo') {
      if (usuario.rol !== 'admin') return seg_json_({ error: 'Solo el administrador puede ver la liquidación final', code: 'PERM' });
      return seg_json_(seg_sueldosLegajo_(body.legajo));
    }

    // Acciones de Planificación Horaria (funciones de Código.gs)
    if (accion === 'guardarPlanificacion') {
      if (['admin', 'analyst', 'supervisor'].indexOf(usuario.rol) < 0) return seg_json_({ error: 'Sin permiso', code: 'PERM' });
      return guardarPlanificacion(body);
    }
    if (accion === 'actualizarEstado') {
      if (['admin', 'analyst'].indexOf(usuario.rol) < 0) return seg_json_({ error: 'Sin permiso', code: 'PERM' });
      body.aprobador = usuario.nombreReal || usuario.nombre;   // el aprobador lo pone el servidor
      return actualizarEstado(body);
    }

    return seg_json_({ error: 'Acción no reconocida: ' + accion });
  } catch (err) {
    return seg_json_({ error: err.message });
  }
}


// ─── Liquidación final: sueldos de UNA persona ─────────────────────
// Devuelve solo las filas de la hoja Sueldos de ese legajo (no toda la hoja).
function seg_sueldosLegajo_(legajo) {
  var leg = String(legajo || '').trim().replace(/\.0+$/, '');
  if (!leg) return { error: 'Falta el legajo' };
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sueldos');
  if (!sheet) return { error: 'No existe la hoja Sueldos' };
  var rango = sheet.getDataRange();
  var val = rango.getValues();
  var txt = rango.getDisplayValues();
  var enc = txt[0].map(function (h) { return String(h).trim(); });
  var iL = enc.indexOf('Legajo'), iN = enc.indexOf('Novedad'), iM = enc.indexOf('Monto'), iMes = enc.indexOf('Mes');
  if (iL < 0 || iN < 0 || iM < 0 || iMes < 0) return { error: 'La hoja Sueldos no tiene las columnas Legajo, Novedad, Monto y Mes' };
  var out = [];
  for (var i = 1; i < val.length; i++) {
    if (String(txt[i][iL]).trim().replace(/\.0+$/, '') !== leg) continue;
    var monto = val[i][iM];
    if (typeof monto !== 'number') monto = Number(String(txt[i][iM]).replace(/\./g, '').replace(',', '.')) || 0;
    out.push({ Novedad: String(txt[i][iN]), Monto: monto, Mes: String(txt[i][iMes]).trim() });
  }
  return out;
}


// ─── Ficha 360: sanciones de UNA persona ───────────────────────────
// Lee la hoja "Sanciones", donde se pega tal cual el reporte del sistema
// san_historialporlegajo (con sus encabezados: fklegajo, fecnov, sancion...).
// Devuelve solo las filas de ese legajo que tienen sanción. Las filas sin
// sanción son "casos" que genera el sistema y no se usan.
// Supervisores y analistas con sucursal solo ven legajos de su alcance.
function seg_sancionesLegajo_(usuario, legajo) {
  var norm = function (v) { var s = String(v == null ? '' : v).trim().replace(/\.0+$/, ''); var n = parseInt(s, 10); return isNaN(n) ? s : String(n); };
  var leg = norm(legajo);
  if (!leg) return { error: 'Falta el legajo' };

  var alcance = seg_alcance_(usuario);
  if (alcance) {
    var permitido = false;
    seg_leerHoja_(SEG.HOJA_NOMINA, 'texto').forEach(function (e) {
      if (norm(e['Legajo']) === leg && alcance.empleado(e)) permitido = true;
    });
    if (!permitido) return [];
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sanciones');
  if (!sheet) return { error: 'No existe la hoja Sanciones en Base Nini' };
  var val = sheet.getDataRange().getValues();
  if (!val.length) return [];
  var enc = val[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var col = function (n) { return enc.indexOf(n); };
  var iL = col('fklegajo'), iS = col('sancion');
  if (iL < 0 || iS < 0) return { error: 'La hoja Sanciones no tiene las columnas fklegajo y sancion del reporte del sistema' };
  var campos = ['fecnov', 'sancion', 'motivo', 'docfalta', 'docsancion', 'diassusp', 'fecdessusp', 'fecreinteg', 'fkusuario', 'descargo'];

  var out = [];
  for (var i = 1; i < val.length; i++) {
    if (norm(val[i][iL]) !== leg) continue;
    if (!String(val[i][iS]).trim()) continue;
    var obj = {};
    campos.forEach(function (c) {
      var j = col(c); if (j < 0) return;
      var v = val[i][j];
      obj[c] = (v instanceof Date) ? Utilities.formatDate(v, 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd') : (typeof v === 'string' ? v.trim() : v);
    });
    out.push(obj);
  }
  return out;
}


// ─── Inicio: variables que son o están por volverse habituales ─────
// Recorre la hoja Sueldos y, por persona y concepto variable (según la
// hoja ConceptosLiquidacion), cuenta en cuántos meses se cobró.
//  - habitual: 6 meses o más (entra en la base de la indemnización)
//  - por volverse habitual: 5 meses y lo cobró el último mes
function seg_alertasVariables_() {
  var cache = CacheService.getScriptCache();
  var guardado = cache.get('alertasVariables');
  if (guardado) return JSON.parse(guardado);

  var tipos = {};
  seg_leerHoja_('ConceptosLiquidacion', 'texto').forEach(function (f) {
    tipos[String(f['Concepto']).toUpperCase().replace(/\s+/g, ' ').trim()] = String(f['Tipo']).toUpperCase().trim();
  });
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sueldos');
  var txt = sheet.getDataRange().getDisplayValues();
  var enc = txt[0].map(function (h) { return String(h).trim(); });
  var iL = enc.indexOf('Legajo'), iN = enc.indexOf('Novedad'), iM = enc.indexOf('Monto'), iMes = enc.indexOf('Mes');
  var meses = {}, cobros = {};      // cobros[legajo|concepto] = {mes: monto}
  for (var i = 1; i < txt.length; i++) {
    var mes = String(txt[i][iMes]).trim().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(mes)) continue;
    meses[mes] = true;
    var con = String(txt[i][iN]).toUpperCase().replace(/\s+/g, ' ').trim();
    if (tipos[con] !== 'VARIABLE') continue;
    var monto = Number(String(txt[i][iM]).replace(/\./g, '').replace(',', '.')) || 0;
    if (monto <= 0) continue;
    var k = String(txt[i][iL]).trim().replace(/\.0+$/, '') + '|' + con;
    if (!cobros[k]) cobros[k] = {};
    cobros[k][mes] = (cobros[k][mes] || 0) + monto;
  }
  var lista = Object.keys(meses).sort().slice(-12);
  var ultimo = lista[lista.length - 1];
  var out = { meses: lista, items: [] };
  Object.keys(cobros).forEach(function (k) {
    var c = cobros[k];
    var enVentana = lista.filter(function (m) { return c[m] > 0; });
    var n = enVentana.length;
    var estado = n >= 6 ? 'habitual' : (n === 5 && c[ultimo] > 0 ? 'por volverse habitual' : '');
    if (!estado) return;
    var suma = enVentana.reduce(function (s, m) { return s + c[m]; }, 0);
    var partes = k.split('|');
    out.items.push({ legajo: partes[0], concepto: partes[1], meses: n, total: lista.length, promedio: Math.round(suma / lista.length), estado: estado });
  });
  var json = JSON.stringify(out);
  if (json.length < 90000) cache.put('alertasVariables', json, 3600);   // 1 hora
  return out;
}


// ─── Login / sesión ────────────────────────────────────────────────

function seg_login_(body) {
  var user = String(body.usuario || '').trim().toLowerCase();
  var pass = String(body.contrasena || '').trim();
  if (!user || !pass) return { error: 'Completá usuario y contraseña' };

  var cache = CacheService.getScriptCache();
  var claveFallos = 'fallos_' + user;
  var fallos = Number(cache.get(claveFallos) || 0);
  if (fallos >= SEG.MAX_INTENTOS) {
    return { error: 'Demasiados intentos. Probá de nuevo en 15 minutos.' };
  }

  var filas = seg_leerHoja_(SEG.HOJA_USUARIOS, 'texto');
  var encontrado = null;
  for (var i = 0; i < filas.length; i++) {
    var u = filas[i];
    var nombreU = String(u['Usuario'] || '').trim().toLowerCase();
    if (nombreU && nombreU === user && seg_passOk_(String(u['Contraseña'] || '').trim(), pass)) {
      encontrado = u;
      break;
    }
  }

  if (!encontrado) {
    cache.put(claveFallos, String(fallos + 1), SEG.BLOQUEO_SEG);
    Utilities.sleep(800); // frena los intentos automáticos
    return { error: 'Usuario o contraseña incorrectos' };
  }
  cache.remove(claveFallos);

  var perfil = {
    nombre:     String(encontrado['Usuario'] || '').trim(),
    nombreReal: String(encontrado['Nombre'] || '').trim(),
    rol:        String(encontrado['Rol'] || 'analyst').trim().toLowerCase(),
    sector:     String(encontrado['Sector'] || '').trim(),
    sucursal:   String(encontrado['Sucursal'] || '').trim()
  };
  var token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
  cache.put('tok_' + token, JSON.stringify(perfil), SEG.DURACION_SESION_SEG);
  return { ok: true, token: token, usuario: perfil };
}

function seg_logout_(body) {
  if (body.token) CacheService.getScriptCache().remove('tok_' + body.token);
  return { ok: true };
}

function seg_sesion_(token) {
  if (!token) return null;
  var v = CacheService.getScriptCache().get('tok_' + token);
  return v ? JSON.parse(v) : null;
}

// Acepta contraseñas en texto (como están hoy) o con hash "sha256:..."
// (ver la función hashearContrasenas más abajo).
function seg_passOk_(guardada, ingresada) {
  if (!guardada) return false;
  if (guardada.indexOf('sha256:') === 0) return guardada === 'sha256:' + seg_sha256_(ingresada);
  return guardada === ingresada;
}

function seg_sha256_(txt) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, txt, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}


// ─── Datos según el rol ────────────────────────────────────────────

function seg_datos_(usuario, hoja) {
  var conf = SEG.HOJAS[hoja];
  if (!conf) return { error: 'Hoja no disponible: ' + hoja, code: 'PERM' };
  if (conf.roles.indexOf(usuario.rol) < 0) return { error: 'Tu rol no tiene acceso a ' + hoja, code: 'PERM' };

  var filas = seg_leerHoja_(hoja, conf.modo);
  var alcance = seg_alcance_(usuario);   // null = ve todo

  if (alcance && conf.filtro === 'nomina') {
    filas = filas.filter(alcance.empleado);
  } else if (alcance && conf.filtro === 'legajo') {
    var legajos = seg_legajosDe_(alcance);
    filas = filas.filter(function (f) {
      return legajos[String(f['Legajo'] != null ? f['Legajo'] : (f['legajo'] || '')).trim()];
    });
  }
  return filas;
}

// Devuelve el recorte que le corresponde al usuario, igual que el filtro
// que el panel ya aplicaba en pantalla:
//  - supervisor con sector(es): sus sectores (y su sucursal, si tiene)
//  - analista con sucursal: su sucursal
//  - admin, dirección y el resto: todo
function seg_alcance_(u) {
  var suc = String(u.sucursal || '').trim().toLowerCase();
  var ubic = function (e) { return String(e['Ubicación'] || e['Ubicacion'] || '').trim().toLowerCase(); };

  if (u.rol === 'supervisor') {
    var sectores = String(u.sector || '').split(',').map(function (s) { return s.trim(); }).filter(String);
    if (!sectores.length) return null;
    return {
      empleado: function (e) {
        if (sectores.indexOf(String(e['Sector'] || '').trim()) < 0) return false;
        return suc ? ubic(e).indexOf(suc) >= 0 : true;
      }
    };
  }
  if (u.rol === 'analyst' && suc) {
    return { empleado: function (e) { return ubic(e) === suc; } };
  }
  return null;
}

function seg_legajosDe_(alcance) {
  var mapa = {};
  seg_leerHoja_(SEG.HOJA_NOMINA, 'texto').forEach(function (e) {
    if (alcance.empleado(e)) mapa[String(e['Legajo']).trim()] = true;
  });
  return mapa;
}

// Lee una hoja como lista de objetos {encabezado: valor}, sin columnas sensibles.
function seg_leerHoja_(nombre, modo) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombre);
  if (!sheet) throw new Error('Hoja no encontrada: ' + nombre);
  var rango = sheet.getDataRange();
  var datos = modo === 'texto' ? rango.getDisplayValues() : rango.getValues();
  if (!datos.length) return [];

  var enc = datos[0].map(function (h) { return String(h).trim(); });
  var esUsuarios = (nombre === SEG.HOJA_USUARIOS);
  var usar = [];
  for (var j = 0; j < enc.length; j++) {
    if (!enc[j]) continue;
    if (!esUsuarios && SEG.COLUMNAS_OCULTAS.indexOf(enc[j]) >= 0) continue;
    usar.push(j);
  }

  var out = [];
  for (var i = 1; i < datos.length; i++) {
    var fila = datos[i], vacia = true, obj = {};
    for (var k = 0; k < usar.length; k++) {
      var v = fila[usar[k]];
      if (v !== '' && v !== null) vacia = false;
      obj[enc[usar[k]]] = v;
    }
    if (!vacia) out.push(obj);
  }
  return out;
}

function seg_json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}


// ─── Opcional: guardar las contraseñas con hash ────────────────────
// Ejecutar a mano UNA vez desde el editor (botón ▶ con esta función).
// Reemplaza cada contraseña de la hoja Usuarios por "sha256:...".
// Después de eso nadie puede leer las contraseñas en la planilla, ni vos:
// para cambiar una, escribí la nueva en texto y volvé a ejecutar esta función.
function hashearContrasenas() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SEG.HOJA_USUARIOS);
  var datos = sheet.getDataRange().getValues();
  var col = datos[0].map(String).indexOf('Contraseña');
  if (col < 0) throw new Error('No encontré la columna Contraseña');
  var cambios = 0;
  for (var i = 1; i < datos.length; i++) {
    var p = String(datos[i][col] || '').trim();
    if (p && p.indexOf('sha256:') !== 0) {
      sheet.getRange(i + 1, col + 1).setValue('sha256:' + seg_sha256_(p));
      cambios++;
    }
  }
  Logger.log('Contraseñas convertidas: ' + cambios);
}
