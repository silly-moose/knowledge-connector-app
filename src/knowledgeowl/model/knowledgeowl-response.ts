export interface KnowledgeOwlPageStats {
  total_records?: number;
  total_pages?: number;
  next_page?: number | null;
}

export interface KnowledgeOwlResponse<T> {
  valid?: boolean;
  page_stats?: KnowledgeOwlPageStats;
  data?: T[];
}
