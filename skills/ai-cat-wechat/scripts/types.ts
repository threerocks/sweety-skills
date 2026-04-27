export type Track = "kids" | "adult" | "portfolio";
export type Slot = "kids" | "adult" | "evening" | "news";
export type WorkType = "poster" | "article";
export type RunStatus = "prepared" | "published" | "failed";

export interface AiCatConfig {
  timezone: string;
  default_output_dir: string;
  wechat_publish_mode: "draft";
  image_strategy: "poster-first";
  slot_times: Record<Slot, string>;
  catalog_min_items: number;
  hot_case: {
    lookback_hours: number;
    min_score: number;
    max_items: number;
  };
  news: {
    lookback_hours: number;
    digest_count: number;
    min_items: number;
    max_items: number;
  };
  poster_to_article_on_publish_failure: boolean;
  image_provider_fallback_order: string[];
}

export interface WatchlistSource {
  course_id: string;
  track: Track;
  provider: string;
  course_title: string;
  catalog_source_url: string;
  source_type: string;
  priority: number;
  evergreen?: boolean;
  knowledge_strategy?: string[];
  extraction_hints?: string[];
  seed_catalog_items?: CatalogItem[];
}

export interface WatchlistsFile {
  tracks: Record<Track, WatchlistSource[]>;
}

export interface CatalogItem {
  item_no: number;
  title: string;
  core_question: string;
  seed_keywords: string[];
  required_source_types: string[];
  default_work_type: WorkType;
  teaching_points?: string[];
  source_notes?: string[];
}

export interface EvidenceSource {
  source_label: string;
  source_type: string;
  source_title: string;
  source_url: string;
  captured_at?: string;
  excerpt?: string;
  notes?: string[];
}

export interface LessonContentSection {
  heading: string;
  body: string;
}

export interface LessonContentPack {
  item_no: number;
  title: string;
  summary: string;
  opening_scene: string;
  big_idea: string;
  explanation_sections: LessonContentSection[];
  takeaways: string[];
  misconceptions?: string[];
  discussion_questions?: string[];
  at_home_try?: string[];
  poster_points?: string[];
  visual_brief?: {
    poster_prompt?: string;
    cover_prompt?: string;
    inline_prompt?: string;
  };
  asset_files?: {
    poster_image?: string;
    cover_image?: string;
    inline_images?: string[];
  };
  evidence: EvidenceSource[];
}

export interface CourseSourcePack {
  course_id: string;
  course_title: string;
  provider: string;
  catalog_overview?: string;
  catalog_source_documents?: EvidenceSource[];
  catalog_items: CatalogItem[];
  lessons?: LessonContentPack[];
}

export interface CourseCatalog {
  course_id: string;
  track: Track;
  course_title: string;
  provider: string;
  catalog_source_url: string;
  source_type: string;
  priority: number;
  evergreen?: boolean;
  catalog_items: CatalogItem[];
  knowledge_strategy: string[];
  validated_at: string;
  status: "validated" | "failed";
  validation_error?: string;
}

export interface TrackCursor {
  track: Track;
  current_course_id: string | null;
  current_item_index: number;
  completed_course_ids: string[];
  status: "idle" | "ready" | "blocked";
  last_run_at: string | null;
  last_published_run_id: string | null;
}

export interface TrackStateFile {
  tracks: Record<Track, TrackCursor>;
}

export interface PublishResult {
  ok: boolean;
  attempts: number;
  article_type: "news" | "newspic";
  media_id?: string | null;
  draft_media_id?: string | null;
  fallback_to_article?: boolean;
  errors?: string[];
}

export interface RunHistoryEntry {
  run_id: string;
  slot: Slot;
  track: Track | "news" | null;
  source_kind: "course" | "hot-case" | "news";
  account_alias: string;
  run_date: string;
  started_at: string;
  finished_at: string | null;
  status: RunStatus;
  title: string;
  work_type: WorkType;
  output_dir: string;
  manifest_path: string | null;
  course_id: string | null;
  course_title: string | null;
  item_no: number | null;
  fallback_to_article: boolean;
  error: string | null;
  retry_of_run_id: string | null;
  publish_result?: PublishResult;
}

export interface HotCaseItem {
  id: string;
  title: string;
  summary: string;
  source_url: string;
  source_name: string;
  published_at: string;
  score: number;
  is_practical: boolean;
  evidence_urls?: string[];
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source_url: string;
  source_name: string;
  published_at: string;
  impact: string;
  score: number;
}

export interface HotCaseHistoryEntry {
  hot_case_id: string;
  drafted_at: string;
  run_id: string;
  title: string;
}

export interface RunManifest {
  version: number;
  run_id: string;
  slot: Slot;
  track: Track | "news" | null;
  source_kind: "course" | "hot-case" | "news";
  title: string;
  summary: string;
  work_type: WorkType;
  account_alias: string;
  course_id: string | null;
  course_title: string | null;
  item_no: number | null;
  created_at: string;
  publishing: {
    poster_to_article_on_publish_failure: boolean;
    fallback_triggered: boolean;
    account_alias: string;
  };
  sources: {
    catalog_source_url?: string;
    source_urls: string[];
    source_types: string[];
  };
  assets: {
    poster_image: string | null;
    article_cover: string | null;
    article_inline: string[];
  };
}
