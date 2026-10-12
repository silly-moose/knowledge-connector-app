export interface KnowledgeOwlCategory {
  id: string;
  // KnowledgeOwl returns either a plain string or a { [language]: name } map
  name?: string | Record<string, string> | null;
  // Empty string, null or false when the category is top level
  parent_id?: string | null | false;
  parents?: string[] | null;
  status?: string | null;
  type?: string | null;
  url_hash?: string | null;
}
