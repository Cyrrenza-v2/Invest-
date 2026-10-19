import request from 'supertest';
import server from '../server';

describe('Smoke Tests', () => {
  afterAll(() => {
    server.close();
  });

  it('should return health check', async () => {
    const response = await request(server).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('OK');
  });

  it('should fail to login without credentials', async () => {
    const response = await request(server)
      .post('/api/v1/auth/login')
      .send({});
    expect(response.status).toBe(400);
  });

  it('should register a new user', async () => {
    const response = await request(server)
      .post('/api/v1/auth/register')
      .send({
        email: `test-${Date.now()}@example.com`,
        password: 'testpass123',
        name: 'Test User',
        phone: '1234567890',
      });
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });
});
