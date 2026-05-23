import { BASE_FINE, MAX_FINE, WEEKLY_GOAL, EXTRA_LIFE_THRESHOLD } from '../constants'
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
  indigo: 'bg-indigo-600/10 border-indigo-600/30 text-indigo-400',
  red:    'bg-red-600/10    border-red-600/30    text-red-400',
  pink:   'bg-pink-600/10   border-pink-600/30   text-pink-400',
  yellow: 'bg-yellow-600/10 border-yellow-600/30 text-yellow-400',
  cyan:   'bg-cyan-600/10   border-cyan-600/30   text-cyan-400',
  orange: 'bg-orange-600/10 border-orange-600/30 text-orange-400',
  purple: 'bg-purple-600/10 border-purple-600/30 text-purple-400',
  amber:  'bg-amber-600/10  border-amber-600/30  text-amber-400',
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

      <div className="bg-gray-800 rounded-2xl border border-gray-700 p-4 text-center">
        <p className="text-xs text-gray-500">
          Las reglas pueden evolucionar por consenso familiar. 💪
        </p>
      </div>
    </div>
  )
}
