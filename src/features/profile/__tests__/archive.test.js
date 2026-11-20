import { describe, it, expect } from 'vitest'
import { buildArchive, isV1Summary, archiveStatus } from '../archive.js'

// Small synthetic fixtures shaped like v1 docs (never real data).
const members = [
  { id: 'a', name: 'Ana', walletBalance: 6000, extraLives: 1, hasShield: true },
  { id: 'b', name: 'Beto', extraLives: 0 }, // no walletBalance: falls back to fineApplied
  { id: 'c', name: 'Caro' }, // no v1 data at all
]

const summaries = [
  { userId: 'a', weekId: '2026-W10', status: 'completed', sessions: 3, fineApplied: 0 },
  { userId: 'a', weekId: '2026-W11', status: 'missed', sessions: 1, fineApplied: 2000, lifeUsed: true },
  { userId: 'a', weekId: '2026-W12', status: 'holiday', sessions: 0, holidayName: 'Semana Santa' },
  { userId: 'a', weekId: '2026-W13', status: 'completed', sessions: 4 },
  { userId: 'b', weekId: '2026-W10', status: 'missed', sessions: 0, fineApplied: 1000 },
  { userId: 'b', weekId: '2026-W12', status: 'justified', sessions: 1, fineApplied: 500 },
  { userId: 'b', weekId: '2026-W13', status: 'frozen' },
  // v2 docs must be ignored
  { userId: 'a', weekId: '2026-W47', v: 2, status: 'completed', sessions: 3 },
  { userId: 'b', weekId: '2026-W46', v: 2, status: 'missed', sessions: 0 },
]

describe('isV1Summary / archiveStatus', () => {
  it('keeps only pre-v2, non-v2 docs', () => {
    expect(isV1Summary({ weekId: '2026-W46', status: 'missed' })).toBe(true)
    expect(isV1Summary({ weekId: '2026-W46', v: 2 })).toBe(false)
    expect(isV1Summary({ weekId: '2026-W48' })).toBe(false)
    expect(isV1Summary({ status: 'missed' })).toBe(false)
  })
  it('maps a life-saved week to completed and unknown statuses to null', () => {
    expect(archiveStatus({ status: 'missed', lifeUsed: true })).toBe('completed')
    expect(archiveStatus({ status: 'weird' })).toBe(null)
    expect(archiveStatus(null)).toBe(null)
  })
})

describe('buildArchive', () => {
  const a = buildArchive({ members, summaries })

  it('computes the season span over every week, including gaps', () => {
    expect(a.hasData).toBe(true)
    expect(a.firstWeekId).toBe('2026-W10')
    expect(a.lastWeekId).toBe('2026-W13')
    expect(a.weekIds).toEqual(['2026-W10', '2026-W11', '2026-W12', '2026-W13'])
  })

  it('uses walletBalance as the fine total, falling back to fineApplied', () => {
    const [ana, beto, caro] = a.members
    expect(ana.fines).toBe(6000)
    expect(beto.fines).toBe(1500)
    expect(caro.fines).toBe(0)
    expect(a.pot).toBe(7500)
  })

  it('counts weeks, sessions, lives and best streak', () => {
    const [ana, beto, caro] = a.members
    expect(ana.achieved).toBe(3) // W10, W11 (life), W13
    expect(ana.missed).toBe(0)
    expect(ana.livesUsed).toBe(1)
    expect(ana.bestStreak).toBe(3) // holiday is neutral
    expect(ana.sessions).toBe(8)
    expect(ana.lives).toBe(1)
    expect(ana.shield).toBe(true)
    expect(beto.missed).toBe(1)
    expect(beto.counts).toMatchObject({ missed: 1, justified: 1, frozen: 1, completed: 0 })
    expect(beto.shield).toBe(null)
    expect(caro.lives).toBe(null)
    expect(caro.weeks.every((w) => w.status === null)).toBe(true)
    expect(a.totalSessions).toBe(9)
    expect(a.weeksAchieved).toBe(3)
  })

  it('fills the strip with nulls for weeks without a summary', () => {
    const beto = a.members[1]
    expect(beto.weeks.map((w) => w.status)).toEqual(['missed', null, 'justified', 'frozen'])
    expect(a.members[0].weeks[2].holidayName).toBe('Semana Santa')
  })

  it('renders an empty archive without v1 data or fields', () => {
    const empty = buildArchive({ members: [{ id: 'x', name: 'X' }], summaries: [{ userId: 'x', weekId: '2026-W48', v: 2 }] })
    expect(empty.hasData).toBe(false)
    expect(empty.weekIds).toEqual([])
    expect(empty.pot).toBe(0)
    expect(empty.members[0].weeks).toEqual([])
    expect(buildArchive().hasData).toBe(false)
  })

  it('tolerates junk values', () => {
    const r = buildArchive({
      members: [{ id: 'z', walletBalance: 'abc', extraLives: null }],
      summaries: [{ userId: 'z', weekId: '2026-W20', status: 'missed', sessions: 'x', fineApplied: undefined }],
    })
    expect(r.members[0].fines).toBe(0)
    expect(r.members[0].sessions).toBe(0)
    expect(r.members[0].lives).toBe(null)
  })
})
