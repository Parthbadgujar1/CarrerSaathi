import { Setting } from '../models/index.js';
import { logger } from '../config/logger.js';

/** Defaults for admin-editable runtime settings. */
export const DEFAULT_SETTINGS = Object.freeze({
  registrationOpen: true,
  mentorApplicationsOpen: true,
  aiEnabled: true,
  aiDailyLimitStudent: 15,
  aiDailyLimitStaff: 100,
  announcementBanner: '',
  // The four Skill NexGen family portals (verified from the sites' own navigation/footers).
  ecosystemLinks: {
    skillnexgen: 'https://www.skillnexgen.com/',
    kaushalsaathi: 'https://www.kaushalsaathi.com/',
    internsaathi: 'https://www.internsaathi.com/',
    naukrisaathi: 'https://www.naukrisaathi.com/',
  },
});

let cache = null;
let cachedAt = 0;
const TTL = 30_000;

export async function getSettings() {
  if (cache && Date.now() - cachedAt < TTL) return cache;
  try {
    const rows = await Setting.find().lean();
    const merged = structuredClone(DEFAULT_SETTINGS);
    for (const row of rows) {
      if (!(row.key in merged)) continue;
      const def = merged[row.key];
      if (def && typeof def === 'object') {
        // Only keys that still exist in the defaults — retired entries saved earlier are ignored.
        for (const k of Object.keys(def)) {
          if (row.value && row.value[k] !== undefined) def[k] = row.value[k];
        }
      } else {
        merged[row.key] = row.value;
      }
    }
    cache = merged;
    cachedAt = Date.now();
    return merged;
  } catch (err) {
    // Settings must never take a feature down — fall back to defaults.
    logger.warn('Settings unavailable, using defaults', { message: err.message });
    return cache || structuredClone(DEFAULT_SETTINGS);
  }
}

export async function updateSettings(patch, userId) {
  const ops = Object.entries(patch)
    .filter(([key]) => key in DEFAULT_SETTINGS)
    .map(([key, value]) => ({
      updateOne: { filter: { key }, update: { $set: { value, updatedBy: userId } }, upsert: true },
    }));
  if (ops.length) await Setting.bulkWrite(ops);
  cache = null;
  return getSettings();
}
