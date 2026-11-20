# FitFamily v2 — plan del rediseño

Estado: en implementación en la rama `v2-rediseno`. Nada de esto está desplegado.

## 1. Qué cambia y por qué

La v1 era un juego de multas. Al bajar el uso, las multas se dispararon solas
(W44–W46 llegaron al tope de $40.000) y el juego dejó de ser divertido. La v2
conserva lo que sí funcionaba —la mini red social familiar— y cambia el motor:

| v1 (multas) | v2 (logros) |
|---|---|
| Meta fija de 3 sesiones, multa si fallas | Meta semanal propia (1–7 sesiones), sin multas |
| Pozo, muro de la vergüenza, vidas, escudos, canjes | Rachas y un álbum de láminas (logros) |
| Juez IA, justificaciones, congelar semanas, deuda | "Semana de descanso": un toque, no rompe la racha |
| Solo ejercicio | Ejercicio + hábitos personales (leer, meditar, agua…) |
| Foto obligatoria + reportar fotos falsas | Foto obligatoria (se mantiene); sin reportes ni votaciones |
| Sin metas propias | Metas personales: cada uno se pone las suyas, con plazo y recompensa opcional |
| Feed: ejercicios, justificaciones, logros | Feed: ejercicios, láminas nuevas, resultado semanal de la familia |

Se mantiene: los 4 miembros (Jose, Javi, Gonza, Fran), login con PIN, fotos,
reacciones, comentarios, empujones, notificaciones push, resumen semanal con IA,
PWA instalable, todo el historial de ejercicios.

Decisiones del dueño del producto (José, 20-nov-2026), que mandan sobre cualquier otra parte del plan:
- **La foto es obligatoria** al registrar un ejercicio, igual que en la v1 (incluida la validación de fecha EXIF).
- **Metas personalizables**: cada persona decide cuántas veces por semana entrena y además puede ponerse
  sus propias metas (ver "Metas personales" en §3).
- **Se elimina el cobro de multas** por completo: del código (cliente y functions) y de producción.

## 2. Respaldo de la v1

- Git: tag `v1.8.0-multas` y rama `legacy/v1-multas` (código completo de la v1).
- Datos: `scripts/dev-only/backups/pre-v2-*.json` (export de todo Firestore, local, no versionado).
- Firestore: la v2 **no borra ni modifica** colecciones ni campos de la v1
  (`walletBalance`, `extraLives`, `absences`, `justifications`, …). Solo agrega.
- En la app: página "Archivo" (solo lectura) con el cierre de la temporada de multas.
- Volver a la v1 = desplegar functions y reglas desde el tag y publicar la rama legacy.

## 3. Reglas del producto v2

**Semana** (lunes a domingo, mismos `weekId` de siempre, p. ej. `2026-W47`).
- Cada persona tiene `weeklyGoal` (sesiones por semana, 1–7, por defecto 3). La cambia en su perfil.
- Estado de la semana: `completed` (sesiones ≥ meta), `missed`, o `rest` (semana de descanso).
- Semana de descanso: la marca la persona para la semana en curso (o la siguiente). Es neutra: ni suma ni rompe racha.
- **Racha** = semanas logradas consecutivas, contando hacia atrás desde la última semana cerrada
  (+1 si la semana actual ya está lograda). Semanas neutras se saltan: `rest` y, del historial v1,
  `frozen`, `holiday`, `paused`. Rompen: `missed` y `justified`. Cuenta como lograda: `completed` o `lifeUsed`.
- `V2_START_WEEK = '2026-W47'`: desde esa semana el cierre es v2 (sin multas). Las anteriores no se tocan.
  Todos parten la temporada 2 con racha 0 (las últimas semanas v1 fueron `missed`).

**Hábitos**
- Cada persona crea los suyos: nombre, emoji y cuántos días por semana (1–7; 7 = diario).
  Hay una lista de sugerencias (leer, meditar, tomar agua, dormir 7 h, estirar, sin azúcar, sin pantallas antes de dormir, caminar…).
- Se marcan con un toque, para hoy o para cualquier día ya pasado de la semana en curso.
- Visibilidad: `family` (por defecto, la familia lo ve) o `private` (solo su dueño lo ve en la app;
  no aparece en perfiles ajenos ni en el resultado semanal). Es privacidad de interfaz, no de seguridad.
- Un hábito se "logra" en la semana si días marcados ≥ meta. Racha del hábito = semanas logradas seguidas
  (para hábitos diarios se muestra además la racha en días).
- Los hábitos no afectan si la semana de ejercicio se logra o no; se muestran al lado.
- Se pueden archivar (no borrar), para conservar historial.

**Metas personales**
- Además de su meta semanal de sesiones, cada persona puede crear metas propias con plazo:
  título, emoji, fecha de inicio y de término, y un objetivo que puede ser
  - *automático* (se mide solo con lo registrado): sesiones, minutos o calorías en el período, con filtro
    opcional por tipo de ejercicio ("12 sesiones en diciembre", "600 minutos este mes", "Yoga 8 veces antes
    del 31"), o días marcados de un hábito ("Leer 20 días este mes");
  - *libre* (avance manual): un número con unidad que la persona va actualizando ("Correr 100 km",
    "Leer 4 libros"), o simplemente marcar "lograda".
- **Recompensa opcional**: un texto libre ("Si lo logro, me compro las zapatillas"). Se muestra junto a la meta
  y, al lograrla, en el feed ("Jose logró su meta y se ganó: …").
- Estados: `active` → `achieved` (al alcanzar el objetivo; lo registra el cliente del dueño una sola vez)
  o `missed` (venció el plazo sin lograrla) o `cancelled`. Sin castigo por no lograrla.
- Visibilidad `family` (por defecto) o `private`, igual que los hábitos.
- Feed: "X se propuso una meta" al crearla y "X logró su meta" al cumplirla (solo las `family`),
  ambas con reacciones y comentarios. Push a la familia en ambos casos.
- Plantillas rápidas al crear: sesiones este mes, minutos esta semana, un deporte N veces, meta libre.
- Las metas no afectan la racha semanal.

**Logros = álbum de láminas**
- Cada logro es una lámina numerada con rareza: común, rara, épica, legendaria.
- Páginas del álbum (categorías): Constancia, Volumen, Minutos, Calorías, Variedad, Hábitos, Familia, Especiales.
- Se conservan los logros v1 con sus ids. Los que dependían de multas/vidas/escudos
  (`clean_record`, `shield_earned`, `life_saver`) pasan a "Clásicas": solo se muestran si ya estaban ganadas.
- Nuevas: hábitos (primer hábito marcado, 7 y 30 días seguidos de un hábito, semana perfecta de hábitos,
  4 semanas logrando todos los hábitos), familia (los 4 logran la misma semana; 2 y 4 semanas seguidas así),
  sociales (primer comentario, 25 reacciones dadas), temporada 2 (primera sesión de la temporada),
  metas (primera meta lograda, 5 metas logradas, una meta lograda antes de la mitad del plazo).
- Cada lámina no ganada muestra su progreso cuando es medible (p. ej. 3 de 4 semanas).
- Ganar una lámina: animación de "pegar la lámina", publicación en el feed (con reacciones y comentarios)
  y push a la familia.
- Primera vez que alguien abre la v2: sus láminas ya ganadas por historial se registran en silencio
  (`seeded: true`, fecha antigua) para no inundar el feed.

**Cierre semanal** (lunes 00:10, Cloud Function; el cliente lo hace si la función no corrió)
- Idempotente: solo escribe `weekly_summaries/{userId}_{weekId}` y `week_posts/{weekId}`; no toca saldos.
- Publica en el feed una tarjeta "Resultado de la semana" con los 4: logró / no logró / descanso,
  sesiones vs meta, hábitos logrados, racha, y el resumen con IA. Se puede reaccionar y comentar.
- Push personal: "Semana lograda, racha de N" o "Esta semana no salió; la próxima parte de cero" (sin regaños).
- También marca como `missed` las metas personales vencidas sin lograr.
- **Candado propio**: el cierre v2 usa `settings/meta.v2LastClosedWeekId` (mismo protocolo de "claim"
  con `settings/meta.v2Processing`). No usa `lastAutoProcessedWeekId`.
- **Interruptor de multas v1**: tanto la función v2 (en cada ejecución) como el cliente v2 (al iniciar) dejan
  `settings/meta.lastAutoProcessedWeekId = '9999-W99'` si no lo está (guardando el valor anterior en
  `v1LastProcessedWeekId`). Con ese candado estacionado en el futuro, la función v1 y cualquier cliente v1
  en caché se saltan el cierre para siempre: nadie vuelve a cobrar una multa.
  `scripts/dev-only/disable-v1-fines.mjs` hace lo mismo a mano (y `--revert` lo deshace).

**Notificaciones**: lunes (meta de la semana), jueves (si vas atrasado), domingo (último día),
social (alguien entrenó, comentó, reaccionó, ganó una lámina), y un recordatorio de hábitos a las 20:30
solo si te quedan hábitos sin marcar y lo tienes activado (`prefs.habitReminder`, activado por defecto).
Ninguna menciona multas.

## 4. Modelo de datos (Firestore)

Sin cambios: `workouts` (`photoURL` sigue siendo obligatorio), `weekly_recaps`, `monthly_recaps`.
`settings/meta`: + `v2LastClosedWeekId`, `v2Processing`, `v1LastProcessedWeekId`, `v1FinesDisabledAt`.
Congeladas (solo lectura desde la v2): `absences`, `justifications`, `flagged_workouts`.

```
users/{userId}                    + weeklyGoal: number (1–7)
                                  + restWeeks: string[]            // weekIds
                                  + prefs: { habitReminder: boolean }
                                  + v2SeededAt: timestamp          // láminas históricas ya registradas
                                  (campos v1 intactos)

habits/{autoId}                   { userId, name, emoji, targetPerWeek (1–7),
                                    visibility: 'family'|'private', archived: boolean,
                                    order: number, createdAt }

habit_weeks/{userId}_{weekId}     { userId, weekId, checks: { [habitId]: ['yyyy-MM-dd', …] }, updatedAt }

weekly_summaries/{userId}_{weekId}   (v2)  { userId, weekId, v: 2, status: 'completed'|'missed'|'rest',
                                    sessions, goal, totalRequired: goal, minutes,
                                    habits: { total, met, items: [{ habitId, name, emoji, done, target }] } }
                                    // items solo incluye hábitos 'family'

week_posts/{weekId}               { weekId, v: 2, results: [{ userId, status, sessions, goal, streak,
                                    habitsMet, habitsTotal }], recap?: string, createdAt,
                                    reactions: { [userId]: emoji }, comments: [{ userId, text, createdAt }] }

achievement_unlocks/{userId}_{achievementId}   + reactions, comments (misma forma que workouts)

goals/{autoId}                    { userId, title, emoji,
                                    kind: 'auto'|'manual',
                                    metric: 'sessions'|'minutes'|'calories'|'habit'   // solo kind 'auto'
                                    exerciseType?: string, habitId?: string,          // filtros de 'auto'
                                    target: number, unit?: string,                    // unit solo 'manual'
                                    progress?: number,                                // solo 'manual'
                                    startDate, endDate ('yyyy-MM-dd'),
                                    reward?: string,
                                    visibility: 'family'|'private',
                                    status: 'active'|'achieved'|'missed'|'cancelled',
                                    achievedAt?, createdAt,
                                    reactions, comments }
```

## 5. Arquitectura del cliente

```
src/
  main.jsx  App.jsx  index.css  firebase.js  constants.js
  game/          Lógica pura compartida con Cloud Functions (se copia a functions/game con scripts/sync-game.mjs).
                 Sin imports externos. weekId.js, constants.js, recapText.js (se mantienen) +
                 week.js (estado y cierre v2), streaks.js, habits.js. Con tests en __tests__/.
  domain/        Lógica pura solo-cliente: achievements.js (definiciones, rareza, progreso), feed.js.
  data/          backend.firebase.js · backend.demo.js · index.js (elige backend) ·
                 FamilyDataProvider.jsx (useFamily) · selectors.js
  auth/          AuthContext.jsx (PIN, igual que hoy)
  components/ui/ Primitivas del sistema de diseño
  features/      today/ · log/ · habits/ · feed/ · member/ · achievements/ · profile/ · stats/ · auth/
  utils/         compressImage.js, extractPhotoDate.js, uploadErrors.js (se mantienen)
```

- **Un solo almacén de datos**: `FamilyDataProvider` se suscribe una vez a `users`, `workouts`,
  `weekly_summaries`, `habits`, `habit_weeks`, `achievement_unlocks`, `week_posts` (≈300 ejercicios y
  ≈150 resúmenes hoy: a escala familiar es barato) y todo lo demás se deriva con selectores puros.
  Se acaba el `gameState` pasado por props y las cargas duplicadas por página.
- **Backends intercambiables**: `firebase` (producción) y `demo` (en memoria, con datos de ejemplo
  realistas de las 4 personas). `vite --mode demo` (`VITE_DEMO=1`) usa el demo: sirve para desarrollar y
  verificar sin escribir en producción ni disparar notificaciones a la familia.
  `vite --mode readonly` (`VITE_READONLY=1`) usa Firebase real pero convierte toda escritura en un no-op con log.
- Rutas (HashRouter): `/` Hoy · `/familia` feed · `/logros` álbum · `/perfil` · `/u/:userId` perfil de un miembro ·
  `/habitos` gestionar hábitos · `/metas` metas personales · `/stats` · `/archivo` · `/novedades`. Las rutas v1 `/feed` y `/user/:id` redirigen.
- Navegación inferior: Hoy · Familia · (+ registrar) · Logros · Perfil.

## 6. Dirección de diseño — "el álbum de la familia"

Idea: la app es el álbum de láminas de la familia. Lo memorable son **las láminas** (logros troquelados,
con borde blanco, levemente rotados, las legendarias con brillo holográfico) y **el color de cada persona**.
Todo lo demás es papel y tinta: tranquilo, legible, con mucho aire.

- Color. Papel `#F2F4F7`, superficie `#FFFFFF`, tinta `#16203A`, tinta suave `#5B6478`, línea `#DCE1E8`.
  Un color por persona, usado en su anillo de avatar, sus tarjetas y sus gráficos:
  Jose naranja `#F4511E`, Javi turquesa `#00A6A6`, Gonza azul `#2563EB`, Fran amarillo `#F5B700`.
  Botón principal en tinta (no en un color de marca). Logrado: verde `#1FA35C`. No logrado: neutro
  (tinta suave), nunca rojo de alarma. Tema oscuro con los mismos tokens (papel `#0E1528`,
  superficie `#18223A`, tinta `#EEF1F6`, línea `#2A3653`); sigue al sistema y se puede fijar en Perfil.
- Tipografía. Una sola familia: Bricolage Grotesque (variable, autoalojada con
  `@fontsource-variable/bricolage-grotesque`, sin CDN por el modo offline). Titulares 700–800 con
  tracking apretado y tamaño generoso; texto 400–500 a 15–16 px; números tabulares.
  Escala: 12 / 14 / 16 / 20 / 26 / 34 / 44.
- Composición. Móvil primero, una columna (máx. ~28rem), alineación a la izquierda.
  El titular de "Hoy" es el estado mismo ("Te falta 1 sesión para lograr la semana"), no un rótulo.
  No todo es una tarjeta: las secciones viven sobre el papel; solo los grupos interactivos usan superficie.
  Radios con jerarquía (superficies 20 px, controles 12 px, chips redondos), no un mismo radio para todo.
- Estructura que informa. Anillo del avatar **segmentado**: un segmento por sesión de la meta, relleno al
  registrar. Tira de la semana L M M J V S D con los días entrenados. Cada hábito con sus 7 puntos de la semana.
  Láminas vacías con contorno punteado y su número.
- Movimiento. Un momento protagonista: la lámina que "se pega" al ganarla. Además solo respuestas a
  acciones (marcar un hábito, abrir una hoja). Respetar `prefers-reduced-motion`.
- Iconos de interfaz: lucide-react. Emojis solo como contenido (glifo de una lámina, emoji de un hábito,
  reacciones), no como decoración de títulos y botones.
- Evitar: rótulos en mayúsculas con tracking, cadenas con puntos medios "A · B · C", flechas "→" en botones,
  degradados decorativos, la misma sombra gris en todo, índigo sobre gris oscuro (el look de la v1).
- Voz: español neutro de tú (nunca voseo). Frases cortas y directas, celebratorias sin exagerar.
  Un botón dice lo que hace ("Registrar ejercicio", "Guardar hábito"). Los vacíos invitan a actuar.
  Sin vergüenza ni castigo en ningún texto.

## 7. Fases de implementación

1. **Cimientos** (2 agentes en paralelo)
   - 1A Datos y dominio: `src/game`, `src/domain`, `src/data`, `src/auth`, `src/constants.js`, tests, backend demo.
   - 1B Sistema de diseño y carcasa: `index.css`, fuente, `components/ui`, `App.jsx`, navegación,
     páginas provisionales, galería `/dev/ui`, limpieza de componentes y páginas v1.
2. **Funcionalidades** (en paralelo, carpetas disjuntas)
   - 2A Hoy + registrar ejercicio (`features/today`, `log`)
   - 2B Hábitos + metas personales (`features/habits`, `goals`)
   - 2C Familia (feed) + perfil de miembro (`features/feed`, `member`)
   - 2D Logros: álbum, lámina, celebración, registro de desbloqueos (`features/achievements`)
   - 2E Perfil, ajustes, estadísticas, archivo, novedades (`features/profile`, `stats`)
   - 2F Backend: `functions/`, `firestore.rules`, `storage.rules`, manifest, scripts
3. **Integración y verificación**: tests, build, recorrido en modo demo (claro/oscuro, móvil),
   revisión con datos reales en modo solo-lectura.

## 8. Puesta en producción (requiere tu visto bueno, en este orden)

0. (Opcional, inmediato) `node scripts/dev-only/disable-v1-fines.mjs` — estaciona el candado v1: nadie vuelve
   a cobrar multas aunque no se haya desplegado nada.
1. `firebase deploy --only firestore:rules,storage --dry-run` y luego sin `--dry-run` — reglas nuevas.
   No se pudieron compilar localmente (el emulador pide Java 21); el dry-run es su primera validación.
   Sin estas reglas la app v2 no puede leer `habits`, `habit_weeks`, `goals` ni `week_posts`.
   Con ellas, un cliente v1 en caché ya no puede escribir multas ni justificaciones.
2. `firebase deploy --only functions` — cierre semanal sin multas y notificaciones nuevas. El CLI pedirá borrar
   las tres funciones que ya no existen en el código: `evaluateJustification`, `onJustificationCreated`,
   `onJustificationUpdated`.
   **Mientras ni el paso 0 ni este se hagan, el lunes 00:10 la función v1 sigue cobrando multas.**
3. Commit, merge de `v2-rediseno` a `master` y push — Vercel publica en fitness.jaguridi.cl.
4. El lunes siguiente: `node scripts/dev-only/inspect-state.js` (solo lectura) para revisar candados, resumen IA
   y que los resultados se hayan notificado.

Modos de desarrollo: `vite --mode demo` (datos de ejemplo en memoria) y `vite --mode readonly` (Firebase real,
toda escritura es un no-op). `vite` a secas escribe en producción y dispara notificaciones a la familia.
