import { loadEnv } from './src/config/env';
import { createApp } from './app';
import { startBackgroundJobs } from './src/index';

const env = loadEnv();
const app = createApp(env);
startBackgroundJobs();

app.listen(env.PORT, () => {
  console.log(`iterlaw-api listening on http://localhost:${env.PORT}`);
});
