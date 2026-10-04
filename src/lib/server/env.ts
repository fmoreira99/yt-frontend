const read = (key: string): string | undefined => process.env[key]?.trim() || undefined;
const url = (key: string, fallback?: string): string | undefined => (read(key) ?? fallback)?.replace(/\/+$/, '');

// Getters: se leen en cada petición (no se congelan en el build).
export const env = {
  get appPassword() {
    return read('APP_PASSWORD');
  },
  get extractorUrl() {
    return url('EXTRACTOR_URL', 'https://yt-extractor-service.onrender.com')!;
  },
  get coreDbUrl() {
    return url('CORE_DB_URL', 'https://core-db-service.onrender.com')!;
  },
  get mediaHubUrl() {
    return url('MEDIA_HUB_URL', 'https://ptbiuplgwmjwvzwpogep.supabase.co/functions/v1/media-hub')!;
  },
  get youtubeUrl() {
    return url('MS_YOUTUBE_URL');
  },
  get internalApiKey() {
    return read('INTERNAL_API_KEY');
  },
  get mediaHubApiKey() {
    return read('MEDIA_HUB_API_KEY');
  },
  get youtubeJwtSecret() {
    return read('YOUTUBE_JWT_SECRET');
  },
};
