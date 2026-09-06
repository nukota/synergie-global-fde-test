import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import dataSource from '../database/data-source';
import { databasePath } from '../database/database.options';

async function run(): Promise<void> {
  await mkdir(dirname(databasePath), { recursive: true });
  await dataSource.initialize();
  const migrations = await dataSource.runMigrations();
  console.log(`Applied ${migrations.length} migration(s) to ${databasePath}.`);
  await dataSource.destroy();
}

void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
