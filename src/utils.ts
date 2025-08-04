import type { Buffer } from 'node:buffer'
import sharp from 'sharp'
import { nonNullable } from 'voidlib'

export type Maybe<T> = T | null | undefined

export interface ComposeInput {
  width: number
  height: number
  colorDepth: number
  palette: {
    colors: Array<{
      red: number
      green: number
      blue: number
      alpha: number
    }>
  }
  regions: Maybe<{
    buffer: Buffer
    top: number
    left: number
    width: number
    height: number
  }>[]
}

export interface BoundingBox {
  top: number
  left: number
  bottom: number
  right: number
  width: number
  height: number
}

export class CanvasBuffer {
  private readonly buffer: Buffer
  private readonly width: number
  private readonly height: number

  constructor(
    buffer: Buffer,
    {
      width,
      height,
    }: {
      width: number
      height: number
    },
  ) {
    this.buffer = buffer
    this.width = width
    this.height = height
  }

  computeBoundingBox(): BoundingBox {
    const channels = 4 // RGBA
    let top = this.height
    let left = this.width
    let right = 0
    let bottom = 0

    const rawBuffer = this.buffer

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const offset = (y * this.width + x) * channels
        const alpha = rawBuffer[offset + 3]!

        if (alpha > 0) {
          if (y < top)
            top = y
          if (x < left)
            left = x
          if (x > right)
            right = x
          if (y > bottom)
            bottom = y
        }
      }
    }

    // image is fully transparent
    if (right < left || bottom < top) {
      return {
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        width: 0,
        height: 0,
      }
    }

    return {
      top,
      left,
      bottom,
      right,
      width: right - left + 1,
      height: bottom - top + 1,
    }
  }

  async toFile(path: string): Promise<void> {
    const pipe = sharp(this.buffer, {
      raw: {
        width: this.width,
        height: this.height,
        channels: 4,
      },
    })

    await pipe.png().toFile(path)
  }
}

export async function composite(input: ComposeInput): Promise<CanvasBuffer> {
  const [bg, ...others] = await Promise.all([
    sharp({
      create: {
        width: input.width,
        height: input.height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .png()
      .toBuffer(),

    ...input.regions
      .filter(nonNullable)
      .map((cel) => {
        if (input.colorDepth === 8) {
          const rgbaBuffer = new Uint8Array(cel.width * cel.height * 4)
          for (let i = 0; i < cel.buffer.length; i++) {
            const index = cel.buffer[i]!
            const color = input.palette.colors[index] || { red: 0, green: 0, blue: 0, alpha: 0 }
            const offset = i * 4
            rgbaBuffer[offset] = color.red
            rgbaBuffer[offset + 1] = color.green
            rgbaBuffer[offset + 2] = color.blue
            rgbaBuffer[offset + 3] = color.alpha
          }

          return sharp(rgbaBuffer, { raw: { width: cel.width, height: cel.height, channels: 4 } }).png().toBuffer()
        }

        if (input.colorDepth === 32) {
          return sharp(cel.buffer, { raw: { width: cel.width, height: cel.height, channels: 4 } }).png().toBuffer()
        }

        throw new Error(`Unsupported color depth: ${input.colorDepth}`)
      }),
  ])

  const pipe = sharp(bg)
    .composite(others.map((img, index) => ({
      input: img,
      top: input.regions[index]!.top,
      left: input.regions[index]!.left,
    })))

  const frameBuffer = await pipe.raw().toBuffer()

  return new CanvasBuffer(frameBuffer, {
    width: input.width,
    height: input.height,
  })
}
