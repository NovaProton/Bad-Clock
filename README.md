# Bad Clock

This project displays various interesting time-related metrics, such as the number of minutes past midnight, the current ISO week number, the number of seconds since the Unix epoch, and more. The clock updates every second, providing a real-time view of these metrics.

## Features
- **Minutes Past Midnight**: Displays the number of minutes that have passed since midnight of the current day.
- **Week Number**: Displays the current ISO week number for the year.
- **Seconds Since Epoch**: Shows the number of seconds that have passed since the Unix epoch (1 January 1970).
- **Reverse Time**: Displays the time remaining until midnight, updating every second.
- **Day Counter**: Displays how many days have passed so far in the current year.
- **Milliseconds To Midnight**: Shows the precise number of milliseconds remaining until midnight.
- **Hours Left In The Year**: Displays the total number of hours remaining until the end of the current year.
- **Swatch Internet Time**: Shows the current Internet time in beats (@beats).
- **Earth’s Rotation**: Displays the percentage of the current day that has passed.
- **Greenwich Sidereal Time**: Shows the current sidereal time at the Greenwich Meridian.
- **Decimal Time**: Displays the time of day in decimal format, dividing the day into 10 hours.
- **Julian Date**: Shows the Julian date, which represents a continuous count of days since the Julian Period began.
- **Moon Phase**: Displays the current phase of the moon based on its position relative to the Earth and Sun.

## New Features
- **Enhanced Time Metrics**: Added several new calculations and displays, including:
    - **Milliseconds to Midnight**: Precise countdown of milliseconds until the next day.
    - **Hours Left in the Year**: Displays the remaining hours in the current year.
    - **Swatch Internet Time**: Shows the time in internet beats (@beats), where each day is divided into 1000 units.
    - **Greenwich Sidereal Time**: Displays the sidereal time at the Greenwich Meridian.
    - **Decimal Time**: Shows the current time in a decimalised format, dividing the day into 10 hours.
    - **Julian Date**: Displays the continuous Julian date for astronomical applications.
    - **Moon Phase**: Indicates the current phase of the moon based on its position relative to Earth and Sun.
    - **Day Completion Percentage**: Shows the percentage of the day that has passed.

- **"Copy Code" Feature**: Users can now view the JavaScript implementation of any metric in a modal window. A **Copy Code** button allows users to copy the displayed function for reuse.

- **Improved Responsiveness**: Enhanced the layout and styling to ensure compatibility across different screen sizes and devices, with a user-friendly modal for accessing additional information.

- **Real-Time Updates**: The clock refreshes every second to provide a dynamic display of all metrics.

- **Enhanced Aesthetics**:
    - Introduced shadows and rounded corners to improve the visual appeal.
    - Increased font size and spacing for better readability.
    - Used colour coding to emphasise key elements like time values.


## Files
- **index.html**: Contains the basic structure of the webpage, including placeholders for each time-related metric and a modal for viewing code snippets.
- **style.css**: Provides the styling for the webpage, including layout, colors, fonts, button styles, and other visual elements to enhance the user experience.
- **script.js**: Contains the JavaScript logic to calculate and update each of the time metrics every second, as well as the logic for opening modals, displaying code snippets, and implementing the "Copy Code" functionality.

## Technologies Used
- **HTML5**: For the basic structure of the webpage.
- **CSS3**: To style the page, center the clock, and apply visual enhancements.
- **JavaScript**: To calculate the current time and update all metrics in real-time, as well as provide interactive features like the "Copy Code" button.

## Future Improvements
- Add more time-related metrics, such as localised sunrise and sunset times or timezone-based variations.
- Enhance the UI/UX of the modal with animations and better responsiveness.
- Save user preferences (e.g., favourite metrics) using localStorage.
- Implement a dark mode for better usability in low-light environments.

## Screenshot
![Bad Clock Screenshot](BadClockDemo.png)

## License
This project is open-source and available under the MIT License.
