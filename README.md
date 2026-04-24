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
   ```

2. Create a `.env` file in the project root:

   ```
   DB_FILE_NAME=src/db/local.db
   ```

3. Initialize the database:
   ```bash
   npm run db:push
   ```

## Development

Start the development server:

```bash
npm start
```

### Database Management

1. **Initialize the database**:

   ```bash
   npm run db:push
   ```

   This creates the database with the schema defined in your project.

2. **Seed the database**:

   ```bash
   npm run db:seed
   ```

   This populates the database with initial data from the default location (`src/db/seed_data`).
   You can also specify a custom path for your seed data using the `--data-path` argument:

   ```bash
   npm run db:seed -- --data-path ./path/to/your/seed_data_folder
   ```

   To see help for the seed script, including the `--data-path` option:

   ```bash
   node src/db/seed_from_json.js -h
   ```

   Note that this process will create a folder of images for the project. In case you need to reset, this image folder must be deleted manually.

3. **Set up search functionality**:

   ```bash
   npm run db:search-setup
   ```

   This creates and configures the full-text search index for institutions, including setting up the required tables, triggers, and populating the search index with institution data and translations.

4. **Complete database setup (all-in-one)**:
   ```bash
   npm run db:setup-all
   ```
   This unified command runs all three steps above in sequence (push schema, seed data, and setup search).

### Development Tools

- `npm run db:studio` - Launch Drizzle Studio to view/edit database

### Translations

In the `/translations` page you can manage the interface translations. The related database tables are initially empty, but you can import the `translations_export.json` inside the assets folder. This will create two interface languages (english and italian) and add some entries.

IF you add more entries you can export the file with the related button in the same page.

## Building

Build the Electron app and both website production artifacts:

```bash
yarn build
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
   - Make sure all dependencies are installed with `npm install`
   - Try deleting the `node_modules` folder and running `npm install` again
   - Check if all required ports are available
