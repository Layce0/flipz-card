const { Jimp } = require('jimp');
const fs = require('fs');

async function processPack(filename) {
    const imgPath = `src/assets/${filename}.png`;
    if (!fs.existsSync(imgPath)) {
        console.log('Skipping', imgPath, '- not found');
        return;
    }
    
    console.log('Processing', imgPath);
    const img = await Jimp.read(imgPath);
    const topImg = img.clone();
    const bottomImg = img.clone();

    const w = img.bitmap.width;
    const h = img.bitmap.height;

    const tearY = new Array(w);
    
    let currentY = h * 0.17;
    for (let x = 0; x < w; x++) {
        currentY += (Math.random() - 0.5) * 3;
        
        if (currentY < h * 0.15) currentY = h * 0.15;
        if (currentY > h * 0.20) currentY = h * 0.20;
        
        const macro = Math.sin(x * 0.03) * 6;
        tearY[x] = Math.floor(currentY + macro);
    }

    for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) {
            const boundary = tearY[x];
            
            const originalColor = img.getPixelColor(x, y);
            const alpha = originalColor & 0xFF;
            const isOpaque = alpha > 10;
            
            const frayWidth = 2 + Math.random() * 4;
            
            const cValue = 200 + Math.floor(Math.random() * 55);
            const frayColor = (cValue * 16777216) + (cValue * 65536) + (cValue * 256) + 255;

            if (y < boundary) {
                bottomImg.setPixelColor(0x00000000, x, y);
                if (boundary - y < frayWidth && isOpaque) {
                    if (Math.random() > 0.2) {
                        topImg.setPixelColor(frayColor, x, y);
                    }
                }
            } else {
                topImg.setPixelColor(0x00000000, x, y);
                if (y - boundary < frayWidth && isOpaque) {
                    if (Math.random() > 0.2) {
                        bottomImg.setPixelColor(frayColor, x, y);
                    }
                }
            }
        }
    }

    await topImg.write(`src/assets/${filename}-top.png`);
    await bottomImg.write(`src/assets/${filename}-bottom.png`);
    console.log('Saved', `${filename}-top.png`, 'and', `${filename}-bottom.png`);
}

async function main() {
    await processPack('pack-sachet');
    await processPack('pack-lucky');
    await processPack('pack-ultra');
}

main().catch(console.error);
