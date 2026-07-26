// scratch/compare-dates.ts
function hasTimeComponent(dateString: string): boolean {
  return dateString.includes('T') || /\d{2}:\d{2}/.test(dateString);
}

const getCloseDateTime = (dateString: string): Date => {
  const date = new Date(dateString);
  if (!hasTimeComponent(dateString)) {
    date.setHours(23, 59, 59, 999);
  }
  return date;
};

const parseThailandDate = (dateString: string, isEnd: boolean): Date => {
  const hasTime = dateString.includes('T') || /\d{2}:\d{2}/.test(dateString);
  if (!hasTime) {
    const parts = dateString.split(/[-/]/);
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // 0-indexed
      const day = parseInt(parts[2], 10);
      if (isEnd) {
        return new Date(Date.UTC(year, month, day, 16, 59, 59, 999));
      } else {
        const d = new Date(Date.UTC(year, month, day, 0, 0, 0));
        d.setUTCHours(d.getUTCHours() - 7);
        return d;
      }
    }
  }
  return new Date(dateString);
};

// Test values
const testDates = [
  "2026-06-27",
  "2026-06-28",
  "2026-06-27T14:30:00",
  "2026-06-27 14:30:00",
];

console.log("Current system timezone offset:", new Date().getTimezoneOffset());
console.log("Current time local:", new Date().toString());
console.log("Current time UTC:", new Date().toUTCString());

testDates.forEach(dStr => {
  console.log(`\n--- Test Date: "${dStr}" ---`);
  const clientClose = getCloseDateTime(dStr);
  const serverClose = parseThailandDate(dStr, true);
  
  console.log(`Client Close (Local): ${clientClose.toString()}`);
  console.log(`Client Close (UTC):   ${clientClose.toUTCString()}`);
  console.log(`Client Close (Epoch): ${clientClose.getTime()}`);
  
  console.log(`Server Close (Local): ${serverClose.toString()}`);
  console.log(`Server Close (UTC):   ${serverClose.toUTCString()}`);
  console.log(`Server Close (Epoch): ${serverClose.getTime()}`);
  
  console.log(`Difference (Server - Client): ${serverClose.getTime() - clientClose.getTime()} ms (${(serverClose.getTime() - clientClose.getTime()) / 3600000} hours)`);
});
