import { resolve } from "node:path";
import { AppDatabase } from "./database.js";

const databasePath = process.env.DATABASE_PATH ?? "./data/pubius.sqlite";
const backupDirectory = process.env.BACKUP_DIRECTORY ?? "./backups";
const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const destination = resolve(backupDirectory, `pubius-${timestamp}.sqlite`);
const database = new AppDatabase(databasePath);

try {
  await database.backup(destination);
  console.log(destination);
} finally {
  database.close();
}
