document.addEventListener('DOMContentLoaded', () => {
    const gridContainer = document.getElementById('gridContainer');
    const modal = document.getElementById('modal');
    const closeModal = document.getElementById('closeModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalDescription = document.getElementById('modalDescription');
    const modalLink = document.getElementById('modalLink');
    const codeSnippet = document.getElementById('codeSnippet');
    const copyCodeButton = document.getElementById('copyCodeButton');
    const copyTimeButton = document.getElementById('copyTimeButton');
    let currentTile = null; // the tile whose pop-up is open

    // Where the viewer is, once they've shared their location
    // ({ latitude, longitude } in degrees). Tiles that need it fall back to
    // Greenwich while it's null. Set by the location code near the bottom.
    let place = null;

    // ---- Time override -------------------------------------------------
    // Every tile asks getNow() for the time. With no override it's the real
    // clock; once a time is picked, every tile shows that moment instead.
    let timeOverride = null;
    const getNow = () => (timeOverride ? new Date(timeOverride.getTime()) : new Date());

    const toInputValue = d => {
        const p = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    };

    const timeInput = document.getElementById('timeInput');
    const timeNowButton = document.getElementById('timeNowButton');
    const timeStatus = document.getElementById('timeStatus');
    timeInput.value = toInputValue(new Date());

    let focusTile = null; // the tile shown full page, if any

    // Keep the frozen moment (?t=2012-12-21T11:11:00) and the full-page tile
    // (?show=moonPhase) in the address so they can be bookmarked or shared.
    // replaceState doesn't add history entries.
    function updateAddress() {
        const url = new URL(location.href);
        url.searchParams.delete('t');
        url.searchParams.delete('show');
        const extra = [];
        if (focusTile) extra.push('show=' + encodeURIComponent(focusTile.id));
        // Set by hand so the colons stay readable rather than becoming %3A.
        if (timeOverride) extra.push('t=' + toInputValue(timeOverride));
        if (extra.length) url.search = (url.search ? url.search + '&' : '?') + extra.join('&');
        try {
            history.replaceState(null, '', url);
        } catch (err) {
            // Some browsers block this for pages opened straight from disk (file://).
            console.warn('Could not update the address:', err);
        }
    }

    function setFrozen(date) {
        timeOverride = date;
        updateAddress();
        document.body.classList.toggle('is-frozen', Boolean(date));
        timeNowButton.disabled = !date;
        timeStatus.textContent = date
            ? `Frozen at ${date.toLocaleString('en-GB')}. Click a tile to copy its value.`
            : 'Showing the live time. Click a tile to see how it works.';
        renderTiles();
    }

    timeInput.addEventListener('input', () => {
        if (!timeInput.value) return;
        const picked = new Date(timeInput.value); // no offset, so read as local time
        if (isNaN(picked)) return;
        setFrozen(picked);
    });

    timeNowButton.addEventListener('click', () => {
        timeInput.value = toInputValue(new Date());
        setFrozen(null);
    });
    // ---------------------------------------------------------------------

    const tiles = [
        {
            id: 'weeks',
            name: 'ISO Week Number',
            info: 'This is the ISO Week Number, which represents the current week of the year according to ISO standards.',
            link: 'https://en.wikipedia.org/wiki/ISO_week_date',
            func: function () {
                // An ISO week belongs to the year its Thursday falls in, so jump to
                // this week's Thursday and count weeks from 1 January of that year.
                // Working in UTC dates avoids clock-change hours skewing the maths.
                const now = getNow();
                const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
                const isoDay = d.getUTCDay() || 7; // Monday = 1 … Sunday = 7
                d.setUTCDate(d.getUTCDate() + 4 - isoDay);
                const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
                return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
            }
        },
        {
            id: 'minutes',
            name: 'Minutes Past Midnight',
            info: 'This represents the number of minutes that have passed since midnight today.',
            link: 'https://en.wikipedia.org/wiki/Midnight',
            func: function () {
                const now = getNow();
                return now.getHours() * 60 + now.getMinutes();
            }
        },
        {
            id: 'epoch',
            name: 'Seconds Since Epoch',
            info: 'The number of seconds that have elapsed since January 1, 1970 (the Unix Epoch).',
            link: 'https://en.wikipedia.org/wiki/Unix_time',
            func: function () {
                return Math.floor(getNow() / 1000);
            }
        },
        {
            id: 'reverseTime',
            name: 'Time To Midnight',
            info: 'The time remaining until midnight.',
            link: 'https://www.timeanddate.com/countdown/generic',
            func: function () {
                const now = getNow();
                const reverseHours = 23 - now.getHours();
                const reverseMinutes = 59 - now.getMinutes();
                const reverseSeconds = 59 - now.getSeconds();
                return `${reverseHours.toString().padStart(2, '0')}:${reverseMinutes.toString().padStart(2, '0')}:${reverseSeconds.toString().padStart(2, '0')}`;
            }
        },
        {
            id: 'dayCounter',
            name: 'Days Into This Year',
            info: 'The number of days that have passed since the beginning of the year.',
            link: 'https://en.wikipedia.org/wiki/Year',
            func: function () {
                // Compare calendar dates, not elapsed milliseconds, so the hour lost
                // to British Summer Time can't knock the count back a day.
                const now = getNow();
                const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
                const startOfYear = Date.UTC(now.getFullYear(), 0, 1);
                return Math.round((today - startOfYear) / 86400000) + 1;
            }
        },
        {
            id: 'msToMidnight',
            name: 'Milliseconds To Midnight',
            info: 'The number of milliseconds remaining until the start of the next day.',
            link: 'https://en.wikipedia.org/wiki/Millisecond',
            func: function () {
                const now = getNow();
                const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
                return nextMidnight - now;
            }
        },
        {
            id: 'hoursLeftInYear',
            name: 'Hours Left In The Year',
            info: 'The number of hours remaining until the end of the current year.',
            link: 'https://www.timeanddate.com/countdown/newyear',
            func: function () {
                const now = getNow();
                const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
                const msLeftInYear = endOfYear - now;
                return Math.floor(msLeftInYear / (1000 * 60 * 60));
            }
        },
        {
            id: 'internetBeats',
            name: 'Swatch Time',
            info: 'Internet Swatch time, represented in beats (@beats). One beat equals 1/1000th of a day.',
            link: 'https://en.wikipedia.org/wiki/Swatch_Internet_Time',
            func: function () {
                // Biel Mean Time is UTC+1 all year round; a beat is 86.4 seconds.
                const beats = Math.floor(((getNow().getTime() + 3600000) % 86400000) / 86400);
                return `@${beats}`;
            }
        },
        {
            id: 'dayCompletion',
            name: 'Earth’s Rotation',
            info: 'The percentage of the current day that has passed.',
            link: 'https://en.wikipedia.org/wiki/Earth%27s_rotation',
            func: function () {
                const totalSeconds = 24 * 60 * 60;
                const now = getNow();
                const nowSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
                return `${((nowSeconds / totalSeconds) * 100).toFixed(2)}%`;
            }
        },
        {
            id: 'siderealTime',
            name: 'Greenwich Sidereal Time',
            info: 'The sidereal time at the Greenwich Meridian.',
            link: 'https://en.wikipedia.org/wiki/Sidereal_time',
            func: function () {
                const JD = (function getJulianDate(date) {
                    let year = date.getUTCFullYear();
                    let month = date.getUTCMonth() + 1;
                    const day = date.getUTCDate();
                    if (month <= 2) {
                        month += 12;
                        year -= 1;
                    }
                    const A = Math.floor(year / 100);
                    const B = 2 - A + Math.floor(A / 4);
                    const jdAtMidnight =
                        Math.floor(365.25 * (year + 4716)) +
                        Math.floor(30.6001 * (month + 1)) +
                        day +
                        B -
                        1524.5;
                    const fractionOfDay =
                        (date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600) / 24;
                    return jdAtMidnight + fractionOfDay;
                })(getNow());
                const D = JD - 2451545.0;
                let GMST = 280.46061837 + 360.98564736629 * D;
                GMST = GMST % 360;
                if (GMST < 0) GMST += 360;
                const GMST_hours = GMST / 15;
                const h = Math.floor(GMST_hours);
                const m = Math.floor((GMST_hours - h) * 60);
                const s = Math.floor(((GMST_hours - h) * 60 - m) * 60);
                return `${h}h ${m}m ${s}s`;
            }
        },
        {
            id: 'decimalTime',
            name: 'Decimal Time',
            info: 'The current time of day in decimal format, where the day is divided into 10 hours.',
            link: 'https://en.wikipedia.org/wiki/Decimal_time',
            func: function () {
                const now = getNow();
                const h = now.getHours();
                const m = now.getMinutes();
                const s = now.getSeconds();
                const totalSeconds = h * 3600 + m * 60 + s;
                const decimalSeconds = (totalSeconds / 86400) * 100000;
                const decHours = Math.floor(decimalSeconds / 10000);
                const decMinutes = Math.floor((decimalSeconds % 10000) / 100);
                const decSecs = Math.floor(decimalSeconds % 100);
                return `${decHours}h:${decMinutes.toString().padStart(2, '0')}m:${decSecs.toString().padStart(2, '0')}s`;
            }
        },
        {
            id: 'julianDate',
            name: 'Julian Date',
            info: 'The Julian date, which represents the continuous count of days since the beginning of the Julian Period.',
            link: 'https://en.wikipedia.org/wiki/Julian_day',
            func: function () {
                const now = getNow();
                let year = now.getUTCFullYear();
                let month = now.getUTCMonth() + 1;
                const day = now.getUTCDate();
                if (month <= 2) {
                    month += 12;
                    year -= 1;
                }
                const A = Math.floor(year / 100);
                const B = 2 - A + Math.floor(A / 4);
                const jdAtMidnight =
                    Math.floor(365.25 * (year + 4716)) +
                    Math.floor(30.6001 * (month + 1)) +
                    day +
                    B -
                    1524.5;
                const fractionOfDay =
                    (now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600) / 24;
                return (jdAtMidnight + fractionOfDay).toFixed(5);
            }
        },
                {
            id: 'excelSerial',
            name: 'Excel Serial Date',
            info: 'The current date and time as a spreadsheet serial number (1900 date system): whole days since 30 December 1899, with the time of day as a fraction. Paste it into Excel or Google Sheets and format the cell as a date to read it back.',
            link: 'https://support.microsoft.com/en-gb/office/date-systems-in-excel-e7fe7167-48a9-4b96-bb53-5612a800b487',
            func: function () {
                const now = getNow();
                const localMs = now.getTime() - now.getTimezoneOffset() * 60000;
                return (localMs / 86400000 + 25569).toFixed(5);
            }
        },
                {
            id: 'marsTime',
            name: 'Mars Coordinated Time',
            info: 'The Mars Sol Date (days since a reference date in 1873) and Coordinated Mars Time, the Martian equivalent of UTC at the prime meridian. A sol lasts about 24h 39m 35s.',
            link: 'https://en.wikipedia.org/wiki/Timekeeping_on_Mars',
            func: function () {
                const jdUTC = getNow().getTime() / 86400000 + 2440587.5;
                const jdTT = jdUTC + (37 + 32.184) / 86400;
                const msd = (jdTT - 2405522.0028779) / 1.0274912517;
                const secs = Math.floor((msd % 1) * 86400);
                const p = n => String(n).padStart(2, '0');
                return `Sol ${Math.floor(msd)}, ${p(Math.floor(secs / 3600))}:${p(Math.floor(secs / 60) % 60)}:${p(secs % 60)}`;
            }
        },
                {
            id: 'y2038',
            name: 'Y2038 Countdown',
            info: 'Seconds until signed 32-bit Unix time overflows (2,147,483,647 seconds after the epoch), at 03:14:07 UTC on 19 January 2038.',
            link: 'https://en.wikipedia.org/wiki/Year_2038_problem',
            func: function () {
                const left = 2147483647 - Math.floor(getNow().getTime() / 1000);
                return `${left.toLocaleString('en-GB')} s`;
            }
        },
                {
            id: 'hexTime',
            name: 'Hexadecimal Time',
            info: 'The day divided into 16 hexadecimal hours, each of 256 hex minutes, each of 16 hex seconds. Midnight is 0_00_0 and midday is 8_00_0.',
            link: 'https://en.wikipedia.org/wiki/Hexadecimal_time',
            func: function () {
                const now = getNow();
                const secs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
                const h = Math.floor(secs / 86400 * 65536).toString(16).toUpperCase().padStart(4, '0');
                return `${h[0]}_${h.slice(1, 3)}_${h[3]}`;
            }
        },
        {
            id: 'moonPhase',
            name: 'Moon Phase',
            info: 'The current phase of the moon based on its position relative to the Earth and Sun.',
            link: 'https://en.wikipedia.org/wiki/Lunar_phase',
            func: function () {
                const synodicMonth = 29.5305882;
                const reference = new Date('2000-01-06T18:14:00Z');
                const now = getNow();
                const daysSinceReference = (now - reference) / (1000 * 60 * 60 * 24);
                const moonAge = ((daysSinceReference % synodicMonth) + synodicMonth) % synodicMonth; // stays positive before 2000
                const phaseFraction = moonAge / synodicMonth;
                this.fraction = phaseFraction; // used to draw the little moon

                if (phaseFraction < 0.03 || phaseFraction > 0.97) return 'New Moon';
                if (phaseFraction < 0.22) return 'Waxing Crescent';
                if (phaseFraction < 0.28) return 'First Quarter';
                if (phaseFraction < 0.47) return 'Waxing Gibbous';
                if (phaseFraction < 0.53) return 'Full Moon';
                if (phaseFraction < 0.72) return 'Waning Gibbous';
                if (phaseFraction < 0.78) return 'Last Quarter';
                return 'Waning Crescent';
            },
            // Draws the moon as seen from the northern hemisphere: an outline,
            // with the lit part bounded by the limb and an elliptical terminator.
            illustrate: function (fraction) {
                const r = 14, cx = 16, cy = 16;
                const k = Math.cos(2 * Math.PI * fraction); // 1 = new, -1 = full
                const rx = Math.abs(k) * r;
                const waxing = fraction < 0.5;
                const outer = waxing ? 1 : 0; // right limb when waxing, left when waning
                const inner = waxing ? (k > 0 ? 0 : 1) : (k > 0 ? 1 : 0);
                const lit = `M ${cx} ${cy - r} A ${r} ${r} 0 0 ${outer} ${cx} ${cy + r} A ${rx} ${r} 0 0 ${inner} ${cx} ${cy - r} Z`;
                // South of the equator the moon looks the other way round, so mirror it.
                const flip = place && place.latitude < 0 ? ' transform="matrix(-1 0 0 1 32 0)"' : '';
                return `<g${flip}>
                        <circle class="moon-dark" cx="${cx}" cy="${cy}" r="${r}"/>
                        <path class="moon-lit" d="${lit}"/>
                        <circle class="moon-rim" cx="${cx}" cy="${cy}" r="${r}"/>
                        </g>`;
            }
        },
                {
            id: 'romanTime',
            name: 'Roman Time',
            info: 'The time in Roman numerals. The Romans had no zero, so medieval scholars used N (nulla) instead.',
            link: 'https://en.wikipedia.org/wiki/Roman_numerals',
            func: function () {
                const roman = n => {
                    if (n === 0) return 'N';
                    const map = [[50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
                    let out = '';
                    for (const [v, r] of map) while (n >= v) { out += r; n -= v; }
                    return out;
                };
                const now = getNow();
                return `${roman(now.getHours())} : ${roman(now.getMinutes())} : ${roman(now.getSeconds())}`;
            }
        },
                {
            id: 'morseTime',
            name: 'Morse Time',
            info: 'Hours, minutes and seconds in International Morse Code, one per line.',
            link: 'https://en.wikipedia.org/wiki/Morse_code',
            mono: true, // fixed-width font so neighbouring dashes don't merge
            func: function () {
                const m = ['-----', '.----', '..---', '...--', '....-', '.....', '-....', '--...', '---..', '----.'];
                const now = getNow();
                const p = n => String(n).padStart(2, '0');
                // One line each for hours, minutes and seconds.
                return [now.getHours(), now.getMinutes(), now.getSeconds()]
                    .map(n => [...p(n)].map(d => m[d]).join(' '))
                    .join('\n');
            }
        },
                {
            id: 'planckTime',
            name: 'Planck Times Since Midnight',
            info: 'Planck times elapsed since midnight. One Planck time is about 5.39 × 10⁻⁴⁴ seconds, the shortest interval that makes physical sense.',
            link: 'https://en.wikipedia.org/wiki/Planck_units#Planck_time',
            func: function () {
                const now = getNow();
                const secs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds() + now.getMilliseconds() / 1000;
                return (secs / 5.391247e-44).toExponential(4);
            }
        },
                {
            id: 'lightDistance',
            name: 'Light Since Midnight',
            info: 'How far light emitted at midnight has travelled, in astronomical units (1 AU = Earth–Sun distance). It reaches Neptune (about 30 AU) shortly after 4am.',
            link: 'https://en.wikipedia.org/wiki/Light-second',
            func: function () {
                const now = getNow();
                const secs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
                return `${(secs * 299792.458 / 149597870.7).toFixed(3)} AU`;
            }
        },
                {
            id: 'medievalTime',
            name: 'Medieval Time',
            info: 'The monastic canonical hour, plus moments elapsed in the current hour. A moment (momentum) was a medieval unit of 1/40 of an hour, or 90 seconds.',
            link: 'https://en.wikipedia.org/wiki/Moment_(time)',
            func: function () {
                const hours = ['Matins', 'Lauds', 'Prime', 'Terce', 'Sext', 'None', 'Vespers', 'Compline'];
                const now = getNow();
                const moments = Math.floor((now.getMinutes() * 60 + now.getSeconds()) / 90);
                return `${hours[Math.floor(now.getHours() / 3)]}, ${moments} moments past the hour`;
            }
        },
        {
            id: 'shipsBells',
            name: "Ship's Bells",
            info: "Time as rung aboard ship: one bell per half hour of a four-hour watch, up to eight bells at the change of watch. The 16:00–20:00 watch is split into two dog watches so crews rotate.",
            link: 'https://en.wikipedia.org/wiki/Ship%27s_bell',
            func: function () {
                const now = getNow();
                const h = now.getHours();
                const bells = Math.floor((h * 60 + now.getMinutes()) / 30) % 8 || 8;
                const watch = h < 4 ? 'Middle' : h < 8 ? 'Morning' : h < 12 ? 'Forenoon' : h < 16 ? 'Afternoon'
                    : h < 18 ? 'First Dog' : h < 20 ? 'Last Dog' : 'First';
                return `${bells} bell${bells > 1 ? 's' : ''}, ${watch} Watch`;
            }
        },
        {
            id: 'mayanLongCount',
            name: 'Mayan Long Count',
            info: "Days since the Maya creation date (11 August 3114 BC), written as baktun.katun.tun.uinal.kin. The famous 13.0.0.0.0 fell on 21 December 2012. Uses the GMT correlation (584283).",
            link: 'https://en.wikipedia.org/wiki/Mesoamerican_Long_Count_calendar',
            func: function () {
                let d = Math.floor(getNow().getTime() / 86400000) + 2440588 - 584283;
                const parts = [144000, 7200, 360, 20, 1].map(n => { const v = Math.floor(d / n); d %= n; return v; });
                return parts.join('.');
            }
        },
        {
            id: 'gpsTime',
            name: 'GPS Time',
            info: "GPS week number and seconds into the week, counted from 6 January 1980. GPS ignores leap seconds, so it currently runs 18 seconds ahead of UTC. Older receivers only store the week in 10 bits, which rolls over every 1,024 weeks.",
            link: 'https://en.wikipedia.org/wiki/GPS_week_number_rollover',
            func: function () {
                const gps = Math.floor(getNow().getTime() / 1000) - 315964800 + 18;
                const week = Math.floor(gps / 604800);
                return `Week ${week} (${week % 1024}), ${(gps % 604800).toLocaleString('en-GB')} s`;
            }
        },
        {
            id: 'sundialTime',
            name: 'Sundial Time',
            info: "Apparent solar time: what a sundial would read. It drifts from clock time because Earth's orbit is elliptical and its axis is tilted (the equation of time). In early November a sundial runs about 16 minutes fast.",
            link: 'https://en.wikipedia.org/wiki/Equation_of_time',
            func: function () {
                // Your longitude if you've shared your location, otherwise Greenwich.
                const LONGITUDE = place ? place.longitude : 0; // degrees east of Greenwich
                const now = getNow();
                const N = Math.floor((now - Date.UTC(now.getUTCFullYear(), 0, 0)) / 86400000);
                const B = 2 * Math.PI * (N - 81) / 365;
                const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
                const utcMins = now.getUTCHours() * 60 + now.getUTCMinutes() + now.getUTCSeconds() / 60;
                const solar = (utcMins + LONGITUDE * 4 + eot + 1440) % 1440;
                const p = n => String(Math.floor(n)).padStart(2, '0');
                return `${p(solar / 60)}:${p(solar % 60)}:${p((solar * 60) % 60)}`;
            }
        },
        {
            id: 'shichen',
            name: 'Chinese Double-Hour',
            info: "Traditional Chinese timekeeping split the day into 12 shichen of two hours each, named after the Earthly Branches and zodiac animals. The Rat hour starts at 23:00. Each was further divided into 8 ke of 15 minutes.",
            link: 'https://en.wikipedia.org/wiki/Traditional_Chinese_timekeeping',
            func: function () {
                const names = ['Zi (Rat)', 'Chou (Ox)', 'Yin (Tiger)', 'Mao (Rabbit)', 'Chen (Dragon)', 'Si (Snake)',
                    'Wu (Horse)', 'Wei (Goat)', 'Shen (Monkey)', 'You (Rooster)', 'Xu (Dog)', 'Hai (Pig)'];
                const now = getNow();
                const shifted = (now.getHours() + 1) % 24;
                const ke = Math.floor(((shifted % 2) * 60 + now.getMinutes()) / 15) + 1;
                return `${names[Math.floor(shifted / 2)]}, ke ${ke} of 8`;
            }
        },
        {
            id: 'halakim',
            name: 'Hebrew Chalakim',
            info: "In the Hebrew calendar an hour is divided into 1,080 chalakim (parts) of 3⅓ seconds each, a number chosen because it divides cleanly by 2, 3, 4, 5, 6, 8, 9 and 10.",
            link: 'https://en.wikipedia.org/wiki/Helek',
            func: function () {
                const now = getNow();
                const parts = Math.floor((now.getMinutes() * 60 + now.getSeconds()) * 0.3);
                return `${now.getHours()} hours, ${parts} chalakim`;
            }
        },
        {
            id: 'fuzzyTime',
            name: 'Fuzzy Time',
            info: 'The time the way a person says it when they glance at a clock.',
            link: 'https://en.wikipedia.org/wiki/12-hour_clock',
            func: function () {
                const words = ['twelve', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven'];
                const phrases = ["{h} o'clock", 'five past {h}', 'ten past {h}', 'quarter past {h}', 'twenty past {h}', 'twenty-five past {h}',
                    'half past {h}', 'twenty-five to {n}', 'twenty to {n}', 'quarter to {n}', 'ten to {n}', 'five to {n}', "{n} o'clock"];
                const now = getNow();
                const i = Math.round((now.getMinutes() + now.getSeconds() / 60) / 5);
                const h = now.getHours() % 12;
                const text = phrases[i].replace('{h}', words[h]).replace('{n}', words[(h + 1) % 12]);
                return `About ${text}`;
            }
        },
        {
            id: 'orbitDistance',
            name: 'Orbit Since Midnight',
            info: 'How far Earth has carried you around the Sun since midnight, at an average orbital speed of 29.78 km/s.',
            link: 'https://en.wikipedia.org/wiki/Earth%27s_orbit',
            func: function () {
                const now = getNow();
                const secs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
                return `${Math.round(secs * 29.78).toLocaleString('en-GB')} km`;
            }
        },
        {
            id: 'isstime',
            name: 'ISS Local Time',
            info: 'Local time at the location below the International Space Station',
            link: 'https://isstracker.spaceflight.esa.int/index_portal.php',
            func: async function () {
                // The ISS position only exists for right now, so this tile can't time-travel.
                if (timeOverride) return 'Live time only';

                // Ask for the position at most every 10 seconds (the API allows
                // about one request a second); in between, reuse the last answer.
                // The ISS moves about 77 km in that time, so the time barely changes.
                const REFRESH_MS = 10000;
                if (!this.position || Date.now() - this.fetchedAt > REFRESH_MS) {
                    if (!this.pending) {
                        this.pending = fetch('https://api.wheretheiss.at/v1/satellites/25544')
                            .then(res => {
                                if (!res.ok) throw new Error(`ISS API returned ${res.status}`);
                                return res.json();
                            })
                            .then(({ latitude, longitude }) => { this.position = { latitude, longitude }; })
                            .catch(error => console.error('ISS lookup failed:', error))
                            .finally(() => {
                                this.fetchedAt = Date.now(); // after a failure, wait before retrying too
                                this.pending = null;
                            });
                    }
                    if (!this.position) await this.pending; // first load: wait for an answer
                }

                if (!this.position) return 'Temporarily unavailable';
                return this.calculateLocalTime(this.position.latitude, this.position.longitude, new Date());
            },
            calculateLocalTime: function (lat, lng, date) {
                // Simple timezone approximation using longitude
                const hoursOffset = Math.round(lng / 15); // 15° longitude = 1 hour
                const localTime = new Date(date.getTime() + (hoursOffset * 60 * 60 * 1000));

                return localTime.toLocaleTimeString('en-US', {
                    timeZone: 'UTC',
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                }) + ` (UTC${hoursOffset >= 0 ? '+' : ''}${hoursOffset})`;
            }
        }
    ];

    // ---- Dial ------------------------------------------------------------
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const dialTicks = document.getElementById('dialTicks');
    for (let i = 0; i < 60; i++) {
        const major = i % 5 === 0;
        const tick = document.createElementNS(SVG_NS, 'line');
        tick.setAttribute('x1', 100);
        tick.setAttribute('x2', 100);
        tick.setAttribute('y1', 8);
        tick.setAttribute('y2', major ? 24 : 14);
        tick.setAttribute('class', major ? 'tick tick-major' : 'tick');
        tick.setAttribute('transform', `rotate(${i * 6} 100 100)`);
        dialTicks.appendChild(tick);
    }

    const hourHand = document.getElementById('hourHand');
    const minuteHand = document.getElementById('minuteHand');
    const secondHand = document.getElementById('secondHand');
    const readout = document.getElementById('readout');
    const rotate = (el, deg) => el.setAttribute('transform', `rotate(${deg} 100 100)`);

    function updateDial() {
        const now = getNow();
        const s = now.getSeconds();
        const m = now.getMinutes() + s / 60;
        const h = (now.getHours() % 12) + m / 60;
        rotate(hourHand, h * 30);
        rotate(minuteHand, m * 6);
        rotate(secondHand, s * 6);
        readout.dateTime = now.toISOString();
        readout.textContent = now.toLocaleString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    }

    document.getElementById('tileCount').textContent = tiles.length;

    // ---- Tiles -----------------------------------------------------------
    tiles.forEach((tile) => {
        const tileButton = document.createElement('button');
        tileButton.type = 'button';
        tileButton.className = 'tile';

        const nameEl = document.createElement('span');
        nameEl.className = 'tile-name';
        nameEl.textContent = tile.name;

        const valueEl = document.createElement('span');
        valueEl.className = tile.mono ? 'tile-value is-mono' : 'tile-value';
        valueEl.textContent = '…';

        tileButton.append(nameEl, valueEl);
        tile.el = tileButton;
        tile.valueEl = valueEl;

        // Tiles with an illustrate() method get a small picture in the corner.
        if (tile.illustrate) {
            tile.iconEl = document.createElementNS(SVG_NS, 'svg');
            tile.iconEl.setAttribute('class', 'tile-icon');
            tile.iconEl.setAttribute('viewBox', '0 0 32 32');
            tile.iconEl.setAttribute('aria-hidden', 'true');
            tileButton.append(tile.iconEl);
        }

        tileButton.addEventListener('click', () => {
            // Frozen mode: copy "Name: value" instead of opening the pop-up.
            if (timeOverride) {
                if (tileButton.dataset.flash) return;
                navigator.clipboard.writeText(`${tile.name}: ${valueEl.textContent}`)
                    .then(() => flashTile(tileButton, 'Copied'))
                    .catch(err => {
                        console.error('Failed to copy tile: ', err);
                        flashTile(tileButton, 'Copy failed');
                    });
                return;
            }
            openModal(tile);
        });

        gridContainer.appendChild(tileButton);
    });

    // Lay a short message over a tile; the value underneath keeps updating.
    function flashTile(el, message) {
        el.dataset.flash = message;
        setTimeout(() => delete el.dataset.flash, 900);
    }

    // Each tile updates on its own, so a slow one (the ISS lookup) doesn't hold up the rest.
    function renderTiles() {
        updateDial();
        const startedWith = timeOverride;
        tiles.forEach(async (tile) => {
            const result = tile.func instanceof Function ? await tile.func() : tile.func;
            if (timeOverride !== startedWith) return; // time changed while waiting; drop stale result
            tile.valueEl.textContent = result;
            if (tile.iconEl && tile.fraction !== undefined) {
                tile.iconEl.innerHTML = tile.illustrate(tile.fraction);
            }
            if (tile === focusTile) updateFocus();
        });
    }

    // ---- Full page view ----------------------------------------------------
    // One tile filling the browser window (not the Fullscreen API), with the
    // value sized as large as fits. It's a <dialog>, so Escape closes it.
    const focusView = document.getElementById('focusView');
    const focusName = document.getElementById('focusName');
    const focusValue = document.getElementById('focusValue');
    const focusIcon = document.getElementById('focusIcon');
    const focusReadout = document.getElementById('focusReadout');
    const focusStage = document.getElementById('focusStage');
    let fittedFor = ''; // the text shape the current font size was worked out for

    function openFocus(tile) {
        focusTile = tile;
        focusName.textContent = tile.name;
        // SVG elements don't have a .hidden property, so set the attribute itself.
        focusIcon.toggleAttribute('hidden', !tile.illustrate);
        focusView.classList.toggle('is-mono', Boolean(tile.mono));
        fittedFor = '';
        if (modal.open) modal.close();
        focusView.showModal();
        focusView.focus(); // focus the view itself, not the first button (no stray focus ring)
        updateFocus();
        updateAddress();
    }

    function updateFocus() {
        if (!focusTile) return;
        const text = focusTile.valueEl.textContent;
        focusValue.textContent = text;
        focusReadout.textContent = timeOverride ? `Frozen at ${readout.textContent}` : readout.textContent;
        if (focusTile.iconEl) focusIcon.innerHTML = focusTile.iconEl.innerHTML;
        // Refit only when the shape of the text changes (digits are fixed-width),
        // so the size doesn't wobble every second.
        const shape = text.replace(/\d/g, '0');
        if (shape !== fittedFor) fitFocusValue(shape);
    }

    // Measure the text at 100px, then scale it to fill the space available.
    function fitFocusValue(shape) {
        fittedFor = shape;
        focusValue.style.transform = '';
        focusValue.style.fontSize = '100px';
        const { width, height } = focusValue.getBoundingClientRect();
        const stage = getComputedStyle(focusStage);
        const roomWidth = focusStage.clientWidth - parseFloat(stage.paddingLeft) - parseFloat(stage.paddingRight);
        const roomHeight = focusStage.clientHeight - parseFloat(stage.paddingTop) - parseFloat(stage.paddingBottom);
        // Leave room for the picture (the moon) above the value, if there is one.
        const iconHeight = focusIcon.hasAttribute('hidden') ? 0 : focusIcon.getBoundingClientRect().height + 24;
        const scale = Math.min((roomWidth * 0.92) / width, ((roomHeight - iconHeight) * 0.9) / height);
        const size = Math.max(16, Math.floor(100 * scale));
        focusValue.style.fontSize = `${size}px`;
        // Fonts leave more room above the letters than below, so text centred by
        // its line box looks low. Nudge it so the visible shapes are centred.
        focusValue.style.transform = `translateY(${-inkOffset(size).toFixed(1)}px)`;
    }

    // How far the middle of the visible letters sits below the middle of the
    // text's line boxes, worked out from the font's real measurements.
    const measureCtx = document.createElement('canvas').getContext('2d');
    function inkOffset(size) {
        const style = getComputedStyle(focusValue);
        measureCtx.font = `${style.fontWeight} ${size}px ${style.fontFamily}`;
        const lines = focusValue.textContent.split('\n');
        let inkAscent = 0, inkDescent = -Infinity, fontAscent = 0, fontDescent = 0;
        for (const line of lines) {
            const m = measureCtx.measureText(line);
            inkAscent = Math.max(inkAscent, m.actualBoundingBoxAscent);
            inkDescent = Math.max(inkDescent, m.actualBoundingBoxDescent);
            fontAscent = m.fontBoundingBoxAscent;
            fontDescent = m.fontBoundingBoxDescent;
        }
        const lineHeight = parseFloat(style.lineHeight) || size * 1.1;
        const firstBaseline = (lineHeight - (fontAscent + fontDescent)) / 2 + fontAscent;
        const inkTop = firstBaseline - inkAscent;
        const inkBottom = firstBaseline + (lines.length - 1) * lineHeight + inkDescent;
        return (inkTop + inkBottom) / 2 - (lines.length * lineHeight) / 2;
    }

    // Refit once the web fonts have arrived, in case it was measured with a fallback.
    document.fonts?.ready.then(() => { if (focusTile) { fittedFor = ''; updateFocus(); } });

    window.addEventListener('resize', () => { if (focusTile) { fittedFor = ''; updateFocus(); } });

    document.getElementById('focusClose').addEventListener('click', () => focusView.close());
    focusView.addEventListener('close', () => {
        const tile = focusTile;
        focusTile = null;
        updateAddress();
        if (tile) tile.el.focus(); // put keyboard focus back on the tile it came from
    });

    // Opened with ?t=… in the address? Start frozen at that moment.
    // A value without an offset is read as local time, like the picker.
    // Read both values before anything rewrites the address.
    const startParams = new URLSearchParams(location.search);
    const startTime = startParams.get('t');
    const startShow = startParams.get('show');
    const startDate = startTime ? new Date(startTime) : null;
    if (startDate && !isNaN(startDate)) {
        timeInput.value = toInputValue(startDate);
        setFrozen(startDate); // also renders the tiles
    } else {
        if (startTime) updateAddress(); // drop a ?t= that couldn't be read
        renderTiles();
    }
    setInterval(renderTiles, 1000);

    // Opened with ?show=… in the address? Go straight to that tile, full page.
    const showTile = tiles.find(t => t.id === startShow);
    if (showTile) openFocus(showTile);
    else if (startShow) updateAddress(); // drop a ?show= that doesn't match a tile

    // ---- Location --------------------------------------------------------
    // Only asked for when the button is pressed. If the browser has already
    // been given permission for this page, it's picked up automatically.
    // The position stays in the page; nothing is sent anywhere.
    const locationText = document.getElementById('locationText');
    const locationButton = document.getElementById('locationButton');

    const formatPlace = ({ latitude, longitude }) =>
        `${Math.abs(latitude).toFixed(1)}° ${latitude >= 0 ? 'N' : 'S'}, ` +
        `${Math.abs(longitude).toFixed(1)}° ${longitude >= 0 ? 'E' : 'W'}`;

    function findLocation() {
        locationButton.disabled = true;
        locationText.textContent = 'Finding your location…';
        navigator.geolocation.getCurrentPosition(
            ({ coords }) => {
                place = { latitude: coords.latitude, longitude: coords.longitude };
                locationText.textContent = `Sundial and moon set for ${formatPlace(place)}.`;
                locationButton.hidden = true;
                renderTiles();
            },
            (err) => {
                locationText.textContent = err.code === err.PERMISSION_DENIED
                    ? 'Location is blocked. Sundial set for Greenwich.'
                    : "Couldn't find your location. Sundial set for Greenwich.";
                locationButton.textContent = 'Try again';
                locationButton.disabled = false;
            },
            { maximumAge: 60 * 60 * 1000, timeout: 15000 }
        );
    }

    if ('geolocation' in navigator) {
        locationButton.addEventListener('click', findLocation);
        navigator.permissions?.query({ name: 'geolocation' })
            .then(status => { if (status.state === 'granted') findLocation(); })
            .catch(() => {});
    } else {
        locationButton.hidden = true;
        locationText.textContent = "This browser can't share a location. Sundial set for Greenwich.";
    }

    // Tell the CSS how many rows of tiles there are, so it can cap their
    // height on big screens. Re-checked whenever the grid changes size.
    const countRows = () => {
        const columns = getComputedStyle(gridContainer).gridTemplateColumns.split(' ').length;
        gridContainer.style.setProperty('--rows', Math.ceil(tiles.length / columns));
    };
    new ResizeObserver(countRows).observe(gridContainer);

    // ---- Pop-up ----------------------------------------------------------
    // <dialog> handles Escape, focus and the backdrop for us.
    function openModal(tile) {
        currentTile = tile;
        copyTimeButton.textContent = 'Copy time';
        modalTitle.textContent = tile.name;
        modalDescription.textContent = tile.info;
        modalLink.hidden = !tile.link;
        if (tile.link) modalLink.href = tile.link;
        codeSnippet.textContent = dedent(tile.func.toString());
        copyCodeButton.textContent = 'Copy code';
        modal.showModal();
        modal.focus();
    }

    // toString() keeps the indentation from inside the tiles array; strip it
    // from every line after the first so the code sits flush left.
    function dedent(source) {
        const [first, ...rest] = source.split('\n');
        const indents = rest.filter(l => l.trim()).map(l => l.match(/^\s*/)[0].length);
        const cut = indents.length ? Math.min(...indents) : 0;
        return [first, ...rest.map(l => l.slice(cut))].join('\n');
    }

    closeModal.addEventListener('click', () => modal.close());
    document.getElementById('fullPageButton').addEventListener('click', () => {
        if (currentTile) openFocus(currentTile);
    });

    // A click on the dialog itself (not its contents) is a click on the backdrop.
    modal.addEventListener('click', (event) => {
        if (event.target === modal) modal.close();
    });

    // Copy some text and show the result on the button for a moment.
    function copyWithFeedback(button, label, getText) {
        button.addEventListener('click', () => {
            navigator.clipboard.writeText(getText())
                .then(() => { button.textContent = 'Copied'; })
                .catch(err => {
                    console.error(`Failed to ${label.toLowerCase()}: `, err);
                    button.textContent = 'Copy failed';
                })
                .finally(() => {
                    clearTimeout(button.resetTimer);
                    button.resetTimer = setTimeout(() => { button.textContent = label; }, 1500);
                });
        });
    }

    copyWithFeedback(copyCodeButton, 'Copy code', () => codeSnippet.textContent);
    // Copies "Name: value" as it is at the moment of the click (live or frozen),
    // the same format as clicking a tile while the clock is frozen.
    copyWithFeedback(copyTimeButton, 'Copy time',
        () => currentTile ? `${currentTile.name}: ${currentTile.valueEl.textContent}` : '');
});