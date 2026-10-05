export type Mode =
  | 'idle'
  | 'sleep'
  | 'think'
  | 'read'
  | 'search'
  | 'edit'
  | 'bash'
  | 'web'
  | 'agent'
  | 'run'
  | 'jump'
  | 'cheer'
  | 'error'

export type Anim = {
  mode: Mode
  since: number
  x: number
  dir: 1 | -1
  tick: number
  target: string
  working: boolean // whether a turn was running at the last tick
}

declare module 'claude-code' {
  interface PluginState {
    'pixel-pet': { anim: Anim }
  }
}
