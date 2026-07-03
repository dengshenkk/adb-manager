/**
 * 从 SVG 生成 macOS 规范的应用图标
 * 用法: node scripts/generate-icon.js
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SVG_PATH = path.resolve(__dirname, '../build/icon.svg');
const PNG_PATH = path.resolve(__dirname, '../build/icon.png');

async function main() {
  const svg = fs.readFileSync(SVG_PATH, 'utf-8');
  await sharp(Buffer.from(svg))
    .resize(1024, 1024)
    .png()
    .toFile(PNG_PATH);

  const meta = await sharp(PNG_PATH).metadata();
  console.log(`图标已生成: ${PNG_PATH}`);
  console.log(`尺寸: ${meta.width}×${meta.height}`);
  console.log(`透明度: ${meta.hasAlpha ? '✅ 有' : '❌ 无'}`);
}

main().catch(err => {
  console.error('生成图标失败:', err);
  process.exit(1);
});
