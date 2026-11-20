/**
 * Metas personales — piezas reutilizables:
 *   GoalItem          una meta en una lista (GoalProgress + ritmo + "Privada")
 *   GoalDetailSheet   la meta de cerca: lo que contó, avance manual, editar/cancelar
 *   GoalEditorSheet   crear desde plantillas o editar
 *   TemplateList      las plantillas rápidas como filas tocables
 *   SelectField, DateField  controles de formulario locales
 */
export { default as GoalsPage } from './GoalsPage'
export { default as GoalItem } from './GoalItem'
export { default as GoalDetailSheet } from './GoalDetailSheet'
export { default as GoalEditorSheet } from './GoalEditorSheet'
export { TemplateList, SelectField, DateField } from './formControls'
export * from './goalForm'
