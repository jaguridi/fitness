/**
 * Sistema de diseño de FitFamily v2 — importa todo desde aquí:
 *
 *   import { Button, Surface, Section, AvatarRing, Sticker, Sheet, memberProps } from '../../components/ui'
 *
 * Cada archivo trae su uso documentado en el encabezado. La galería viva está en
 * `#/dev/ui` (solo en desarrollo): src/features/dev/UiGallery.jsx.
 */
export { default as Button } from './Button'
export { default as IconButton } from './IconButton'
export { default as Surface } from './Surface'
export { default as Section } from './Section'
export { default as PageHeader } from './PageHeader'
export { default as Sheet } from './Sheet'
export { Dialog, ConfirmDialog } from './Dialog'
export { default as Avatar, AVATAR_SIZES, avatarSrc } from './Avatar'
export { default as AvatarRing } from './AvatarRing'
export { default as WeekStrip, DAY_LETTERS, DAY_NAMES } from './WeekStrip'
export { default as HabitDots } from './HabitDots'
export { default as ProgressBar } from './ProgressBar'
export { default as GoalProgress } from './GoalProgress'
export { Chip, Tag } from './Chip'
export { default as Toggle } from './Toggle'
export { default as Stepper } from './Stepper'
export { Field, TextField, TextArea, inputClass } from './Field'
export { default as SegmentedControl } from './SegmentedControl'
export { default as EmptyState } from './EmptyState'
export { default as Skeleton, SkeletonText } from './Skeleton'
export { default as Sticker, STICKER_SIZES, RARITIES, RARITY_LABEL, stickerLook } from './Sticker'
export { default as PhotoViewer } from './PhotoViewer'
export { default as ReactionBar, REACTION_PALETTE } from './ReactionBar'
export { default as CommentThread } from './CommentThread'
export { default as MemberName, memberName, findMember } from './MemberName'
export { default as Toaster } from './Toaster'
export { memberColor, memberInk, memberOn, memberTint, memberProps } from './member'
export { useTheme, useResolvedTheme, useThemeSync, setThemePreference, THEME_OPTIONS } from './theme'
export { default as useModal } from './useModal'
export { cx, hashString } from './cx'
export { toDate, timeAgo } from './time'
