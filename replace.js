const fs = require('fs');
const path = require('path');

function walk(dir, done) {
  let results = [];
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    let pending = list.length;
    if (!pending) return done(null, results);
    list.forEach(function(file) {
      file = path.resolve(dir, file);
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          walk(file, function(err, res) {
            results = results.concat(res);
            if (!--pending) done(null, results);
          });
        } else {
          if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            results.push(file);
          }
          if (!--pending) done(null, results);
        }
      });
    });
  });
}

walk('d:/shop/psusccshop/src', (err, files) => {
  if (err) throw err;
  let count = 0;
  files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    // Replace something.toLocaleString( to something?.toLocaleString(
    // Match a word character, closing parenthesis, or closing bracket, followed by .toLocaleString(
    let newContent = content.replace(/(\w+|\)|\])\.toLocaleString\(/g, '$1?.toLocaleString(');
    if (content !== newContent) {
      fs.writeFileSync(file, newContent, 'utf8');
      console.log('Updated', file);
      count++;
    }
  });
  console.log('Total files updated:', count);
});
