# KnowledgeOwl → Genesys Cloud knowledge sync: test setup

This syncs articles, categories and tags from a KnowledgeOwl knowledge base
into a Genesys Cloud knowledge base (Knowledge Workbench V2). It is built on
Genesys's open-source Knowledge Connector App, the same tool Genesys provides
for syncing Zendesk, Salesforce and ServiceNow knowledge bases.

For the first test we sync into a **new, empty test knowledge base** in your
Genesys org. Nothing in your existing knowledge bases is touched, and the test
can be removed by deleting that knowledge base and the OAuth client.

## Before the call (about 20 minutes, Genesys admin)

### 1. Create a test knowledge base
Admin > Knowledge > Knowledge Workbench > create a knowledge base named
something like `KnowledgeOwl sync test`, language **en-US**. Copy its ID from
the URL (the long string after `/knowledge/`).

### 2. Create a role for the sync
Admin > People & Permissions > Roles / Permissions > Add Role, named
`KnowledgeOwl sync`, with these permissions:

| Area | Permissions |
|---|---|
| Knowledge > Document | Upload, Delete |
| Knowledge > Export Job | Add, View, Delete |
| Knowledge > Sync Job | Add, View, Edit, Delete |
| Response Assets > Asset | Add, View, Edit, Delete |

(The Response Assets permissions are for uploading article images.)

### 3. Create an OAuth client
Admin > Integrations > OAuth > Add Client:
- Grant type: **Client Credentials**
- Roles: `KnowledgeOwl sync`, in the division that contains the test
  knowledge base
- Save, then copy the **Client ID** and **Client Secret** (the secret is shown
  once). Keep them somewhere safe; do not email them.

### 4. Pick a machine to run it on
Any laptop or server with:
- Node.js 22 or newer (`node -v` to check; https://nodejs.org)
- Git
- Internet access to `app.knowledgeowl.com` and your Genesys API host

### 5. Have ready
- Your Genesys region's login and API hosts. US East is
  `https://login.mypurecloud.com` and `https://api.mypurecloud.com`; if you
  log in at a different address, we'll use that region's hosts.
- The KnowledgeOwl API key and knowledge base ID you already created for us.

## On the call (about 30 minutes, together)

1. Clone the repository and install:
   ```
   git clone https://github.com/silly-moose/knowledge-connector-app.git
   cd knowledge-connector-app
   npm install
   npm run build
   ```
2. Create a file named `.env` in that folder:
   ```
   CONFIGURER=knowledgeowl
   KNOWLEDGEOWL_API_KEY=<your KnowledgeOwl API key>
   KNOWLEDGEOWL_KB_ID=<your KnowledgeOwl knowledge base ID>
   KNOWLEDGEOWL_SITE_URL=https://<your-kb>.knowledgeowl.com
   BUILD_EXTERNAL_URLS=true

   GENESYS_LOGIN_URL=https://login.mypurecloud.com
   GENESYS_BASE_URL=https://api.mypurecloud.com
   GENESYS_CLIENT_ID=<OAuth client ID>
   GENESYS_CLIENT_SECRET=<OAuth client secret>
   GENESYS_KNOWLEDGE_BASE_ID=<test knowledge base ID>

   EXTERNAL_ID_PREFIX=knowledgeowl-
   COMPARE_MODE=ModificationDate
   LOG_LEVEL=info
   ```
3. Preview without writing anything to Genesys:
   ```
   node dist/knowledgeowl/dry-run.js preview.json
   ```
   This prints how many articles, categories and tags were read and converted.
4. Run the sync:
   ```
   npm start
   ```
5. Open the test knowledge base in Knowledge Workbench and check a few
   articles, including ones with tables and images.

Running `npm start` again only uploads articles that changed in KnowledgeOwl
since the last run. To keep it in sync, schedule that command (for example
hourly or nightly) on the same machine.

## Rolling back
Delete the test knowledge base and the `KnowledgeOwl sync` OAuth client in
Genesys, and delete the folder on the machine. Your KnowledgeOwl content is
only ever read, never changed.
