import { USERS } from '../../constants'
import { cx } from './cx'
import { memberProps } from './member'

/**
 * MemberName — el nombre de alguien en su color legible (text-member-ink).
 *
 *   <MemberName userId="user4" />                 // "Fran"
 *   <MemberName userId={c.userId} members={members} className="font-bold" />
 *   <MemberName userId="user1" you currentUserId={me.id} />   // "Tú" si es la persona actual
 *
 * @param {string} userId
 * @param {{id:string,name:string}[]} [members] lista desde useFamily(); si falta, usa USERS
 * @param {boolean} [you] mostrar "Tú" cuando userId === currentUserId
 * @param {string} [currentUserId]
 */
export function memberName(userId, members) {
  const list = members?.length ? members : USERS
  return list.find((m) => m.id === userId)?.name || 'Alguien'
}

export function findMember(userId, members) {
  const list = members?.length ? members : USERS
  return list.find((m) => m.id === userId) || USERS.find((m) => m.id === userId) || null
}

export default function MemberName({ userId, members, you = false, currentUserId, className }) {
  const text = you && userId === currentUserId ? 'Tú' : memberName(userId, members)
  return (
    <span {...memberProps(userId)} className={cx('font-semibold text-member-ink', className)}>
      {text}
    </span>
  )
}
