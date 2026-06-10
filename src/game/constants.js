// Pure game constants — shared between the web client and Cloud Functions.
// IMPORTANT: this module must stay free of imports (no Firebase, no React,
// no date-fns) so it can run unchanged in both environments.

// Processing order for the week-end close (matches USERS in src/constants.js).
export const USER_IDS = ['user1', 'user2', 'user3', 'user4']

export const WEEKLY_GOAL = 3
export const BASE_FINE = 5000
export const MAX_FINE = 40000
export const EXTRA_LIFE_THRESHOLD = 5
export const MAX_LIVES_PER_WEEK = 1

// Extras → fine redemption: bank N sessions above WEEKLY_GOAL (and not consumed
// by frozen-week debt) and auto-redeem each batch for FINE_REDEMPTION_AMOUNT
// off the wallet at week-end. Carries forward indefinitely; redeems whenever a
// pending fine exists.
export const EXTRAS_PER_FINE_REDEMPTION = 10
export const FINE_REDEMPTION_AMOUNT = BASE_FINE
