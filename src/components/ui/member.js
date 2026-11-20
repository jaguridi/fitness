/**
 * Color de cada persona.
 *
 * La forma preferida es por contexto CSS: poner `data-member={userId}` en un contenedor
 * y usar dentro las utilidades bg-member, bg-member-tint, text-member-ink, text-on-member,
 * border-member. Sin data-member, "member" cae en la tinta.
 *
 *   <div {...memberProps('user3')} className="bg-member-tint rounded-surface p-4">
 *     <span className="text-member-ink font-semibold">Gonza</span>
 *   </div>
 *
 * Para SVG o estilos en línea: memberColor('user1') → 'var(--m-user1)'.
 */

const KNOWN = new Set(['user1', 'user2', 'user3', 'user4'])

/** Color sólido de la persona como valor CSS (cae en tinta si no se conoce). */
export function memberColor(userId) {
  return KNOWN.has(userId) ? `var(--m-${userId})` : 'var(--ink)'
}

/** Color de texto legible de la persona sobre papel o superficie. */
export function memberInk(userId) {
  return KNOWN.has(userId) ? `var(--m-${userId}-ink)` : 'var(--ink)'
}

/** Color de texto legible sobre el color sólido de la persona. */
export function memberOn(userId) {
  return KNOWN.has(userId) ? `var(--m-${userId}-on)` : 'var(--on-ink)'
}

/** Fondo suave (tinte) de la persona. */
export function memberTint(userId) {
  return KNOWN.has(userId) ? `var(--m-${userId}-tint)` : 'var(--surface-sunk)'
}

/** Props para activar el contexto de color: <div {...memberProps(id)}>. */
export function memberProps(userId) {
  return KNOWN.has(userId) ? { 'data-member': userId } : {}
}
