import type { Anim, Mode } from '../types'
import { MODES } from './pixels'
import { DEFAULTS } from './settings'
import type { Settings } from './settings'
import type { ToolMode } from './status'

export const TICK_MS = 100
const SPEED = 9 // cells per second at normal pace
const RUN_AFTER_TOOL_MS = 4000
const WANDER_PACE = 0.4 // a wandering pet walks at this part of the run speed
const JUMP_YIELDS_MS = 400 // a tool call cuts the start-of-turn hop short after this long

/** What the session is doing, as the hooks last saw it. */
export type Activity = {
  isWorking: boolean
  activeTools: number
  activeMode: ToolMode // the latest tool call's mode
  activeTarget: string
  lastToolAt: number
  room: number // the furthest column a running pet may reach
  wander?: boolean // the pet walks while idle
}

/** The mode the pet holds while nothing starts or ends. */
function settle(w: Activity, t: number): Mode {
  if (!w.isWorking) {
    return 'idle'
  }
  if (w.activeTools > 0) {
    return w.activeMode
  }

  return t - w.lastToolAt < RUN_AFTER_TOOL_MS ? 'run' : 'think'
}

/**
 * The pet one tick later, at time `t`. A turn starting makes it jump and a turn ending makes it cheer. A mode
 * with a fixed length (jump, cheer, error) runs out before the pet settles, sooner at a faster pace. Idle turns
 * to sleep after `sleepAfterMs`. A running pet, or an idle one that wanders, walks and turns at `room`, past the scene's obstacles. An `a` saved
 * by another version of the mod, with a mode this one lacks, starts over idle.
 */
export function step(a: Anim, w: Activity, t: number, s: Pick<Settings, 'pace' | 'sleepAfterMs'> = DEFAULTS): Anim {
  let { mode, since, x, dir } = a
  if (!(mode in MODES)) {
    mode = 'idle'
    since = t
  }
  const length = MODES[mode].once
  const once = length === undefined ? undefined : length / s.pace

  if (a.working && !w.isWorking) {
    mode = 'cheer'
    since = t
  } else if (!a.working && w.isWorking) {
    mode = 'jump'
    since = t
  } else if (once !== undefined) {
    const yields = mode === 'jump' && w.activeTools > 0 && t - since >= JUMP_YIELDS_MS / s.pace
    if (t - since >= once || yields) {
      mode = settle(w, t)
      since = t
    }
  } else {
    let want = settle(w, t)
    const canSleep = s.sleepAfterMs > 0
    if (want === 'idle' && canSleep && (mode === 'sleep' || (mode === 'idle' && t - since >= s.sleepAfterMs))) {
      want = 'sleep'
    }
    if (want !== mode) {
      mode = want
      since = t
    }
  }

  const walks = mode === 'run' || (mode === 'idle' && w.wander === true)
  if (walks) {
    x += (dir * SPEED * (mode === 'run' ? 1 : WANDER_PACE) * s.pace * TICK_MS) / 1000
    if (x >= w.room) {
      x = w.room
      dir = -1
    } else if (x <= 0) {
      x = 0
      dir = 1
    }
  }

  return { mode, since, x, dir, tick: a.tick + 1, working: w.isWorking, target: w.activeTools > 0 ? w.activeTarget : a.target }
}

/** The pet after a failed tool call: an error face, unless it is cheering. */
export function fail(a: Anim, t: number): Anim {
  return a.mode === 'cheer' ? a : { ...a, mode: 'error', since: t }
}
