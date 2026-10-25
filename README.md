# Daymark

Daymark is a personal habit tracker that runs on your computer. Create routines, choose when they are due, and keep a history of your check-ins. Your data stays in a SQLite database inside the project folder; Daymark does not need an account or a cloud service.

## What you can do

- Create habits with a name, icon, color, category, and a daily goal.
- Set daily, weekly, or monthly schedules. Choose specific weekdays or dates, and set a start date and an optional end date or check-in count.
- Record a check-in from the Today page, including multiple steps toward a goal.
- Browse and filter your habit library, edit routines, or archive them while keeping their history.
- Review completion rates, streaks, check-in history, and the annual activity view on the Stats page.
- Adjust the theme, week start, reminders, dashboard details, categories, and other preferences in Settings.
- Export your app data as JSON, create and restore SQLite backups, or import a previous JSON export.

## Requirements

- Node.js 22.13 or newer
- npm (included with Node.js)

Daymark uses Node's built-in SQLite support, so it does not need a separate database installation.

## Get started

Open a terminal in the Daymark project folder and run:

```sh
npm install
npm run dev
```

Open the local address printed by Vite. By default, the app is at [http://127.0.0.1:3100](http://127.0.0.1:3100). The development process also starts the local SQLite API, normally on port `3101`.

To stop the development servers, press `Ctrl+C` in the terminal.

## Everyday commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the Vite development server and the local data API. |
| `npm run build` | Checks TypeScript and creates the production frontend and backend build. |
| `npm start` | Runs the production app. Build it first with `npm run build`. |
| `npm test` | Runs the automated tests for schedules, the database, and the API. |
| `npm run typecheck` | Checks the frontend, backend, and test TypeScript without emitting files. |
| `npm run verify` | Runs type checks, tests, and a production build. |

For a production run:

```sh
npm run build
npm start
```

The production app is available at [http://127.0.0.1:3000](http://127.0.0.1:3000) by default. Stop it with `Ctrl+C`.

## Ports

The development web app uses port `3100` and its data API normally uses `3101`. The production app uses port `3000`. If you need different ports, set `PORT` and, during development, `API_PORT` before starting Daymark:

```sh
PORT=3200 API_PORT=3201 npm run dev
```

For production, only `PORT` is needed:

```sh
PORT=3200 npm start
```

The development launcher can choose a free API port if its configured API port is already occupied. Keep the app and API on your own computer: the default server address is `127.0.0.1`.

## Where your data lives

Daymark creates and initializes its SQLite database automatically:

```text
data/database.sqlite    Main database
data/backups/           SQLite snapshots managed by Daymark
```

The database contains your habits, schedules, categories, check-in history, and preferences. The `dist/` folder contains generated production files; it is not where your data is stored.

### Back up and move Daymark

In Settings, you can download a JSON export or create a SQLite backup. JSON is convenient for moving your app state between installs. A SQLite backup is a snapshot of the database. Daymark also creates a database backup before importing an export or restoring a snapshot.

To move Daymark to another computer:

1. Stop the app.
2. Copy the project folder, including `data/database.sqlite`.
3. On the new computer, install Node.js 22.13 or newer, open a terminal in the copied folder, and run `npm install`.
4. Start the app with `npm run dev` or build and run it with `npm run build` and `npm start`.

Copy `data/backups/` too if you want to bring Daymark's saved SQLite snapshots. Keep another copy of important backups somewhere outside the project folder. The database and backup files are not encrypted by Daymark, so protect them like other personal files on your computer.

The **Wipe all data** control in Settings permanently deletes the app's saved data and Daymark-managed SQLite backups. It does not delete JSON exports or copies you saved elsewhere.

## Project layout

```text
Daymark/
├── data/                  Local SQLite database and its backups
├── public/                Static files, including the favicon
├── server/                Node.js API, database, and development launcher
├── shared/                Schedule logic shared by the app and server
├── src/                   React app, TypeScript entry point, and CSS
├── tests/                 Schedule, database, and API tests
├── dist/                  Generated production files (created by the build)
├── index.html             Browser entry point
├── package.json           Dependencies and npm commands
├── tsconfig*.json         TypeScript settings
└── vite.config.ts         Vite and Tailwind CSS v4 configuration
```

The browser interface is a React 19 single-page app written in TypeScript. Vite serves it during development and builds the production frontend. A small Node.js server handles local API requests and SQLite storage. Tailwind CSS v4 is available through the Vite plugin, with the app's visual styles in `src/index.css`.

## Troubleshooting

**A port is already in use.** Choose another `PORT` (and `API_PORT` for development) as shown above. If the development API port is occupied, the launcher will try a free local port automatically.

**The production app says the build is missing.** Run `npm run build`, then run `npm start` again.

**A browser reminder does not appear.** Allow notifications for the browser and device, and check that reminders are enabled in Settings. Browsers and operating systems control when notifications are delivered.

**The app opens without my old data after moving it.** Check that `data/database.sqlite` was copied to the project root. The database must stay in `data/`; a database inside `dist/` will not be used.

