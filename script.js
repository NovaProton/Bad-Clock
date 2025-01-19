document.addEventListener('DOMContentLoaded', () => {
    const gridContainer = document.getElementById('gridContainer');
    const modal = document.getElementById('modal');
    const closeModal = document.getElementById('closeModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalDescription = document.getElementById('modalDescription');
    const codeSnippet = document.getElementById('codeSnippet');

    const tiles = [
        {
            id: 'weeks',
            name: 'ISO Week Number',
            info: 'This is the ISO Week Number, which represents the current week of the year according to ISO standards.',
            link: 'https://en.wikipedia.org/wiki/ISO_week_date',
            func: function () {
                const now = new Date();
                const startOfYear = new Date(now.getFullYear(), 0, 1);
                const dayOfWeek = startOfYear.getDay();
                const ISOWeekStart = new Date(startOfYear);
                if (dayOfWeek <= 4) {
                    ISOWeekStart.setDate(startOfYear.getDate() - dayOfWeek + 1);
                } else {
                    ISOWeekStart.setDate(startOfYear.getDate() + 8 - dayOfWeek);
                }
                return Math.floor((now - ISOWeekStart) / (7 * 24 * 60 * 60 * 1000)) + 1;
            }
        },
        {
            id: 'minutes',
            name: 'Minutes Past Midnight',
            info: 'This represents the number of minutes that have passed since midnight today.',
            link: 'https://en.wikipedia.org/wiki/Midnight',
            func: function () {
                const now = new Date();
                return now.getHours() * 60 + now.getMinutes();
            }
        },
        {
            id: 'epoch',
            name: 'Seconds Since Epoch',
            info: 'The number of seconds that have elapsed since January 1, 1970 (the Unix Epoch).',
            link: 'https://en.wikipedia.org/wiki/Unix_time',
            func: function () {
                return Math.floor(new Date() / 1000);
            }
        },
        {
            id: 'reverseTime',
            name: 'Time To Midnight',
            info: 'The time remaining until midnight.',
            link: 'https://www.timeanddate.com/countdown/generic',
            func: function () {
                const now = new Date();
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
                const now = new Date();
                const startOfYear = new Date(now.getFullYear(), 0, 1);
                return Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000)) + 1;
            }
        },
        {
            id: 'msToMidnight',
            name: 'Milliseconds To Midnight',
            info: 'The number of milliseconds remaining until the start of the next day.',
            link: 'https://en.wikipedia.org/wiki/Millisecond',
            func: function () {
                const now = new Date();
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
                const now = new Date();
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
                const now = new Date();
                const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
                const bielTime = new Date(utcTime + 3600000);
                const totalSeconds = bielTime.getUTCHours() * 3600 + bielTime.getUTCMinutes() * 60 + bielTime.getUTCSeconds();
                const beats = Math.floor((totalSeconds / 86400) * 1000);
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
                const now = new Date();
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
                })(new Date());
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
                const now = new Date();
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
                const now = new Date();
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
            id: 'moonPhase',
            name: 'Moon Phase',
            info: 'The current phase of the moon based on its position relative to the Earth and Sun.',
            link: 'https://en.wikipedia.org/wiki/Lunar_phase',
            func: function () {
                const synodicMonth = 29.5305882;
                const reference = new Date('2000-01-06T18:14:00Z');
                const now = new Date();
                const daysSinceReference = (now - reference) / (1000 * 60 * 60 * 24);
                const moonAge = daysSinceReference % synodicMonth;
                const phaseFraction = moonAge / synodicMonth;

                if (phaseFraction < 0.03 || phaseFraction > 0.97) return 'New Moon';
                if (phaseFraction < 0.22) return 'Waxing Crescent';
                if (phaseFraction < 0.28) return 'First Quarter';
                if (phaseFraction < 0.47) return 'Waxing Gibbous';
                if (phaseFraction < 0.53) return 'Full Moon';
                if (phaseFraction < 0.72) return 'Waning Gibbous';
                if (phaseFraction < 0.78) return 'Last Quarter';
                return 'Waning Crescent';
            }
        }
    ];

    const copyCodeButton = document.getElementById('copyCodeButton');

    copyCodeButton.addEventListener('click', () => {
        const codeSnippet = document.getElementById('codeSnippet');
        navigator.clipboard.writeText(codeSnippet.textContent)
            .then(() => {
                alert('Code copied to clipboard!');
            })
            .catch(err => {
                console.error('Failed to copy code: ', err);
                alert('Failed to copy code. Please try again.');
            });
    });

    // Generate tiles dynamically
    tiles.forEach(tile => {
        const tileDiv = document.createElement('div');
        tileDiv.className = 'tile';
        tileDiv.textContent = `${tile.name}: ${tile.func()}`;
        tileDiv.addEventListener('click', () => {
            modal.classList.remove('hidden');
            modalTitle.textContent = tile.name;
            modalDescription.textContent = tile.info;

            // Remove any existing "More Info" buttons
            const existingLinkButton = document.querySelector('#modal a');
            if (existingLinkButton) {
                existingLinkButton.remove();
            }

            // Add the "More Info" button if the tile has a link
            if (tile.link) {
                const linkButton = document.createElement('a');
                linkButton.href = tile.link;
                linkButton.target = '_blank';
                linkButton.textContent = 'More Info';
                linkButton.style.marginBottom = '10px';
                modalDescription.insertAdjacentElement('afterend', linkButton);
            }

            codeSnippet.textContent = tile.func.toString();
        });


        gridContainer.appendChild(tileDiv);
    });

    // Update tiles every second
    setInterval(() => {
        gridContainer.childNodes.forEach((child, index) => {
            child.textContent = `${tiles[index].name}: ${tiles[index].func()}`;
        });
    }, 1000);

    // Close modal functionality
    closeModal.addEventListener('click', () => {
        modal.classList.add('hidden');
        const linkButton = document.querySelector('#modal a');
        if (linkButton) {
            linkButton.remove();
        }
    });

    // Close modal with Escape key
    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
            modal.classList.add('hidden');
        }
    });

    // Ensure modal closes on outside click
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.classList.add('hidden');
            const linkButton = document.querySelector('#modal a');
            if (linkButton) {
                linkButton.remove();
            }
        }
    });
});