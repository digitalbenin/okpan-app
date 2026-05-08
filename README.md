# DB Connection Tool (Electron)

An Electron application for managing collections, built with:

- Electron
- SvelteKit
- Drizzle ORM
- SQLite (via LibSQL)
- GraphQL

## Project Structure

```
├── src/
│   ├── assets/          # Application assets
│   ├── backend/         # Electron main process code
│   ├── db/              # Database related files
│   │   ├── migrations/  # SQL migration files
│   │   ├── scripts/     # Database utility scripts
│   │   ├── schema.js    # Database schema definition
│   │   ├── seed.js      # Database seeding script
│   │   └── init.js      # Database initialization
│   ├── lib/             # Shared utilities and components
│   │   ├── components/  # UI components
│   │   ├── queries/     # GraphQL queries
│   │   ├── stores/      # Svelte stores
│   │   └── utils/       # Utility functions
│   ├── preload/         # Electron preload scripts
│   └── routes/          # SvelteKit routes
├── build/               # SvelteKit build output
└── out/                 # Electron build output
```

## Setup

1. Clone and install dependencies:

   ```bash
   git clone <repository-url>
   cd db-connection-tool
   yarn install
   yarn --cwd src/website install
   ```

   The `src/website` folder is a separate nested package with its own `package.json` and `yarn.lock`.
   Run `yarn --cwd src/website install` on a fresh checkout and whenever dependencies under `src/website` change.

2. Create a `.env` file in the project root:

   ```
   DB_FILE_NAME=src/db/local.db
   ```

3. Generate schema migrations when the schema changes:
   ```bash
   npm run db:generate
   ```

4. Start the app to apply migrations and initialize the local database.

## Development

Start the development server:

```bash
npm start
```

### Database Management

1. **Initialize the database**:

   ```bash
   npm run db:generate
   ```

   This updates the SQL migration files from the current Drizzle schema. The app applies those migrations automatically at startup.

2. **Seed the database**:

   ```bash
   npm run db:seed
   ```

   This is a development-only workflow for local authoring and sample-data preparation. It does not run during packaging or app startup.
   You can also specify a custom path for your seed data using the `--data-path` argument:

   ```bash
   npm run db:seed -- --data-path ./path/to/your/seed_data_folder
   ```

   To see help for the seed script, including the `--data-path` option:

   ```bash
   node src/db/seed_from_json.js -h
   ```

   Note that this process will create a folder of images for the project. In case you need to reset, this image folder must be deleted manually.

3. **Runtime migrations**:

   The packaged app applies schema and custom SQL migrations automatically at startup, including the FTS and change-log trigger migrations under `src/db/migrations`.

4. **Local database location**:

   In development, the default database remains `src/db/local.db` unless `DB_FILE_NAME` overrides it.
   In packaged builds, the live database is created under Electron's `userData` directory so app reinstalls and upgrades do not rely on writable files inside the application bundle.

5. **Sample project distribution**:

   The sample project should be distributed as an external `.dctx` backup artifact, not shipped inside the installer or seeded into the packaged database.
   The recommended workflow is to curate the sample project in development, export it with the standard project backup flow, and let users import it on demand through the existing restore-backup UI.

### Development Tools

- `npm run db:studio` - Launch Drizzle Studio to view/edit database

### Translations

In the `/translations` page you can manage the interface translations. The related database tables are initially empty, but you can import the `translations_export.json` inside the assets folder. This will create two interface languages (english and italian) and add some entries.

IF you add more entries you can export the file with the related button in the same page.

## Building

### Website handling

The website in `src/website` is used for two different outputs:

- the embedded preview UI loaded inside the Electron app from `src/website/build`
- the standalone static export copied from `src/website/build-export`

It is maintained as a separate nested package, so its dependencies must be installed with `yarn --cwd src/website install`.

Build the Electron app and both website production artifacts:

```bash
yarn build
```

Before running the build, make sure both dependency trees are installed:

```bash
yarn install
yarn --cwd src/website install
```

This runs:

- `yarn build:app` for the root Electron renderer build
- `yarn build:website:preview` for the embedded website UI served inside Electron from `src/website/build`
- `yarn build:website:static` for the standalone export artifact copied from `src/website/build-export`

Create the packaged production build:

```bash
yarn make
```

## Troubleshooting

### Common Issues

1. **Database not found**

   - Make sure you've created the `.env` file with the correct DB_FILE_NAME
   - Run `npm run db:push` to create the database
   - Check if the database directory exists

2. **GraphQL queries not working**

   - Use the "Show Schema" button in the app to see available queries and mutations
   - Make sure your query syntax matches the schema exactly
   - Check the developer console (F12) for detailed error messages

3. **Development server issues**
   - Make sure both dependency trees are installed with `yarn install` and `yarn --cwd src/website install`
   - If website build commands fail with missing Vite or Svelte packages, reinstall `src/website` separately
   - Try deleting both `node_modules` and `src/website/node_modules`, then reinstall
   - Check if all required ports are available
