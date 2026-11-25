// ═══════════════════════════════════════════════════════════════════
// HRnini · Cálculo de liquidación final (solo rol administrador)
// Última actualización: 25/11/2026
//
// Estimación para negociar. NO reemplaza la liquidación oficial.
// Criterios (ver docs/liquidacion-final.md en el repo):
//  - Art. 245 LCT según Ley 27.802 (vigente desde 06/03/2026): mejor
//    remuneración mensual, normal y habitual; sin SAC, sin vacaciones, sin
//    premios no mensuales; variables solo si se cobraron en 6+ meses del
//    último año, por el promedio más favorable (6 o 12 meses); tope del
//    convenio con piso del 67 % (Vizzoti); mínimo 1 sueldo.
//  - Sumas no remunerativas: se incluyen (decisión de RRHH, 25/11/2026).
//  - Viáticos y comida de Camioneros: se excluyen (decisión de RRHH).
//  - Período de prueba: 6 meses, sin indemnización ni preaviso.
// ═══════════════════════════════════════════════════════════════════

const LIQ = (() => {
  const PRUEBA_MESES = 6;
  const PISO_VIZZOTI = 0.67;
  const MESES_HABITUAL = 6;

  const norm = (s) => String(s == null ? '' : s).toUpperCase().replace(/\s+/g, ' ').trim();
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  // Números escritos como 3846538.59, 3.846.538,59 o 3846538,59
  function numero(v) {
    if (typeof v === 'number') return v;
    let s = String(v == null ? '' : v).replace(/[$\s]/g, '');
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
    return Number(s) || 0;
  }

  // Fechas como "día" UTC para no tener problemas de horario.
  function fecha(y, m, d) { return new Date(Date.UTC(y, m, d)); }
  function parseFecha(v) {
    if (!v) return null;
    if (v instanceof Date && !isNaN(v)) return fecha(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate());
    const s = String(v).trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return fecha(+m[1], +m[2] - 1, +m[3]);
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (m) { let y = +m[3]; if (y < 100) y += 2000; return fecha(y, +m[2] - 1, +m[1]); }
    return null;
  }
  const diasEntre = (a, b) => Math.round((b - a) / 86400000);          // b - a, en días
  const ultimoDiaMes = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  function sumarMeses(f, n) {
    const y = f.getUTCFullYear(), m = f.getUTCMonth() + n, d = f.getUTCDate();
    const ud = ultimoDiaMes(y + Math.floor(m / 12), ((m % 12) + 12) % 12);
    return fecha(y, m, Math.min(d, ud));
  }
  const claveMes = (f) => f.getUTCFullYear() + '-' + String(f.getUTCMonth() + 1).padStart(2, '0');
  const fmtF = (f) => f ? String(f.getUTCDate()).padStart(2, '0') + '/' + String(f.getUTCMonth() + 1).padStart(2, '0') + '/' + f.getUTCFullYear() : '';

  // Antigüedad: años completos, meses y días restantes.
  function antiguedad(ingreso, egreso) {
    let anios = 0;
    while (sumarMeses(ingreso, 12 * (anios + 1)) <= egreso) anios++;
    const desdeAnios = sumarMeses(ingreso, 12 * anios);
    let meses = 0;
    while (sumarMeses(desdeAnios, meses + 1) <= egreso) meses++;
    const dias = diasEntre(sumarMeses(desdeAnios, meses), egreso);
    // "Fracción mayor de tres meses": más de 3 meses cumplidos (3 meses y 1 día o más)
    const fraccionMayor3 = meses > 3 || (meses === 3 && dias > 0);
    return { anios, meses, dias, aniosIndemn: anios + (fraccionMayor3 ? 1 : 0), totalDias: diasEntre(ingreso, egreso) };
  }

  // ── Clasificación de conceptos de la hoja Sueldos ──────────────
  // Tipos: FIJO, VARIABLE, NOREM, EXCLUIDO
  function clasificar(concepto, mapa) {
    const c = norm(concepto);
    if (mapa && mapa[c]) return mapa[c];
    if (/^(DESC|RET|APORTE|CONTRIB|IMP\.|CUOTA|SIND\.|CTA\.)/.test(c)) return 'EXCLUIDO';
    if (/S\.?A\.?C\.?/.test(c) || /VAC/.test(c)) return 'EXCLUIDO';
    return 'SIN_CLASIFICAR';
  }

  function mapaDesdeHoja(filas) {
    const m = {};
    (filas || []).forEach(f => {
      const c = norm(f['Concepto']);
      const t = norm(f['Tipo']);
      if (c && ['FIJO', 'VARIABLE', 'NOREM', 'EXCLUIDO'].includes(t)) m[c] = t;
    });
    return m;
  }

  function topeVigente(topes, convenio, egreso) {
    let conv = norm(convenio);
    let nota = '';
    if (conv.includes('FUERA')) { conv = 'COMERCIO'; nota = 'Fuera de convenio: se usa el tope de Comercio (CCT del establecimiento).'; }
    const filas = (topes || [])
      .map(t => ({ conv: norm(t['Convenio']), desde: parseFecha(t['Vigencia desde']), tope: numero(t['Tope']), fuente: t['Fuente'] || '' }))
      .filter(t => t.conv === conv && t.tope > 0 && t.desde)
      .sort((a, b) => a.desde - b.desde);
    if (!filas.length) return { tope: 0, desde: null, fuente: '', nota: nota || 'No hay tope cargado para ' + convenio + ' en la hoja Topes.' };
    let elegido = filas[0];
    filas.forEach(f => { if (f.desde <= egreso) elegido = f; });
    return { tope: elegido.tope, desde: elegido.desde, fuente: elegido.fuente, nota };
  }

  // ── Cálculo principal ──────────────────────────────────────────
  function calcular(p) {
    const notas = [];
    const ingreso = parseFecha(p.fechaIngreso);
    const egreso = parseFecha(p.fechaEgreso);
    if (!ingreso) throw new Error('No se pudo leer la fecha de ingreso de la nómina.');
    if (!egreso) throw new Error('Cargá la fecha de egreso.');
    if (egreso < ingreso) throw new Error('La fecha de egreso es anterior al ingreso.');

    const mapa = p.mapaConceptos || {};
    const antig = antiguedad(ingreso, egreso);
    const enPrueba = sumarMeses(ingreso, PRUEBA_MESES) > egreso;
    if (enPrueba) notas.push('Está dentro del período de prueba (' + PRUEBA_MESES + ' meses): no corresponde indemnización ni preaviso.');

    // Agrupar sueldos por mes
    const meses = {};          // 'YYYY-MM' → {fijo, norem, variables:{}, total, conceptos:[]}
    const sinClasificar = {};
    const mesesConVac = new Set();
    (p.filasSueldo || []).forEach(f => {
      const mes = String(f.Mes || f.mes || '').trim().slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(mes)) return;
      const concepto = norm(f.Novedad || f.novedad || f.Concepto);
      const monto = numero(f.Monto);
      if (!meses[mes]) meses[mes] = { fijo: 0, norem: 0, variables: {}, conceptos: [] };
      const tipo = clasificar(concepto, mapa);
      if (/VACACIONES/.test(concepto)) mesesConVac.add(mes);
      const M = meses[mes];
      if (tipo === 'FIJO') { M.fijo += monto; M.conceptos.push([concepto, monto, 'FIJO']); }
      else if (tipo === 'NOREM') { M.norem += monto; M.conceptos.push([concepto, monto, 'NOREM']); }
      else if (tipo === 'VARIABLE') { M.variables[concepto] = (M.variables[concepto] || 0) + monto; M.conceptos.push([concepto, monto, 'VARIABLE']); }
      else if (tipo === 'SIN_CLASIFICAR' && monto > 0) { sinClasificar[concepto] = (sinClasificar[concepto] || 0) + monto; }
    });

    // Ventana: últimos 12 meses calendario hasta el mes de egreso
    const mesEgreso = claveMes(egreso);
    const ventana12 = [];
    for (let i = 0; i < 12; i++) ventana12.push(claveMes(sumarMeses(fecha(egreso.getUTCFullYear(), egreso.getUTCMonth(), 1), -i)));
    const conDatos = ventana12.filter(k => meses[k]).sort();       // ascendente
    if (!conDatos.length) throw new Error('No hay sueldos cargados de esta persona en los 12 meses anteriores al egreso.');
    if (conDatos.length < 12) notas.push('Hay sueldos de ' + conDatos.length + ' de los últimos 12 meses (' + conDatos[0] + ' a ' + conDatos[conDatos.length - 1] + '). La base se calcula con esos meses.');
    const ultimo = conDatos[conDatos.length - 1];
    const ult6 = conDatos.slice(-6);

    // Variables habituales (6+ meses con cobro) y su promedio más favorable
    const todasVar = new Set();
    conDatos.forEach(k => Object.keys(meses[k].variables).forEach(c => todasVar.add(c)));
    const variables = [];
    todasVar.forEach(c => {
      const cobros = conDatos.filter(k => (meses[k].variables[c] || 0) > 0).length;
      const suma12 = conDatos.reduce((s, k) => s + (meses[k].variables[c] || 0), 0);
      const suma6 = ult6.reduce((s, k) => s + (meses[k].variables[c] || 0), 0);
      const prom12 = suma12 / conDatos.length;
      const prom6 = suma6 / ult6.length;
      const habitual = cobros >= MESES_HABITUAL;
      variables.push({ concepto: c, mesesCobrados: cobros, prom6: r2(prom6), prom12: r2(prom12), usado: habitual ? r2(Math.max(prom6, prom12)) : 0, criterio: habitual ? (prom6 >= prom12 ? 'promedio 6 meses' : 'promedio 12 meses') : 'no habitual (menos de ' + MESES_HABITUAL + ' meses)', habitual });
    });
    variables.sort((a, b) => b.usado - a.usado);
    const promVariables = variables.reduce((s, v) => s + v.usado, 0);

    // Mejor mes (fijos + no remunerativos)
    let mejorMes = conDatos[0];
    conDatos.forEach(k => { if (meses[k].fijo + meses[k].norem > meses[mejorMes].fijo + meses[mejorMes].norem) mejorMes = k; });
    const MM = meses[mejorMes];
    const base = r2(MM.fijo + MM.norem + promVariables);
    const sueldoNormal = r2(meses[ultimo].fijo + meses[ultimo].norem + promVariables);
    if (base <= 0) throw new Error('No se encontraron conceptos remunerativos para calcular la base. Revisá la hoja ConceptosLiquidacion.');

    // Tope del convenio
    const tv = topeVigente(p.topes, p.convenio, egreso);
    const tope = p.topeManual > 0 ? Number(p.topeManual) : tv.tope;
    if (tv.nota) notas.push(tv.nota);
    if (p.topeManual > 0) notas.push('Se usó un tope cargado a mano: $' + tope.toLocaleString('es-AR') + '.');
    else if (tv.desde) {
      const mesesTope = (egreso.getUTCFullYear() - tv.desde.getUTCFullYear()) * 12 + egreso.getUTCMonth() - tv.desde.getUTCMonth();
      if (mesesTope > 3) notas.push('El tope de ' + p.convenio + ' cargado es de ' + fmtF(tv.desde) + ' (hace ' + mesesTope + ' meses). Puede estar desactualizado: verificalo antes de negociar.');
    }
    let baseTopeada = base, topeAplicado = false, pisoAplicado = false;
    if (tope > 0 && base > tope) {
      topeAplicado = true;
      baseTopeada = tope;
      if (tope < base * PISO_VIZZOTI) { baseTopeada = base * PISO_VIZZOTI; pisoAplicado = true; }
    }
    baseTopeada = r2(baseTopeada);

    // Art. 245
    let indem245 = 0;
    if (!enPrueba) {
      indem245 = baseTopeada * antig.aniosIndemn;
      if (indem245 < base) { indem245 = base; notas.push('Se aplica el mínimo legal de 1 sueldo (art. 245).'); }
    }
    indem245 = r2(indem245);

    // Días trabajados del mes de egreso
    const d = egreso.getUTCDate();
    const udm = ultimoDiaMes(egreso.getUTCFullYear(), egreso.getUTCMonth());
    const esUltimoDia = d === udm;
    const diasTrab = r2(esUltimoDia ? sueldoNormal : sueldoNormal / 30 * Math.min(d, 30));

    // Preaviso e integración (si no se otorgó preaviso)
    const mesesPreaviso = enPrueba ? 0 : (antig.anios >= 5 && (antig.anios > 5 || antig.meses > 0 || antig.dias > 0) ? 2 : 1);
    const preaviso = r2(p.preavisoOtorgado || enPrueba ? 0 : sueldoNormal * mesesPreaviso);
    const integracion = r2(p.preavisoOtorgado || enPrueba || esUltimoDia ? 0 : Math.max(0, sueldoNormal - diasTrab));

    // SAC proporcional del semestre
    const semIni = fecha(egreso.getUTCFullYear(), egreso.getUTCMonth() < 6 ? 0 : 6, 1);
    const semFin = fecha(egreso.getUTCFullYear(), egreso.getUTCMonth() < 6 ? 5 : 11, egreso.getUTCMonth() < 6 ? 30 : 31);
    const desdeSem = ingreso > semIni ? ingreso : semIni;
    const diasSem = diasEntre(desdeSem, egreso) + 1;
    const totalSem = diasEntre(semIni, semFin) + 1;
    const mesesSem = conDatos.filter(k => k >= claveMes(semIni) && k <= mesEgreso);
    let mejorSem = 0, mesMejorSem = '';
    mesesSem.forEach(k => {
      const tot = meses[k].fijo + meses[k].norem + Object.values(meses[k].variables).reduce((a, b) => a + b, 0);
      if (tot > mejorSem) { mejorSem = tot; mesMejorSem = k; }
    });
    if (!mejorSem) { mejorSem = sueldoNormal; mesMejorSem = 'sueldo normal'; }
    const sacProp = r2(mejorSem / 2 * diasSem / totalSem);

    // Vacaciones no gozadas (art. 156)
    const antig31 = antiguedad(ingreso, fecha(egreso.getUTCFullYear(), 11, 31));
    const diasVacAnio = antig31.anios < 5 ? 14 : antig31.anios < 10 ? 21 : antig31.anios < 20 ? 28 : 35;
    const inicioAnio = fecha(egreso.getUTCFullYear(), 0, 1);
    const desdeAnio = ingreso > inicioAnio ? ingreso : inicioAnio;
    const diasTrabAnio = diasEntre(desdeAnio, egreso) + 1;
    const vacProp = diasVacAnio * diasTrabAnio / 365;
    const gozadas = Math.max(0, Number(p.vacGozadasAnio) || 0);
    const pendientes = Math.max(0, Number(p.vacPendientes) || 0);
    const vacDias = Math.round((Math.max(0, vacProp - gozadas) + pendientes) * 100) / 100;
    const valorDiaVac = sueldoNormal / 25;
    const vacaciones = r2(vacDias * valorDiaVac);
    const mesesVac = [...mesesConVac].filter(k => k.startsWith(String(egreso.getUTCFullYear()))).sort();
    if (mesesVac.length && !gozadas) notas.push('En ' + mesesVac.join(', ') + ' figuran conceptos de vacaciones: si ya gozó vacaciones de este año, cargá los días en "Vacaciones ya gozadas".');

    const sacSobre = (x) => r2(x / 12);
    const rub = {
      indem245, indem247: r2(indem245 * 0.5),
      preaviso, sacPreaviso: sacSobre(preaviso),
      integracion, sacIntegracion: sacSobre(integracion),
      diasTrab, sacProp, vacaciones, sacVacaciones: sacSobre(vacaciones),
    };
    const final = r2(rub.diasTrab + rub.sacProp + rub.vacaciones + rub.sacVacaciones);
    const indemnizatorios = r2(rub.preaviso + rub.sacPreaviso + rub.integracion + rub.sacIntegracion);
    const escenarios = {
      sinCausa: r2(rub.indem245 + indemnizatorios + final),
      faltaTrabajo: r2(rub.indem247 + indemnizatorios + final),
      conCausa: final,
    };

    const sinClas = Object.keys(sinClasificar).sort();
    if (sinClas.length) notas.push('Conceptos sin clasificar (no se tomaron en la base): ' + sinClas.join(', ') + '. Agregalos en la hoja ConceptosLiquidacion.');

    return {
      ingreso: fmtF(ingreso), egreso: fmtF(egreso), antig, enPrueba,
      base, sueldoNormal, mejorMes, mesFijo: r2(MM.fijo), mesNorem: r2(MM.norem), conceptosMejorMes: MM.conceptos,
      ultimoMes: ultimo, mesesConDatos: conDatos, variables, promVariables: r2(promVariables),
      tope, topeDesde: tv.desde ? fmtF(tv.desde) : '', topeFuente: tv.fuente, topeAplicado, pisoAplicado, baseTopeada,
      mesesPreaviso, diasSem, totalSem, mejorSem: r2(mejorSem), mesMejorSem,
      diasVacAnio, diasTrabAnio, vacProp: r2(vacProp), vacDias, valorDiaVac: r2(valorDiaVac),
      rubros: rub, final, indemnizatorios, escenarios, notas, sinClasificar: sinClas,
    };
  }

  return { calcular, numero, mapaDesdeHoja, clasificar, parseFecha, antiguedad, norm, topeVigente };
})();

if (typeof module !== 'undefined') module.exports = LIQ;
