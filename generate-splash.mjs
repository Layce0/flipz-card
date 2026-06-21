/**
 * Generate all splash screen assets from the user-provided splash image.
 */
import sharp from 'sharp';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

const SOURCE = 'C:/Users/layce/.gemini/antigravity-ide/brain/4d07abd8-b030-4412-bdc4-a7d51801edeb/media__1781560458777.png';

async function generateSplash(sourceBuffer, outputPath, width, height) {
  const dir = dirname(outputPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  // Resize the source image to cover the target dimensions
  await sharp(sourceBuffer)
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .png()
    .toFile(outputPath);

  console.log(`✅ ${outputPath} (${width}x${height})`);
}

async function main() {
  const sourceBuffer = readFileSync(SOURCE);
  console.log('🎨 Source splash image loaded:', SOURCE);

  // Public splash
  await generateSplash(sourceBuffer, 'public/splash.png', 1284, 2778);
  await generateSplash(sourceBuffer, 'assets/splash.png', 1284, 2778);

  // iOS Splash screens (square 2732x2732)
  const iosSplashFiles = [
    'ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png',
    'ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png',
    'ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png',
    'ios/App/App/Assets.xcassets/Splash.imageset/Default@1x~universal~anyany.png',
    'ios/App/App/Assets.xcassets/Splash.imageset/Default@2x~universal~anyany.png',
    'ios/App/App/Assets.xcassets/Splash.imageset/Default@3x~universal~anyany.png',
    'ios/App/App/Assets.xcassets/Splash.imageset/Default@1x~universal~anyany-dark.png',
    'ios/App/App/Assets.xcassets/Splash.imageset/Default@2x~universal~anyany-dark.png',
    'ios/App/App/Assets.xcassets/Splash.imageset/Default@3x~universal~anyany-dark.png',
  ];
  for (const f of iosSplashFiles) {
    await generateSplash(sourceBuffer, f, 2732, 2732);
  }

  // Android splash screens
  const portDirs = [
    'drawable', 'drawable-night',
    'drawable-port-hdpi', 'drawable-port-ldpi', 'drawable-port-mdpi',
    'drawable-port-xhdpi', 'drawable-port-xxhdpi', 'drawable-port-xxxhdpi',
    'drawable-port-night-hdpi', 'drawable-port-night-ldpi', 'drawable-port-night-mdpi',
    'drawable-port-night-xhdpi', 'drawable-port-night-xxhdpi', 'drawable-port-night-xxxhdpi',
  ];
  const landDirs = [
    'drawable-land-hdpi', 'drawable-land-ldpi', 'drawable-land-mdpi',
    'drawable-land-xhdpi', 'drawable-land-xxhdpi', 'drawable-land-xxxhdpi',
    'drawable-land-night-hdpi', 'drawable-land-night-ldpi', 'drawable-land-night-mdpi',
    'drawable-land-night-xhdpi', 'drawable-land-night-xxhdpi', 'drawable-land-night-xxxhdpi',
  ];

  for (const dir of portDirs) {
    await generateSplash(sourceBuffer, `android/app/src/main/res/${dir}/splash.png`, 480, 800);
  }
  for (const dir of landDirs) {
    await generateSplash(sourceBuffer, `android/app/src/main/res/${dir}/splash.png`, 800, 480);
  }

  console.log('\n🎉 All splash screens generated!');
}

main().catch(console.error);
