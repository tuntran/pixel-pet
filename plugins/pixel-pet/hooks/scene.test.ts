import { expect, test } from 'claude-code/testing'

import { HEIGHT } from './pixels'
import { DRIFT_MS, GROUND_H, drawBand, layScene } from './scene'
import type { Scene } from './scene'
import { animate, readTheme } from './theme'

const rock = ['.rr.', 'rrrr']
const bodyOf = (v: unknown) => {
  const read = readTheme(v)
  if (read.errors) {
    throw new Error(read.errors.join('\n'))
  }
  return animate(read.theme)
}
const scene: Scene = { ground: ['gg.'], obstacles: [rock, ['r', 'r', 'r']], decor: [['y'], ['yy', '..']], every: 40 }

test('a scene lays out the same way at the same width, with obstacles spread apart and decor clear of them', () => {
  const layout = layScene(scene, 300)
  expect(layScene(scene, 300)).toEqual(layout)
  const spans = layout.obstacles.map(o => ({ x: o.x, w: Math.max(...o.rows.map(r => r.length)) }))
  expect(spans[0]?.x).toBe(24)
  expect(spans.every(o => o.x + o.w <= 300)).toBe(true)
  for (let k = 1; k < spans.length; k++) {
    const [a, b] = [spans[k - 1], spans[k]] as [{ x: number; w: number }, { x: number; w: number }]
    expect(b.x - (a.x + a.w) >= 20 + 3).toBe(true)
  }
  const clearOf = (x: number, w: number) => spans.every(o => x + w < o.x - 1 || x > o.x + o.w)
  expect(layout.decor.length > 0 && layout.decor.every(d => clearOf(d.x, d.rows[0]?.length ?? 0))).toBe(true)
})

test('the band draws the ground across its width, obstacles on the ground, and the pet over them', () => {
  const body = bodyOf({ sprite: ['b'], palette: { b: '#222222', g: '#00ff00', r: '#ff0000', y: '#ffff00' } })
  const layout = { width: 10, obstacles: [{ x: 4, rows: rock }], decor: [] }
  const picture = { w: 2, h: HEIGHT, px: [...new Array(2 * (HEIGHT - 1)).fill(-1), 0x222222, 0x222222] }
  const band = drawBand(body, scene, layout, picture, 5, 0)
  const at = (x: number, y: number) => band.px[y * band.w + x]
  expect([band.w, band.h]).toEqual([10, HEIGHT + GROUND_H])
  expect([0, 1, 2, 3, 9].map(x => at(x, HEIGHT))).toEqual([0x00ff00, 0x00ff00, -1, 0x00ff00, 0x00ff00])
  expect([at(4, HEIGHT - 1), at(5, HEIGHT - 2), at(4, HEIGHT - 2)]).toEqual([0xff0000, 0xff0000, -1])
  expect([at(5, HEIGHT - 1), at(6, HEIGHT - 1)]).toEqual([0x222222, 0x222222])
})

test('raised decor drifts left and comes back in from the right; decor on the ground stays', () => {
  const body = bodyOf({ sprite: ['b'], palette: { b: '#222222', y: '#ffff00', g: '#00ff00' } })
  const layout = { width: 10, obstacles: [], decor: [{ x: 1, rows: ['yy', '..'], drift: 1000 }, { x: 6, rows: ['g'] }] }
  const picture = { w: 1, h: HEIGHT, px: new Array(HEIGHT).fill(-1) }
  const cloud = (ms: number) => {
    const band = drawBand(body, scene, layout, picture, 0, ms)
    return [...Array(10).keys()].filter(x => band.px[(HEIGHT - 2) * band.w + x] === 0xffff00)
  }
  const flower = (ms: number) => drawBand(body, scene, layout, picture, 0, ms).px[(HEIGHT - 1) * 10 + 6]
  expect([cloud(0), cloud(999), cloud(1000), cloud(2000)]).toEqual([[1, 2], [1, 2], [0, 1], [0, 9]])
  expect(cloud(10000)).toEqual([1, 2])
  expect([flower(0), flower(5000)]).toEqual([0x00ff00, 0x00ff00])
})

test('raised decor drifts, each drawing at its own speed; decor on the ground has no drift', () => {
  const layout = layScene({ obstacles: [], decor: [['yy', '..'], ['g']], every: 40 }, 300)
  const raised = layout.decor.filter(d => d.rows.length === 2)
  expect(raised.length > 1 && raised.every(d => d.drift !== undefined && d.drift >= DRIFT_MS.fast && d.drift <= DRIFT_MS.slow)).toBe(true)
  expect(new Set(raised.map(d => d.drift)).size > 1).toBe(true)
  expect(layout.decor.filter(d => d.rows.length === 1).every(d => d.drift === undefined)).toBe(true)
})

test('the sky drawing stays near the top right, behind drifting decor', () => {
  const body = bodyOf({ sprite: ['b'], palette: { b: '#222222', y: '#ffff00', o: '#ff8800' } })
  const sky = ['oo', 'oo']
  const layout = { width: 20, obstacles: [], decor: [{ x: 12, rows: ['y', ...Array(HEIGHT - 2).fill('.')], drift: 1000 }] }
  const picture = { w: 1, h: HEIGHT, px: new Array(HEIGHT).fill(-1) }
  const at = (ms: number, x: number, y: number) => {
    const band = drawBand(body, { ...scene, sky }, layout, picture, 0, ms)
    return band.px[y * band.w + x]
  }
  expect([at(0, 12, 1), at(0, 13, 2), at(9000, 12, 1)]).toEqual([0xffff00, 0xff8800, 0xff8800])
})
