import { describe, expect, it } from '@jest/globals';
import {
  articleMapper,
  categoryMapper,
  categoryName,
  labelMapper,
  normalizeProtocolRelativeUrls,
  parentCategoryId,
} from './content-mapper.js';
import { KnowledgeOwlContext } from './model/knowledgeowl-context.js';
import { KnowledgeOwlArticle } from './model/knowledgeowl-article.js';
import { GeneratedValue } from '../utils/generated-value.js';

function buildContext(): KnowledgeOwlContext {
  return {
    adapter: { unprocessedItems: { categories: [], labels: [], articles: [] } },
    categoryLookupTable: {},
    labelLookupTable: {},
    articleLookupTable: {},
  } as unknown as KnowledgeOwlContext;
}

const OPTIONS = {
  language: 'en',
  siteUrl: 'https://help.example.com',
  fetchCategories: true,
  fetchLabels: true,
  buildExternalUrls: true,
};

describe('KnowledgeOwl content mapper', () => {
  describe('categoryName', () => {
    it('should read a localized name map', () => {
      expect(categoryName({ id: 'c1', name: { en: 'Billing' } }, 'en')).toBe(
        'Billing',
      );
    });

    it('should fall back to the first language', () => {
      expect(categoryName({ id: 'c1', name: { fr: 'Facturation' } }, 'en')).toBe(
        'Facturation',
      );
    });

    it('should accept a plain string name', () => {
      expect(categoryName({ id: 'c1', name: 'Billing' }, 'en')).toBe('Billing');
    });
  });

  describe('parentCategoryId', () => {
    it('should treat empty string, null and false as top level', () => {
      expect(parentCategoryId({ id: 'c1', parent_id: '' })).toBeNull();
      expect(parentCategoryId({ id: 'c1', parent_id: null })).toBeNull();
      expect(parentCategoryId({ id: 'c1', parent_id: false })).toBeNull();
    });

    it('should use parent_id when present', () => {
      expect(parentCategoryId({ id: 'c1', parent_id: 'p1' })).toBe('p1');
    });
  });

  describe('categoryMapper', () => {
    it('should map a top level category', () => {
      const [category] = categoryMapper(
        { id: 'c1', name: { en: 'COBRA' }, parent_id: null },
        buildContext(),
        'en',
      );

      expect(category).toEqual({
        id: null,
        externalId: 'c1',
        name: 'COBRA',
        parentCategory: null,
      });
    });

    it('should postpone a category whose parent is not processed yet', () => {
      const result = categoryMapper(
        { id: 'c2', name: { en: 'Child' }, parent_id: 'c1' },
        buildContext(),
        'en',
      );

      expect(result).toEqual([]);
    });

    it('should reference an already processed parent', () => {
      const context = buildContext();
      context.categoryLookupTable['c1'] = {
        id: null,
        externalId: 'c1',
        name: 'Parent',
      };

      const [category] = categoryMapper(
        { id: 'c2', name: { en: 'Child' }, parent_id: 'c1' },
        context,
        'en',
      );

      expect(category!.parentCategory).toEqual({
        id: null,
        externalId: 'c1',
        name: 'Parent',
      });
    });
  });

  describe('normalizeProtocolRelativeUrls', () => {
    it('should make protocol-relative image and link URLs absolute', () => {
      expect(
        normalizeProtocolRelativeUrls(
          '<img src="//cdn.example.com/a.png"><a href=\'//cdn.example.com/f.pdf\'>f</a><a href="https://x.com/">x</a>',
        ),
      ).toBe(
        '<img src="https://cdn.example.com/a.png"><a href=\'https://cdn.example.com/f.pdf\'>f</a><a href="https://x.com/">x</a>',
      );
    });

    it('should leave relative paths alone', () => {
      expect(normalizeProtocolRelativeUrls('<a href="/help/x">x</a>')).toBe(
        '<a href="/help/x">x</a>',
      );
    });
  });

  describe('labelMapper', () => {
    it('should map a tag to a label with a generated color', () => {
      expect(labelMapper({ id: 't1', name: 'FSA' })).toEqual([
        { id: null, externalId: 't1', name: 'FSA', color: GeneratedValue.COLOR },
      ]);
    });
  });

  describe('articleMapper', () => {
    const article: KnowledgeOwlArticle = {
      id: 'a1',
      name: 'Plan Limits',
      url_hash: 'plan-limits',
      status: 'published',
      category: 'c1',
      tags: ['t1', 'missing-tag'],
      date_modified: '10/09/2026 12:54 pm EDT',
      current_version: {
        en: { title: 'Plan Limits', text: '<p>Hello</p>' },
      },
    };

    it('should map a published article with category, label and external url', () => {
      const context = buildContext();
      context.categoryLookupTable['c1'] = {
        id: null,
        externalId: 'c1',
        name: 'Retirement',
      };
      context.labelLookupTable['t1'] = {
        id: null,
        externalId: 't1',
        name: 'FSA',
      };

      const [document] = articleMapper(article, context, OPTIONS);

      expect(document).toEqual({
        id: null,
        externalId: 'a1',
        externalUrl: 'https://help.example.com/help/plan-limits',
        published: {
          title: 'Plan Limits',
          visible: true,
          alternatives: null,
          category: { id: null, externalId: 'c1', name: 'Retirement' },
          labels: [{ id: null, externalId: 't1', name: 'FSA' }],
          variations: [{ rawHtml: '<p>Hello</p>', body: null }],
        },
        draft: null,
        externalVersionId: '10/09/2026 12:54 pm EDT',
      });
    });

    it('should treat review status as published', () => {
      const [document] = articleMapper(
        { ...article, status: 'review' },
        buildContext(),
        OPTIONS,
      );

      expect(document!.published).not.toBeNull();
      expect(document!.draft).toBeNull();
    });

    it('should map a draft article to the draft version', () => {
      const [document] = articleMapper(
        { ...article, status: 'draft' },
        buildContext(),
        OPTIONS,
      );

      expect(document!.published).toBeNull();
      expect(document!.draft).not.toBeNull();
    });

    it('should skip archived and deleted articles', () => {
      expect(
        articleMapper({ ...article, status: 'archived' }, buildContext(), OPTIONS),
      ).toEqual([]);
      expect(
        articleMapper({ ...article, status: 'deleted' }, buildContext(), OPTIONS),
      ).toEqual([]);
    });

    it('should fall back to the article name and an empty body', () => {
      const [document] = articleMapper(
        { ...article, current_version: null },
        buildContext(),
        { ...OPTIONS, buildExternalUrls: false },
      );

      expect(document!.published!.title).toBe('Plan Limits');
      expect(document!.published!.variations![0]!.rawHtml).toBe('');
      expect(document!.externalUrl).toBeNull();
    });
  });
});
