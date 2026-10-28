import { createAdminHandler } from '../../server/admin.mjs';

export default request => createAdminHandler()(request);
export const config = {
  path: ['/api/admin/session', '/api/admin/logout', '/api/admin/cms'],
  rateLimit: { windowLimit: 200, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
