const DEFAULT_HOME_HERO_TITLE = "Heldenhaft Reisen";
const DEFAULT_HOME_HERO_BODY =
  "Aktuelle Neuigkeiten findest du oben \u00fcber den Live-Updates-Tab im Header. Dort k\u00f6nnen Admins und Moderatoren neue Meldungen direkt ver\u00f6ffentlichen und bearbeiten.";
const DEFAULT_UPDATES_TITLE = "Live Updates";
const LOGIN_STATS_CACHE_TTL_MS = 1000 * 10;
const DISCORD_HOME_INVITE_URL = "https://discord.gg/CWWxbZenwS";
const DISCORD_HOME_INVITE_CODE = "CWWxbZenwS";
const DISCORD_HOME_INVITE_API_URL =
  `https://discord.com/api/v9/invites/${DISCORD_HOME_INVITE_CODE}?with_counts=true&with_expiration=true`;
const DISCORD_HOME_STATS_CACHE_TTL_MS = 1000 * 60 * 2;
const DISCORD_HOME_FETCH_TIMEOUT_MS = 5000;
const FALLBACK_DISCORD_HOME_STATS = Object.freeze({
  guildName: "Heldenhafte Reisen Discord",
  inviteUrl: DISCORD_HOME_INVITE_URL,
  memberCount: null,
  onlineCount: null,
  iconUrl: "",
  available: false
});
const NOOP = () => {};

function createHomePageService(options = {}) {
  const db = options.db;
  const renderGuestbookBbcode =
    typeof options.renderGuestbookBbcode === "function"
      ? options.renderGuestbookBbcode
      : (value) => String(value || "");
  const fetchImpl =
    typeof options.fetchImpl === "function"
      ? options.fetchImpl
      : typeof globalThis.fetch === "function"
        ? globalThis.fetch.bind(globalThis)
        : null;
  const getActiveSessionUserIds =
    typeof options.getActiveSessionUserIds === "function"
      ? options.getActiveSessionUserIds
      : () => [];
  const getConnectedUserComparableIps =
    typeof options.getConnectedUserComparableIps === "function"
      ? options.getConnectedUserComparableIps
      : () => new Set();
  const normalizeComparableIp =
    typeof options.normalizeComparableIp === "function"
      ? options.normalizeComparableIp
      : (value) => String(value || "").trim();
  const normalizeCharacterServerId =
    typeof options.normalizeCharacterServerId === "function"
      ? options.normalizeCharacterServerId
      : (value) => String(value || "").trim().toLowerCase();
  const larpServerId = String(options.larpServerId || "larp").trim().toLowerCase();
  const getOnlineUserIdsForServers =
    typeof options.getOnlineUserIdsForServers === "function"
      ? options.getOnlineUserIdsForServers
      : () => new Set();
  const getOnlineStaffStats =
    typeof options.getOnlineStaffStats === "function"
      ? options.getOnlineStaffStats
      : () => ({
          adminOnlineCount: 0,
          adminOnlineNames: [],
          moderatorOnlineCount: 0,
          moderatorOnlineNames: []
        });
  const getLoggedInUsersCount =
    typeof options.getLoggedInUsersCount === "function"
      ? options.getLoggedInUsersCount
      : (activeUserIds) => (Array.isArray(activeUserIds) ? activeUserIds.length : 0);
  const broadcastSiteStatsUpdate =
    typeof options.broadcastSiteStatsUpdate === "function"
      ? options.broadcastSiteStatsUpdate
      : NOOP;
  const getRecentSiteUpdates =
    typeof options.getRecentSiteUpdates === "function"
      ? options.getRecentSiteUpdates
      : () => [];
  const getLatestSiteUpdateRevisionToken =
    typeof options.getLatestSiteUpdateRevisionToken === "function"
      ? options.getLatestSiteUpdateRevisionToken
      : () => "";
  const defaultSeoDescription = String(options.defaultSeoDescription || "");

  if (!db) {
    throw new Error("Home page service requires a database connection.");
  }

  let cachedLoginStats = null;
  let cachedLoginStatsExpiresAt = 0;
  let cachedDiscordHomeStats = { ...FALLBACK_DISCORD_HOME_STATS };
  let cachedDiscordHomeStatsExpiresAt = 0;
  let discordHomeStatsRefreshPromise = null;

  function clearLoginStatsCache() {
    cachedLoginStats = null;
    cachedLoginStatsExpiresAt = 0;
  }

  function buildDiscordHomeIconUrl(guildId, iconHash) {
    const normalizedGuildId = String(guildId || "").trim();
    const normalizedIconHash = String(iconHash || "").trim();
    if (!normalizedGuildId || !normalizedIconHash) {
      return "";
    }

    return `https://cdn.discordapp.com/icons/${encodeURIComponent(normalizedGuildId)}/${encodeURIComponent(normalizedIconHash)}.png?size=128`;
  }

  function normalizeDiscordHomeStats(payload) {
    const guild = payload && typeof payload === "object" ? payload.guild || {} : {};
    const profile = payload && typeof payload === "object" ? payload.profile || {} : {};
    const guildName = String(
      profile.name ||
        guild.name ||
        cachedDiscordHomeStats.guildName ||
        FALLBACK_DISCORD_HOME_STATS.guildName
    ).trim() || FALLBACK_DISCORD_HOME_STATS.guildName;
    const memberCountRaw =
      profile.member_count ?? payload?.approximate_member_count ?? payload?.member_count;
    const onlineCountRaw =
      profile.online_count ?? payload?.approximate_presence_count ?? payload?.presence_count;
    const memberCount = Number.isFinite(Number(memberCountRaw)) ? Number(memberCountRaw) : null;
    const onlineCount = Number.isFinite(Number(onlineCountRaw)) ? Number(onlineCountRaw) : null;

    return {
      guildName,
      inviteUrl: DISCORD_HOME_INVITE_URL,
      memberCount,
      onlineCount,
      iconUrl: buildDiscordHomeIconUrl(guild.id || payload?.guild_id, guild.icon || profile.icon_hash),
      available: memberCount !== null || onlineCount !== null
    };
  }

  function getDiscordHomeStats() {
    if (Date.now() >= cachedDiscordHomeStatsExpiresAt) {
      void refreshDiscordHomeStats();
    }

    return cachedDiscordHomeStats;
  }

  async function refreshDiscordHomeStats(force = false) {
    if (!fetchImpl) {
      return cachedDiscordHomeStats;
    }

    if (discordHomeStatsRefreshPromise) {
      return discordHomeStatsRefreshPromise;
    }

    if (!force && Date.now() < cachedDiscordHomeStatsExpiresAt) {
      return cachedDiscordHomeStats;
    }

    discordHomeStatsRefreshPromise = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DISCORD_HOME_FETCH_TIMEOUT_MS);

      try {
        const response = await fetchImpl(DISCORD_HOME_INVITE_API_URL, {
          signal: controller.signal,
          headers: {
            accept: "application/json",
            "user-agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
          }
        });

        if (!response.ok) {
          throw new Error(`Discord invite request failed with status ${response.status}`);
        }

        const previousStats = JSON.stringify(cachedDiscordHomeStats);
        cachedDiscordHomeStats = normalizeDiscordHomeStats(await response.json());
        cachedDiscordHomeStatsExpiresAt = Date.now() + DISCORD_HOME_STATS_CACHE_TTL_MS;
        clearLoginStatsCache();

        if (JSON.stringify(cachedDiscordHomeStats) !== previousStats) {
          broadcastSiteStatsUpdate(getLoginStats());
        }

        return cachedDiscordHomeStats;
      } catch (_error) {
        cachedDiscordHomeStatsExpiresAt = Date.now() + 30000;
        return cachedDiscordHomeStats;
      } finally {
        clearTimeout(timeout);
        discordHomeStatsRefreshPromise = null;
      }
    })();

    return discordHomeStatsRefreshPromise;
  }

  async function ensureDiscordHomeStats() {
    if (Date.now() < cachedDiscordHomeStatsExpiresAt) {
      return cachedDiscordHomeStats;
    }

    return refreshDiscordHomeStats(true);
  }

  function getHomeStatsTrackedIp(user) {
    const registrationIp = normalizeComparableIp(user?.registration_ip);
    if (registrationIp) {
      return registrationIp;
    }
    return normalizeComparableIp(user?.last_login_ip);
  }

  function getPrimaryHomeStatsAdminUser(users) {
    if (!Array.isArray(users) || users.length === 0) {
      return null;
    }

    const normalizeName = (value) => String(value || "").trim().toLowerCase();
    return (
      users.find(
        (user) =>
          Number(user?.is_admin) === 1 &&
          (
            normalizeName(user?.admin_character_name) === "noctra" ||
            normalizeName(user?.username) === "noctra"
          )
      ) ||
      users.find((user) => Number(user?.is_admin) === 1) ||
      null
    );
  }

  function getHomeStatsUsers() {
    return db
      .prepare(`
        SELECT u.id,
               u.username,
               u.is_admin,
               u.registration_ip,
               u.last_login_ip,
               COALESCE(admin_character.name, '') AS admin_character_name
          FROM users u
          LEFT JOIN characters admin_character
            ON admin_character.id = u.admin_character_id
      `)
      .all();
  }

  function getHomeStatsHiddenUserIds(users) {
    const primaryAdminUser = getPrimaryHomeStatsAdminUser(users);
    const hiddenUserIds = new Set();
    const adminIps = new Set();
    const primaryAdminConnectedIps = primaryAdminUser
      ? getConnectedUserComparableIps(primaryAdminUser.id)
      : new Set();

    users.forEach((user) => {
      if (Number(user?.is_admin) !== 1) {
        return;
      }

      const trackedIp = getHomeStatsTrackedIp(user);
      if (trackedIp) {
        adminIps.add(trackedIp);
      }
    });

    primaryAdminConnectedIps.forEach((ip) => {
      if (ip) {
        adminIps.add(ip);
      }
    });

    users.forEach((user) => {
      if (primaryAdminUser && Number(user?.id) === Number(primaryAdminUser.id)) {
        return;
      }
      if (Number(user?.is_admin) === 1) {
        hiddenUserIds.add(Number(user.id));
        return;
      }

      const trackedIp = getHomeStatsTrackedIp(user);
      if (trackedIp && adminIps.has(trackedIp)) {
        hiddenUserIds.add(Number(user.id));
      }
    });

    return hiddenUserIds;
  }

  function getVisibleAccountCountForHomeStats(users = []) {
    const seenIps = new Set();
    let visibleCount = 0;

    users.forEach((user) => {
      const trackedIp = getHomeStatsTrackedIp(user);
      if (!trackedIp) {
        visibleCount += 1;
        return;
      }
      if (seenIps.has(trackedIp)) {
        return;
      }

      seenIps.add(trackedIp);
      visibleCount += 1;
    });

    return visibleCount;
  }

  function getVisibleCharacterStatsForHomeStats(hiddenUserIds = null) {
    const characters = db.prepare("SELECT user_id, server_id FROM characters").all();
    const visibleCharacters =
      hiddenUserIds instanceof Set
        ? characters.filter((character) => !hiddenUserIds.has(Number(character.user_id)))
        : characters;

    return {
      characterCount: visibleCharacters.length,
      freeRpCharacterCount: visibleCharacters.filter(
        (character) => normalizeCharacterServerId(character.server_id) === "free-rp"
      ).length,
      erpCharacterCount: visibleCharacters.filter(
        (character) => normalizeCharacterServerId(character.server_id) === "erp"
      ).length,
      larpCharacterCount: visibleCharacters.filter(
        (character) => normalizeCharacterServerId(character.server_id) === larpServerId
      ).length
    };
  }

  function getVisibleLoggedInUserIdsForHomeStats(activeUserIds = [], hiddenUserIds = null) {
    const hiddenSet = hiddenUserIds instanceof Set ? hiddenUserIds : null;
    const visibleUserIds = [];
    const seenUserIds = new Set();

    (Array.isArray(activeUserIds) ? activeUserIds : []).forEach((userId) => {
      const parsedUserId = Number(userId);
      if (!Number.isInteger(parsedUserId) || parsedUserId < 1) {
        return;
      }
      if (hiddenSet && hiddenSet.has(parsedUserId)) {
        return;
      }
      if (seenUserIds.has(parsedUserId)) {
        return;
      }

      seenUserIds.add(parsedUserId);
      visibleUserIds.push(parsedUserId);
    });

    return visibleUserIds;
  }

  function getVisibleOnlineUserCountForServers(serverIds, hiddenUserIds = null) {
    const onlineUserIds = getOnlineUserIdsForServers(serverIds);
    if (!(hiddenUserIds instanceof Set) || hiddenUserIds.size === 0) {
      return onlineUserIds.size;
    }

    let visibleCount = 0;
    onlineUserIds.forEach((userId) => {
      if (!hiddenUserIds.has(Number(userId))) {
        visibleCount += 1;
      }
    });
    return visibleCount;
  }

  function buildLoginStats() {
    const discordHomeStats = getDiscordHomeStats();
    const activeUserIds = getActiveSessionUserIds();
    const homeStatsUsers = getHomeStatsUsers();
    const hiddenHomeStatsUserIds = getHomeStatsHiddenUserIds(homeStatsUsers);
    const visibleHomeStatsUsers = homeStatsUsers.filter(
      (user) => !hiddenHomeStatsUserIds.has(Number(user.id))
    );
    const visibleCharacterStats = getVisibleCharacterStatsForHomeStats(hiddenHomeStatsUserIds);
    const visibleLoggedInUserIds = getVisibleLoggedInUserIdsForHomeStats(
      activeUserIds,
      hiddenHomeStatsUserIds
    );
    const staffStats = getOnlineStaffStats(hiddenHomeStatsUserIds);
    const freeRpCharacterCount = visibleCharacterStats.freeRpCharacterCount;
    const erpCharacterCount = visibleCharacterStats.erpCharacterCount;

    return {
      accountCount: getVisibleAccountCountForHomeStats(visibleHomeStatsUsers),
      characterCount: visibleCharacterStats.characterCount,
      rpServerCount: freeRpCharacterCount + erpCharacterCount,
      freeRpCharacterCount,
      erpCharacterCount,
      larpServerCount: visibleCharacterStats.larpCharacterCount,
      freeRpOnlineCount: getVisibleOnlineUserCountForServers("free-rp", hiddenHomeStatsUserIds),
      erpOnlineCount: getVisibleOnlineUserCountForServers("erp", hiddenHomeStatsUserIds),
      rpOnlineCount: getVisibleOnlineUserCountForServers(
        ["free-rp", "erp"],
        hiddenHomeStatsUserIds
      ),
      larpOnlineCount: 0,
      discordGuildName: discordHomeStats.guildName,
      discordInviteUrl: discordHomeStats.inviteUrl,
      discordMemberCount: discordHomeStats.memberCount,
      discordOnlineCount: discordHomeStats.onlineCount,
      discordIconUrl: discordHomeStats.iconUrl,
      discordAvailable: discordHomeStats.available,
      loggedInUserCount: getLoggedInUsersCount(visibleLoggedInUserIds),
      adminOnlineCount: staffStats.adminOnlineCount,
      adminOnlineNames: staffStats.adminOnlineNames,
      moderatorOnlineCount: staffStats.moderatorOnlineCount,
      moderatorOnlineNames: staffStats.moderatorOnlineNames
    };
  }

  function getLoginStats() {
    const now = Date.now();
    if (cachedLoginStats && now < cachedLoginStatsExpiresAt) {
      return cachedLoginStats;
    }

    cachedLoginStats = buildLoginStats();
    cachedLoginStatsExpiresAt = now + LOGIN_STATS_CACHE_TTL_MS;
    return cachedLoginStats;
  }

  function emitHomeStatsUpdate() {
    broadcastSiteStatsUpdate(getLoginStats());
  }

  function normalizeHomeSectionTitle(rawTitle) {
    return String(rawTitle || "").trim().slice(0, 120);
  }

  function normalizeHomeSectionBody(rawBody) {
    return String(rawBody || "").trim().slice(0, 2000);
  }

  function decorateHomeContent(homeContent) {
    const heroTitle =
      normalizeHomeSectionTitle(homeContent?.hero_title || "") || DEFAULT_HOME_HERO_TITLE;
    const heroBody =
      normalizeHomeSectionBody(homeContent?.hero_body || "") || DEFAULT_HOME_HERO_BODY;
    const updatesTitle =
      normalizeHomeSectionTitle(homeContent?.updates_title || "") || DEFAULT_UPDATES_TITLE;

    return {
      hero_title: heroTitle,
      hero_body: heroBody,
      hero_body_html: renderGuestbookBbcode(heroBody),
      updates_title: updatesTitle
    };
  }

  function getHomeContent() {
    const homeContent = db
      .prepare(
        `SELECT hero_title, hero_body, updates_title
         FROM site_home_settings
         WHERE id = 1`
      )
      .get();

    return decorateHomeContent(homeContent);
  }

  function buildHomePageViewModel() {
    const homeContent = getHomeContent();
    const recentSiteUpdatesResult = getRecentSiteUpdates(30);
    const recentSiteUpdates = Array.isArray(recentSiteUpdatesResult) ? recentSiteUpdatesResult : [];

    return {
      title: homeContent.hero_title || DEFAULT_HOME_HERO_TITLE,
      metaDescription: defaultSeoDescription,
      stats: getLoginStats(),
      homeContent,
      recentSiteUpdateRevisions: recentSiteUpdates
        .map((siteUpdate) => String(siteUpdate?.revision_token || "").trim())
        .filter(Boolean),
      latestSiteUpdateRevisionToken: getLatestSiteUpdateRevisionToken(),
      pageClass: "page-home-screen"
    };
  }

  function saveHeroContent(rawTitle, rawBody) {
    const heroTitle = normalizeHomeSectionTitle(rawTitle);
    const heroBody = normalizeHomeSectionBody(rawBody);

    if (!heroTitle) {
      return {
        ok: false,
        error: "Die Startseiten-\u00dcberschrift darf nicht leer sein."
      };
    }

    if (!heroBody) {
      return {
        ok: false,
        error: "Der Startseitentext darf nicht leer sein."
      };
    }

    db.prepare(
      `UPDATE site_home_settings
       SET hero_title = ?, hero_body = ?
       WHERE id = 1`
    ).run(heroTitle, heroBody);

    return {
      ok: true,
      homeContent: getHomeContent()
    };
  }

  function saveUpdatesTitle(rawTitle) {
    const updatesTitle = normalizeHomeSectionTitle(rawTitle);

    if (!updatesTitle) {
      return {
        ok: false,
        error: "Die Live-Updates-\u00dcberschrift darf nicht leer sein."
      };
    }

    db.prepare(
      `UPDATE site_home_settings
       SET updates_title = ?
       WHERE id = 1`
    ).run(updatesTitle);

    return {
      ok: true,
      homeContent: getHomeContent()
    };
  }

  return {
    buildHomePageViewModel,
    clearLoginStatsCache,
    emitHomeStatsUpdate,
    ensureDiscordHomeStats,
    getHomeContent,
    getLoginStats,
    normalizeHomeSectionBody,
    normalizeHomeSectionTitle,
    refreshDiscordHomeStats,
    saveHeroContent,
    saveUpdatesTitle
  };
}

module.exports = {
  createHomePageService,
  DEFAULT_UPDATES_TITLE
};
