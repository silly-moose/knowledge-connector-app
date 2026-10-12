import { KnowledgeOwlArticle } from './model/knowledgeowl-article.js';
import { KnowledgeOwlCategory } from './model/knowledgeowl-category.js';
import { KnowledgeOwlTag } from './model/knowledgeowl-tag.js';
import { KnowledgeOwlContext } from './model/knowledgeowl-context.js';
import { Category } from '../model/category.js';
import { Label } from '../model/label.js';
import { Document, DocumentVersion } from '../model/document.js';
import { LabelReference } from '../model/label-reference.js';
import { GeneratedValue } from '../utils/generated-value.js';

const PUBLISHED_STATUSES = ['published', 'review'];
const DRAFT_STATUSES = ['draft'];

export function categoryName(
  category: KnowledgeOwlCategory,
  language: string,
): string {
  const { name } = category;
  if (!name) {
    return category.id;
  }
  if (typeof name === 'string') {
    return name;
  }
  return name[language] ?? Object.values(name)[0] ?? category.id;
}

export function parentCategoryId(category: KnowledgeOwlCategory): string | null {
  const { parent_id, parents } = category;
  if (typeof parent_id === 'string' && parent_id.length > 0) {
    return parent_id;
  }
  if (Array.isArray(parents) && parents.length > 0) {
    const last = parents[parents.length - 1];
    return typeof last === 'string' && last.length > 0 ? last : null;
  }
  return null;
}

export function categoryMapper(
  category: KnowledgeOwlCategory,
  context: KnowledgeOwlContext,
  language: string,
): Category[] {
  const parentId = parentCategoryId(category);
  const parentCategory = parentId
    ? context.categoryLookupTable[parentId]
    : null;

  if (parentCategory === undefined) {
    // Parent is not yet processed, retry later
    return [];
  }

  return [
    {
      id: null,
      externalId: category.id,
      name: categoryName(category, language),
      parentCategory: parentCategory
        ? {
            id: null,
            externalId: parentCategory.externalId,
            name: parentCategory.name,
          }
        : null,
    },
  ];
}

export function labelMapper(tag: KnowledgeOwlTag): Label[] {
  return [
    {
      id: null,
      externalId: tag.id,
      name: tag.name ?? tag.id,
      color: GeneratedValue.COLOR,
    },
  ];
}

/**
 * KnowledgeOwl writes protocol-relative URLs (//cdn.example.com/...) for images
 * and file links. Make them absolute so they survive outside a browser.
 */
export function normalizeProtocolRelativeUrls(html: string): string {
  return html.replace(/(\s(?:src|href)=)(["'])\/\//gi, '$1$2https://');
}

export function articleVersion(
  article: KnowledgeOwlArticle,
  language: string,
): { title: string; html: string } {
  const versions = article.current_version ?? {};
  const version = versions[language] ?? Object.values(versions)[0];

  return {
    title: version?.title || article.name || article.id,
    html: normalizeProtocolRelativeUrls(version?.text ?? ''),
  };
}

export function articleMapper(
  article: KnowledgeOwlArticle,
  context: KnowledgeOwlContext,
  options: {
    language: string;
    siteUrl: string | null;
    fetchCategories: boolean;
    fetchLabels: boolean;
    buildExternalUrls: boolean;
  },
): Document[] {
  const status = (article.status ?? '').toLowerCase();
  const isPublished = PUBLISHED_STATUSES.includes(status);
  const isDraft = DRAFT_STATUSES.includes(status);

  if (!isPublished && !isDraft) {
    return [];
  }

  const { title, html } = articleVersion(article, options.language);

  const category =
    options.fetchCategories && article.category
      ? (context.categoryLookupTable[article.category] ?? null)
      : null;

  // KnowledgeOwl returns null, false or an object instead of an array when an article has no tags
  const tagIds: string[] = Array.isArray(article.tags)
    ? article.tags.filter((tagId): tagId is string => typeof tagId === 'string')
    : [];

  const labels: LabelReference[] | null = options.fetchLabels
    ? tagIds
        .map((tagId) => context.labelLookupTable[tagId])
        .filter((label): label is LabelReference => !!label)
    : null;

  const documentVersion: DocumentVersion = {
    title,
    visible: true,
    alternatives: null,
    category: category
      ? {
          id: null,
          externalId: category.externalId,
          name: category.name,
        }
      : null,
    labels,
    variations: [
      {
        rawHtml: html,
        body: null,
      },
    ],
  };

  const externalUrl =
    options.buildExternalUrls && options.siteUrl && article.url_hash
      ? `${options.siteUrl}/help/${article.url_hash}`
      : null;

  return [
    {
      id: null,
      externalId: article.id,
      externalUrl,
      published: isPublished ? documentVersion : null,
      draft: isDraft ? documentVersion : null,
      externalVersionId: article.date_modified ?? null,
    },
  ];
}
