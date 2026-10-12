export interface KnowledgeOwlArticleVersion {
  title?: string | null;
  text?: string | null;
}

export interface KnowledgeOwlArticle {
  id: string;
  name?: string | null;
  url_hash?: string | null;
  status?: string | null;
  category?: string | null;
  parents?: string[] | null | false;
  // Array of tag IDs; null, false or an empty object when the article has no tags
  tags?: string[] | null | false | Record<string, unknown>;
  date_modified?: string | null;
  date_published?: string | null;
  current_version?: Record<string, KnowledgeOwlArticleVersion> | null;
  reader_roles?: string[] | null;
  inherited_roles?: string[] | null;
  prevent_searching?: boolean | null;
  article_link?: string | null;
  content_article?: string | null;
}
