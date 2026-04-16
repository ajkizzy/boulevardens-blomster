import fs from 'fs';
import path from 'path';
import heic2any from 'heic2any';

const picturesDir = './pictures';
const outputDir = './public/images';

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Get all HEIC/heic files
const files = fs.readdirSync(picturesDir).filter(file =>
  file.toLowerCase().endsWith('.heic')
);

console.log(`Found ${files.length} HEIC files to convert`);

let converted = 0;

for (const file of files) {
  const inputPath = path.join(picturesDir, file);
  const outputFileName = file.replace(/\.heic$/i, '.jpg');
  const outputPath = path.join(outputDir, outputFileName);

  try {
    console.log(`Converting: ${file} → ${outputFileName}`);

    const input = fs.readFileSync(inputPath);
    const output = await heic2any({
      blob: new Blob([input], { type: 'image/heic' }),
      toType: 'image/jpeg',
      quality: 0.9
    });

    fs.writeFileSync(outputPath, Buffer.from(await output.arrayBuffer()));
    console.log(`✓ Converted: ${outputFileName}`);
    converted++;
  } catch (error) {
    console.error(`✗ Failed to convert ${file}:`, error.message);
  }
}

console.log(`\nConversion complete! ${converted}/${files.length} files converted`);
console.log(`Images saved to: ${outputDir}`);
