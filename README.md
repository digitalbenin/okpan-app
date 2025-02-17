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
│   ├── backend/         # Electron main process
│   ├── db/             # Database related files
│   │   ├── schema.js   # Drizzle schema
│   │   └── init.js     # Database initialization
│   ├── lib/            # Shared components
│   └── routes/         # SvelteKit routes
├── out/                # Compiled output
└── build/             # SvelteKit build
```

## Prerequisites

1. [Node.js](https://nodejs.org/) (version 16 or higher)
2. [VSCode](https://code.visualstudio.com/) (recommended) with extensions:
   - [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
   - [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
   - [Svelte](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode)

## Setup

1. Clone and install dependencies:
   ```bash
   git clone <repository-url>
   cd db-connection-tool
   npm install
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

### Development Tools

- `npm run db:studio` - Launch Drizzle Studio to view/edit database
- `npm run db:push` - Push schema changes to database
- `npm run db:generate` - Generate migration files

## Building

Create a production build:
```bash
npm run make
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

