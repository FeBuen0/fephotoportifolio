import { createAdminHandler } from '../../server/admin.mjs';

export default request => createAdminHandler()(request);
export const config = {
  path: '/api/admin/login',
  rateLimit: { windowLimit: 5, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
