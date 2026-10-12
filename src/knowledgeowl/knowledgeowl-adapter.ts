import { AbstractSourceAdapter } from '../adapter/abstract-source-adapter.js';
import { ImageSourceAdapter } from '../adapter/image-source-adapter.js';
import { KnowledgeOwlCategory } from './model/knowledgeowl-category.js';
import { KnowledgeOwlTag } from './model/knowledgeowl-tag.js';
import { KnowledgeOwlArticle } from './model/knowledgeowl-article.js';
import { KnowledgeOwlConfig } from './model/knowledgeowl-config.js';
import { KnowledgeOwlContext } from './model/knowledgeowl-context.js';
import { KnowledgeOwlApi } from './knowledgeowl-api.js';
import { Image } from '../model/image.js';
import { ExternalLink } from '../model/external-link.js';
import { fetchImage } from '../utils/web-client.js';
import { removeTrailingSlash } from '../utils/remove-trailing-slash.js';
import { AttachmentDomainValidator } from '../processor/attachment-domain-validator/attachment-domain-validator.js';
import { AttachmentDomainNotAllowedError } from '../processor/attachment-domain-validator/attachment-domain-not-allowed-error.js';
import { getLogger } from '../utils/logger.js';

export class KnowledgeOwlAdapter
  extends AbstractSourceAdapter<
    KnowledgeOwlCategory,
    KnowledgeOwlTag,
    KnowledgeOwlArticle
  >
  implements ImageSourceAdapter
{
  private config: KnowledgeOwlConfig = {};
  private attachmentDomainValidator?: AttachmentDomainValidator;
  private api: KnowledgeOwlApi;

  constructor() {
    super();

    this.api = new KnowledgeOwlApi();
  }

  public async initialize(
    config: KnowledgeOwlConfig,
    context: KnowledgeOwlContext,
  ): Promise<void> {
    await super.initialize(config, context);

    this.config = config;
    this.attachmentDomainValidator = new AttachmentDomainValidator(config);

    await this.api.initialize(config, context);
  }

  public async *articleIterator(): AsyncGenerator<
    KnowledgeOwlArticle,
    void,
    void
  > {
    yield* this.api.articleIterator();
  }

  public async *categoryIterator(): AsyncGenerator<
    KnowledgeOwlCategory,
    void,
    void
  > {
    yield* this.api.categoryIterator();
  }

  public async *labelIterator(): AsyncGenerator<KnowledgeOwlTag, void, void> {
    yield* this.api.tagIterator();
  }

  public getDocumentLinkMatcherRegexp(): RegExp | undefined {
    return undefined;
  }

  /**
   * KnowledgeOwl serves article images from a public CDN, so the image is
   * downloaded directly from its URL.
   */
  public async getAttachment(
    articleId: string | null,
    url: string,
  ): Promise<Image | null> {
    if (!this.attachmentDomainValidator!.isDomainAllowed(url)) {
      throw new AttachmentDomainNotAllowedError(url, articleId ?? '');
    }

    try {
      return await fetchImage(url);
    } catch (error) {
      getLogger().warn(
        `Image [${url}] for article [${articleId}] could not be downloaded: ${(error as Error).message}`,
      );
      return null;
    }
  }

  public getResourceBaseUrl(): string {
    return removeTrailingSlash(
      this.config.relativeLinkBaseUrl ||
        this.config.knowledgeowlSiteUrl ||
        this.api.getInstanceUrl(),
    );
  }

  public async constructDocumentLink(
    _id: string,
  ): Promise<ExternalLink | null> {
    return null;
  }
}
