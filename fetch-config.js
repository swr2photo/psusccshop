const https = require('https');
const fs = require('fs');

const url = "https://skfacffsynjxyvvvuycl.supabase.co/rest/v1/config?key=eq.config-version&select=value";
const options = {
  headers: {
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrZmFjZmZzeW5qeHl2dnZ1eWNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMDY4NDQsImV4cCI6MjA4NDU4Mjg0NH0.F1rSk9nnDQRCJoq34oHCNFUWZTDu_muR6kKxDmvhEIs",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrZmFjZmZzeW5qeHl2dnZ1eWNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMDY4NDQsImV4cCI6MjA4NDU4Mjg0NH0.F1rSk9nnDQRCJoq34oHCNFUWZTDu_muR6kKxDmvhEIs"
  }
};

https.get(url, options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const config = JSON.parse(data)[0].value;
    const tess = config.products.find(p => p.id === 'tess' || p.name.includes('tess'));
    console.log(JSON.stringify(tess, null, 2));
  });
}).on('error', err => {
  console.log('Error: ', err.message);
});
