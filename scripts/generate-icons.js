/**
 * Generate app icons from SVG for Tauri application
 * Uses sharp for image processing (lightweight and fast)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if sharp is available, if not, provide instructions
let sharp;
try {
  sharp = (await import('sharp')).default;
} catch (e) {
  console.log('Installing sharp...');
  try {
    execSync('npm install sharp --save-dev', { stdio: 'inherit' });
    sharp = (await import('sharp')).default;
  } catch (err) {
    console.error('Please install sharp: npm install sharp --save-dev');
    process.exit(1);
  }
}

const projectRoot = path.resolve(__dirname, '..');
const svgPath = path.join(projectRoot, 'public', 'mediaflow-logo.svg');
const iconsDir = path.join(projectRoot, 'src-tauri', 'icons');

// Icon sizes needed
const sizes = {
  '32x32.png': 32,
  '128x128.png': 128,
  '128x128@2x.png': 256,
  'icon.png': 512,
};

async function generateIcons() {
  console.log('Generating MediaFlow app icons...');
  console.log(`SVG source: ${svgPath}`);
  console.log(`Output directory: ${iconsDir}\n`);

  // Check if SVG exists
  if (!fs.existsSync(svgPath)) {
    console.error(`Error: SVG file not found at ${svgPath}`);
    process.exit(1);
  }

  // Create icons directory if it doesn't exist
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  // Read SVG
  const svgBuffer = fs.readFileSync(svgPath);

  // Generate PNG files
  let successCount = 0;
  for (const [filename, size] of Object.entries(sizes)) {
    try {
      const outputPath = path.join(iconsDir, filename);
      await sharp(svgBuffer)
        .resize(size, size, {
          kernel: sharp.kernel.lanczos3,
        })
        .png()
        .toFile(outputPath);
      
      console.log(`✓ Generated ${filename} (${size}x${size})`);
      successCount++;
    } catch (error) {
      console.error(`✗ Error generating ${filename}:`, error.message);
    }
  }

  // Generate ICO from multiple PNG sizes
  try {
    const toIco = (await import('to-ico')).default;
    const icoPath = path.join(iconsDir, 'icon.ico');
    
    // Create ICO with multiple sizes (16, 32, 48, 64, 128, 256)
    const icoSizes = [16, 32, 48, 64, 128, 256];
    const icoImages = [];
    
    for (const icoSize of icoSizes) {
      const resized = await sharp(svgBuffer)
        .resize(icoSize, icoSize, {
          kernel: sharp.kernel.lanczos3,
        })
        .png()
        .toBuffer();
      icoImages.push(resized);
    }
    
    // Generate ICO file
    const icoBuffer = await toIco(icoImages);
    fs.writeFileSync(icoPath, icoBuffer);
    
    console.log(`✓ Generated icon.ico with ${icoSizes.length} sizes`);
  } catch (error) {
    console.error(`✗ Error generating ICO:`, error.message);
    console.log(`  Note: ICO generation failed, but PNG files are available`);
  }

  console.log(`\n✓ Generated ${successCount} icon files`);
  console.log(`✓ Icons saved to: ${iconsDir}`);
  console.log(`\nNote: icon.icns requires macOS iconutil tool`);
}

generateIcons().catch(console.error);

