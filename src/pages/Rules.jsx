import {
  BASE_FINE,
  MAX_FINE,
  WEEKLY_GOAL,
  EXTRA_LIFE_THRESHOLD,
  EXTRAS_PER_FINE_REDEMPTION,
  FINE_REDEMPTION_AMOUNT,
} from '../constants'
import { formatCLP } from '../constants'

const sections = [
  {
    icon: '🎯',
    title: 'Meta semanal',
    color: 'indigo',
    items: [
      `Cada miembro debe completar ${WEEKLY_GOAL} sesiones de ejercicio por semana (lunes a domingo).`,
      'Cada sesión requiere una foto como comprobante al momento de registrarla.',
      'El tipo de ejercicio y la duración son libres — lo importante es moverse.',
    ],
  },
  {
    icon: '💸',
    title: 'Multas',
    color: 'red',
    items: [
      `Multa base: ${formatCLP(BASE_FINE)} CLP. Si no cumples la meta, pagas.`,
      'Si fallas semanas consecutivas, la multa se duplica cada vez.',
      `Techo máximo: ${formatCLP(MAX_FINE)} CLP — no puede subir más.`,
      'Cuando cumples la meta, la multa se reduce a la mitad (piso: ${formatCLP(BASE_FINE)}).',
    ],
  },
  {
    icon: '❤️',
    title: 'Vidas extra',
    color: 'pink',
    items: [
      `Si completas ${EXTRA_LIFE_THRESHOLD} o más sesiones en una semana, ganas 1 vida extra.`,
      'Máximo 1 vida por semana.',
      'Una vida te cubre automáticamente si te falta exactamente 1 sesión al cerrar la semana.',
      'Las vidas acumuladas se guardan hasta que se necesiten.',
    ],
  },
  {
    icon: '🏦',
    title: 'Banco de extras (canje de multas)',
    color: 'emerald',
    items: [
      `Cada sesión por encima de la meta semanal (${WEEKLY_GOAL}) se guarda como "extra" en tu banco personal.`,
      `Cuando acumulas ${EXTRAS_PER_FINE_REDEMPTION} extras, se canjean automáticamente al cierre de semana: te descuentan ${formatCLP(FINE_REDEMPTION_AMOUNT)} de multa pendiente.`,
      'Si no tienes multa al momento del canje, los extras quedan guardados (sin tope) y esperan a la próxima multa.',
      'Las sesiones extra que ya se usaron para recuperar una semana congelada NO cuentan para el banco (no se contabilizan dos veces).',
      'Tampoco cuentan las sesiones de semanas que perdiste — solo si cumples la meta de esa semana entera.',
    ],
  },
  {
    icon: '🛡️',
    title: 'Escudo',
    color: 'yellow',
    items: [
      'Si completas 4 semanas consecutivas con éxito, ganas un Escudo.',
      'El Escudo absorbe la próxima multa pagando solo el 50%.',
      'Después de usarse, el Escudo se rompe y hay que ganarlo de nuevo.',
      'Las vidas usadas cuentan como semanas exitosas para el streak.',
    ],
  },
  {
    icon: '🧊',
    title: 'Congelar semanas (1 o más)',
    color: 'cyan',
    items: [
      'Si sabes que no podrás cumplir (viaje, vacaciones, etc.), puedes congelar una o más semanas — incluso la semana en curso.',
      `Por cada semana del rango eliges cuántas sesiones congelar (1, 2 o ${WEEKLY_GOAL}). Por defecto se congela completa.`,
      'Puedes editar o eliminar un congelamiento mientras esté activo (la ventana de recuperación se recalcula sola).',
    ],
  },
  {
    icon: '🔄',
    title: 'Recuperación automática (±3 semanas)',
    color: 'orange',
    items: [
      'Cuando congelas, generas una "deuda" igual al total de sesiones congeladas.',
      'Tienes ±3 semanas alrededor del rango congelado para pagar la deuda con sesiones extra (por encima de la meta semanal).',
      'Las sesiones extra dentro de la ventana se aplican automáticamente a la deuda; no necesitas elegir cuándo recuperarlas.',
      'Las sesiones que se usan para pagar deuda NO cuentan para la vida extra (umbral de 5 sesiones).',
      'La racha y el escudo siguen subiendo normal mientras cumplas la meta de cada semana.',
      'Si al cerrar la ventana queda deuda, se aplica una multa proporcional al nivel actual del usuario y la(s) semana(s) congelada(s) pasan a estado "multada".',
    ],
  },
  {
    icon: '🤖',
    title: 'Juez IA (justificación por sesión)',
    color: 'purple',
    items: [
      'Si no puedes cumplir por un imprevisto (enfermedad súbita, emergencia familiar, etc.), puedes presentar una justificación.',
      `Indicas cuántas sesiones quieres justificar (1, 2 o ${WEEKLY_GOAL}).`,
      `Si justificas menos del total, debes completar las restantes para evitar la multa. Ej: hiciste 1, justificas 1 → debes completar la última.`,
      'La IA evalúa tu excusa de forma estricta e imparcial.',
      'Solo se aceptan situaciones genuinamente imprevistas — con evidencia (foto, certificado médico).',
      '"No tuve tiempo", viajes planificados o cansancio NO son aceptados.',
    ],
  },
  {
    icon: '🚩',
    title: 'Reportar foto',
    color: 'amber',
    items: [
      'Si crees que una foto no corresponde a ejercicio real, puedes reportarla.',
      'Los demás miembros (excepto el dueño) votan: "Legítima" o "Falsa".',
      'Con 3 votos emitidos, si la mayoría dice "Falsa", el ejercicio se elimina automáticamente.',
      'El flagger vota automáticamente "Falsa" al reportar.',
    ],
  },
]

const colorMap = {
  indigo:  'bg-indigo-600/10  border-indigo-600/30  text-indigo-400',
  red:     'bg-red-600/10     border-red-600/30     text-red-400',
  pink:    'bg-pink-600/10    border-pink-600/30    text-pink-400',
  yellow:  'bg-yellow-600/10  border-yellow-600/30  text-yellow-400',
  cyan:    'bg-cyan-600/10    border-cyan-600/30    text-cyan-400',
  orange:  'bg-orange-600/10  border-orange-600/30  text-orange-400',
  purple:  'bg-purple-600/10  border-purple-600/30  text-purple-400',
  amber:   'bg-amber-600/10   border-amber-600/30   text-amber-400',
  emerald: 'bg-emerald-600/10 border-emerald-600/30 text-emerald-400',
}

// ── Changelog ──────────────────────────────────────────────────────
// Versioning:
//   - Major (vX): muchas mejoras nuevas / cambio de paradigma.
//   - Minor (vX.Y): nuevas features importantes.
//   - Patch (vX.Y.Z): bugfixes, ajustes menores.
// Más reciente primero.
const CHANGELOG = [
  {
    version: 'v1.7.0',
    date: '2026-06-10',
    type: 'minor',
    title: 'Cierre automático confiable, notificaciones sociales y app más rápida',
    items: [
      'El cierre de semana ahora corre solo en el servidor (lunes 00:10) — ya no depende de que alguien abra la app, y es imposible que se aplique dos veces.',
      'Push del resultado del cierre cada lunes: si cumpliste, tu multa, vidas y el pozo actualizado.',
      'Notificaciones cuando alguien de la familia entrena, comenta tu ejercicio, reacciona o necesita tu voto.',
      'Los recordatorios ahora saben si tu semana está congelada o justificada (no más avisos de más).',
      'Notificaciones en varios dispositivos a la vez (teléfono y computador).',
      'La app abre sin conexión (modo offline) y carga mucho más rápido: avatares 50 veces más livianos.',
      'Tu PIN ahora se guarda cifrado.',
    ],
  },
  {
    version: 'v1.6.0',
    date: '2026-05-25',
    type: 'minor',
    title: 'Banco de extras: canjea sesiones por multas',
    items: [
      `Cada sesión sobre la meta semanal se ahorra como "extra" en tu banco personal.`,
      `Al acumular ${EXTRAS_PER_FINE_REDEMPTION} extras, se canjean automáticamente al cierre de semana: ${formatCLP(FINE_REDEMPTION_AMOUNT)} menos de multa.`,
      'Los extras que pagan deuda de semanas congeladas NO entran al banco (no se cuentan dos veces).',
      'Si no tienes multa al momento del canje, los extras quedan ahorrados sin tope.',
      'Nuevo contador en tu tarjeta cuando tienes extras ahorrados o en camino.',
    ],
  },
  {
    version: 'v1.5.1',
    date: '2026-05-25',
    type: 'patch',
    title: 'Fix de subida de fotos (memoria insuficiente)',
    items: [
      'Compresión de imagen libera memoria agresivamente (decodificación + canvas).',
      'Preview con object URL en lugar de base64: ahorra varios MB de RAM por foto.',
      'Detecta dispositivos con poca RAM (≤4 GB) y comprime más fuerte.',
      'Mensajes de error específicos según tipo de fallo (cuota, permisos, conexión).',
    ],
  },
  {
    version: 'v1.5.0',
    date: '2026-05-23',
    type: 'minor',
    title: 'Congelamiento multi-semana + recuperación automática',
    items: [
      'Ahora puedes congelar un rango de días (no solo una semana) — incluida la semana en curso.',
      'Recuperación automática: las sesiones extra (>3 por semana) en ±3 semanas alrededor del rango pagan la deuda solas.',
      'Editar y eliminar tus congelamientos activos desde Admin.',
      'Contador "Recuperación pendiente" en tu tarjeta cuando estás dentro del rango con deuda.',
      'Pestaña de Reglas ahora incluye este Historial de cambios.',
    ],
  },
  {
    version: 'v1.4.0',
    date: '2026-05-18',
    type: 'minor',
    title: 'Calorías, gráficos de tendencia y mejoras de engagement',
    items: [
      'Tracking opcional de calorías por sesión (Stats: kcal totales y por sesión).',
      'Gráfico de tendencia con promedio móvil de 4 semanas.',
      '8 mejoras de engagement (recap mensual, bests personales, heatmap, etc.).',
    ],
  },
  {
    version: 'v1.3.1',
    date: '2026-05-18',
    type: 'patch',
    title: 'Cierre semanal robusto + Rewind Lock',
    items: [
      'Bug: las multas no se aplicaban si una semana fallaba silenciosamente. Ahora el lock avanza solo después de un cierre exitoso.',
      'Catch-up recorre desde la última procesada hasta la actual (antes solo procesaba la anterior).',
      'Botón "Rewind Lock" en Admin para reprocesar semanas pasadas a mano.',
      'Script de reset destructivo movido a dev-only y bloqueado tras prompt interactivo.',
    ],
  },
  {
    version: 'v1.3.0',
    date: '2026-05-06',
    type: 'minor',
    title: 'Stats expandidas y flexibilidad por sesión',
    items: [
      'Múltiples tipos de ejercicio por sesión.',
      'Stats con minutos y heatmap de intensidad.',
      'Comparaciones a nivel familia.',
      'Justificaciones por sesión (no por semana entera).',
      'Congelamiento parcial: 1, 2 o 3 sesiones por semana.',
    ],
  },
  {
    version: 'v1.2.0',
    date: '2026-02-23',
    type: 'minor',
    title: 'Engagement, PWA y Stats',
    items: [
      'Pestaña de Reglas + reacciones con emoji en el feed.',
      'Cierre semanal automático.',
      'PWA: instala FitFamily como app nativa.',
      'Notificaciones push reales (VAPID).',
      'Pestaña de Estadísticas.',
      'Avatares pixel-art para Fran.',
      'Easter eggs: 7× toque al título → Modo Leyenda · 10× toque al pozo → minijuego.',
    ],
  },
  {
    version: 'v1.1.0',
    date: '2026-02-17',
    type: 'minor',
    title: 'Capa de gamificación',
    items: [
      'Escudo: 4 semanas exitosas seguidas → 50% de descuento en la próxima multa.',
      'Juez IA: justifica una semana fallada con una excusa (la IA evalúa).',
      'Sistema de apelaciones para justificaciones rechazadas.',
      'Avatares con estados de ánimo (feliz / neutral / triste según racha).',
      'Sistema de reporte de fotos sospechosas con votación familiar.',
      'Compresión de imágenes al subir.',
    ],
  },
  {
    version: 'v1.0.0',
    date: '2026-02-17',
    type: 'major',
    title: 'Lanzamiento inicial',
    items: [
      'Tracker familiar con meta semanal de 3 sesiones.',
      'Multas escalonadas y vidas extra.',
      'Login por PIN para cada miembro.',
      'Feed estilo Instagram con últimos entrenamientos.',
      'Planificación de ausencias (formato semana única).',
    ],
  },
]

const versionTypeStyle = {
  major: 'bg-purple-600/30 text-purple-200',
  minor: 'bg-indigo-600/25 text-indigo-200',
  patch: 'bg-gray-600/30 text-gray-300',
}
const versionTypeLabel = {
  major: 'Mayor',
  minor: 'Feature',
  patch: 'Fix',
}

export default function Rules() {
  return (
    <div className="space-y-4 pb-24">
      <div className="text-center">
        <h2 className="text-2xl font-black text-white">📋 Reglas</h2>
        <p className="text-sm text-gray-400 mt-1">Cómo funciona el reto FitFamily</p>
      </div>

      {sections.map((s) => {
        const colorClass = colorMap[s.color]
        return (
          <div
            key={s.title}
            className={`rounded-2xl border p-4 ${colorClass}`}
          >
            <h3 className="text-base font-bold text-white mb-3">
              {s.icon} {s.title}
            </h3>
            <ul className="space-y-2">
              {s.items.map((item, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-300">
                  <span className="mt-0.5 text-gray-500 shrink-0">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )
      })}

      {/* ── Changelog ───────────────────────────────────────── */}
      <div className="bg-gray-800/60 rounded-2xl border border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700">
          <h3 className="text-base font-bold text-white">📜 Historial de cambios</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Mayor = paradigma · Feature = funcionalidad nueva · Fix = corrección
          </p>
        </div>
        <ul className="divide-y divide-gray-700/50">
          {CHANGELOG.map((entry) => (
            <li key={entry.version} className="p-4">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="font-mono text-sm font-bold text-white">{entry.version}</span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    versionTypeStyle[entry.type]
                  }`}
                >
                  {versionTypeLabel[entry.type]}
                </span>
                <span className="text-xs text-gray-500 ml-auto">{entry.date}</span>
              </div>
              <p className="text-sm font-semibold text-gray-200 mb-2">{entry.title}</p>
              <ul className="space-y-1">
                {entry.items.map((it, i) => (
                  <li key={i} className="flex gap-2 text-xs text-gray-400">
                    <span className="text-gray-600 shrink-0">•</span>
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-gray-800 rounded-2xl border border-gray-700 p-4 text-center">
        <p className="text-xs text-gray-500">
          Las reglas pueden evolucionar por consenso familiar. 💪
        </p>
      </div>
    </div>
  )
}
