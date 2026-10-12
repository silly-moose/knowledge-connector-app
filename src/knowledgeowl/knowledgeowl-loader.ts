import { AbstractLoader } from '../pipe/abstract-loader.js';
import { AdapterPair } from '../adapter/adapter-pair.js';
import { Adapter } from '../adapter/adapter.js';
import { Category } from '../model/category.js';
import { Label } from '../model/label.js';
import { Document } from '../model/document.js';
import { KnowledgeOwlAdapter } from './knowledgeowl-adapter.js';
import { KnowledgeOwlConfig } from './model/knowledgeowl-config.js';
import { KnowledgeOwlContext } from './model/knowledgeowl-context.js';
import { KnowledgeOwlCategory } from './model/knowledgeowl-category.js';
import { KnowledgeOwlTag } from './model/knowledgeowl-tag.js';
import { KnowledgeOwlArticle } from './model/knowledgeowl-article.js';
import {
  articleMapper,
  categoryMapper,
  categoryName,
  labelMapper,
} from './content-mapper.js';
import { removeTrailingSlash } from '../utils/remove-trailing-slash.js';

/**
 * KnowledgeOwlLoader is a specific {@Link Loader} implementation for fetching data from the KnowledgeOwl API
 */
export class KnowledgeOwlLoader extends AbstractLoader<KnowledgeOwlContext> {
  private adapter?: KnowledgeOwlAdapter;
  private language: string = 'en';
  private siteUrl: string | null = null;

  public async initialize(
    config: KnowledgeOwlConfig,
    adapters: AdapterPair<KnowledgeOwlAdapter, Adapter>,
    context: KnowledgeOwlContext,
  ): Promise<void> {
    await super.initialize(config, adapters, context);

    this.adapter = adapters.sourceAdapter;
    this.language = config.knowledgeowlLanguage || 'en';
    this.siteUrl = config.knowledgeowlSiteUrl
      ? removeTrailingSlash(config.knowledgeowlSiteUrl)
      : null;

    if (!this.context!.categoryLookupTable) {
      this.context!.categoryLookupTable = {};
    }
    if (!this.context!.labelLookupTable) {
      this.context!.labelLookupTable = {};
    }
  }

  public async *categoryIterator(): AsyncGenerator<Category, void, void> {
    if (!this.shouldLoadCategories()) {
      return;
    }

    yield* this.loadItems<KnowledgeOwlCategory, Category>(
      this.adapter!.categoryIterator(),
      (item: KnowledgeOwlCategory): Category[] => {
        const result = categoryMapper(item, this.context!, this.language);
        if (result.length > 0) {
          this.addCategoryToLookupTable(item);
        }
        return result;
      },
      this.context!.adapter.unprocessedItems.categories,
    );
  }

  public async *labelIterator(): AsyncGenerator<Label, void, void> {
    if (!this.shouldLoadLabels()) {
      return;
    }

    yield* this.loadItems<KnowledgeOwlTag, Label>(
      this.adapter!.labelIterator(),
      (item: KnowledgeOwlTag): Label[] => {
        this.addLabelToLookupTable(item);

        return labelMapper(item);
      },
      this.context!.adapter.unprocessedItems.labels,
    );
  }

  public async *documentIterator(): AsyncGenerator<Document, void, void> {
    if (!this.shouldLoadArticles()) {
      return;
    }

    yield* this.loadItems<KnowledgeOwlArticle, Document>(
      this.adapter!.articleIterator(),
      (item: KnowledgeOwlArticle): Document[] => {
        return articleMapper(item, this.context!, {
          language: this.language,
          siteUrl: this.siteUrl,
          fetchCategories: this.shouldLoadCategories(),
          fetchLabels: this.shouldLoadLabels(),
          buildExternalUrls: this.shouldBuildExternalUrls(),
        });
      },
      this.context!.adapter.unprocessedItems.articles,
    );
  }

  private addCategoryToLookupTable(item: KnowledgeOwlCategory): void {
    this.context!.categoryLookupTable[item.id] = {
      id: null,
      externalId: item.id,
      name: categoryName(item, this.language),
    };
  }

  private addLabelToLookupTable(item: KnowledgeOwlTag): void {
    const labelReference = {
      id: null,
      externalId: item.id,
      name: item.name ?? item.id,
    };
    this.context!.labelLookupTable[item.id] = labelReference;
    if (item.name) {
      this.context!.labelLookupTable[item.name] = labelReference;
    }
  }
}
