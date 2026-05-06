import { useState, useEffect } from 'react'
import { USERS, getExerciseTypes, formatExerciseTypes } from '../constants'
import { useAuth } from '../context/AuthContext'
import {
  subscribeAllWorkouts,
  subscribeJustifications,
  subscribeFlaggedWorkouts,
  flagWorkout,
  voteOnFlag,
  resolveFlag,
  deleteWorkout,
  addReaction,
  removeReaction,
  addComment,
} from '../services/firebaseService'
import Avatar from '../components/Avatar'
import { FeedCardSkeleton } from '../components/Skeleton'

export default function Feed() {
  const { currentUser } = useAuth()
  const [workouts, setWorkouts] = useState([])
  const [justifications, setJustifications] = useState([])
  const [flags, setFlags] = useState([])
  const [loading, setLoading] = useState(true)
  const [fullscreenPhoto, setFullscreenPhoto] = useState(null)
  const [flagging, setFlagging] = useState(null) // workoutId being flagged (confirm dialog)

  useEffect(() => {
    let loadCount = 0
    const checkLoaded = () => { loadCount++; if (loadCount >= 3) setLoading(false) }

    const unsub1 = subscribeAllWorkouts(
      (data) => { setWorkouts(data); checkLoaded() },
      (err) => { console.error(err); checkLoaded() }
    )
    const unsub2 = subscribeJustifications(
      (data) => { setJustifications(data); checkLoaded() },
      (err) => { console.error(err); checkLoaded() }
    )
    const unsub3 = subscribeFlaggedWorkouts(
      (data) => { setFlags(data); checkLoaded() },
      (err) => { console.error(err); checkLoaded() }
    )
    return () => { unsub1(); unsub2(); unsub3() }
  }, [])

  const getUserInfo = (userId) => USERS.find((u) => u.id === userId) || { name: 'Desconocido', avatar: '❓' }

  const formatTimeAgo = (createdAt) => {
    if (!createdAt?.seconds) return ''
    const diff = Date.now() - createdAt.seconds * 1000
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Ahora'
    if (mins < 60) return `hace ${mins} min`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `hace ${hours}h`
    const days = Math.floor(hours / 24)
    if (days < 7) return `hace ${days}d`
    return `hace ${Math.floor(days / 7)} sem`
  }

  // ── Flag & Vote helpers ──────────────────────────────────────

  const getFlagForWorkout = (workoutId) => flags.find((f) => f.workoutId === workoutId)

  const handleFlag = async (workout) => {
    try {
      await flagWorkout(workout.id, currentUser.id, workout.userId)
      setFlagging(null)
    } catch (err) {
      alert(err.message)
      setFlagging(null)
    }
  }

  const handleVote = async (workoutId, vote) => {
    try {
      await voteOnFlag(workoutId, currentUser.id, vote)

      // Check if all 3 eligible voters have voted → resolve
      const flag = getFlagForWorkout(workoutId)
      const updatedVotes = { ...flag.votes, [currentUser.id]: vote }
      const voteCount = Object.keys(updatedVotes).length

      if (voteCount >= 3) {
        const fakeVotes = Object.values(updatedVotes).filter((v) => v === 'fake').length
        const legitVotes = Object.values(updatedVotes).filter((v) => v === 'legitimate').length

        if (fakeVotes >= legitVotes) {
          // Majority fake → delete workout
          await resolveFlag(workoutId, 'fake')
          await deleteWorkout(workoutId)
        } else {
          // Majority legitimate → keep workout
          await resolveFlag(workoutId, 'legitimate')
        }
      }
    } catch (err) {
      console.error('Vote error:', err)
      alert('Error al votar. Intenta de nuevo.')
    }
  }

  // ── Comments ────────────────────────────────────────────────
  const [commentText, setCommentText] = useState({}) // { workoutId: text }
  const [submittingComment, setSubmittingComment] = useState(null)

  const handleComment = async (workoutId) => {
    const text = (commentText[workoutId] || '').trim()
    if (!text || !currentUser) return
    setSubmittingComment(workoutId)
    try {
      await addComment(workoutId, currentUser.id, text)
      setCommentText((prev) => ({ ...prev, [workoutId]: '' }))
    } catch (err) {
      console.error('Comment error:', err)
    } finally {
      setSubmittingComment(null)
    }
  }

  // ── Reactions ───────────────────────────────────────────────
  const REACTION_EMOJIS = ['💪', '🔥', '👏', '😮', '😂']

  const handleReaction = async (workoutId, emoji) => {
    if (!currentUser) return
    const workout = workouts.find((w) => w.id === workoutId)
    const myCurrentReaction = workout?.reactions?.[currentUser.id]
    try {
      if (myCurrentReaction === emoji) {
        await removeReaction(workoutId, currentUser.id)
      } else {
        await addReaction(workoutId, currentUser.id, emoji)
      }
    } catch (err) {
      console.error('Reaction error:', err)
    }
  }

  // ── Render ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4 pb-24">
        <div className="text-center">
          <h2 className="text-2xl font-black text-white">📸 Feed</h2>
          <p className="text-sm text-gray-400 mt-1">Actividad de toda la familia</p>
        </div>
        {[...Array(3)].map((_, i) => <FeedCardSkeleton key={i} />)}
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="text-center">
        <h2 className="text-2xl font-black text-white">📸 Feed</h2>
        <p className="text-sm text-gray-400 mt-1">Actividad de toda la familia</p>
      </div>

      {workouts.length === 0 && justifications.length === 0 ? (
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 text-center">
          <div className="text-4xl mb-2">🏃</div>
          <p className="text-gray-400">Aún no hay actividad. ¡Sé el primero!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Merge workouts and justifications into a single timeline */}
          {[
            ...workouts.map((w) => ({ ...w, _type: 'workout', _ts: w.createdAt?.seconds || 0 })),
            ...justifications.map((j) => ({ ...j, _type: 'justification', _ts: j.createdAt?.seconds || 0 })),
          ]
            .sort((a, b) => b._ts - a._ts)
            .map((item) => {
              if (item._type === 'justification') {
                const j = item
                const user = getUserInfo(j.userId)
                const isPending = j.status === 'pending_vote'
                const borderClass = isPending
                  ? 'bg-amber-900/10 border-amber-700/30'
                  : j.aiVerdict === true
                  ? 'bg-green-900/10 border-green-700/30'
                  : 'bg-red-900/10 border-red-700/30'
                const badgeClass = isPending
                  ? 'bg-amber-600/20 text-amber-400'
                  : j.aiVerdict === true
                  ? 'bg-green-600/20 text-green-400'
                  : 'bg-red-600/20 text-red-400'
                const badgeText = isPending
                  ? '🗳️ En votación'
                  : j.aiVerdict === true
                  ? '⚖️ Aceptada'
                  : '❌ Rechazada'

                return (
                  <div
                    key={`j-${j.id}`}
                    className={`rounded-2xl overflow-hidden border ${borderClass}`}
                  >
                    <div className="flex items-center gap-3 p-3">
                      <Avatar src={user.avatar} name={user.name} size="sm" />
                      <div className="flex-1">
                        <p className="font-semibold text-white text-sm">{user.name}</p>
                        <p className="text-gray-500 text-xs">{formatTimeAgo(j.createdAt)}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeClass}`}>
                        {badgeText}
                      </span>
                    </div>

                    {/* Evidence photo */}
                    {j.evidencePhotoURL && (
                      <button
                        onClick={() => setFullscreenPhoto(j.evidencePhotoURL)}
                        className="w-full"
                      >
                        <img
                          src={j.evidencePhotoURL}
                          alt="Evidencia"
                          loading="lazy"
                          className="w-full max-h-64 object-cover hover:opacity-90 transition-opacity"
                        />
                      </button>
                    )}

                    <div className="p-3">
                      {typeof j.sessionsJustified === 'number' && (
                        <span className="inline-block text-xs font-semibold text-indigo-400 bg-indigo-900/30 px-2 py-0.5 rounded-full mb-1.5">
                          {j.sessionsJustified} sesión{j.sessionsJustified > 1 ? 'es' : ''}
                        </span>
                      )}
                      <p className="text-gray-300 text-sm">
                        <span className="font-semibold text-white">{user.name}:</span>{' '}
                        &ldquo;{j.excuse}&rdquo;
                      </p>
                      {j.aiReason && (
                        <div className={`mt-2 text-xs px-2 py-1 rounded-lg inline-block ${
                          isPending ? 'bg-amber-900/30 text-amber-300'
                          : j.aiVerdict === true ? 'bg-green-900/30 text-green-300'
                          : 'bg-red-900/30 text-red-300'
                        }`}>
                          {isPending ? '🗳️' : '🤖'} {j.aiReason}
                        </div>
                      )}
                    </div>
                  </div>
                )
              }

              // Workout card
              const w = item
            const user = getUserInfo(w.userId)
            const flag = getFlagForWorkout(w.id)
            const isOwner = w.userId === currentUser?.id

            return (
              <div
                key={w.id}
                className={`rounded-2xl overflow-hidden border ${
                  flag
                    ? 'bg-red-900/5 border-red-700/40'
                    : 'bg-gray-800 border-gray-700'
                }`}
              >
                {/* Post header */}
                <div className="flex items-center gap-3 p-3">
                  <Avatar src={user.avatar} name={user.name} size="sm" />
                  <div className="flex-1">
                    <p className="font-semibold text-white text-sm">{user.name}</p>
                    <p className="text-gray-500 text-xs">{formatTimeAgo(w.createdAt)}</p>
                  </div>
                  {flag && (
                    <span className="bg-red-600/20 text-red-400 text-xs font-semibold px-2 py-0.5 rounded-full animate-pulse">
                      🚩 En revisión
                    </span>
                  )}
                  <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
                    {getExerciseTypes(w).map((t) => (
                      <span
                        key={t}
                        className="bg-indigo-600/20 text-indigo-400 text-xs font-semibold px-2 py-0.5 rounded-full"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Photo */}
                {w.photoURL && (
                  <button
                    onClick={() => setFullscreenPhoto(w.photoURL)}
                    className="w-full"
                  >
                    <img
                      src={w.photoURL}
                      alt={formatExerciseTypes(w)}
                      loading="lazy"
                      className="w-full max-h-96 object-cover hover:opacity-90 transition-opacity"
                    />
                  </button>
                )}

                {/* Stats + description */}
                <div className="p-3">
                  <div className="flex items-center gap-3 text-sm text-gray-400 mb-1">
                    <span>⏱️ {w.duration} min</span>
                    <span>📅 {w.date}</span>
                  </div>
                  {w.description && (
                    <p className="text-gray-300 text-sm">
                      <span className="font-semibold text-white">{user.name}</span>{' '}
                      {w.description}
                    </p>
                  )}
                </div>

                {/* ── Reactions ──────────────────────────────── */}
                {(() => {
                  const reactionMap = w.reactions || {}
                  const myReaction = reactionMap[currentUser?.id]
                  // Aggregate counts per emoji
                  const counts = REACTION_EMOJIS.reduce((acc, e) => {
                    acc[e] = Object.values(reactionMap).filter((v) => v === e).length
                    return acc
                  }, {})
                  return (
                    <div className="px-3 pb-2 flex gap-1.5 flex-wrap">
                      {REACTION_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => handleReaction(w.id, emoji)}
                          className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm transition-all active:scale-90 ${
                            myReaction === emoji
                              ? 'bg-indigo-600/30 ring-1 ring-indigo-500 text-white'
                              : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                          }`}
                        >
                          <span>{emoji}</span>
                          {counts[emoji] > 0 && (
                            <span className="text-xs font-semibold">{counts[emoji]}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )
                })()}

                {/* ── Comments section ───────────────────────── */}
                {(() => {
                  const comments = w.comments || []
                  return (
                    <div className="px-3 pb-2">
                      {/* Existing comments */}
                      {comments.length > 0 && (
                        <div className="space-y-1.5 mb-2">
                          {comments.slice(-5).map((c, i) => {
                            const commenter = getUserInfo(c.userId)
                            return (
                              <div key={i} className="flex gap-2 items-start">
                                <Avatar src={commenter.avatar} name={commenter.name} size="sm" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-gray-300">
                                    <span className="font-semibold text-white">{commenter.name}</span>{' '}
                                    {c.text}
                                  </p>
                                </div>
                              </div>
                            )
                          })}
                          {comments.length > 5 && (
                            <p className="text-xs text-gray-500 pl-10">
                              +{comments.length - 5} comentario(s) anterior(es)
                            </p>
                          )}
                        </div>
                      )}

                      {/* Comment input */}
                      {currentUser && (
                        <div className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={commentText[w.id] || ''}
                            onChange={(e) =>
                              setCommentText((prev) => ({ ...prev, [w.id]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                handleComment(w.id)
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Comentar..."
                            maxLength={140}
                            className="flex-1 bg-gray-700/50 border border-gray-600/50 rounded-full px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleComment(w.id)
                            }}
                            disabled={!(commentText[w.id] || '').trim() || submittingComment === w.id}
                            className="text-indigo-400 hover:text-indigo-300 disabled:text-gray-600 text-sm font-semibold transition-colors"
                          >
                            {submittingComment === w.id ? '...' : 'Enviar'}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* ── Flag & Vote section ────────────────────── */}
                {(() => {
                  // No flag exists: show flag button (only for non-owners)
                  if (!flag && !isOwner) {
                    return (
                      <div className="px-3 pb-3">
                        <button
                          onClick={() => setFlagging(w.id)}
                          className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                        >
                          🚩 Reportar foto
                        </button>
                      </div>
                    )
                  }

                  // Flag exists and current user can vote (not owner, hasn't voted yet)
                  if (flag && !isOwner && !flag.votes[currentUser?.id]) {
                    const flagger = getUserInfo(flag.flaggedBy)
                    return (
                      <div className="px-3 pb-3 bg-amber-900/10 border-t border-amber-700/30">
                        <p className="text-xs text-amber-300 font-semibold py-2">
                          🗳️ {flagger.name} reportó esta foto. ¿Es ejercicio legítimo?
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleVote(w.id, 'legitimate')}
                            className="flex-1 py-2 rounded-xl text-sm font-bold bg-green-600/20 text-green-400 hover:bg-green-600/30 transition-all active:scale-95"
                          >
                            ✅ Legítima
                          </button>
                          <button
                            onClick={() => handleVote(w.id, 'fake')}
                            className="flex-1 py-2 rounded-xl text-sm font-bold bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-all active:scale-95"
                          >
                            ❌ Falsa
                          </button>
                        </div>
                      </div>
                    )
                  }

                  // Flag exists and current user already voted (show their vote + progress)
                  if (flag && !isOwner && flag.votes[currentUser?.id]) {
                    const myVote = flag.votes[currentUser.id]
                    const totalVotes = Object.keys(flag.votes).length
                    return (
                      <div className="px-3 pb-3">
                        <p className="text-xs text-gray-500">
                          🗳️ Votaste: {myVote === 'fake' ? '❌ Falsa' : '✅ Legítima'}
                          {' · '}{totalVotes}/3 votos
                        </p>
                      </div>
                    )
                  }

                  // Flag exists and current user is the owner (show status)
                  if (flag && isOwner) {
                    const totalVotes = Object.keys(flag.votes).length
                    return (
                      <div className="px-3 pb-3">
                        <p className="text-xs text-red-400">
                          🚩 Tu ejercicio está siendo revisado por la familia ({totalVotes}/3 votos)
                        </p>
                      </div>
                    )
                  }

                  return null
                })()}
              </div>
            )
          })}
        </div>
      )}


      {/* Flag confirmation dialog */}
      {flagging && (() => {
        const workout = workouts.find((w) => w.id === flagging)
        if (!workout) return null
        const owner = getUserInfo(workout.userId)
        return (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setFlagging(null)}
          >
            <div
              className="bg-gray-800 rounded-2xl p-6 max-w-sm w-full space-y-4 border border-gray-700"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="text-4xl mb-2">🚩</div>
                <h3 className="text-lg font-bold text-white">Reportar ejercicio</h3>
              </div>
              <div className="flex items-center gap-3 bg-gray-700/50 rounded-xl p-3">
                <Avatar src={owner.avatar} name={owner.name} size="sm" />
                <div>
                  <p className="font-semibold text-white text-sm">{owner.name}</p>
                  <p className="text-xs text-gray-400">{formatExerciseTypes(workout)} · {workout.date}</p>
                </div>
              </div>
              <p className="text-sm text-gray-300 text-center">
                ¿Crees que esta foto no corresponde a ejercicio real?
                Tu voto contará automáticamente como <span className="text-red-400 font-semibold">"Falsa"</span>.
                Los demás miembros votarán también.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setFlagging(null)}
                  className="flex-1 py-3 rounded-xl font-bold text-gray-400 bg-gray-700 hover:bg-gray-600 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleFlag(workout)}
                  className="flex-1 py-3 rounded-xl font-bold bg-red-600 hover:bg-red-500 text-white transition-all active:scale-95"
                >
                  🚩 Reportar
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Fullscreen photo modal */}
      {fullscreenPhoto && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setFullscreenPhoto(null)}
        >
          <button
            className="absolute top-4 right-4 text-white text-3xl z-10"
            onClick={() => setFullscreenPhoto(null)}
          >
            ✕
          </button>
          <img
            src={fullscreenPhoto}
            alt="Foto ampliada"
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>
      )}
    </div>
  )
}
