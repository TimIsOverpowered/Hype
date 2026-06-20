// Query / React-Query
export const STALE_TIME_5MIN = 1000 * 60 * 5;
export const STALE_TIME_30SEC = 1000 * 30;
export const DEFAULT_RETRY_COUNT = 1;

// Pagination
export const CHANNEL_PAGE_SIZE = 100;
export const VODS_PAGE_SIZE = 100;
export const VODS_NEXT_PAGE_SIZE = 25;
export const SEARCH_MAX_RESULTS = 15;

// Timers / Intervals
export const CHAT_LOOP_INTERVAL_MS = 1000;
export const CHAT_STATE_CHANGE_DELAY_MS = 300;
export const CHAT_FETCH_RETRIES = 3;
export const CHAT_RETRY_DELAY_MS = 1000;
export const TIME_UPDATE_THROTTLE_MS = 250;
export const ELAPSED_TIMER_INTERVAL_MS = 1000;
export const CHANNEL_SEARCH_DEBOUNCE_MS = 200;
export const SEARCH_BLUR_DELAY_MS = 150;

// Thresholds
export const INTERSECTION_OBSERVER_MARGIN = '200px';
export const CHAT_BOTTOM_THRESHOLD = 50;
export const CHAT_SCROLL_UP_THRESHOLD = 25;
export const CHAT_INTERSECTION_MARGIN = '0px 0px 100px 0px';
export const MIN_SEARCH_QUERY_LENGTH = 2;
export const CHAT_WIDTH_MIN = 150;
export const CHAT_WIDTH_MAX = 800;
export const DEFAULT_CHAT_WIDTH_MIN = 150;
export const DEFAULT_CHAT_WIDTH_MAX = 800;
export const DEFAULT_CHAT_WIDTH = 340;

// Chat UI
export const DEFAULT_CHAT_FONT_FAMILY = 'Inter, sans-serif';
export const DEFAULT_CHAT_FONT_SIZE = 14;
export const CHAT_SKELETON_COUNT = 24;
export const CHAT_MAX_MESSAGES = 1500;
export const CHAT_MAX_MESSAGES_AT_BOTTOM = 200;

// Graph
export const DEFAULT_INTERVAL_SECONDS = 30;
export const DEFAULT_MESSAGE_THRESHOLD = 25;
export const DEFAULT_SEARCH_THRESHOLD = 1;
export const DEFAULT_SEARCH_TERM = '';

// Workers
export const SEVENTV_ZERO_WIDTH_FLAG = 1 << 8;
export const SIMPLIFICATION_TOLERANCE = 5;
export const TOP_EMOTES_COUNT = 5;
export const MIN_LOG_LINE_LENGTH = 10;

// Luminance
export const LUMINANCE_R = 0.299;
export const LUMINANCE_G = 0.587;
export const LUMINANCE_B = 0.114;
export const MIN_USERNAME_LUMINANCE = 90;

// Time
export const SECONDS_PER_HOUR = 3600;
export const SECONDS_PER_MINUTE = 60;
export const HMS_PAD_WIDTH = 2;

// Twitch emote URL segments
export const TWITCH_EMOTE_URL_PATTERN = {
  cdn: 'https://static-cdn.jtvnw.net',
  path: 'emoticons/v2',
  variant: 'default/dark',
  resolutions: ['1.0', '2.0', '3.0', '4x'] as const,
} as const;

// 7TV emote resolutions
export const SEVENTV_EMOTE_RESOLUTIONS = ['1x.webp', '2x.webp', '3x.webp', '4x.webp'] as const;

// File dialogs
export const VIDEO_FILE_EXTENSIONS = ['mp4'];
