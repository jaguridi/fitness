import { useState } from 'react'
import { USERS } from '../constants'
import { voteOnJustification, resolveJustificationVote } from '../services/firebaseService'
import Avatar from './Avatar'

/**
 * Card shown to family members to vote on a pending justification.
 * Appears when the AI Judge couldn't evaluate and the justification
 * was sent to family voting.
 */
export default function JustificationVoteCard({ justification, currentUserId }) {
  const [voting, setVoting] = useState(false)

  const owner = USERS.find((u) => u.id === justification.userId)
  const isOwner = justification.userId === currentUserId
  const votes = justification.votes || {}
  const myVote = votes[currentUserId]
  const eligibleVoters = USERS.filter((u) => u.id !== justification.userId)
  const totalVotes = Object.keys(votes).length
  const approves = Object.values(votes).filter((v) => v === 'approve').length
  const rejects = Object.values(votes).filter((v) => v === 'reject').length

  const handleVote = async (vote) => {
    setVoting(true)
    try {
      await voteOnJustification(justification.id, currentUserId, vote)

      // Check if we should resolve (all eligible voters voted, or majority reached)
      const updatedVotes = { ...votes, [currentUserId]: vote }
      const newTotal = Object.keys(updatedVotes).length
      await resolveJustificationVote(justification.id, updatedVotes, eligibleVoters.length)
    } catch (err) {
      console.error('Vote error:', err)
    } finally {
      setVoting(false)
    }
  }

  // Owner sees pending status
  if (isOwner) {
    return (
      <div className="bg-amber-900/20 border border-amber-700/30 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🗳️</span>
          <div>
            <p className="font-semibold text-amber-300">Justificación en votación</p>
            <p className="text-xs text-amber-400/70">
              La IA no pudo evaluar tu caso. La familia está votando ({totalVotes}/{eligibleVoters.length} votos).
            </p>
          </div>
        </div>
        <div className="mt-2 bg-amber-900/30 rounded-xl p-2">
          <p className="text-xs text-amber-300 truncate">{justification.excuse}</p>
        </div>
      </div>
    )
  }

  // Already voted
  if (myVote) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-2">
          <Avatar src={owner?.avatar} name={owner?.name} size="sm" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">{owner?.name}</p>
            <p className="text-xs text-gray-400">Justificación en votación</p>
          </div>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            myVote === 'approve' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'
          }`}>
            {myVote === 'approve' ? '✓ Aprobaste' : '✗ Rechazaste'}
          </span>
        </div>
        <p className="text-xs text-gray-500">{totalVotes}/{eligibleVoters.length} votos emitidos</p>
      </div>
    )
  }

  // Can vote
  return (
    <div className="bg-amber-900/10 border border-amber-700/30 rounded-2xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <Avatar src={owner?.avatar} name={owner?.name} size="sm" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">{owner?.name}</p>
          <p className="text-xs text-amber-400">Necesita tu voto - La IA no pudo evaluar</p>
        </div>
        <span className="text-lg">🗳️</span>
      </div>

      <div className="bg-gray-800/50 rounded-xl p-3 mb-3">
        <p className="text-xs text-gray-400 mb-1">Justificación:</p>
        <p className="text-sm text-gray-200">{justification.excuse}</p>
        {justification.evidencePhotoURL && (
          <img
            src={justification.evidencePhotoURL}
            alt="Evidencia"
            className="mt-2 rounded-lg w-full max-h-32 object-cover"
          />
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => handleVote('approve')}
          disabled={voting}
          className="flex-1 py-2.5 rounded-xl font-bold bg-green-600 hover:bg-green-500 text-white text-sm transition-all active:scale-95 disabled:opacity-50"
        >
          ✓ Aprobar
        </button>
        <button
          onClick={() => handleVote('reject')}
          disabled={voting}
          className="flex-1 py-2.5 rounded-xl font-bold bg-red-600 hover:bg-red-500 text-white text-sm transition-all active:scale-95 disabled:opacity-50"
        >
          ✗ Rechazar
        </button>
      </div>

      <p className="text-xs text-gray-500 mt-2 text-center">
        {totalVotes}/{eligibleVoters.length} votos — se necesitan {Math.ceil(eligibleVoters.length / 2)} para resolver
      </p>
    </div>
  )
}
