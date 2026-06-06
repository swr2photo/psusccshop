// scratch/test-google.ts
async function main() {
  try {
    const res = await fetch('https://www.google.com');
    console.log('Google fetch status:', res.status);
  } catch (error) {
    console.error('Google fetch error:', error);
  }
}
main();
