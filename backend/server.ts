import { loadEnv } from './src/config/env';
import { createApp } from './app';

const env = loadEnv();
const app = createApp(env);

app.listen(env.PORT, () => {
  console.log(`iterlaw-api listening on http://localhost:${env.PORT}`);
});
