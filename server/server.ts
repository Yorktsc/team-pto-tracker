import { createApp, server, analytics } from '@databricks/appkit';

createApp({
  plugins: [server(), analytics()],
}).catch(console.error);
