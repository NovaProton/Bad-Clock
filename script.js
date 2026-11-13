// The first touch marks this as a touch device, which hides the arrow-key hints.
window.addEventListener('touchstart', () => document.documentElement.classList.add('is-touch'),
    { once: true, passive: true });

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

    // The panes of the full page view, one per tile shown (empty when it's
    // closed). Each is { tile, el, iconEl, valueEl, ... }.
    let panes = [];
    const MAX_PANES = 4;
    let shuffling = false; // full page view is cycling through the tiles

    // Keep the frozen moment (?t=2012-12-21T11:11:00) and the full-page tiles
    // (?show=moonPhase or ?show=moonPhase,binaryTime) in the address so they
    // can be bookmarked or shared. replaceState doesn't add history entries.
    function updateAddress() {
        const url = new URL(location.href);
        url.searchParams.delete('t');
        url.searchParams.delete('show');
        url.searchParams.delete('shuffle');
        const extra = [];
        if (shuffling) extra.push('shuffle');
        else if (panes.length) extra.push('show=' + panes.map(p => encodeURIComponent(p.tile.id)).join(','));
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

    // ---- Shared helpers ----------------------------------------------------
    // Used by more than one tile. A tile lists the helpers it uses in `uses`,
    // so the pop-up can show their code under the tile's own.

    // Seconds that atomic time (TAI) is ahead of UTC at a given moment. UTC
    // gains a leap second now and then to stay in step with Earth's spin;
    // each date below is when one took effect. None since 2017, and they're
    // due to be scrapped by 2035. Before 1972 UTC used stretchy seconds
    // instead, so there's no whole-second answer: returns null.
    function taiMinusUtc(date) {
        const leaps = [
            '1972-01-01', '1972-07-01', '1973-01-01', '1974-01-01', '1975-01-01',
            '1976-01-01', '1977-01-01', '1978-01-01', '1979-01-01', '1980-01-01',
            '1981-07-01', '1982-07-01', '1983-07-01', '1985-07-01', '1988-01-01',
            '1990-01-01', '1991-01-01', '1992-07-01', '1993-07-01', '1994-07-01',
            '1996-01-01', '1997-07-01', '1999-01-01', '2006-01-01', '2009-01-01',
            '2012-07-01', '2015-07-01', '2017-01-01'
        ];
        const passed = leaps.filter(d => date >= new Date(d + 'T00:00:00Z')).length;
        return passed ? 9 + passed : null; // 10 s on 1 January 1972, then one more each time
    }

    // Time since midnight today, in milliseconds. Measured on the real clock
    // rather than worked out from the hours and minutes on the clock face, so
    // it's right on the days the clocks change: a 23-hour day in March and a
    // 25-hour day in October.
    function sinceMidnight(date) {
        return date - new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

    // How long today is, in milliseconds: 24 hours, except 23 or 25 on the
    // days the clocks change.
    function dayLength(date) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
            - new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

    // The equation of time, in minutes: how far a sundial is ahead of (+) or
    // behind (−) the Sun's average pace. Earth's elliptical orbit and tilted
    // axis make it swing between about 16 minutes ahead in early November and
    // 14 behind in mid-February.
    function equationOfTime(date) {
        const N = Math.floor((date - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86400000); // day of the year
        const B = 2 * Math.PI * (N - 81) / 365;
        return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
    }

    // The day of the September equinox in Paris, as a Julian Day Number,
    // using Jean Meeus's method (Astronomical Algorithms, chapter 27):
    // a smooth formula for the year, then 24 wobble terms for the pull of the
    // Moon and planets. Good to about a minute for any year from 1000 to 3000.
    function parisEquinoxDay(year) {
        const Y = (year - 2000) / 1000;
        const jde0 = 2451810.21715 + 365242.01767 * Y - 0.11575 * Y ** 2 + 0.00337 * Y ** 3 + 0.00078 * Y ** 4;
        const T = (jde0 - 2451545) / 36525;
        const rad = Math.PI / 180;
        const W = (35999.373 * T - 2.47) * rad;
        const dLambda = 1 + 0.0334 * Math.cos(W) + 0.0007 * Math.cos(2 * W);
        const terms = [
            [485, 324.96, 1934.136], [203, 337.23, 32964.467], [199, 342.08, 20.186],
            [182, 27.85, 445267.112], [156, 73.14, 45036.886], [136, 171.52, 22518.443],
            [77, 222.54, 65928.934], [74, 296.72, 3034.906], [70, 243.58, 9037.513],
            [58, 119.81, 33718.147], [52, 297.17, 150.678], [50, 21.02, 2281.226],
            [45, 247.54, 29929.562], [44, 325.15, 31555.956], [29, 60.93, 4443.417],
            [18, 155.12, 67555.328], [17, 288.79, 4562.452], [16, 198.04, 62894.029],
            [14, 199.76, 31436.921], [12, 95.39, 14577.848], [12, 287.11, 31931.756],
            [12, 320.81, 34777.259], [9, 227.73, 1222.114], [8, 15.45, 16859.074]
        ];
        const S = terms.reduce((sum, [A, B, C]) => sum + A * Math.cos((B + C * T) * rad), 0);
        const jde = jde0 + (0.00001 * S) / dLambda;
        // Paris Observatory is 2.337° east of Greenwich: 9 min 21 s ahead.
        // A Julian Day starts at noon, so add half a day to count from midnight.
        return Math.floor(jde + 561 / 86400 + 0.5);
    }

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
            info: 'This represents the number of minutes that have passed since midnight today. On the days the clocks change it counts real minutes, so it reaches 1,380 or 1,500 by the end of the day rather than 1,440.',
            link: 'https://en.wikipedia.org/wiki/Midnight',
            uses: [sinceMidnight],
            func: function () {
                return Math.floor(sinceMidnight(getNow()) / 60000);
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
            info: 'The time remaining until midnight. Counted on the real clock, so on the days the clocks change it allows for the hour gained or lost.',
            link: 'https://www.timeanddate.com/countdown/generic',
            uses: [sinceMidnight, dayLength],
            func: function () {
                const now = getNow();
                // Whole seconds left, rounded up, so it agrees with the clock: at
                // 12:00:00 there are 12:00:00 left, and it never reads 00:00:00 early.
                const left = Math.ceil((dayLength(now) - sinceMidnight(now)) / 1000);
                const p = n => String(n).padStart(2, '0');
                return `${p(Math.floor(left / 3600))}:${p(Math.floor(left / 60) % 60)}:${p(left % 60)}`;
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
                const endOfYear = new Date(now.getFullYear() + 1, 0, 1); // midnight on 1 January
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
                // The double % keeps it positive for dates before 1970.
                const msToday = (((getNow().getTime() + 3600000) % 86400000) + 86400000) % 86400000;
                const beats = Math.floor(msToday / 86400);
                return `@${beats}`;
            }
        },
        {
            id: 'dayCompletion',
            name: 'Earth’s Rotation',
            info: 'The percentage of the current day that has passed. On the days the clocks change, the day is 23 or 25 hours long, and the percentage allows for that.',
            link: 'https://en.wikipedia.org/wiki/Earth%27s_rotation',
            uses: [sinceMidnight, dayLength],
            func: function () {
                const now = getNow();
                const done = Math.floor(sinceMidnight(now) / 1000) * 1000; // whole seconds, like the clock
                // Round down, so it only reaches 100% at midnight.
                return `${(Math.floor((done / dayLength(now)) * 10000) / 100).toFixed(2)}%`;
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
                // Multiply before dividing, so whole numbers stay whole and don't round down.
                const decimalSeconds = totalSeconds * 100000 / 86400;
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
            uses: [taiMinusUtc],
            func: function () {
                const now = getNow();
                const jdUTC = now.getTime() / 86400000 + 2440587.5;
                // Terrestrial Time = atomic time + 32.184 s. Before 1972, use 10 s.
                const jdTT = jdUTC + ((taiMinusUtc(now) ?? 10) + 32.184) / 86400;
                const msd = (jdTT - 2405522.0028779) / 1.0274912517;
                const secs = Math.floor((msd - Math.floor(msd)) * 86400); // fraction of the sol, also before 1873
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
            info: "The Moon's phase and how much of it is lit. The percentage is the same wherever you are on Earth: it depends on where the Sun and Moon are, and Earth is tiny next to those distances. What does change is which way round it looks (the picture flips south of the equator), the tilt of the lit edge, and whether the Moon is up. Worked out from the Sun's and Moon's real positions, which wobble enough that a simple average month can be out by half a day.",
            link: 'https://en.wikipedia.org/wiki/Lunar_phase',
            uses: [taiMinusUtc],
            func: function () {
                // Jean Meeus, Astronomical Algorithms, chapters 47 and 48.
                const now = getNow();
                const rad = Math.PI / 180;
                // Julian centuries since 2000, in Terrestrial Time (atomic time + 32.184 s).
                const jd = now.getTime() / 86400000 + 2440587.5;
                const T = (jd + ((taiMinusUtc(now) ?? 10) + 32.184) / 86400 - 2451545) / 36525;

                // Mean elongation of the Moon from the Sun, the Sun's mean anomaly
                // and the Moon's mean anomaly, in degrees.
                const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T ** 2 + T ** 3 / 545868 - T ** 4 / 113065000;
                const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T ** 2 + T ** 3 / 24490000;
                const Mm = 134.9633964 + 477198.8675055 * T + 0.0087414 * T ** 2 + T ** 3 / 69699 - T ** 4 / 14712000;

                // The real elongation: the mean one plus the biggest wobbles from the
                // Moon's elliptical orbit and the Sun's pull. 0° = new, 180° = full.
                const sin = deg => Math.sin(deg * rad);
                const elongation = (((D + 6.289 * sin(Mm) - 2.100 * sin(M) + 1.274 * sin(2 * D - Mm)
                    + 0.658 * sin(2 * D) + 0.214 * sin(2 * Mm) + 0.110 * sin(D)) % 360) + 360) % 360;

                // Lit fraction = (1 + cos i) ÷ 2, where i (the phase angle, measured at
                // the Moon) is 180° minus the elongation. That's (1 − cos elongation) ÷ 2.
                const lit = (1 - Math.cos(elongation * rad)) / 2;
                const phaseFraction = elongation / 360; // 0 = new, 0.5 = full
                this.fraction = phaseFraction; // used to draw the little moon

                let name;
                if (phaseFraction < 0.03 || phaseFraction > 0.97) name = 'New Moon';
                else if (phaseFraction < 0.22) name = 'Waxing Crescent';
                else if (phaseFraction < 0.28) name = 'First Quarter';
                else if (phaseFraction < 0.47) name = 'Waxing Gibbous';
                else if (phaseFraction < 0.53) name = 'Full Moon';
                else if (phaseFraction < 0.72) name = 'Waning Gibbous';
                else if (phaseFraction < 0.78) name = 'Last Quarter';
                else name = 'Waning Crescent';
                return `${name}\n${Math.round(lit * 100)}% lit`; // % on its own line
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
            id: 'binaryTime',
            name: 'Binary Clock',
            info: 'Hours, minutes and seconds in binary, one per line. Each line has six bits worth 32, 16, 8, 4, 2 and 1 from left to right; add up the places with a 1. Six bits count to 63, which covers every hour, minute and second.',
            link: 'https://en.wikipedia.org/wiki/Binary_clock',
            mono: true, // fixed-width font and line breaks, like Morse
            func: function () {
                const now = getNow();
                return [now.getHours(), now.getMinutes(), now.getSeconds()]
                    .map(n => n.toString(2).padStart(6, '0'))
                    .join('\n');
            }
        },

        {
            id: 'planckTime',
            name: 'Planck Times Since Midnight',
            info: 'Planck times elapsed since midnight. One Planck time is about 5.39 × 10⁻⁴⁴ seconds, the shortest interval that makes physical sense.',
            link: 'https://en.wikipedia.org/wiki/Planck_units#Planck_time',
            uses: [sinceMidnight],
            func: function () {
                const secs = sinceMidnight(getNow()) / 1000;
                return (secs / 5.391247e-44).toExponential(4);
            }
        },
        {
            id: 'lightDistance',
            name: 'Light Since Midnight',
            info: 'How far light emitted at midnight has travelled, in astronomical units (1 AU = Earth–Sun distance). It reaches Neptune (about 30 AU) shortly after 4am.',
            link: 'https://en.wikipedia.org/wiki/Light-second',
            uses: [sinceMidnight],
            func: function () {
                const secs = Math.floor(sinceMidnight(getNow()) / 1000);
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
            info: "Time as rung aboard ship: one bell per half hour of a four-hour watch, up to eight bells at the change of watch. The 16:00–20:00 watch is split into two dog watches so crews rotate; in British ships the last dog watch rings one, two and three bells rather than five, six and seven.",
            link: 'https://en.wikipedia.org/wiki/Ship%27s_bell',
            func: function () {
                const now = getNow();
                const h = now.getHours();
                let bells = Math.floor((h * 60 + now.getMinutes()) / 30) % 8 || 8;
                // British practice since 1797: the last dog watch rings 1, 2, 3
                // (not 5, 6, 7) before eight bells at 20:00.
                if (h >= 18 && h < 20 && bells > 4) bells -= 4;
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
                // Today's date where you are, as a Julian Day Number, minus the correlation.
                const now = getNow();
                let d = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000) + 2440588 - 584283;
                const parts = [144000, 7200, 360, 20, 1].map(n => { const v = Math.floor(d / n); d %= n; return v; });
                return parts.join('.');
            }
        },
        {
            id: 'taiTime',
            name: 'Atomic Time (TAI)',
            info: "International Atomic Time, kept by averaging around 450 atomic clocks worldwide. UTC, the time we live by, gets an extra leap second now and then to keep up with Earth's slightly irregular spin, so it has fallen behind TAI: 10 seconds in 1972, and 37 seconds since the last leap second at the end of 2016.",
            link: 'https://en.wikipedia.org/wiki/International_Atomic_Time',
            uses: [taiMinusUtc],
            func: function () {
                const now = getNow();
                const offset = taiMinusUtc(now);
                if (offset === null) return 'Not defined before 1972';
                const tai = new Date(now.getTime() + offset * 1000);
                return `${tai.toISOString().slice(11, 19)} TAI (UTC + ${offset} s)`;
            }
        },
        {
            id: 'gpsTime',
            name: 'GPS Time',
            info: "GPS week number and seconds into the week, counted from 6 January 1980. GPS ignores leap seconds: it's always 19 seconds behind atomic time (TAI), so it currently runs 18 seconds ahead of UTC. Older receivers only store the week in 10 bits, which rolls over every 1,024 weeks.",
            link: 'https://en.wikipedia.org/wiki/GPS_week_number_rollover',
            uses: [taiMinusUtc],
            func: function () {
                // GPS = TAI − 19 s, so it picks up each leap second after 1980.
                const now = getNow();
                if (now < new Date('1980-01-06T00:00:00Z')) return 'Not started yet (6 January 1980)';
                const gps = Math.floor(now.getTime() / 1000) - 315964800 + (taiMinusUtc(now) - 19);
                const week = Math.floor(gps / 604800);
                return `Week ${week} (${week % 1024}), ${(gps % 604800).toLocaleString('en-GB')} s`;
            }
        },
        {
            id: 'frenchRepublican',
            name: 'French Republican Date',
            info: "The calendar of the French Revolution, used from 1793 to 1805. Twelve months of 30 days, named after the weather and the farming year, each split into three ten-day décades. The five or six days left over at the end of the year were festivals. Each year started on the day of the autumn equinox at the Paris Observatory, counting from 22 September 1792 (year I). Years are in Roman numerals.",
            link: 'https://en.wikipedia.org/wiki/French_Republican_calendar',
            uses: [parisEquinoxDay],
            func: function () {
                const months = ['Vendémiaire', 'Brumaire', 'Frimaire', 'Nivôse', 'Pluviôse', 'Ventôse',
                    'Germinal', 'Floréal', 'Prairial', 'Messidor', 'Thermidor', 'Fructidor'];
                const days = ['Primidi', 'Duodi', 'Tridi', 'Quartidi', 'Quintidi',
                    'Sextidi', 'Septidi', 'Octidi', 'Nonidi', 'Décadi'];
                const festivals = ['Fête de la Vertu', 'Fête du Génie', 'Fête du Travail',
                    "Fête de l'Opinion", 'Fête des Récompenses', 'Fête de la Révolution'];
                const roman = n => [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
                    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
                    .reduce((out, [v, r]) => { while (n >= v) { out += r; n -= v; } return out; }, '');

                // Today's date where you are, as a Julian Day Number.
                const now = getNow();
                const today = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000) + 2440588;

                // The year started on this year's equinox, or last year's if that's still to come.
                let start = parisEquinoxDay(now.getFullYear());
                let startYear = now.getFullYear();
                if (today < start) start = parisEquinoxDay(--startYear);
                const year = startYear - 1791;
                if (year < 1) return 'Before the Republic';

                const d = today - start; // 0 = 1 Vendémiaire
                if (d >= 360) return `${festivals[d - 360]}, an ${roman(year)}`;
                return `${days[d % 10]} ${d % 30 + 1} ${months[Math.floor(d / 30)]} an ${roman(year)}`;
            }
        },
        {
            id: 'sundialTime',
            name: 'Sundial Time',
            // Worked out when the pop-up opens, so the figure is for today.
            info: function () {
                const eot = equationOfTime(getNow());
                const mins = Math.round(Math.abs(eot));
                const gap = mins < 1 ? 'Today the two almost agree.'
                    : `Today a sundial runs about ${mins} minute${mins === 1 ? '' : 's'} ${eot > 0 ? 'fast' : 'slow'}.`;
                return "Apparent solar time: what a sundial would read. It drifts from the Sun's average pace because Earth's orbit is elliptical and its axis is tilted (the equation of time), between about 16 minutes fast in early November and 14 slow in mid-February. " + gap;
            },
            link: 'https://en.wikipedia.org/wiki/Equation_of_time',
            uses: [equationOfTime],
            func: function () {
                // Your longitude if you've shared your location, otherwise Greenwich.
                const LONGITUDE = place ? place.longitude : 0; // degrees east of Greenwich
                const now = getNow();
                const eot = equationOfTime(now);
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
            uses: [sinceMidnight],
            func: function () {
                const secs = Math.floor(sinceMidnight(getNow()) / 1000);
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
            // Picking tiles to show side by side: tick or untick this one.
            if (picking) {
                togglePick(tile);
                return;
            }
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
            if (panes.some(p => p.tile === tile)) updateFocus();
        });
    }

    // ---- Full page view ----------------------------------------------------
    // One to four tiles filling the browser window (not the Fullscreen API),
    // each value sized as large as fits. It's a <dialog>, so Escape closes it.
    const focusView = document.getElementById('focusView');
    const focusName = document.getElementById('focusName');
    const focusReadout = document.getElementById('focusReadout');
    const focusStage = document.getElementById('focusStage');
    const focusHint = document.getElementById('focusHint');
    const paneTemplate = document.getElementById('paneTemplate');
    let activePane = 0; // the pane ← and → change

    function openFocus(list, active = 0, { shuffle = false } = {}) {
        shuffling = shuffle;
        focusView.classList.toggle('is-shuffling', shuffle);
        // Drop repeats and anything past the limit.
        list = [...new Set(list)].slice(0, MAX_PANES);
        if (!list.length) return;
        focusStage.replaceChildren();
        panes = list.map(tile => {
            const el = paneTemplate.content.firstElementChild.cloneNode(true);
            const pane = {
                el,
                iconEl: el.querySelector('.focus-icon'),
                valueEl: el.querySelector('.focus-value')
            };
            focusStage.append(el);
            showInPane(pane, tile);
            return pane;
        });

        const multi = panes.length > 1;
        focusView.classList.toggle('is-multi', multi);
        if (multi) {
            // Click or Tab to a pane to choose which one the arrow keys change.
            panes.forEach((pane, i) => {
                pane.el.tabIndex = 0;
                pane.el.addEventListener('focus', () => setActivePane(i));
                pane.el.addEventListener('click', () => setActivePane(i));
            });
        }
        focusHint.textContent = shuffle
            ? `A new tile every ${SHUFFLE_MS / 1000} seconds. Use ← and → to skip`
            : multi ? 'Click a tile, then use ← and → to change it'
            : 'Use ← and → to change tile';
        setActivePane(Math.min(active, panes.length - 1));
        updateFocusName();

        if (modal.open) modal.close();
        if (!focusView.open) {
            focusView.showModal();
            focusView.focus(); // focus the view itself, not the first button (no stray focus ring)
        }
        wake();
        updateFocus(true);
        updateAddress();
    }

    // Point a pane at a tile.
    function showInPane(pane, tile) {
        pane.tile = tile;
        pane.fittedFor = '';
        pane.el.setAttribute('aria-label', tile.name);
        // SVG elements don't have a .hidden property, so set the attribute itself.
        pane.iconEl.toggleAttribute('hidden', !tile.illustrate);
        pane.el.classList.toggle('is-mono', Boolean(tile.mono));
    }

    function setActivePane(i) {
        activePane = i;
        panes.forEach((pane, j) => pane.el.classList.toggle('is-active', j === i));
    }

    function updateFocusName() {
        focusName.textContent = panes.length > 1 ? `${panes.length} tiles` : panes[0].tile.name;
    }

    // ← and →: move the active pane to the previous or next tile, skipping
    // any already shown in another pane.
    function stepPane(step) {
        const pane = panes[activePane];
        let next = pane.tile;
        do next = neighbour(next, step);
        while (panes.some(p => p !== pane && p.tile === next));
        showInPane(pane, next);
        updateFocusName();
        updateFocus(true);
        updateAddress();
    }

    function updateFocus(force = false) {
        if (!panes.length) return;
        focusReadout.textContent = timeOverride ? `Frozen at ${readout.textContent}` : readout.textContent;
        let refit = force;
        for (const pane of panes) {
            const text = pane.tile.valueEl.textContent;
            pane.valueEl.textContent = text;
            if (pane.tile.iconEl) pane.iconEl.innerHTML = pane.tile.iconEl.innerHTML;
            // Refit only when the shape of some text changes (digits are
            // fixed-width), so the sizes don't wobble every second.
            if (text.replace(/\d/g, '0') !== pane.fittedFor) refit = true;
        }
        if (refit) layoutFocus();
    }

    // Choose the column count, then size every value to fill its pane.
    // Each layout is tried for real and measured; the winner is the one
    // where the smallest value comes out largest. That gives side by side on
    // a wide screen and one above the other on a phone, without breakpoints.
    function layoutFocus() {
        // Measure every value at 100px.
        for (const pane of panes) {
            pane.fittedFor = pane.valueEl.textContent.replace(/\d/g, '0');
            pane.valueEl.style.transform = '';
            pane.valueEl.style.fontSize = '100px';
            const { width, height } = pane.valueEl.getBoundingClientRect();
            pane.w = width || 1;
            pane.h = height || 1;
        }

        let best = { cols: 1, size: -1 };
        for (let cols = 1; cols <= panes.length; cols++) {
            useColumns(cols);
            const size = Math.min(...panes.map(fitSize));
            if (size > best.size) best = { cols, size };
        }
        useColumns(best.cols);

        for (const pane of panes) {
            const size = fitSize(pane);
            pane.valueEl.style.fontSize = `${size}px`;
            // Fonts leave more room above the letters than below, so text centred by
            // its line box looks low. Nudge it so the visible shapes are centred.
            pane.valueEl.style.transform = `translateY(${-inkOffset(pane.valueEl, size).toFixed(1)}px)`;
        }
    }

    // Lay the panes out in this many columns. If the last row isn't full,
    // its last pane stretches across the spare space.
    function useColumns(cols) {
        focusStage.style.setProperty('--cols', cols);
        const spare = cols * Math.ceil(panes.length / cols) - panes.length;
        panes.forEach((pane, i) => {
            pane.el.style.gridColumn = spare && i === panes.length - 1 ? `span ${spare + 1}` : '';
        });
    }

    // The font size that fits this pane's value in its pane as laid out now.
    function fitSize(pane) {
        const box = getComputedStyle(pane.el);
        const roomWidth = pane.el.clientWidth - parseFloat(box.paddingLeft) - parseFloat(box.paddingRight);
        const roomHeight = pane.el.clientHeight - parseFloat(box.paddingTop) - parseFloat(box.paddingBottom);
        // Leave room for the picture (the moon) above the value, if there is one.
        const iconHeight = pane.iconEl.hasAttribute('hidden')
            ? 0 : pane.iconEl.getBoundingClientRect().height + (parseFloat(box.rowGap) || 0);
        const scale = Math.min((roomWidth * 0.92) / pane.w, ((roomHeight - iconHeight) * 0.9) / pane.h);
        return Math.max(12, Math.floor(100 * scale));
    }

    // How far the middle of the visible letters sits below the middle of the
    // text's line boxes, worked out from the font's real measurements.
    const measureCtx = document.createElement('canvas').getContext('2d');
    function inkOffset(el, size) {
        const style = getComputedStyle(el);
        measureCtx.font = `${style.fontWeight} ${size}px ${style.fontFamily}`;
        const lines = el.textContent.split('\n');
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
    document.fonts?.ready.then(() => { if (panes.length) layoutFocus(); });

    window.addEventListener('resize', () => { if (panes.length) layoutFocus(); });

    document.getElementById('focusClose').addEventListener('click', () => focusView.close());
    // After 3 seconds without the mouse, keyboard or touch, fade out everything
    // except the time (and hide the cursor). Any of them brings it all back.
    const IDLE_MS = 3000;
    let idleTimer;
    function wake() {
        focusView.classList.remove('is-idle');
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => focusView.classList.add('is-idle'), IDLE_MS);
    }
    ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(type =>
        focusView.addEventListener(type, wake, { passive: true }));

    focusView.addEventListener('close', () => {
        const tile = panes[activePane]?.tile;
        clearTimeout(idleTimer);
        stopShuffle();
        focusView.classList.remove('is-idle', 'is-multi', 'is-shuffling');
        panes = [];
        focusStage.replaceChildren();
        updateAddress();
        if (tile) tile.el.focus({ focusVisible: true }); // highlight the tile you were last viewing
    });

    // ---- Shuffle ------------------------------------------------------------
    // Full page, one tile at a time, moving on every few seconds. Goes through
    // every tile in a random order, then reshuffles, so none repeat until
    // they've all had a turn. Escape or "Back to all tiles" stops it.
    const SHUFFLE_MS = 10000;
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let shuffleTimer;
    let shuffleQueue = [];

    function nextShuffled() {
        if (!shuffleQueue.length) {
            shuffleQueue = [...tiles];
            for (let i = shuffleQueue.length - 1; i > 0; i--) { // Fisher–Yates
                const j = Math.floor(Math.random() * (i + 1));
                [shuffleQueue[i], shuffleQueue[j]] = [shuffleQueue[j], shuffleQueue[i]];
            }
            // Don't show the same tile twice in a row across a reshuffle.
            if (shuffleQueue[0] === panes[0]?.tile) shuffleQueue.push(shuffleQueue.shift());
        }
        return shuffleQueue.shift();
    }

    function startShuffle() {
        shuffleQueue = [];
        openFocus([nextShuffled()], 0, { shuffle: true });
        restartShuffleTimer();
    }

    function restartShuffleTimer() {
        clearInterval(shuffleTimer);
        shuffleTimer = setInterval(() => {
            // Fade out, swap tile, fade back in.
            focusStage.classList.add('is-fading');
            setTimeout(() => {
                if (!shuffling) return; // closed while fading
                showInPane(panes[0], nextShuffled());
                updateFocusName();
                updateFocus(true);
                focusStage.classList.remove('is-fading');
            }, reduceMotion.matches ? 0 : 250);
        }, SHUFFLE_MS);
    }

    function stopShuffle() {
        clearInterval(shuffleTimer);
        shuffling = false;
        focusStage.classList.remove('is-fading');
    }

    document.getElementById('shuffleButton').addEventListener('click', () => {
        if (picking) setPicking(false);
        startShuffle();
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

    // Opened with ?show=… in the address? Go straight to those tiles, full
    // page. Several can be listed with commas: ?show=moonPhase,binaryTime
    const showTiles = (startShow || '').split(',')
        .map(id => tiles.find(t => t.id === id.trim()))
        .filter(Boolean);
    if (startParams.has('shuffle')) startShuffle(); // ?shuffle: start shuffling straight away
    else if (showTiles.length) openFocus(showTiles); // also tidies any ids that didn't match
    else if (startShow) updateAddress(); // drop a ?show= that doesn't match a tile

    // ---- Location --------------------------------------------------------
    // Only asked for when the button is pressed. If the browser has already
    // been given permission for this page, it's picked up automatically.
    // The position stays in the page; nothing is sent anywhere.
    const locationButton = document.getElementById('locationButton');

    // The location button is an icon, so what it says is in its tooltip
    // (data-tip) and its label for screen readers.
    function setTip(button, text) {
        button.dataset.tip = text;
        button.setAttribute('aria-label', text);
    }
    // Show the tooltip for a few seconds without hovering (e.g. on a phone).
    function flashTip(button) {
        button.classList.add('show-tip');
        clearTimeout(button.tipTimer);
        button.tipTimer = setTimeout(() => button.classList.remove('show-tip'), 3000);
    }

    const formatPlace = ({ latitude, longitude }) =>
        `${Math.abs(latitude).toFixed(1)}° ${latitude >= 0 ? 'N' : 'S'}, ` +
        `${Math.abs(longitude).toFixed(1)}° ${longitude >= 0 ? 'E' : 'W'}`;

    // quiet: picked up automatically on load, so don't pop the tooltip up.
    function findLocation(quiet = false) {
        locationButton.disabled = true;
        locationButton.classList.add('is-busy');
        setTip(locationButton, 'Finding your location…');
        navigator.geolocation.getCurrentPosition(
            ({ coords }) => {
                place = { latitude: coords.latitude, longitude: coords.longitude };
                setTip(locationButton, `Sundial and moon set for ${formatPlace(place)}`);
                locationButton.classList.add('is-set');
                done(quiet);
                renderTiles();
            },
            (err) => {
                setTip(locationButton, (err.code === err.PERMISSION_DENIED
                    ? 'Location is blocked. Sundial set for Greenwich.'
                    : "Couldn't find your location. Sundial set for Greenwich.") + ' Try again');
                done(false);
            },
            { maximumAge: 60 * 60 * 1000, timeout: 15000 }
        );
        function done(quietly) {
            locationButton.disabled = false;
            locationButton.classList.remove('is-busy');
            if (!quietly) flashTip(locationButton);
        }
    }

    if ('geolocation' in navigator) {
        locationButton.addEventListener('click', () => findLocation());
        navigator.permissions?.query({ name: 'geolocation' })
            .then(status => { if (status.state === 'granted') findLocation(true); })
            .catch(() => { });
    } else {
        locationButton.disabled = true;
        setTip(locationButton, "This browser can't share a location. Sundial set for Greenwich.");
    }

    // Tell the CSS how many rows of tiles there are, so it can cap their
    // height on big screens. Re-checked whenever the grid changes size.
    const columnCount = () => getComputedStyle(gridContainer).gridTemplateColumns.split(' ').length;
    const countRows = () => {
        gridContainer.style.setProperty('--rows', Math.ceil(tiles.length / columnCount()));
    };
    new ResizeObserver(countRows).observe(gridContainer);

    // ---- Pop-up ----------------------------------------------------------
    // <dialog> handles Escape, focus and the backdrop for us.
    function openModal(tile) {
        currentTile = tile;
        copyTimeButton.textContent = 'Copy time';
        modalTitle.textContent = tile.name;
        // Most descriptions are fixed text; a few (the sundial) are worked out for the date shown.
        modalDescription.textContent = typeof tile.info === 'function' ? tile.info() : tile.info;
        modalLink.hidden = !tile.link;
        if (tile.link) modalLink.href = tile.link;
        // The tile's own code, then any shared helpers it uses.
        codeSnippet.textContent = [tile.func, ...(tile.uses || [])]
            .map(f => dedent(f.toString())).join('\n\n');
        copyCodeButton.textContent = 'Copy code';
        codeSnippet.parentElement.scrollTo(0, 0); // start each tile's code at the top
        if (!modal.open) {
            modal.showModal();
            modal.focus();
        }
    }

    // ---- Arrow keys --------------------------------------------------------
    // In the pop-up or the full page view, ← and → move to the previous or
    // next tile, looping round at the ends. On the grid, all four arrows move
    // between tiles, with ↑ and ↓ jumping a whole row.
    const neighbour = (tile, step) => tiles[(tiles.indexOf(tile) + step + tiles.length) % tiles.length];
    const ARROWS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];

    document.addEventListener('keydown', (event) => {
        if (!ARROWS.includes(event.key)) return;
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        // Leave the arrows alone where they already do something: scrolling
        // the code box, or changing the date and time in the picker.
        if (event.target.closest && event.target.closest('pre, input, textarea, select')) return;

        if (focusView.open || modal.open) {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            const step = event.key === 'ArrowRight' ? 1 : -1;
            event.preventDefault();
            if (focusView.open && panes.length) {
                stepPane(step);
                if (shuffling) restartShuffleTimer(); // a full turn for the tile you skipped to
            }
            else if (currentTile) openModal(neighbour(currentTile, step));
            return;
        }

        // On the grid.
        const index = tiles.findIndex(t => t.el === document.activeElement);
        if (index === -1) {
            // Nothing picked yet: the first arrow press lands on the first tile.
            if (event.target === document.body) {
                event.preventDefault();
                tiles[0].el.focus();
            }
            return;
        }
        const columns = columnCount();
        const move = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns }[event.key];
        const next = index + move;
        if (next < 0 || next >= tiles.length) return; // at the edge: let the page scroll as normal
        event.preventDefault();
        tiles[next].el.focus();
        tiles[next].el.scrollIntoView({ block: 'nearest' });
    });

    // ---- Picking tiles to show side by side --------------------------------
    // "Show tiles side by side" turns clicking a tile into ticking it, up to
    // four. They're shown full page in the order they were picked.
    const pickButton = document.getElementById('pickButton');
    const pickBar = document.getElementById('pickBar');
    const pickCount = document.getElementById('pickCount');
    const pickShow = document.getElementById('pickShow');
    let picking = false;
    let picked = [];

    function setPicking(on) {
        picking = on;
        picked = [];
        document.body.classList.toggle('is-picking', on);
        pickBar.hidden = !on;
        pickButton.setAttribute('aria-pressed', String(on));
        setTip(pickButton, on ? 'Stop picking' : 'Show tiles side by side');
        refreshPicks();
    }

    function togglePick(tile) {
        if (picked.includes(tile)) picked = picked.filter(t => t !== tile);
        else if (picked.length < MAX_PANES) picked.push(tile);
        else return flashTile(tile.el, `${MAX_PANES} is the most`);
        refreshPicks();
    }

    function refreshPicks() {
        tiles.forEach(tile => {
            const i = picked.indexOf(tile);
            if (i >= 0) tile.el.dataset.pick = i + 1;
            else delete tile.el.dataset.pick;
            if (picking) tile.el.setAttribute('aria-pressed', String(i >= 0));
            else tile.el.removeAttribute('aria-pressed');
        });
        document.body.classList.toggle('pick-full', picked.length >= MAX_PANES);
        pickCount.textContent = picked.length
            ? `${picked.length} of ${MAX_PANES} picked`
            : `Pick up to ${MAX_PANES} tiles`;
        pickShow.disabled = picked.length === 0;
        pickShow.textContent = picked.length > 1 ? `Show ${picked.length} full page` : 'Show full page';
    }

    pickButton.addEventListener('click', () => setPicking(!picking));
    document.getElementById('pickCancel').addEventListener('click', () => setPicking(false));
    pickShow.addEventListener('click', () => {
        const list = picked;
        setPicking(false);
        openFocus(list);
    });
    // Escape on the grid stops picking (in a dialog it closes the dialog instead).
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && picking && !modal.open && !focusView.open) setPicking(false);
    });

    // toString() keeps the indentation from inside the tiles array; strip it
    // from every line after the first so the code sits flush left.
    function dedent(source) {
        const [first, ...rest] = source.split('\n');
        const indents = rest.filter(l => l.trim()).map(l => l.match(/^\s*/)[0].length);
        const cut = indents.length ? Math.min(...indents) : 0;
        return [first, ...rest.map(l => l.slice(cut))].join('\n');
    }

    closeModal.addEventListener('click', () => modal.close());

    // Closing the pop-up: highlight the tile you were last looking at (arrow
    // keys may have moved on from the one you opened), as full page does.
    // Skipped when the pop-up closed to open the full page view.
    modal.addEventListener('close', () => {
        if (currentTile && !focusView.open) {
            currentTile.el.focus({ focusVisible: true });
            currentTile.el.scrollIntoView({ block: 'nearest' });
        }
    });
    document.getElementById('fullPageButton').addEventListener('click', () => {
        if (currentTile) openFocus([currentTile]);
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