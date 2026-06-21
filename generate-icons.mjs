/**
 * Generate all app icons from the source logo image.
 * Usage: node generate-icons.mjs <source-image-path>
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

const SOURCE = process.argv[2] || 'C:/Users/layce/.gemini/antigravity-ide/brain/4d07abd8-b030-4412-bdc4-a7d51801edeb/media__1781539192104.jpg';

async function generateIcon(source, outputPath, size, format = 'png') {
  const dir = dirname(outputPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  let pipeline = sharp(source).resize(size, size, { fit: 'cover' });

  if (format === 'png') {
    pipeline = pipeline.png({ quality: 100 });
  } else if (format === 'jpeg' || format === 'jpg') {
    pipeline = pipeline.jpeg({ quality: 95 });
  } else if (format === 'webp') {
    pipeline = pipeline.webp({ quality: 95 });
  } else if (format === 'ico') {
    // For ICO, generate a 32x32 PNG and we'll just use PNG as favicon
    pipeline = sharp(source).resize(32, 32, { fit: 'cover' }).png();
  }

  await pipeline.toFile(outputPath);
  console.log(`✅ ${outputPath} (${size}x${size} ${format})`);
}

async function generateSplash(source, outputPath, width, height) {
  const dir = dirname(outputPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  // Create a splash with the logo centered on a dark purple background
  const logoSize = Math.min(width, height) * 0.4; // Logo takes 40% of the smallest dimension
  const logo = await sharp(source)
    .resize(Math.round(logoSize), Math.round(logoSize), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // Create background
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 15, g: 13, b: 23, alpha: 255 } // #0f0d17
    }
  })
    .composite([{
      input: logo,
      gravity: 'centre'
    }])
    .png()
    .toFile(outputPath);

  console.log(`✅ ${outputPath} (${width}x${height} splash)`);
}

async function main() {
  const sourceBuffer = readFileSync(SOURCE);
  console.log('🎨 Source image loaded:', SOURCE);

  // 1. Public logos
  await generateIcon(sourceBuffer, 'public/flipz-logo-new.png', 1024, 'png');
  await generateIcon(sourceBuffer, 'public/flipz-logo-new.jpeg', 1024, 'jpeg');

  // 2. PWA icons
  await generateIcon(sourceBuffer, 'public/pwa-192x192.png', 192, 'png');
  await generateIcon(sourceBuffer, 'public/pwa-512x512.png', 512, 'png');

  // 3. Favicon (use PNG, 32x32)
  await generateIcon(sourceBuffer, 'public/favicon.ico', 32, 'ico');

  // 4. Icons directory (webp for manifest)
  const webpSizes = [48, 72, 96, 128, 192, 256, 512];
  for (const size of webpSizes) {
    await generateIcon(sourceBuffer, `icons/icon-${size}.webp`, size, 'webp');
  }

  // 5. Assets
  await generateIcon(sourceBuffer, 'assets/icon.png', 1024, 'png');

  // 6. Android mipmap icons
  const androidSizes = {
    'ldpi': 36,
    'mdpi': 48,
    'hdpi': 72,
    'xhdpi': 96,
    'xxhdpi': 144,
    'xxxhdpi': 192,
  };

  for (const [density, size] of Object.entries(androidSizes)) {
    const base = `android/app/src/main/res/mipmap-${density}`;
    await generateIcon(sourceBuffer, `${base}/ic_launcher.png`, size, 'png');
    await generateIcon(sourceBuffer, `${base}/ic_launcher_round.png`, size, 'png');
    await generateIcon(sourceBuffer, `${base}/ic_launcher_foreground.png`, size, 'png');

    // Background: solid purple #6B21A8
    const bgSize = size;
    await sharp({
      create: {
        width: bgSize,
        height: bgSize,
        channels: 4,
        background: { r: 107, g: 33, b: 168, alpha: 255 }
      }
    }).png().toFile(`${base}/ic_launcher_background.png`);
    console.log(`✅ ${base}/ic_launcher_background.png (${bgSize}x${bgSize})`);
  }

  // 7. iOS App Icon (1024x1024)
  await generateIcon(sourceBuffer, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', 1024, 'png');

  // 8. Splash screen for public/splash.png
  await generateSplash(sourceBuffer, 'public/splash.png', 1284, 2778);

  // 9. iOS Splash screens
  await generateSplash(sourceBuffer, 'ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png', 2732, 2732);
  await generateSplash(sourceBuffer, 'ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png', 2732, 2732);
  await generateSplash(sourceBuffer, 'ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png', 2732, 2732);

  // iOS splash Default images
  await generateSplash(sourceBuffer, 'ios/App/App/Assets.xcassets/Splash.imageset/Default@1x~universal~anyany.png', 2732, 2732);
  await generateSplash(sourceBuffer, 'ios/App/App/Assets.xcassets/Splash.imageset/Default@2x~universal~anyany.png', 2732, 2732);
  await generateSplash(sourceBuffer, 'ios/App/App/Assets.xcassets/Splash.imageset/Default@3x~universal~anyany.png', 2732, 2732);
  await generateSplash(sourceBuffer, 'ios/App/App/Assets.xcassets/Splash.imageset/Default@1x~universal~anyany-dark.png', 2732, 2732);
  await generateSplash(sourceBuffer, 'ios/App/App/Assets.xcassets/Splash.imageset/Default@2x~universal~anyany-dark.png', 2732, 2732);
  await generateSplash(sourceBuffer, 'ios/App/App/Assets.xcassets/Splash.imageset/Default@3x~universal~anyany-dark.png', 2732, 2732);

  // 10. Android splash screens
  const splashDirs = [
    'drawable', 'drawable-night',
    'drawable-port-hdpi', 'drawable-port-ldpi', 'drawable-port-mdpi',
    'drawable-port-xhdpi', 'drawable-port-xxhdpi', 'drawable-port-xxxhdpi',
    'drawable-port-night-hdpi', 'drawable-port-night-ldpi', 'drawable-port-night-mdpi',
    'drawable-port-night-xhdpi', 'drawable-port-night-xxhdpi', 'drawable-port-night-xxxhdpi',
    'drawable-land-hdpi', 'drawable-land-ldpi', 'drawable-land-mdpi',
    'drawable-land-xhdpi', 'drawable-land-xxhdpi', 'drawable-land-xxxhdpi',
    'drawable-land-night-hdpi', 'drawable-land-night-ldpi', 'drawable-land-night-mdpi',
    'drawable-land-night-xhdpi', 'drawable-land-night-xxhdpi', 'drawable-land-night-xxxhdpi',
  ];

  for (const dir of splashDirs) {
    const base = `android/app/src/main/res/${dir}`;
    if (!existsSync(base)) mkdirSync(base, { recursive: true });
    // Check what files exist in this dir
    const isLand = dir.includes('land');
    const w = isLand ? 800 : 480;
    const h = isLand ? 480 : 800;
    await generateSplash(sourceBuffer, `${base}/splash.png`, w, h);
  }

  console.log('\n🎉 All icons generated successfully!');
}

main().catch(console.error);
