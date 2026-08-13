// generate-icons.js
// Genera todos los tamaños de íconos PWA desde src/assets/img/logo.png
// Uso: node generate-icons.js

import sharp from "sharp"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const iconSizes = [
  { size: 72,  name: "icon-72x72.png"   },
  { size: 96,  name: "icon-96x96.png"   },
  { size: 128, name: "icon-128x128.png" },
  { size: 144, name: "icon-144x144.png" },
  { size: 152, name: "icon-152x152.png" },
  { size: 180, name: "icon-180x180.png" },
  { size: 192, name: "icon-192x192.png" },
  { size: 384, name: "icon-384x384.png" },
  { size: 512, name: "icon-512x512.png" },
]

async function generateIcons() {
  const inputImage = path.join(__dirname, "src", "assets", "img", "logo.png")
  const outputDir  = path.join(__dirname, "public", "icons")

  console.log("🔧 Generando íconos PWA...")
  console.log(`   Origen:  ${inputImage}`)
  console.log(`   Destino: ${outputDir}`)

  if (!fs.existsSync(inputImage)) {
    console.error("❌ No se encontró src/assets/img/logo.png")
    process.exit(1)
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  for (const { size, name } of iconSizes) {
    const outputPath = path.join(outputDir, name)
    await sharp(inputImage)
      .resize(size, size, {
        fit: "inside",
        withoutEnlargement: false,
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .png({ quality: 100, compressionLevel: 6 })
      .toFile(outputPath)
    console.log(`   ✅ ${name} (${size}x${size})`)
  }

  // favicon
  const faviconPath = path.join(__dirname, "public", "favicon.ico")
  await sharp(inputImage).resize(32, 32).png().toFile(faviconPath)
  console.log("   ✅ favicon.ico (32x32)")

  console.log("\n🎉 Íconos generados correctamente.")
}

generateIcons().catch((err) => {
  console.error("❌ Error:", err)
  process.exit(1)
})
