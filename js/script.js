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

// ----------------------
    // 1) Julian Date
    // ----------------------
    function getJulianDate(date) {
        // Convert the date to Julian Date.
        // This formula is typical for astronomy; the day starts at noon, hence the 0.5 offset.
        // 1) Extract UTC year, month, day
        let year = date.getUTCFullYear();
        let month = date.getUTCMonth() + 1; // 1-12
        const day = date.getUTCDate();
  
        // 2) If January or February, treat them as months 13 and 14 of the previous year
        if (month <= 2) {
          month += 12;
          year -= 1;
        }
  
        // 3) Calculate the terms
        const A = Math.floor(year / 100);
        const B = 2 - A + Math.floor(A / 4);
  
        // 4) JD at 0h UT
        const jdAtMidnight = Math.floor(365.25 * (year + 4716)) +
                             Math.floor(30.6001 * (month + 1)) +
                             day + B - 1524.5;
  
        // 5) Add fraction of day based on UTC hours/mins/secs
        const fractionOfDay = 
          (date.getUTCHours() +
           date.getUTCMinutes() / 60 +
           date.getUTCSeconds() / 3600) / 24;
  
        return jdAtMidnight + fractionOfDay;
      }
  
      // ----------------------
      // 2) Next Solstice or Equinox
      // ----------------------
      // For simplicity, we store approximate UTC times for the next few events.
      // You can extend this array further if needed or fetch from an API.
      const upcomingEvents = [
        // Format: { date: 'YYYY-MM-DDTHH:MM:SSZ', name: 'Event name' }
        // 2025 approximate times (UTC)
        { date: '2025-03-20T09:02:00Z', name: 'March Equinox' },
        { date: '2025-06-21T02:42:00Z', name: 'June Solstice' },
        { date: '2025-09-22T18:19:00Z', name: 'September Equinox' },
        { date: '2025-12-21T17:03:00Z', name: 'December Solstice' },
        // 2026
        { date: '2026-03-20T14:45:00Z', name: 'March Equinox' },
        { date: '2026-06-21T08:24:00Z', name: 'June Solstice' },
        { date: '2026-09-23T00:11:00Z', name: 'September Equinox' },
        { date: '2026-12-21T22:49:00Z', name: 'December Solstice' },
        // etc...
      ];
  
      function getNextSolsticeOrEquinox(now) {
        // Convert "now" to time in ms
        const nowMs = now.getTime();
  
        // Find the first event whose date is after "now"
        for (const evt of upcomingEvents) {
          const evtDate = new Date(evt.date);
          if (evtDate.getTime() > nowMs) {
            // This is our next event
            return { name: evt.name, date: evtDate };
          }
        }
        // If none found, default to last in array or handle differently
        // e.g. return the last event
        const last = upcomingEvents[upcomingEvents.length - 1];
        return { name: last.name, date: new Date(last.date) };
      }
  
      // Update every second
      setInterval(updateClock, 1000);
      // Initialise on page load
      updateClock();