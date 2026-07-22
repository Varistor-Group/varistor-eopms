const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src', 'components');

function replaceColors(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Replace light mode backgrounds with our semantic dark-mode-aware token
  content = content.replace(/bg-\[#(fafafa|fafbfa|f1f3f0|edf0ec|f8faf7|f4f7f2)\]/g, 'bg-varistor-pageBg');
  content = content.replace(/bg-\[#eefed4\]/g, 'bg-varistor-limeTint');
  content = content.replace(/bg-\[#f7fee7\]/g, 'bg-varistor-limeLight');
  content = content.replace(/bg-\[#f0fdf4\]/g, 'bg-emerald-50');
  content = content.replace(/bg-\[#fef08a\]/g, 'bg-yellow-200');
  
  // Replace arbitrary dark text/bg with standard tailwind tokens
  content = content.replace(/bg-\[#1a1a1a\]/g, 'bg-gray-900');
  content = content.replace(/text-\[#ffffff\]/g, 'text-white');
  content = content.replace(/text-\[#15803d\]/g, 'text-emerald-700');
  content = content.replace(/border-\[#bbf7d0\]/g, 'border-emerald-200');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${path.relative(__dirname, filePath)}`);
  }
}

function walkDir(currentPath) {
  const files = fs.readdirSync(currentPath);
  for (const file of files) {
    const fullPath = path.join(currentPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      replaceColors(fullPath);
    }
  }
}

walkDir(dir);
console.log("Done!");
