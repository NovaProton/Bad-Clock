function updateClock() {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const dayOfWeek = startOfYear.getDay();
    const ISOWeekStart = startOfYear;

    // Adjust the start of the ISO week (ISO weeks start on Monday)
    if (dayOfWeek <= 4) { // Thursday or earlier
        ISOWeekStart.setDate(startOfYear.getDate() - startOfYear.getDay() + 1);
    } else { // Friday or later
        ISOWeekStart.setDate(startOfYear.getDate() + 8 - startOfYear.getDay());
    }

    // Calculate the ISO week number
    const weeksSinceISOStart = Math.floor((now - ISOWeekStart) / (7 * 24 * 60 * 60 * 1000)) + 1;

    document.getElementById('weeksValue').textContent = weeksSinceISOStart;


  // Calculate minutes past midnight
  const minutesPastMidnight = now.getHours() * 60 + now.getMinutes();
  document.getElementById('minutesValue').textContent = minutesPastMidnight;

  // Calculate seconds since Unix epoch
  const secondsSinceEpoch = Math.floor(now / 1000);
  document.getElementById('epochValue').textContent = secondsSinceEpoch;

  // Calculate reverse time
  const reverseHours = 23 - now.getHours();
  const reverseMinutes = 59 - now.getMinutes();
  const reverseSeconds = 59 - now.getSeconds();
  document.getElementById('reverseTimeValue').textContent = `${reverseHours.toString().padStart(2, '0')}:${reverseMinutes.toString().padStart(2, '0')}:${reverseSeconds.toString().padStart(2, '0')}`;

  // Calculate days passed in the year
  const dayCounter = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000)) + 1;
  document.getElementById('dayCounterValue').textContent = dayCounter;

// Calculate milliseconds to next midnight
const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
const msToMidnight = nextMidnight - now;
document.getElementById('msToMidnightValue').textContent = msToMidnight;

}

setInterval(updateClock, 1000); // Update every second
updateClock(); // Initialize clock on page load
