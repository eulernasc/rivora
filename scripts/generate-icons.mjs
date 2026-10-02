import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const source = fileURLToPath(new URL('../public/rivora-mark.svg', import.meta.url))
const publicDir = dirname(source)

const sizes = [32, 180, 192, 512]

await Promise.all(
  sizes.map((size) =>
    sharp(source)
      .resize(size, size, { fit: 'cover' })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(join(publicDir, `icon-${size}.png`)),
  ),
)

console.log('RIVORA PWA icons generated:', sizes.join(', '))
