import fs from 'fs';
import path from 'path';

function getFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const item of list) {
    if (item === 'node_modules' || item === 'dist') continue;
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(getFiles(fullPath));
    } else if (/\.(webp|jpg|jpeg|png|svg|avif|gif)$/i.test(item)) {
      results.push({ file: fullPath.replace(/\\/g, '/'), size: stat.size, ext: path.extname(item).toLowerCase() });
    }
  }
  return results;
}

const clientPublic = getFiles('client/public');
const clientSrc = getFiles('client/src');
const adminFiles = getFiles('admin/src').concat(getFiles('admin/public'));

console.log(`Audited Images:`);
console.log(`- client/public: ${clientPublic.length} images`);
console.log(`- client/src: ${clientSrc.length} images`);
console.log(`- admin: ${adminFiles.length} images`);

const allImages = [...clientPublic, ...clientSrc, ...adminFiles];
allImages.sort((a, b) => b.size - a.size);

const totalBytes = allImages.reduce((sum, img) => sum + img.size, 0);
console.log(`\nTotal images: ${allImages.length}`);
console.log(`Total size: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB (${totalBytes} bytes)\n`);

console.log(`Top 25 Largest Images:`);
allImages.slice(0, 25).forEach((img, idx) => {
  console.log(`${idx + 1}. ${(img.size / 1024).toFixed(1)} KB \t ${img.file}`);
});
