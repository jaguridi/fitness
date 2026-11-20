// AUTO-GENERATED from src/game/ by scripts/sync-game.mjs — DO NOT EDIT.
// Run `node scripts/sync-game.mjs` after changing the source module.

// Pure game constants — shared between the web client and Cloud Functions.
// IMPORTANT: this module must stay free of imports (no Firebase, no React,
// no date-fns) so it can run unchanged in both environments.

// Processing order for the week close (matches USERS in src/constants.js).
export const USER_IDS = ['user1', 'user2', 'user3', 'user4']

// Grammatical gender per family member, for gendered Spanish copy and to stop
// AI-generated recaps from guessing wrong (e.g. "Javi" defaulting to male).
// Jose & Gonza are men; Javi & Fran are women.
export const USER_GENDER = { user1: 'm', user2: 'f', user3: 'm', user4: 'f' }

// Personal weekly goal (sessions per week). Each member picks their own.
export const DEFAULT_WEEKLY_GOAL = 3
export const MIN_WEEKLY_GOAL = 1
export const MAX_WEEKLY_GOAL = 7

// First week closed with the v2 rules (no fines). Earlier weeks keep their v1
// summaries untouched and are never closed by v2 (a missing
// settings/meta.v2LastClosedWeekId counts as the week before this one).
export const V2_START_WEEK = '2026-W47'

// Habit targets (days per week). 7 = daily habit.
export const MIN_HABIT_TARGET = 1
export const MAX_HABIT_TARGET = 7

// The v1 Cloud Function / cached v1 clients skip their (fining) week close
// when settings/meta.lastAutoProcessedWeekId is in the future. v2 "parks" it
// here forever; the v2 close uses its own lock (v2LastClosedWeekId).
export const V1_LOCK_PARKED = '9999-W99'
