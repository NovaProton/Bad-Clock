function updateClock() {
    const now = new Date()
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const dayOfWeek = startOfYear.getDay()
    const ISOWeekStart = new Date(startOfYear)
  
    // -------- ISO WEEK --------
    if (dayOfWeek <= 4) {
      // Thursday or earlier
      ISOWeekStart.setDate(startOfYear.getDate() - startOfYear.getDay() + 1)
    } else {
      // Friday or later
      ISOWeekStart.setDate(startOfYear.getDate() + 8 - startOfYear.getDay())
    }
    const weeksSinceISOStart =
      Math.floor((now - ISOWeekStart) / (7 * 24 * 60 * 60 * 1000)) + 1
    document.getElementById("weeksValue").textContent = weeksSinceISOStart
  
    // -------- MINUTES PAST MIDNIGHT --------
    const minutesPastMidnight = now.getHours() * 60 + now.getMinutes()
    document.getElementById("minutesValue").textContent = minutesPastMidnight
  
    // -------- SECONDS SINCE UNIX EPOCH --------
    const secondsSinceEpoch = Math.floor(now / 1000)
    document.getElementById("epochValue").textContent = secondsSinceEpoch
  
    // -------- TIME TO MIDNIGHT (REVERSE TIME) --------
    const reverseHours = 23 - now.getHours()
    const reverseMinutes = 59 - now.getMinutes()
    const reverseSeconds = 59 - now.getSeconds()
    document.getElementById("reverseTimeValue").textContent =
      `${reverseHours.toString().padStart(2, "0")}:${reverseMinutes.toString().padStart(2, "0")}:${reverseSeconds.toString().padStart(2, "0")}`
  
    // -------- DAY COUNTER IN YEAR --------
    const dayCounter = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000)) + 1
    document.getElementById("dayCounterValue").textContent = dayCounter
  
    // -------- MILLISECONDS TO MIDNIGHT --------
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      0,
    )
    const msToMidnight = nextMidnight - now
    document.getElementById("msToMidnightValue").textContent = msToMidnight
  
    // -------- HOURS LEFT IN THE YEAR --------
    const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
    const msLeftInYear = endOfYear - now
    const hoursLeftInYear = Math.floor(msLeftInYear / (1000 * 60 * 60))
    document.getElementById("hoursLeftInYearValue").textContent = hoursLeftInYear
  
    // -------- MOON PHASE --------
    const moonPhaseName = getMoonPhase(now)
    document.getElementById("moonPhaseValue").textContent = moonPhaseName
  
    // -------- JULIAN DATE --------
    const julianDate = getJulianDate(now).toFixed(5)
    document.getElementById("julianDateValue").textContent = julianDate
  
    const decimalClock = getDecimalTime(now)
    document.getElementById("decimalTimeValue").textContent = decimalClock
  
    // -------- Swatch Time  --------
    const beats = getSwatchInternetTime(now)
    document.getElementById("internetBeatsValue").textContent = beats
  
    // -------- GreenwichSiderealTime  --------
    const gst = getGreenwichSiderealTime(now)
    document.getElementById("siderealTimeValue").textContent = gst
  
    // -------- Rotation Percentag  --------
    document.getElementById("dayCompletionValue").textContent =
      getDayCompletionPercentage(now)
  
    // -------- NEXT SOLSTICE OR EQUINOX --------
    const { name, date: eventDate } = getNextSolsticeOrEquinox(now)
    document.getElementById("nextEventName").textContent = name
    document.getElementById("nextEventDate").textContent = eventDate.toUTCString()
  
    // -------- TIME UNTIL NEXT EVENT --------
    const diffMs = eventDate - now
    if (diffMs > 0) {
      const diffSec = Math.floor(diffMs / 1000)
      const h = Math.floor(diffSec / 3600)
      const m = Math.floor((diffSec % 3600) / 60)
      const s = diffSec % 60
      document.getElementById("timeUntilEvent").textContent = `${h}h ${m}m ${s}s`
    } else {
      document.getElementById("timeUntilEvent").textContent =
        "It has passed or is happening now!"
    }
  }
  
  // --------------------------------------------
  // MOON PHASE: same as your existing function
  // --------------------------------------------
  function getMoonPhase(date) {
    const synodicMonth = 29.5305882
    const reference = new Date("2000-01-06T18:14:00Z")
    const daysSinceReference = (date - reference) / (1000 * 60 * 60 * 24)
    const moonAge = daysSinceReference % synodicMonth
    const phaseFraction = moonAge / synodicMonth
  
    if (phaseFraction < 0.03 || phaseFraction > 0.97) {
      return "New Moon"
    } else if (phaseFraction < 0.22) {
      return "Waxing Crescent"
    } else if (phaseFraction < 0.28) {
      return "First Quarter"
    } else if (phaseFraction < 0.47) {
      return "Waxing Gibbous"
    } else if (phaseFraction < 0.53) {
      return "Full Moon"
    } else if (phaseFraction < 0.72) {
      return "Waning Gibbous"
    } else if (phaseFraction < 0.78) {
      return "Last Quarter"
    } else {
      return "Waning Crescent"
    }
  }
  
  // --------------------------------------------
  // JULIAN DATE
  // --------------------------------------------
  function getJulianDate(date) {
    // Typical astronomy formula; day starts at noon.
    let year = date.getUTCFullYear()
    let month = date.getUTCMonth() + 1
    const day = date.getUTCDate()
  
    if (month <= 2) {
      month += 12
      year -= 1
    }
  
    const A = Math.floor(year / 100)
    const B = 2 - A + Math.floor(A / 4)
  
    const jdAtMidnight =
      Math.floor(365.25 * (year + 4716)) +
      Math.floor(30.6001 * (month + 1)) +
      day +
      B -
      1524.5
  
    const fractionOfDay =
      (date.getUTCHours() +
        date.getUTCMinutes() / 60 +
        date.getUTCSeconds() / 3600) /
      24
  
    return jdAtMidnight + fractionOfDay
  }
  
  function getSwatchInternetTime(date) {
    // Convert the current time to UTC+1 (Biel Mean Time)
    const utcTime = date.getTime() + date.getTimezoneOffset() * 60000
    const bielTime = new Date(utcTime + 3600000) // plus 1 hour in ms
  
    // Calculate how many seconds have passed since midnight in Biel time
    const hours = bielTime.getUTCHours()
    const minutes = bielTime.getUTCMinutes()
    const seconds = bielTime.getUTCSeconds()
    const totalSeconds = hours * 3600 + minutes * 60 + seconds
  
    // Each day has 86,400 seconds, 1000 .beats per day
    const beats = Math.floor((totalSeconds / 86400) * 1000)
    return `@${beats}`
  }
  
  function getDecimalTime(date) {
    // Calculate total standard seconds since midnight
    const h = date.getHours()
    const m = date.getMinutes()
    const s = date.getSeconds()
    const totalSeconds = h * 3600 + m * 60 + s
  
    // 1 standard day = 86400 seconds
    // 1 decimal day = 10 decimal hours
    // 1 decimal hour = 100 decimal minutes
    // 1 decimal minute = 100 decimal seconds
    // => 1 decimal day = 100,000 decimal seconds
    const decimalSeconds = (totalSeconds / 86400) * 100000
  
    // Convert that to decimal hours/minutes/seconds
    const decHours = Math.floor(decimalSeconds / 10000)
    const decMinutes = Math.floor((decimalSeconds % 10000) / 100)
    const decSecs = Math.floor(decimalSeconds % 100)
  
    return `${decHours}h:${decMinutes.toString().padStart(2, "0")}m:${decSecs
      .toString()
      .padStart(2, "0")}s`
  }
  
  function getGreenwichSiderealTime(date) {
    // This is a simplified version of the standard sidereal time calculation.
    // Real formula is more involved for high precision.
  
    // 1) Julian Date
    const JD = getJulianDate(date)
    // 2) Days from J2000.0
    const D = JD - 2451545.0
  
    // 3) Rough formula for GMST in degrees
    let GMST = 280.46061837 + 360.98564736629 * D
    GMST = GMST % 360
    if (GMST < 0) GMST += 360
  
    // Convert to hours
    const GMST_hours = GMST / 15
  
    // Convert fractional hours to h:m:s
    const h = Math.floor(GMST_hours)
    const m = Math.floor((GMST_hours - h) * 60)
    const s = Math.floor(((GMST_hours - h) * 60 - m) * 60)
    return `${h}h ${m}m ${s}s`
  }
  
  function getJulianDate(date) {
    let year = date.getUTCFullYear()
    let month = date.getUTCMonth() + 1
    const day = date.getUTCDate()
    if (month <= 2) {
      month += 12
      year -= 1
    }
    const A = Math.floor(year / 100)
    const B = 2 - A + Math.floor(A / 4)
    const jdAtMidnight =
      Math.floor(365.25 * (year + 4716)) +
      Math.floor(30.6001 * (month + 1)) +
      day +
      B -
      1524.5
    const fractionOfDay =
      (date.getUTCHours() +
        date.getUTCMinutes() / 60 +
        date.getUTCSeconds() / 3600) /
      24
    return jdAtMidnight + fractionOfDay
  }
  
  function getDayCompletionPercentage(date) {
    const totalSeconds = 24 * 60 * 60 // 86400
    const nowSeconds =
      date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds()
    return ((nowSeconds / totalSeconds) * 100).toFixed(2) + "%"
  }
  
  const button = document.querySelector(".shuffle");
  const grid = document.querySelector(".grid");
  
  if (button && grid) {
    button.addEventListener("click", () => {
      for (var i = grid.children.length; i >= 0; i--) {
          grid.appendChild(grid.children[Math.random() * i | 0]);
      }
    });
  }

  // --------------------------------------------
  // TICK: update every second
  // --------------------------------------------
  setInterval(updateClock, 1000)
  updateClock()  