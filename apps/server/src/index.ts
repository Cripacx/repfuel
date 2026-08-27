import { loadConfig } from './config.js';
import { createDb } from './core/db.js';
import { createRedis } from './core/redis.js';
import { runMigrations } from './db/migrate.js';
import { buildApp } from './app.js';

async function main() {
  const config = loadConfig();

  await runMigrations(config.DATABASE_URL);

  const { db, client } = createDb(config.DATABASE_URL);
  const redis = createRedis(config.REDIS_URL);
  const app = await buildApp(config, { db, redis });

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
    await client.end();
    redis.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ host: config.HOST, port: config.PORT });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
