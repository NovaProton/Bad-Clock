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

// --- Hours Left in the Year ---
const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
const msLeftInYear = endOfYear - now;
const hoursLeftInYear = Math.floor(msLeftInYear / (1000 * 60 * 60));
document.getElementById('hoursLeftInYearValue').textContent = hoursLeftInYear;

// --- Moon Phase ---
// Basic approach: Use an approximate formula with a known reference date
// (2000-01-06T18:14:00Z) for which the moon was near New Moon.
const moonPhaseName = getMoonPhase(now);
document.getElementById('moonPhaseValue').textContent = moonPhaseName;
}

function getMoonPhase(date) {
// Average length of the synodic month (new moon to new moon)
const synodicMonth = 29.5305882;

// Reference date: 2000 January 6 18:14:00 UT (near a New Moon)
const reference = new Date('2000-01-06T18:14:00Z');

// Number of days since reference
const daysSinceReference = (date - reference) / (1000 * 60 * 60 * 24);

// Moon age in days
const moonAge = daysSinceReference % synodicMonth;

// Phase as a fraction of the synodic month (0 -> 1)
const phaseFraction = moonAge / synodicMonth;

// We can define 8 simple phases (new, waxing crescent, first quarter, 
// waxing gibbous, full, waning gibbous, last quarter, waning crescent).
// You can adjust thresholds as desired.
if (phaseFraction < 0.03 || phaseFraction > 0.97) {
  return 'New Moon';
} else if (phaseFraction < 0.22) {
  return 'Waxing Crescent';
} else if (phaseFraction < 0.28) {
  return 'First Quarter';
} else if (phaseFraction < 0.47) {
  return 'Waxing Gibbous';
} else if (phaseFraction < 0.53) {
  return 'Full Moon';
} else if (phaseFraction < 0.72) {
  return 'Waning Gibbous';
} else if (phaseFraction < 0.78) {
  return 'Last Quarter';
} else {
  return 'Waning Crescent';
}
}

setInterval(updateClock, 1000); // Update every second
updateClock(); // Initialise clock on page load


setInterval(updateClock, 1000); // Update every second
updateClock(); // Initialize clock on page load
