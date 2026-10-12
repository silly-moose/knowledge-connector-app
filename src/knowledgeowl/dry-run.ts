/**
 * Dry run: load a KnowledgeOwl knowledge base, convert it to Genesys Cloud
 * knowledge document blocks and write the result to a JSON file.
 * No Genesys Cloud credentials are needed.
 *
 * Usage: KNOWLEDGEOWL_API_KEY=... KNOWLEDGEOWL_KB_ID=... node dist/knowledgeowl/dry-run.js [output.json]
 */
import winston from 'winston';
import { writeFileSync } from 'node:fs';
import { parseConfig } from '../utils/config-parser.js';
import { setLogger } from '../utils/logger.js';
import { KnowledgeOwlAdapter } from './knowledgeowl-adapter.js';
import { KnowledgeOwlLoader } from './knowledgeowl-loader.js';
import { KnowledgeOwlContext } from './model/knowledgeowl-context.js';
import { HtmlTransformer } from '../processor/html-transformer/html-transformer.js';
import { Adapter } from '../adapter/adapter.js';
import { PipeContext } from '../pipe/pipe-context.js';
import { Category } from '../model/category.js';
import { Label } from '../model/label.js';
import { Document } from '../model/document.js';

interface Failure {
  externalId: string | null;
  title: string | undefined;
  error: string;
}

function countBlockTypes(value: unknown, counts: Record<string, number>): void {
  if (Array.isArray(value)) {
    value.forEach((item) => countBlockTypes(item, counts));
    return;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record['type'] === 'string') {
      counts[record['type']] = (counts[record['type']] ?? 0) + 1;
    }
    Object.values(record).forEach((child) => countBlockTypes(child, counts));
  }
}

async function main(): Promise<void> {
  // Set an info-level logger before parsing config: the config parser logs the
  // whole environment (including secrets) at debug level.
  setLogger(
    winston.createLogger({
      transports: [new winston.transports.Console()],
      level: 'info',
    }),
  );
  const config = parseConfig();
  setLogger(
    winston.createLogger({
      transports: [new winston.transports.Console()],
      level: config['logLevel']?.toLowerCase() ?? 'info',
    }),
  );

  const outputFile = process.argv[2] ?? 'knowledgeowl-dry-run.json';

  const context = {
    adapter: { unprocessedItems: { categories: [], labels: [], articles: [] } },
    categoryLookupTable: {},
    labelLookupTable: {},
    articleLookupTable: {},
  } as unknown as KnowledgeOwlContext;

  const adapter = new KnowledgeOwlAdapter();
  await adapter.initialize(config, context);

  const adapters = {
    sourceAdapter: adapter,
    destinationAdapter: {} as Adapter,
  };
  const loader = new KnowledgeOwlLoader();
  await loader.initialize(config, adapters, context);

  const htmlTransformer = new HtmlTransformer();
  await htmlTransformer.initialize(
    config,
    adapters,
    context as unknown as PipeContext,
  );

  const categories: Category[] = [];
  for await (const category of loader.categoryIterator()) {
    categories.push(category);
  }

  const labels: Label[] = [];
  for await (const label of loader.labelIterator()) {
    labels.push(label);
  }

  const documents: Document[] = [];
  const failures: Failure[] = [];
  const blockTypes: Record<string, number> = {};
  let documentsWithTables = 0;
  let documentsWithImages = 0;
  let emptyDocuments = 0;

  for await (const document of loader.documentIterator()) {
    const title = document.published?.title ?? document.draft?.title;
    try {
      await htmlTransformer.runOnDocument(document);
    } catch (error) {
      failures.push({
        externalId: document.externalId,
        title,
        error: (error as Error).message,
      });
      continue;
    }

    const counts: Record<string, number> = {};
    countBlockTypes(document, counts);
    for (const [type, count] of Object.entries(counts)) {
      blockTypes[type] = (blockTypes[type] ?? 0) + count;
    }
    if (counts['Table']) {
      documentsWithTables++;
    }
    if (counts['Image']) {
      documentsWithImages++;
    }
    const blocks =
      document.published?.variations?.[0]?.body?.blocks ??
      document.draft?.variations?.[0]?.body?.blocks ??
      [];
    if (blocks.length === 0) {
      emptyDocuments++;
    }

    documents.push(document);
  }

  const summary = {
    categories: categories.length,
    labels: labels.length,
    documents: documents.length,
    documentsWithCategory: documents.filter(
      (d) => (d.published ?? d.draft)?.category,
    ).length,
    documentsWithLabels: documents.filter(
      (d) => ((d.published ?? d.draft)?.labels?.length ?? 0) > 0,
    ).length,
    documentsWithTables,
    documentsWithImages,
    emptyDocuments,
    conversionFailures: failures.length,
    blockTypes,
  };

  writeFileSync(
    outputFile,
    JSON.stringify({ summary, failures, categories, labels, documents }, null, 2),
  );

  console.log(JSON.stringify(summary, null, 2));
  if (failures.length > 0) {
    console.log('Conversion failures:');
    failures.forEach((f) => console.log(` - ${f.title} [${f.externalId}]: ${f.error}`));
  }
  console.log(`Full output written to ${outputFile}`);
}

main().catch((error) => {
  console.error('Dry run failed.', error);
  process.exitCode = 1;
});
