import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { extractToDir } from '../src/index.js'

const TEST_OUT_DIR = 'dist'
const TEST_SOURCE_FILE = import.meta.env.VITE_SOURCE

it('should extract all layers', async () => {
  await mkdir('dist', { recursive: true })
  await extractToDir(TEST_SOURCE_FILE, TEST_OUT_DIR)

  const meta = JSON.parse(await readFile(join(TEST_OUT_DIR, 'aseprite.json'), 'utf-8'))

  expect(meta).toBeDefined()
  expect(meta.fileSize).toBeGreaterThan(0)
  expect(meta.width).toBeGreaterThan(0)
  expect(meta.height).toBeGreaterThan(0)
  expect(meta.colorDepth).toBeGreaterThan(0)
  expect(Array.isArray(meta.frames)).toBe(true)
})
