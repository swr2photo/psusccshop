const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('d:/shop/psusccshop/src/app/api');
files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  let changed = false;
  if (c.includes('checkCombinedRateLimit(') && !c.includes('await checkCombinedRateLimit(')) {
    c = c.replace(/= checkCombinedRateLimit\(/g, '= await checkCombinedRateLimitAsync(');
    changed = true;
  }
  if (c.includes('import { checkCombinedRateLimit,')) {
    c = c.replace('import { checkCombinedRateLimit,', 'import { checkCombinedRateLimitAsync,');
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(f, c);
    console.log('Updated ' + f);
  }
});
