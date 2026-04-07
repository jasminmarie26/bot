const USERNAME_CHANGE_COOLDOWN_DAYS = 182;
const USERNAME_CHANGE_COOLDOWN_MS = USERNAME_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
const CHARACTER_RENAME_COOLDOWN_MONTHS = 3;

function addUtcCalendarMonths(value, months, parseSqliteDateTime) {
  const parsed = value instanceof Date
    ? new Date(value.getTime())
    : typeof parseSqliteDateTime === "function"
      ? parseSqliteDateTime(value)
      : null;

  if (!parsed || !Number.isInteger(months)) return null;

  const year = parsed.getUTCFullYear();
  const month = parsed.getUTCMonth();
  const day = parsed.getUTCDate();
  const hours = parsed.getUTCHours();
  const minutes = parsed.getUTCMinutes();
  const seconds = parsed.getUTCSeconds();
  const milliseconds = parsed.getUTCMilliseconds();
  const shiftedMonthIndex = month + months;
  const shiftedYear = year + Math.floor(shiftedMonthIndex / 12);
  const normalizedMonth = ((shiftedMonthIndex % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(Date.UTC(shiftedYear, normalizedMonth + 1, 0)).getUTCDate();

  return new Date(
    Date.UTC(
      shiftedYear,
      normalizedMonth,
      Math.min(day, lastDayOfTargetMonth),
      hours,
      minutes,
      seconds,
      milliseconds
    )
  );
}

function getUsernameChangeAvailability(user, helpers = {}) {
  const {
    parseSqliteDateTime,
    formatGermanDateTime,
    now = Date.now
  } = helpers;
  const isAdmin = Boolean(user?.is_admin === 1 || user?.is_admin === true);

  if (isAdmin) {
    return {
      is_admin_bypass: true,
      can_change: true,
      available_at: null,
      available_at_text: ""
    };
  }

  const lastChangedAt =
    typeof parseSqliteDateTime === "function" ? parseSqliteDateTime(user?.username_changed_at) : null;
  if (!lastChangedAt) {
    return {
      is_admin_bypass: false,
      can_change: true,
      available_at: null,
      available_at_text: ""
    };
  }

  const availableAt = new Date(lastChangedAt.getTime() + USERNAME_CHANGE_COOLDOWN_MS);
  return {
    is_admin_bypass: false,
    can_change: now() >= availableAt.getTime(),
    available_at: availableAt,
    available_at_text:
      typeof formatGermanDateTime === "function" ? formatGermanDateTime(availableAt) : ""
  };
}

function getCharacterRenameAvailability(character, actorUser = null, helpers = {}) {
  const {
    parseSqliteDateTime,
    formatGermanDate,
    now = Date.now
  } = helpers;

  if (actorUser?.is_admin) {
    return {
      can_change: true,
      available_at: null,
      available_at_text: ""
    };
  }

  const lastChangedAt =
    typeof parseSqliteDateTime === "function" ? parseSqliteDateTime(character?.name_changed_at) : null;
  if (!lastChangedAt) {
    return {
      can_change: true,
      available_at: null,
      available_at_text: ""
    };
  }

  const availableAt = addUtcCalendarMonths(
    lastChangedAt,
    CHARACTER_RENAME_COOLDOWN_MONTHS,
    parseSqliteDateTime
  );
  if (!availableAt) {
    return {
      can_change: true,
      available_at: null,
      available_at_text: ""
    };
  }

  return {
    can_change: now() >= availableAt.getTime(),
    available_at: availableAt,
    available_at_text: typeof formatGermanDate === "function" ? formatGermanDate(availableAt) : ""
  };
}

module.exports = {
  CHARACTER_RENAME_COOLDOWN_MONTHS,
  USERNAME_CHANGE_COOLDOWN_DAYS,
  USERNAME_CHANGE_COOLDOWN_MS,
  addUtcCalendarMonths,
  getCharacterRenameAvailability,
  getUsernameChangeAvailability
};
