import { AdapterContext } from '../../adapter/adapter-context.js';
import { KnowledgeOwlArticle } from './knowledgeowl-article.js';
import { KnowledgeOwlCategory } from './knowledgeowl-category.js';
import { KnowledgeOwlTag } from './knowledgeowl-tag.js';

export interface KnowledgeOwlContext
  extends AdapterContext<
    KnowledgeOwlCategory,
    KnowledgeOwlTag,
    KnowledgeOwlArticle
  > {
  api?: KnowledgeOwlApiContext;
}

export interface KnowledgeOwlPageContext<T> {
  done: boolean;
  started: boolean;
  nextPage: number | null;
  unprocessed: T[];
}

export interface KnowledgeOwlApiContext {
  categories: KnowledgeOwlPageContext<KnowledgeOwlCategory>;
  tags: KnowledgeOwlPageContext<KnowledgeOwlTag>;
  // One page context per article status, keyed by status (eg. "published")
  articles: Record<string, KnowledgeOwlPageContext<KnowledgeOwlArticle>>;
}
