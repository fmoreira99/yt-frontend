/* ---------- yt-extractor-service ---------- */
export interface VideoMetadata {
  video_id: string;
  url: string;
  title: string;
  description: string;
  published_at: string | null;
  channel_id: string | null;
  channel_title: string | null;
  channel_url: string | null;
  tags: string[];
  hashtags: string[];
  keywords: string[];
  duration_seconds: number | null;
  view_count: number | null;
  like_count: number | null;
  thumbnail_url: string | null;
  source: 'youtube_api' | 'oembed';
}

export interface VideoAnalysis {
  summary: string;
  language: string | null;
  topics: string[];
  keywords: string[];
  hashtags: string[];
  hook: string | null;
  provider: string;
  model: string | null;
}

export interface VideoExtraction {
  status: 'extracted';
  video_id: string;
  metadata: VideoMetadata;
  transcript: string;
  transcript_available: boolean;
  transcript_language: string | null;
  transcript_truncated: boolean;
  transcript_reason?: string;
  transcript_source?: 'youtube' | 'gemini';
  analysis: VideoAnalysis | null;
  analysis_error?: string;
}

export interface ExtractError {
  input?: string;
  video_id?: string;
  code: string;
  error: string;
}

export interface ExtractVideosResponse {
  extracted: VideoExtraction[];
  skipped: string[];
  errors: ExtractError[];
}

export interface ChannelScanSummary {
  status: 'success' | 'failed';
  channel_id: string;
  channel_title: string | null;
  total_found: number;
  extracted: number;
  skipped: number;
  failed: number;
  errors: Array<{ video_id: string; code: string; error: string }>;
  videos: VideoExtraction[];
}

export interface StoredResult {
  video_id: string;
  extracted_at: string;
  metadata: VideoMetadata;
  analysis: VideoAnalysis | null;
  transcript_available: boolean;
  transcript_source: string | null;
  transcript_chars: number;
  transcript?: string;
}

export interface Pagination {
  limit: number;
  offset: number;
  count: number;
}

export interface ReanalysisSummary {
  analyzed: string[];
  failed: Array<{ video_id: string; error: string }>;
  has_more: boolean;
}

export interface ScheduleStatus {
  channel_id: string;
  cron_expression: string;
  max_videos: number | null;
  running: boolean;
  last_run_at: string | null;
  last_status: 'running' | 'success' | 'failed' | 'skipped' | null;
  last_error: string | null;
  next_run_at: string | null;
}

/* ---------- core-db-service ---------- */
export type JobStatus = 'pending' | 'running' | 'success' | 'failed';

export interface CoreAccount {
  id: string;
  provider: string;
  external_id: string;
  name: string | null;
  email: string | null;
  scopes: string[];
  metadata: Record<string, unknown>;
  token_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobLog {
  id: string;
  service_name: string;
  job_type: string;
  status: JobStatus;
  account_id: string | null;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

/* ---------- ms-media-hub ---------- */
export type MediaType = 'image' | 'video' | 'gif' | 'icon';

export interface MediaItem {
  id: string;
  provider: string;
  type: MediaType;
  title: string;
  preview_url: string;
  full_url: string;
  thumbnail_url: string;
  author: { name: string; profile_url: string };
  dimensions: { width: number; height: number } | null;
  license: string;
  source_url: string;
  attribution?: string;
  duration_seconds?: number;
}

export interface SearchResponse {
  status: 'success';
  query: string;
  type: string;
  page: number;
  total_results: number;
  data: MediaItem[];
  providers: Record<string, string>;
}

export interface MediaProvider {
  id: string;
  name: string;
  category: string;
  status: 'active' | 'inactive' | 'unconfigured' | 'degraded' | 'quota_exhausted';
  rate_limit_remaining: number | null;
}

export type GenerateResult =
  | { content: string; model: string; usage: { prompt_tokens: number | null; completion_tokens: number | null } }
  | { url: string; expires_in: number; mime_type: string; model: string };

export interface GenerateResponse {
  status: 'success';
  task: 'ai_text' | 'ai_image';
  provider: string;
  result: GenerateResult;
}

/* ---------- ms-youtube ---------- */
export interface YoutubeAccount {
  id: string;
  channelId: string;
  channelTitle: string;
  thumbnailUrl?: string;
  scope: string[];
  accessTokenExpiryDate?: number;
  createdAt: string;
  updatedAt: string;
}

export interface VideoStats {
  videoId: string;
  title: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  favoriteCount: number;
  duration: string;
}

export interface ChannelAnalytics {
  channelId: string;
  startDate: string;
  endDate: string;
  metrics: string[];
  rows: (string | number)[][];
}

export interface AnalyticsCatalogItem {
  id: string;
  label: string;
  description: string;
  requiresVideo: boolean;
}

export interface AnalyticsReport {
  id: string;
  label: string;
  channelId: string;
  startDate: string;
  endDate: string;
  columns: string[];
  rows: (string | number)[][];
  skippedMetrics?: string[];
  notes?: string[];
}

export interface AnalyticsBundle {
  generatedAt: string;
  channelId: string;
  channelTitle: string;
  startDate: string;
  endDate: string;
  reports: Record<string, AnalyticsReport>;
  errors: Record<string, string>;
}

export interface ReportJob {
  id: string;
  name: string;
  reportTypeId: string;
  createTime?: string;
  expireTime?: string;
}

export interface ReportFile {
  id: string;
  jobId: string;
  startTime: string;
  endTime: string;
  createTime: string;
}

/* ---------- salud ---------- */
export interface ServiceHealth {
  status: 'ok' | 'down' | 'not_configured';
  latency_ms?: number;
  detail?: string;
}
