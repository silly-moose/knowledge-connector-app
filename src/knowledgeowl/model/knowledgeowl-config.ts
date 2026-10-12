import { Config } from '../../config.js';

export interface KnowledgeOwlConfig extends Config {
  // API key generated in KnowledgeOwl (Account > API). Read access to the KB is enough.
  knowledgeowlApiKey?: string;
  // Knowledge base ID (the KnowledgeOwl "project_id")
  knowledgeowlKbId?: string;
  // API host. Default: https://app.knowledgeowl.com
  knowledgeowlBaseUrl?: string;
  // Public URL of the knowledge base, used for article links and relative URLs
  // (eg. https://support.example.com)
  knowledgeowlSiteUrl?: string;
  // Content language key inside current_version. Default: en
  knowledgeowlLanguage?: string;
  // Comma separated article statuses to sync. Default: published,review
  knowledgeowlStatuses?: string;
  // Expand {{snippet.*}} merge codes server-side. Default: true
  knowledgeowlReplaceSnippets?: string;
  // Page size for list requests (max 100). Default: 100
  knowledgeowlPageSize?: string;
  relativeLinkBaseUrl?: string;
}
