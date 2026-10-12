import { KnowledgeOwlConfig } from './model/knowledgeowl-config.js';
import {
  KnowledgeOwlApiContext,
  KnowledgeOwlContext,
  KnowledgeOwlPageContext,
} from './model/knowledgeowl-context.js';
import { KnowledgeOwlArticle } from './model/knowledgeowl-article.js';
import { KnowledgeOwlCategory } from './model/knowledgeowl-category.js';
import { KnowledgeOwlTag } from './model/knowledgeowl-tag.js';
import { KnowledgeOwlResponse } from './model/knowledgeowl-response.js';
import { fetchSourceResource } from '../utils/web-client.js';
import { removeTrailingSlash } from '../utils/remove-trailing-slash.js';
import { setIfMissing } from '../utils/objects.js';
import { validateNonNull } from '../utils/validate-non-null.js';
import { Pager } from '../utils/pager.js';
import { EntityType } from '../model/entity-type.js';
import { BasicAuthenticationProvider } from '../utils/authentication/basic-authentication-provider.js';
import { getLogger } from '../utils/logger.js';

const DEFAULT_BASE_URL = 'https://app.knowledgeowl.com';
const DEFAULT_STATUSES = 'published,review';
const DEFAULT_PAGE_SIZE = 100;

function emptyPageContext<T>(): KnowledgeOwlPageContext<T> {
  return { done: false, started: false, nextPage: null, unprocessed: [] };
}

/**
 * Thin client for the KnowledgeOwl REST API (https://app.knowledgeowl.com/api/head/...).
 * Authentication is HTTP basic with the API key as username and "x" as password.
 * List endpoints are filtered with query parameters and paged with limit/page.
 */
export class KnowledgeOwlApi {
  private config: KnowledgeOwlConfig = {};
  private baseUrl: string = DEFAULT_BASE_URL;
  private kbId: string = '';
  private pageSize: number = DEFAULT_PAGE_SIZE;
  private statuses: string[] = [];
  private replaceSnippets: boolean = true;
  private authenticationProvider?: BasicAuthenticationProvider<unknown>;
  private apiContext: KnowledgeOwlApiContext = {
    categories: emptyPageContext<KnowledgeOwlCategory>(),
    tags: emptyPageContext<KnowledgeOwlTag>(),
    articles: {},
  };

  public async initialize(
    config: KnowledgeOwlConfig,
    context: KnowledgeOwlContext,
  ): Promise<void> {
    this.config = config;
    this.baseUrl = removeTrailingSlash(
      config.knowledgeowlBaseUrl || DEFAULT_BASE_URL,
    );
    this.kbId = validateNonNull(
      config.knowledgeowlKbId,
      'Missing KNOWLEDGEOWL_KB_ID from config',
    );
    const apiKey = validateNonNull(
      config.knowledgeowlApiKey,
      'Missing KNOWLEDGEOWL_API_KEY from config',
    );
    this.authenticationProvider = new BasicAuthenticationProvider(apiKey, 'x');

    const pageSize = Number(config.knowledgeowlPageSize);
    this.pageSize =
      pageSize > 0 && pageSize <= 100 ? pageSize : DEFAULT_PAGE_SIZE;
    this.statuses = (config.knowledgeowlStatuses || DEFAULT_STATUSES)
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0);
    this.replaceSnippets = config.knowledgeowlReplaceSnippets !== 'false';

    this.apiContext = setIfMissing(context, 'api', this.apiContext);
    for (const status of this.statuses) {
      if (!this.apiContext.articles[status]) {
        this.apiContext.articles[status] =
          emptyPageContext<KnowledgeOwlArticle>();
      }
    }
  }

  public getInstanceUrl(): string {
    return this.baseUrl;
  }

  public async *articleIterator(): AsyncGenerator<
    KnowledgeOwlArticle,
    void,
    void
  > {
    for (const status of this.statuses) {
      const pageContext = this.apiContext.articles[status]!;
      if (pageContext.done) {
        continue;
      }

      const params: Record<string, string> = { status };
      if (this.replaceSnippets) {
        params['replaceSnippets'] = 'true';
      }

      for await (const article of this.getAllPages<KnowledgeOwlArticle>(
        'article',
        params,
        pageContext,
        EntityType.DOCUMENT,
      )) {
        // Guard against the server ignoring the status filter
        if (
          article.status &&
          article.status.toLowerCase() !== status &&
          this.statuses.includes(article.status.toLowerCase())
        ) {
          continue;
        }
        yield article;
      }
    }
  }

  public async *categoryIterator(): AsyncGenerator<
    KnowledgeOwlCategory,
    void,
    void
  > {
    if (this.apiContext.categories.done) {
      return;
    }

    for await (const category of this.getAllPages<KnowledgeOwlCategory>(
      'category',
      { status: 'active' },
      this.apiContext.categories,
      EntityType.CATEGORY,
    )) {
      if (category.status && category.status !== 'active') {
        continue;
      }
      yield category;
    }
  }

  public async *tagIterator(): AsyncGenerator<KnowledgeOwlTag, void, void> {
    if (this.apiContext.tags.done) {
      return;
    }

    for await (const tag of this.getAllPages<KnowledgeOwlTag>(
      'tag',
      { status: 'active' },
      this.apiContext.tags,
      EntityType.LABEL,
    )) {
      if (tag.status && tag.status !== 'active') {
        continue;
      }
      yield tag;
    }
  }

  private async *getAllPages<T>(
    resource: string,
    params: Record<string, string>,
    pageContext: KnowledgeOwlPageContext<T>,
    entityType: EntityType,
  ): AsyncGenerator<T, void, void> {
    const pager = new Pager<T>(pageContext.unprocessed, async () => {
      if (pageContext.done) {
        return null;
      }

      const page = pageContext.nextPage ?? 1;
      pageContext.started = true;

      const response = await this.fetchPage<T>(
        resource,
        page,
        params,
        entityType,
      );
      const nextPage = response.page_stats?.next_page ?? null;

      if (nextPage && nextPage > page) {
        pageContext.nextPage = nextPage;
      } else {
        pageContext.done = true;
        pageContext.nextPage = null;
      }

      return response.data ?? [];
    });

    yield* pager.fetch();
  }

  private async fetchPage<T>(
    resource: string,
    page: number,
    params: Record<string, string>,
    entityType: EntityType,
  ): Promise<KnowledgeOwlResponse<T>> {
    const url = new URL(`${this.baseUrl}/api/head/${resource}.json`);
    url.searchParams.set('project_id', this.kbId);
    url.searchParams.set('limit', String(this.pageSize));
    url.searchParams.set('page', String(page));
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    getLogger().debug(`Fetching KnowledgeOwl ${resource} page ${page}`);

    const headers = {
      ...(await this.authenticationProvider!.constructHeaders()),
      Accept: 'application/json',
    };

    return fetchSourceResource<KnowledgeOwlResponse<T>>(
      url.toString(),
      { headers },
      entityType,
    );
  }
}
