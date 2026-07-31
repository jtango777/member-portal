type CropArea = { x: number; y: number; width: number; height: number }

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', reject)
    img.setAttribute('crossOrigin', 'anonymous')
    img.src = src
  })
}

// Avatars only ever display at a few hundred pixels, so cap the output
// regardless of how large the source photo was (phone photos are often
// 3000px+, which without this produced multi-MB "thumbnails").
const MAX_AVATAR_SIZE = 480

export async function getCroppedImageBlob(imageSrc: string, cropPixels: CropArea): Promise<Blob> {
  const image = await loadImage(imageSrc)
  const outputSize = Math.min(MAX_AVATAR_SIZE, cropPixels.width, cropPixels.height)
  const canvas = document.createElement('canvas')
  canvas.width = outputSize
  canvas.height = outputSize
  const ctx = canvas.getContext('2d')!

  ctx.drawImage(
    image,
    cropPixels.x, cropPixels.y, cropPixels.width, cropPixels.height,
    0, 0, outputSize, outputSize
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob)
      else reject(new Error('Could not crop image'))
    }, 'image/jpeg', 0.85)
  })
}
