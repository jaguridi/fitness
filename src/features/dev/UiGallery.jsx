import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Camera,
  Check,
  Flame,
  ImagePlus,
  Lock,
  Moon,
  Plus,
  RotateCcw,
  Settings,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { USERS } from '../../constants'
import {
  Avatar,
  AvatarRing,
  Button,
  Chip,
  CommentThread,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  GoalProgress,
  HabitDots,
  IconButton,
  MemberName,
  PhotoViewer,
  ProgressBar,
  ReactionBar,
  Section,
  SegmentedControl,
  Sheet,
  Skeleton,
  SkeletonText,
  Stepper,
  Sticker,
  Surface,
  Tag,
  TextArea,
  TextField,
  Toaster,
  Toggle,
  WeekStrip,
  THEME_OPTIONS,
  cx,
  memberProps,
  useTheme,
  useThemeSync,
} from '../../components/ui'

/**
 * Galería del sistema de diseño — `#/dev/ui`, solo en desarrollo (ver main.jsx).
 * Todo con contenido realista; sirve para revisar el diseño en claro y oscuro.
 */

const ME = 'user1'
const TODAY = 3 // jueves
const minutesAgo = (m) => new Date(Date.now() - m * 60000)

// Foto de ejemplo: una ilustración plana (no hay fotos reales en la galería).
const MOCK_PHOTO =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#bfe0f2"/><circle cx="300" cy="80" r="34" fill="#ffe08a"/><path d="M0 210 L90 120 L160 180 L250 90 L400 220 V300 H0Z" fill="#6f8f7a"/><path d="M0 250 Q120 200 220 240 T400 235 V300 H0Z" fill="#4c6b58"/><path d="M228 102 l6 -10 l6 10z" fill="#fff"/><path d="M60 300 Q140 240 210 262" stroke="#e9d9b8" stroke-width="10" fill="none"/></svg>`
  )

const MEMBERS = USERS.map((u) => ({ ...u }))
const m = (id) => MEMBERS.find((x) => x.id === id)

const STICKERS = [
  { id: 'first_workout', icon: '👟', name: 'Primera sesión', number: 1, rarity: 'comun' },
  { id: 'streak_4', icon: '🔥', name: 'Cuatro seguidas', number: 12, rarity: 'rara' },
  { id: 'minutes_1000', icon: '⏱️', name: 'Mil minutos', number: 27, rarity: 'epica' },
  { id: 'family_4x', icon: '🏆', name: 'Familia imparable', number: 58, rarity: 'legendaria' },
]

const ALBUM = [
  { id: 'first_workout', icon: '👟', name: 'Primera sesión', number: 1, rarity: 'comun', earned: true },
  { id: 'streak_2', icon: '✌️', name: 'Dos seguidas', number: 2, rarity: 'comun', earned: true },
  { id: 'streak_4', icon: '🔥', name: 'Cuatro seguidas', number: 3, rarity: 'rara', earned: true },
  { id: 'streak_8', icon: '🌋', name: 'Ocho seguidas', number: 4, rarity: 'epica', earned: false, caption: '5 de 8 semanas' },
  { id: 'streak_12', icon: '🌟', name: 'Doce seguidas', number: 5, rarity: 'epica', earned: false, caption: '5 de 12 semanas' },
  { id: 'streak_26', icon: '👑', name: 'Medio año', number: 6, rarity: 'legendaria', earned: false, caption: '5 de 26 semanas' },
]

const COMMENTS = [
  { userId: 'user2', text: 'Esa subida al cerro no es broma 👀', createdAt: minutesAgo(95) },
  { userId: 'user4', text: '¡Vamos! Mañana me sumo', createdAt: minutesAgo(70) },
  { userId: 'user3', text: 'Yo voy el sábado temprano', createdAt: minutesAgo(40) },
  { userId: 'user1', text: 'Los espero arriba', createdAt: minutesAgo(12) },
]

function Block({ title, children, className }) {
  return (
    <div className={cx('mt-6 first:mt-0', className)}>
      <p className="type-small mb-3 font-semibold text-ink-soft">{title}</p>
      {children}
    </div>
  )
}

function Swatch({ name, varName, note }) {
  return (
    <div className="flex items-center gap-3">
      <span className="size-10 shrink-0 rounded-control border border-line" style={{ background: `var(${varName})` }} />
      <span className="min-w-0">
        <span className="type-small block font-semibold text-ink">{name}</span>
        <span className="type-caption block font-medium text-ink-soft">{note || varName}</span>
      </span>
    </div>
  )
}

function TodayHeaderMock() {
  const [habits, setHabits] = useState([
    { id: 'h1', emoji: '📖', name: 'Leer 20 minutos', target: 5, checks: [true, true, false, true, false, false, false] },
    { id: 'h2', emoji: '💧', name: 'Tomar 2 litros de agua', target: 7, checks: [true, true, true, false, false, false, false] },
    { id: 'h3', emoji: '🧘', name: 'Meditar', target: 3, checks: [true, false, true, true, false, false, false] },
  ])
  const toggle = (hid, i) =>
    setHabits((hs) => hs.map((h) => (h.id === hid ? { ...h, checks: h.checks.map((c, j) => (j === i ? !c : c)) } : h)))
  return (
    <div {...memberProps(ME)}>
      <div className="flex items-center justify-between">
        <AvatarRing userId={ME} src={m(ME).avatar} name="Jose" segments={3} filled={2} size="lg" />
        <IconButton icon={Settings} label="Ajustes" />
      </div>
      <h2 className="type-display mt-5 text-ink">Te falta 1 sesión para lograr la semana</h2>
      <p className="type-body mt-3 flex items-center gap-1.5 text-ink-soft">
        <Flame size={18} strokeWidth={2.3} className="text-member" aria-hidden="true" />
        Racha de 4 semanas. Quedan 4 días.
      </p>
      <WeekStrip userId={ME} days={[1, 0, 1, 0, 0, 0, 0]} today={TODAY} className="mt-6" />

      <Section title="Tus hábitos" action={<Button variant="ghost" size="sm">Editar</Button>} className="mt-9">
        <ul className="flex flex-col">
          {habits.map((h) => {
            const count = h.checks.filter(Boolean).length
            return (
              <li key={h.id} className="border-b border-line py-3 last:border-b-0">
                <div className="flex items-center gap-2.5">
                  <span aria-hidden="true" className="text-xl leading-none">
                    {h.emoji}
                  </span>
                  <span className="type-body min-w-0 flex-1 truncate font-semibold text-ink">{h.name}</span>
                  <span className={cx('type-small tabular-nums', count >= h.target ? 'font-semibold text-done-ink' : 'text-ink-soft')}>
                    {count} de {h.target}
                  </span>
                </div>
                <HabitDots
                  checks={h.checks}
                  target={h.target}
                  today={TODAY}
                  userId={ME}
                  habitName={h.name}
                  onToggle={(i) => toggle(h.id, i)}
                  showCount={false}
                  className="-ml-3.5 mt-0.5"
                />
              </li>
            )
          })}
        </ul>
      </Section>
    </div>
  )
}

function FamilyWeek() {
  const rows = [
    { id: 'user1', goal: 3, done: 2 },
    { id: 'user2', goal: 3, done: 3 },
    { id: 'user3', goal: 4, done: 0 },
    { id: 'user4', goal: 3, done: 0, rest: true },
  ]
  return (
    <ul className="grid grid-cols-4 gap-2">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-col items-center gap-2 text-center">
          <AvatarRing userId={r.id} src={m(r.id).avatar} name={m(r.id).name} segments={r.goal} filled={r.done} rest={r.rest} size="md" />
          <span className="leading-tight">
            <MemberName userId={r.id} className="type-small block" />
            <span className="type-caption block tabular-nums text-ink-soft">
              {r.rest ? 'Descanso' : `${r.done} de ${r.goal}`}
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}

function WorkoutCard({ onPhoto }) {
  const [reactions, setReactions] = useState({ user2: '🔥', user4: '🔥', user3: '💪' })
  const [comments, setComments] = useState(COMMENTS)
  return (
    <Surface padding="none" className="overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-4">
        <Avatar userId="user1" src={m('user1').avatar} name="Jose" size="sm" />
        <div className="min-w-0 flex-1 leading-tight">
          <MemberName userId="user1" className="type-body block" />
          <span className="type-caption text-ink-soft">hace 2 h</span>
        </div>
        <Tag tone="member" userId="user1">
          3.ª de 3
        </Tag>
      </div>
      <p className="type-heading px-4 pt-3 text-ink">Trote al cerro San Cristóbal</p>
      <p className="type-small px-4 pt-1 tabular-nums text-ink-soft">52 minutos, 480 kcal</p>
      <button
        type="button"
        onClick={onPhoto}
        aria-label="Ver la foto en grande"
        className="mx-4 mt-3 block aspect-[4/3] w-[calc(100%-2rem)] overflow-hidden rounded-[14px] bg-surface-sunk"
      >
        <img src={MOCK_PHOTO} alt="" className="h-full w-full object-cover" />
      </button>
      <div className="px-3 pt-2">
        <ReactionBar
          reactions={reactions}
          members={MEMBERS}
          currentUserId={ME}
          onReact={(e) =>
            setReactions((r) => {
              const next = { ...r }
              if (e) next[ME] = e
              else delete next[ME]
              return next
            })
          }
        />
      </div>
      <div className="border-t border-line px-4 pt-3 pb-4">
        <CommentThread
          comments={comments}
          members={MEMBERS}
          currentUserId={ME}
          collapseAfter={2}
          onComment={(text) => setComments((c) => [...c, { userId: ME, text, createdAt: new Date() }])}
        />
      </div>
    </Surface>
  )
}

function StickerPostCard() {
  return (
    <Surface variant="tint" {...memberProps('user2')} className="flex items-center gap-4">
      <Sticker id="streak_4" icon="🔥" number={12} rarity="rara" earned size="sm" showLabel={false} />
      <div className="min-w-0">
        <p className="type-body text-ink">
          <MemberName userId="user2" /> ganó una lámina
        </p>
        <p className="type-sub text-ink">Cuatro seguidas</p>
        <p className="type-caption mt-0.5 text-ink-soft">Rara, hace 20 min</p>
      </div>
    </Surface>
  )
}

function WeekResultCard() {
  const rows = [
    { id: 'user2', status: 'completed', text: '3 de 3, racha de 6' },
    { id: 'user1', status: 'completed', text: '4 de 3, racha de 4' },
    { id: 'user4', status: 'rest', text: 'Semana de descanso' },
    { id: 'user3', status: 'missed', text: '1 de 4. La próxima parte de cero' },
  ]
  return (
    <Surface padding="lg">
      <p className="type-caption font-semibold text-ink-soft">Semana del 10 al 16 de noviembre</p>
      <p className="type-heading mt-1 text-ink">Dos lograron la semana</p>
      <ul className="mt-4 flex flex-col gap-3">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3">
            <Avatar userId={r.id} src={m(r.id).avatar} name={m(r.id).name} size="sm" />
            <span className="min-w-0 flex-1">
              <MemberName userId={r.id} className="type-small block" />
              <span className="type-caption block tabular-nums text-ink-soft">{r.text}</span>
            </span>
            {r.status === 'completed' && (
              <Tag tone="done" icon={Check}>
                Lograda
              </Tag>
            )}
            {r.status === 'rest' && (
              <Tag icon={Moon}>Descanso</Tag>
            )}
            {r.status === 'missed' && <Tag tone="outline">No salió</Tag>}
          </li>
        ))}
      </ul>
      <p className="type-small mt-5 border-t border-line pt-4 text-ink-soft">
        Javi cerró con tres mañanas de yoga y Jose se pasó de la meta con un trote extra el domingo. Fran se tomó la
        semana; Gonza vuelve a empezar el lunes.
      </p>
    </Surface>
  )
}

function Overlays() {
  const [sheet, setSheet] = useState(false)
  const [dialog, setDialog] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [photo, setPhoto] = useState(false)
  const [type, setType] = useState('run')
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setSheet(true)}>
          Abrir hoja
        </Button>
        <Button variant="secondary" onClick={() => setDialog(true)}>
          Abrir diálogo
        </Button>
        <Button variant="secondary" onClick={() => setConfirm(true)}>
          Confirmar borrado
        </Button>
        <Button variant="secondary" icon={ImagePlus} onClick={() => setPhoto(true)}>
          Ver foto
        </Button>
        <Button variant="secondary" onClick={() => toast.success('Ejercicio registrado', { description: 'Llevas 3 de 3. ¡Semana lograda!' })}>
          Aviso de éxito
        </Button>
        <Button variant="secondary" onClick={() => toast.error('No se pudo subir la foto. Revisa tu conexión e inténtalo de nuevo.')}>
          Aviso de error
        </Button>
      </div>
      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Registrar ejercicio"
        description="Cuéntale a la familia qué hiciste hoy."
        footer={
          <Button block size="lg" onClick={() => setSheet(false)}>
            Registrar ejercicio
          </Button>
        }
      >
        <div className="flex flex-col gap-5">
          <div>
            <p className="type-small mb-2 font-semibold text-ink">Tipo</p>
            <div className="flex flex-wrap gap-2">
              {[
                ['run', '🏃', 'Correr'],
                ['gym', '🏋️', 'Gimnasio'],
                ['bike', '🚴', 'Bicicleta'],
                ['yoga', '🧘', 'Yoga'],
                ['walk', '🚶', 'Caminar'],
              ].map(([v, e, l]) => (
                <Chip key={v} emoji={e} selected={type === v} onClick={() => setType(v)}>
                  {l}
                </Chip>
              ))}
            </div>
          </div>
          <TextField label="Minutos" inputMode="numeric" defaultValue="45" data-autofocus />
          <TextArea label="Comentario" placeholder="Opcional" />
          <Field label="Foto" hint="Obligatoria. Una foto de hoy, del entrenamiento.">
            <button
              type="button"
              className="flex h-28 w-full flex-col items-center justify-center gap-1.5 rounded-control border-[1.5px] border-dashed border-line-strong bg-surface-sunk text-ink-soft hover:border-ink-faint hover:text-ink"
            >
              <Camera size={22} strokeWidth={2.2} aria-hidden="true" />
              <span className="type-small font-semibold">Tomar o elegir foto</span>
            </button>
          </Field>
        </div>
      </Sheet>
      <Dialog
        open={dialog}
        onClose={() => setDialog(false)}
        title="Semana de descanso"
        actions={<Button onClick={() => setDialog(false)}>Entendido</Button>}
      >
        No suma ni rompe tu racha. Úsala cuando estés enfermo, de viaje o simplemente necesites parar.
      </Dialog>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="¿Eliminar este ejercicio?"
        description="Se quita del feed y de tu semana. No se puede deshacer."
        confirmLabel="Eliminar ejercicio"
        tone="danger"
        onConfirm={() => new Promise((r) => setTimeout(r, 700)).then(() => toast('Ejercicio eliminado'))}
      />
      <PhotoViewer
        open={photo}
        onClose={() => setPhoto(false)}
        src={MOCK_PHOTO}
        alt="Vista desde el cerro"
        caption="Fran, 40 minutos de funcional"
      />
    </>
  )
}

function GalleryContent() {
  const [goal, setGoal] = useState(3)
  const [reminder, setReminder] = useState(true)
  const [visibility, setVisibility] = useState('family')
  const [period, setPeriod] = useState('month')
  const [chips, setChips] = useState(['leer'])
  const [stickKey, setStickKey] = useState(0)
  const [photo, setPhoto] = useState(false)
  const toggleChip = (c) => setChips((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]))

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-24">
      <Section title="Así se ve Hoy">
        <TodayHeaderMock />
      </Section>

      <Section title="La familia esta semana" description="Jose en camino, Javi lograda, Gonza sin empezar, Fran descansando.">
        <FamilyWeek />
      </Section>

      <Section
        title="Metas personales"
        description="Cada uno se pone las suyas, con plazo y premio si quiere."
        action={<Button variant="ghost" size="sm" icon={Plus}>Nueva meta</Button>}
      >
        <Surface padding="lg" className="flex flex-col gap-5">
          <GoalProgress
            userId="user1"
            emoji="🏃"
            title="12 sesiones en diciembre"
            current={7}
            target={12}
            unit="sesiones"
            daysLeft={11}
            reward="las zapatillas de trail"
            own
          />
          <GoalProgress userId="user1" emoji="📚" title="Leer 4 libros" current={1} target={4} unit="libros" daysLeft={41} />
          <GoalProgress
            userId="user2"
            emoji="🧘"
            title="Yoga 8 veces antes del 30"
            current={8}
            target={8}
            unit="veces"
            status="achieved"
            reward="un masaje"
          />
          <GoalProgress userId="user3" emoji="🚴" title="600 minutos en noviembre" current={410} target={600} unit="minutos" status="missed" />
        </Surface>
      </Section>

      <Section title="Anillos" description="Un segmento por sesión de la meta.">
        <div className="flex flex-wrap items-end gap-3">
          <AvatarRing userId="user3" src={m('user3').avatar} name="Gonza" segments={3} filled={0} size={60} />
          <AvatarRing userId="user4" src={m('user4').avatar} name="Fran" segments={3} filled={2} size={60} />
          <AvatarRing userId="user2" src={m('user2').avatar} name="Javi" segments={3} filled={3} size={60} />
          <AvatarRing userId="user1" src={m('user1').avatar} name="Jose" segments={3} filled={0} rest size={60} />
        </div>
        <div className="mt-5 flex flex-wrap items-end gap-4">
          {[1, 2, 5, 7].map((g) => (
            <AvatarRing key={g} userId="user1" src={m('user1').avatar} name="Jose" segments={g} filled={Math.ceil(g / 2)} size="sm" />
          ))}
          <AvatarRing userId="user2" src={m('user2').avatar} name="Javi" segments={4} filled={1} size="xs" />
        </div>
      </Section>

      <Section
        title="Láminas"
        description="Común, rara, épica y legendaria. Sin ganar: el hueco con su número."
        action={
          <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => setStickKey((k) => k + 1)}>
            Pegar de nuevo
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-x-3 gap-y-6">
          {STICKERS.map((s) => (
            <div key={`${s.id}-${stickKey}`} className="flex justify-center">
              <Sticker {...s} earned justEarned={stickKey > 0} />
            </div>
          ))}
        </div>
        <Block title="Página del álbum: Constancia" className="mt-9">
          <Surface variant="sunk" padding="lg">
            <div className="flex items-baseline justify-between">
              <p className="type-sub text-ink">Constancia</p>
              <p className="type-small tabular-nums text-ink-soft">3 de 6</p>
            </div>
            <ProgressBar value={3} max={6} tone="ink" size="sm" className="mt-2" label="Constancia, 3 de 6" />
            <div className="mt-6 grid grid-cols-3 gap-x-2 gap-y-5">
              {ALBUM.map((s) => (
                <div key={s.id} className="flex justify-center">
                  <Sticker {...s} size="sm" onClick={() => {}} />
                </div>
              ))}
            </div>
          </Surface>
        </Block>
        <Block title="Grande, como en la celebración">
          <div className="flex justify-center py-4">
            <Sticker key={`big-${stickKey}`} id="family_4x" icon="🏆" name="Familia imparable" number={58} rarity="legendaria" earned justEarned={stickKey > 0} size="lg" caption="Los cuatro lograron la semana" />
          </div>
        </Block>
      </Section>

      <Section title="En el feed">
        <div className="flex flex-col gap-4">
          <WorkoutCard onPhoto={() => setPhoto(true)} />
          <StickerPostCard />
          <WeekResultCard />
        </div>
        <PhotoViewer open={photo} onClose={() => setPhoto(false)} src={MOCK_PHOTO} alt="Jose en el cerro" caption="Trote al cerro San Cristóbal" />
      </Section>

      <Section title="Botones">
        <div className="flex flex-col items-start gap-3">
          <Button icon={Plus}>Registrar ejercicio</Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={Camera}>
              Agregar foto
            </Button>
            <Button variant="ghost">Cancelar</Button>
            <Button variant="danger-quiet" icon={Trash2}>
              Eliminar
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {['user1', 'user2', 'user3', 'user4'].map((u) => (
              <Button key={u} variant="member" size="sm" {...memberProps(u)}>
                Saludar a {m(u).name}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="lg">Guardar hábito</Button>
            <Button size="sm" variant="secondary">
              Editar
            </Button>
            <Button loading>Guardando</Button>
            <Button disabled>Registrar ejercicio</Button>
          </div>
          <div className="flex gap-1">
            <IconButton icon={X} label="Cerrar" />
            <IconButton icon={Settings} label="Ajustes" variant="surface" />
            <IconButton icon={Plus} label="Agregar hábito" variant="ink" />
          </div>
        </div>
      </Section>

      <Section title="Controles">
        <div className="flex flex-col gap-5">
          <TextField label="Nombre del hábito" placeholder="Leer 20 minutos" />
          <TextField label="Minutos" inputMode="numeric" defaultValue="0" error="Escribe cuántos minutos entrenaste." />
          <TextArea label="Comentario" hint="Opcional. Lo ve toda la familia." placeholder="¿Cómo te fue?" />
          <Surface>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="type-body font-semibold text-ink">Meta semanal</p>
                <p className="type-small text-ink-soft">Sesiones para lograr la semana</p>
              </div>
              <Stepper value={goal} onChange={setGoal} min={1} max={7} label="Meta semanal" unit={(n) => (n === 1 ? 'sesión' : 'sesiones')} />
            </div>
            <div className="mt-3 border-t border-line pt-2">
              <Toggle
                checked={reminder}
                onChange={setReminder}
                label="Recordatorio de hábitos"
                description="A las 20:30, solo si te queda alguno sin marcar."
              />
            </div>
          </Surface>
          <SegmentedControl
            label="Quién lo ve"
            value={visibility}
            onChange={setVisibility}
            options={[
              { value: 'family', label: 'La familia', icon: Users },
              { value: 'private', label: 'Solo yo', icon: Lock },
            ]}
          />
          <SegmentedControl
            label="Periodo"
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'week', label: 'Semana' },
              { value: 'month', label: 'Mes' },
              { value: 'year', label: 'Año' },
              { value: 'all', label: 'Todo' },
            ]}
          />
          <div className="flex flex-wrap gap-2">
            {[
              ['leer', '📖', 'Leer'],
              ['meditar', '🧘', 'Meditar'],
              ['agua', '💧', 'Tomar agua'],
              ['dormir', '😴', 'Dormir 7 h'],
              ['azucar', '🍬', 'Sin azúcar'],
            ].map(([v, e, l]) => (
              <Chip key={v} emoji={e} selected={chips.includes(v)} onClick={() => toggleChip(v)}>
                {l}
              </Chip>
            ))}
            <Chip icon={Plus}>Otro</Chip>
          </div>
          <div className="flex flex-wrap gap-2">
            <Tag tone="done" icon={Check}>
              Lograda
            </Tag>
            <Tag icon={Moon}>Descanso</Tag>
            <Tag tone="outline">No salió</Tag>
            <Tag tone="ink">Nueva</Tag>
            <Tag icon={Lock}>Privado</Tag>
            {['user1', 'user2', 'user3', 'user4'].map((u) => (
              <Tag key={u} tone="member" userId={u}>
                {m(u).name}
              </Tag>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Semana y hábitos, solo lectura">
        <div className="flex flex-col gap-4">
          {['user2', 'user3', 'user4'].map((u, i) => (
            <div key={u} className="flex items-center gap-3">
              <Avatar userId={u} src={m(u).avatar} name={m(u).name} size="xs" />
              <WeekStrip userId={u} size="sm" today={-1} days={[[1, 0, 1, 0, 1, 0, 0], [0, 0, 0, 1, 0, 0, 0], [1, 0, 2, 0, 0, 1, 0]][i]} className="flex-1" />
            </div>
          ))}
          <HabitDots checks={[true, true, true, true, true, false, false]} target={5} />
          <HabitDots checks={[true, false, true, false, false, false, false]} target={4} userId="user3" />
        </div>
      </Section>

      <Section title="Progreso">
        <div className="flex flex-col gap-4">
          <div>
            <div className="type-small mb-1.5 flex justify-between text-ink-soft">
              <span>Ocho seguidas</span>
              <span className="tabular-nums">5 de 8 semanas</span>
            </div>
            <ProgressBar value={5} max={8} userId="user1" label="Ocho seguidas" />
          </div>
          <ProgressBar value={240} max={300} userId="user4" size="sm" label="Minutos" />
          <ProgressBar value={4} max={4} tone="done" label="Hábitos de la semana" />
        </div>
      </Section>

      <Section title="Vacíos y carga">
        <div className="flex flex-col gap-4">
          <EmptyState
            icon={Sparkles}
            title="Aún no tienes hábitos"
            description="Elige uno chico para empezar: leer 10 minutos, tomar agua o estirar."
            action={<Button icon={Plus}>Crear hábito</Button>}
          />
          <EmptyState emoji="📭" title="Nadie ha comentado todavía" compact />
          <Surface>
            <div className="flex items-center gap-3">
              <Skeleton shape="circle" className="size-10" />
              <div className="flex-1">
                <Skeleton className="w-1/3" />
                <Skeleton className="mt-2 h-3 w-1/5" />
              </div>
            </div>
            <SkeletonText lines={2} className="mt-4" />
            <Skeleton shape="surface" className="mt-4 h-36" />
          </Surface>
        </div>
      </Section>

      <Section title="Capas">
        <Overlays />
      </Section>

      <Section title="Color">
        <div className="grid grid-cols-2 gap-3">
          <Swatch name="Papel" varName="--paper" />
          <Swatch name="Superficie" varName="--surface" />
          <Swatch name="Tinta" varName="--ink" />
          <Swatch name="Tinta suave" varName="--ink-soft" />
          <Swatch name="Línea" varName="--line" />
          <Swatch name="Logrado" varName="--done" />
          {['user1', 'user2', 'user3', 'user4'].map((u) => (
            <Swatch key={u} name={m(u).name} varName={`--m-${u}`} note={`--m-${u}`} />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {['user1', 'user2', 'user3', 'user4'].map((u) => (
            <div key={u} {...memberProps(u)} className="flex flex-col gap-1">
              <span className="flex h-10 items-center justify-center rounded-control bg-member text-sm font-bold text-on-member">Aa</span>
              <span className="flex h-10 items-center justify-center rounded-control bg-member-tint text-sm font-bold text-member-ink">Aa</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tipografía" description="Bricolage Grotesque, una sola familia.">
        <div className="flex flex-col gap-3">
          <p className="type-display text-ink">44 Semana lograda</p>
          <p className="type-title text-ink">34 Tu álbum</p>
          <p className="type-heading text-ink">26 Cuatro seguidas</p>
          <p className="type-sub text-ink">20 La familia esta semana</p>
          <p className="type-body text-ink">16 Marca tus hábitos con un toque, hoy o cualquier día que ya pasó de esta semana.</p>
          <p className="type-small text-ink-soft">14 Se cierra el domingo a medianoche.</p>
          <p className="type-caption text-ink-soft">12 hace 3 h</p>
          <p className="type-heading tabular-nums text-ink">1.234 min  480 kcal  12/12</p>
        </div>
      </Section>
    </div>
  )
}

function useWide() {
  const query = '(min-width: 1280px)'
  const [wide, setWide] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return wide
}

export default function UiGallery() {
  useThemeSync()
  const { preference, setPreference } = useTheme()
  const wide = useWide()
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <Toaster />
      <header className="mx-auto w-full max-w-md px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-8 xl:max-w-5xl">
        <p className="type-small font-semibold text-ink-soft">FitFamily, solo en desarrollo</p>
        <h1 className="type-display mt-1 text-ink">El álbum de la familia</h1>
        <p className="type-body mt-3 max-w-[40ch] text-ink-soft">
          Las piezas con que se arma la v2. Papel y tinta tranquilos; lo audaz son las láminas y el color de cada persona.
        </p>
        <SegmentedControl
          label="Tema"
          value={preference}
          onChange={setPreference}
          options={THEME_OPTIONS}
          block={false}
          className="mt-5"
        />
        <p className="type-caption mt-2 hidden text-ink-soft xl:block">En pantallas anchas se muestran los dos temas lado a lado.</p>
      </header>
      {wide ? (
        <div className="grid grid-cols-2">
          <div data-theme="light" className="bg-paper pt-8 text-ink">
            <GalleryContent />
          </div>
          <div data-theme="dark" className="bg-paper pt-8 text-ink">
            <GalleryContent />
          </div>
        </div>
      ) : (
        <GalleryContent />
      )}
    </div>
  )
}
