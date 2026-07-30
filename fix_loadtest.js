
const fs = require('fs');
let code = fs.readFileSync('C:\\\\Users\\\\This PC\\\\Desktop\\\\api_loadtest.js', 'utf8');
code = code.replace('body.data && body.data.ref', 'body.ref');
code = code.replace('status is 202 (Accepted)': (r) => r.status === 202,, 'status is 202 (Accepted)': (r) => { if (r.status !== 202) console.log(r.body); return r.status === 202; },);
fs.writeFileSync('C:\\\\Users\\\\This PC\\\\Desktop\\\\api_loadtest.js', code);

