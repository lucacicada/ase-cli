// reference: https://github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md
import type { BoundingBox, CanvasBuffer } from './utils'
import { Buffer } from 'node:buffer'
import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import Aseprite from 'ase-parser'
import { composite } from './utils'

interface Bundle {
  ase: Aseprite
  layers: Array<{
    frames: (CanvasBuffer | null)[]
  }>
}

export async function extract(input: string | Buffer): Promise<Bundle> {
  let buffer: Buffer

  if (typeof input === 'string') {
    buffer = await readFile(input)
  }
  else if (Buffer.isBuffer(input)) {
    buffer = input
  }
  else {
    throw new TypeError('Input must be a file path or a Buffer.')
  }

  const ase = new Aseprite(buffer, '')
  ase.parse()

  if (ase.pixelRatio !== '1:1') {
    throw new Error(`Unsupported pixel ratio: ${ase.pixelRatio}. Only 1:1 is supported.`)
  }

  // Color depth (bits per pixel)
  //  32 bpp = RGBA
  //  16 bpp = Grayscale
  //   8 bpp = Indexed
  switch (ase.colorDepth) {
    case 32:
    case 8:
      break

      // Gray scale is not supported yet
    default:
      throw new Error(`Unsupported color depth: ${ase.colorDepth}.`)
  }

  const layers = await Promise.all(ase.layers.map(async (_layer, layerIndex) => {
    const frames = await Promise.all(ase.frames.map(async (frame) => {
      const cels = frame.cels
        .filter(cell => cell.layerIndex === layerIndex)
        .filter(cell => cell.celType === 2)
        .toSorted((a, b) => {
          const orderA = a.layerIndex + a.zIndex
          const orderB = b.layerIndex + b.zIndex

          // sort by order, then by zIndex
          return orderA - orderB || a.zIndex - b.zIndex
        })

      // If the bounding box is empty, skip this frame
      if (cels.length === 0) {
        return null
      }

      const canvas = await composite({
        width: ase.width,
        height: ase.height,
        colorDepth: ase.colorDepth,
        palette: ase.palette,
        regions: cels.map(cel => ({
          buffer: cel.rawCelData,
          top: cel.xpos,
          left: cel.ypos,
          width: cel.w,
          height: cel.h,
        })),
      })

      const box = canvas.computeBoundingBox()

      if (!box || box.width <= 0 || box.height <= 0) {
        return null
      }

      return canvas
    }))

    return {
      frames,
    }
  }))

  return {
    ase,
    layers,
  }
}

export async function extractToDir(input: string | Buffer, outDir: string): Promise<void> {
  outDir = resolve(outDir)

  const { ase, layers } = await extract(input)

  interface ExportFile {
    name: string
    layer: number
    frame: number
    box: BoundingBox
  }

  const files: ExportFile[] = []

  for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
    const canvasLayer = layers[layerIndex]

    if (!canvasLayer) {
      continue
    }

    for (let frameIndex = 0; frameIndex < canvasLayer.frames.length; frameIndex++) {
      const frame = canvasLayer.frames[frameIndex]

      if (!frame) {
        continue
      }

      const filename = `${layerIndex.toString().padStart(2, '0')}-${frameIndex.toString().padStart(2, '0')}.png`

      await frame.toFile(join(outDir, filename))

      const box = frame.computeBoundingBox()

      files.push({
        name: filename,
        layer: layerIndex,
        frame: frameIndex,
        box,
      })
    }
  }

  const aseMeta: any = ase.toJSON()
  aseMeta.files = files

  await writeFile(join(outDir, 'aseprite.json'), JSON.stringify(aseMeta, null, 2))
}
