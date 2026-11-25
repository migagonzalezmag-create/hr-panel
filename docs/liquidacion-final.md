Calculadora de liquidación final del panel HRnini: qué calcula, con qué criterios, de dónde saca los datos y cómo se mantiene. Última actualización: 25/11/2026.

# Liquidación final (panel HRnini)

## Para qué sirve
Estimar cuánto cobraría una persona según cómo termine la relación, para preparar una negociación. La ve **solo el rol administrador**.

- Se escribe el legajo o el nombre y se completan unos pocos datos.
- La calculadora muestra tres escenarios y un simulador de arreglo.

**Es una estimación para negociar.** No reemplaza la liquidación oficial del liquidador ni el asesoramiento legal. Los montos son brutos: antes de aportes y de Ganancias.

## Qué se carga a mano
| Campo | Para qué |
|---|---|
| Legajo o nombre | Busca a la persona en la nómina. |
| Fecha de egreso | Define antigüedad, días del mes, SAC y vacaciones. |
| ¿Se otorgó preaviso? | Si ya se preavisó, no se pagan preaviso ni integración. |
| Vacaciones pendientes de años anteriores | Días que no gozó de años anteriores (se suman). |
| Vacaciones de este año ya gozadas | Se descuentan de las proporcionales del año. La calculadora avisa si ve conceptos de vacaciones en los sueldos del año. |
| Tope del convenio (opcional) | Reemplaza el tope de la hoja Topes solo para ese cálculo. |

## Escenarios
| Rubro | Sin causa (art. 245) | Falta de trabajo (art. 247) | Con causa / renuncia |
|---|---|---|---|
| Indemnización por antigüedad | 100 % | 50 % | — |
| Preaviso (si no se otorgó) + SAC | Sí | Sí | — |
| Integración del mes de despido + SAC | Sí | Sí | — |
| Días trabajados del mes | Sí | Sí | Sí |
| SAC proporcional | Sí | Sí | Sí |
| Vacaciones no gozadas + SAC | Sí | Sí | Sí |

**Simulador de arreglo:**
- Calcula el monto al 50, 60, 70, 80 y 100 %, más un porcentaje libre, **siempre sobre el total del despido sin causa** (decisión del 25/11/2026).
- Avisa si el arreglo queda por debajo de la liquidación final, que se debe igual en cualquier caso.

**Referencia histórica:**
- Muestra el % pagado en arreglos de los últimos 3 años de la hoja Negociaciones: general, del mismo sector y de la misma sede.
- Ojo: en esa hoja el % se calcula como Monto negociado ÷ Indem Ley, y puede no incluir los mismos rubros.

## Criterios de cálculo

### Base de la indemnización (art. 245 LCT, texto de la Ley 27.802)
La Ley 27.802 rige desde el 06/03/2026. La cautelar de la CGT fue dejada sin efecto en abril de 2026.

1. **Mes:** se busca el mejor mes de los últimos 12 sumando los conceptos **fijos** y los **no remunerativos**.
   - Los descuentos por ausencias o licencias no se restan, porque la base es la remuneración **normal** del mes.
2. **Variables:** se suman las variables **habituales**: horas extra, plus nocturno, domingos, feriados, comisiones y adicional variable.
   - Un concepto es habitual si se cobró en **6 meses o más** del período.
   - Se toma su **promedio más favorable**: el de los últimos 6 meses o el del período completo.
3. **Quedan afuera:** SAC, vacaciones, premios no mensuales, ajustes retroactivos, licencias, descuentos, aportes y contribuciones.
4. **Sumas no remunerativas:** **se incluyen**, con el criterio de la jurisprudencia (Pérez c/ Disco, González c/ Polimat). Decisión de RRHH del 25/11/2026.
5. **Viáticos y comida de Camioneros** (4.1.12, 4.1.13, adicional viático/comida): **se excluyen**. Decisión de RRHH del 25/11/2026.
6. **Tope:** si la base supera el tope del convenio, se usa el tope. Pero la base nunca baja del **67 %** de la remuneración real (criterio Vizzoti, incorporado al art. 245).
   - Fuera de convenio usa el tope de Comercio.
7. **Indemnización:** base × años de antigüedad.
   - Una fracción de **más de 3 meses** cuenta como un año más.
   - La indemnización nunca es menor que **1 sueldo**.
8. **Período de prueba:** 6 meses. Dentro de ese período no hay indemnización ni preaviso.

### Otros rubros
- **Sueldo normal:** fijos y no remunerativos del último mes con datos, más las variables habituales. Se usa para preaviso, días trabajados y vacaciones.
- **Preaviso:** 1 mes si la antigüedad es de hasta 5 años y 2 meses si es mayor. Más SAC (÷ 12).
- **Integración del mes:** lo que falta para completar el mes de egreso, si no se preavisó y el egreso no cae el último día. Más SAC.
- **Días trabajados:** sueldo normal ÷ 30 × día de egreso. Si el egreso es el último día del mes, se paga el mes completo.
- **SAC proporcional:** mejor remuneración del semestre ÷ 2 × días trabajados en el semestre ÷ días del semestre.
- **Vacaciones:**
  - Días por antigüedad al 31/12: 14, 21, 28 o 35.
  - Se pagan proporcionales a los días trabajados en el año, menos los ya gozados, más los pendientes de años anteriores.
  - Valor del día: sueldo normal ÷ 25. Más SAC.
- **No incluye** multas, rubros reclamables ni intereses.

## De dónde salen los datos
| Dato | Origen |
|---|---|
| Ingreso, convenio, sector, sede | Hoja `mod35071` (nómina) |
| Sueldos | Hoja `Sueldos`. El servidor envía **solo las filas de la persona consultada** |
| Clasificación de conceptos | Hoja `ConceptosLiquidacion` (Concepto, Tipo, Nota) |
| Topes | Hoja `Topes` (Convenio, Vigencia desde, Tope, Fuente, Nota) |
| Arreglos anteriores | Hoja `Negociaciones` |

Las hojas `Topes` y `ConceptosLiquidacion` solo las puede pedir el administrador.

## Mantenimiento

### Topes (hoja Topes)
Cuando sale un tope nuevo, se agrega **una fila nueva** con convenio, fecha de vigencia (AAAA-MM-DD), monto y fuente. No hay que borrar las anteriores: la calculadora usa la última vigente a la fecha de egreso.

Valores cargados el 25/11/2026 (los últimos oficiales encontrados):

| Convenio | Vigencia | Tope | Fuente | Estado |
|---|---|---|---|---|
| Comercio (CCT 130/75) | 01/03/2026 | $ 3.846.538,59 | Disposición 254/2026 | Hay acuerdos posteriores sin tope publicado |
| Camioneros (CCT 40/89) | 01/08/2025 | $ 2.609.502,42 | Disposición 2849/2025 | **Desactualizado** |
| Viajantes (CCT 308/75) | 01/08/2024 | $ 1.830.000,00 | DI-2025-00413198-APN-DTRT#MCH | **Desactualizado** |

Si el tope tiene más de 3 meses, la calculadora avisa. **Conviene pedir los topes vigentes de Camioneros y Viajantes al liquidador.** Un tope viejo y más bajo puede dar una indemnización menor que la real.

### Conceptos (hoja ConceptosLiquidacion)
- Tipos posibles: `FIJO`, `VARIABLE`, `NOREM`, `EXCLUIDO`.
- Si aparece un concepto nuevo en Sueldos que no está en la hoja, la calculadora lo avisa como "sin clasificar" y **no lo toma**. Para corregirlo, se agrega una fila con el tipo que corresponda.
- **A revisar:**
  - `PTO. 4 CONDICION.`: se tomó como fijo.
  - `BILLETERA`: excluido. No se sabe si es remunerativo y mensual.
  - `CCT 308/75`: excluido. Parece un aporte de Viajantes.

## Limitaciones conocidas
- **Pocos meses de sueldos:** la hoja Sueldos tiene datos desde abril de 2026 (7 meses), y a algunas personas les falta mayo. La base se calcula con los meses disponibles y la calculadora lo avisa. Para que un variable sea habitual con 6 meses de datos, tiene que aparecer en todos.
- **Bono en cuotas:** `SUMA NO REMUNERAT.` mezcla la suma fija mensual con el bono extraordinario en cuotas de Comercio. Como no se pueden separar, ese mes puede quedar algo más alto.
- **Liquidación oficial:** el cálculo no reemplaza el criterio del liquidador ni del estudio jurídico.

## Archivos
- Cálculo: `liquidacion.js` (repo hr-panel).
- Pantalla: pestaña "Liquidación final" en `index.html`.
- Servidor: `apps-script/Seguridad.gs`, acción `sueldosLegajo` y hojas Topes y ConceptosLiquidacion (Apps Script "Hr nini", versión 7 del 25/11/2026).
