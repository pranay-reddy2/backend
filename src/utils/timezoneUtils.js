// Timezone utility functions for server-side operations

/**
 * Get list of common timezones
 * @returns {Array} Array of timezone objects
 */
function getTimezones() {
  return [
    { value: 'Pacific/Midway', label: '(GMT-11:00) Midway Island, Samoa', offset: -11 },
    { value: 'Pacific/Honolulu', label: '(GMT-10:00) Hawaii', offset: -10 },
    { value: 'America/Anchorage', label: '(GMT-09:00) Alaska', offset: -9 },
    { value: 'America/Los_Angeles', label: '(GMT-08:00) Pacific Time (US & Canada)', offset: -8 },
    { value: 'America/Denver', label: '(GMT-07:00) Mountain Time (US & Canada)', offset: -7 },
    { value: 'America/Phoenix', label: '(GMT-07:00) Arizona', offset: -7 },
    { value: 'America/Chicago', label: '(GMT-06:00) Central Time (US & Canada)', offset: -6 },
    { value: 'America/New_York', label: '(GMT-05:00) Eastern Time (US & Canada)', offset: -5 },
    { value: 'America/Caracas', label: '(GMT-04:00) Caracas, La Paz', offset: -4 },
    { value: 'America/Santiago', label: '(GMT-04:00) Santiago', offset: -4 },
    { value: 'America/St_Johns', label: '(GMT-03:30) Newfoundland', offset: -3.5 },
    { value: 'America/Sao_Paulo', label: '(GMT-03:00) Brasilia', offset: -3 },
    { value: 'America/Argentina/Buenos_Aires', label: '(GMT-03:00) Buenos Aires', offset: -3 },
    { value: 'Atlantic/South_Georgia', label: '(GMT-02:00) Mid-Atlantic', offset: -2 },
    { value: 'Atlantic/Azores', label: '(GMT-01:00) Azores', offset: -1 },
    { value: 'UTC', label: '(GMT+00:00) UTC', offset: 0 },
    { value: 'Europe/London', label: '(GMT+00:00) London, Dublin, Lisbon', offset: 0 },
    { value: 'Europe/Paris', label: '(GMT+01:00) Paris, Brussels, Madrid', offset: 1 },
    { value: 'Europe/Berlin', label: '(GMT+01:00) Berlin, Rome, Amsterdam', offset: 1 },
    { value: 'Africa/Cairo', label: '(GMT+02:00) Cairo', offset: 2 },
    { value: 'Europe/Athens', label: '(GMT+02:00) Athens, Istanbul, Bucharest', offset: 2 },
    { value: 'Asia/Jerusalem', label: '(GMT+02:00) Jerusalem', offset: 2 },
    { value: 'Africa/Nairobi', label: '(GMT+03:00) Nairobi', offset: 3 },
    { value: 'Europe/Moscow', label: '(GMT+03:00) Moscow, St. Petersburg', offset: 3 },
    { value: 'Asia/Dubai', label: '(GMT+04:00) Dubai, Abu Dhabi', offset: 4 },
    { value: 'Asia/Kabul', label: '(GMT+04:30) Kabul', offset: 4.5 },
    { value: 'Asia/Karachi', label: '(GMT+05:00) Karachi, Islamabad', offset: 5 },
    { value: 'Asia/Kolkata', label: '(GMT+05:30) Mumbai, Kolkata, New Delhi', offset: 5.5 },
    { value: 'Asia/Kathmandu', label: '(GMT+05:45) Kathmandu', offset: 5.75 },
    { value: 'Asia/Dhaka', label: '(GMT+06:00) Dhaka', offset: 6 },
    { value: 'Asia/Yangon', label: '(GMT+06:30) Yangon (Rangoon)', offset: 6.5 },
    { value: 'Asia/Bangkok', label: '(GMT+07:00) Bangkok, Jakarta', offset: 7 },
    { value: 'Asia/Hong_Kong', label: '(GMT+08:00) Hong Kong, Beijing', offset: 8 },
    { value: 'Asia/Singapore', label: '(GMT+08:00) Singapore', offset: 8 },
    { value: 'Australia/Perth', label: '(GMT+08:00) Perth', offset: 8 },
    { value: 'Asia/Tokyo', label: '(GMT+09:00) Tokyo, Seoul, Osaka', offset: 9 },
    { value: 'Australia/Adelaide', label: '(GMT+09:30) Adelaide', offset: 9.5 },
    { value: 'Australia/Sydney', label: '(GMT+10:00) Sydney, Melbourne', offset: 10 },
    { value: 'Pacific/Guam', label: '(GMT+10:00) Guam', offset: 10 },
    { value: 'Pacific/Auckland', label: '(GMT+12:00) Auckland, Wellington', offset: 12 },
    { value: 'Pacific/Fiji', label: '(GMT+12:00) Fiji', offset: 12 },
    { value: 'Pacific/Tongatapu', label: '(GMT+13:00) Nuku\'alofa', offset: 13 }
  ];
}

/**
 * Validate timezone string
 * @param {string} timezone
 * @returns {boolean}
 */
function isValidTimezone(timezone) {
  const timezones = getTimezones();
  return timezones.some(tz => tz.value === timezone) || timezone === 'UTC';
}

/**
 * Convert time from one timezone to another
 * Note: For full timezone conversion, use a library like moment-timezone or date-fns-tz
 * This is a simplified version
 * @param {Date} date
 * @param {string} fromTz
 * @param {string} toTz
 * @returns {Date}
 */
function convertTimezone(date, fromTz, toTz) {
  // This is a simplified implementation
  // In production, use moment-timezone or date-fns-tz
  const timezones = getTimezones();
  const fromTimezone = timezones.find(tz => tz.value === fromTz);
  const toTimezone = timezones.find(tz => tz.value === toTz);

  if (!fromTimezone || !toTimezone) {
    return date;
  }

  const offsetDiff = (toTimezone.offset - fromTimezone.offset) * 60 * 60 * 1000;
  return new Date(date.getTime() + offsetDiff);
}

/**
 * Get user's browser timezone
 * @returns {string}
 */
function getBrowserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

module.exports = {
  getTimezones,
  isValidTimezone,
  convertTimezone,
  getBrowserTimezone
};
