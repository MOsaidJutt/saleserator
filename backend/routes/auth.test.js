const request = require('supertest');
const app = require('../app');

describe('Auth Routes', () => {
  describe('POST /auth/login', () => {
    it('should return 400 if email is missing', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ password: 'test123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should return 400 if password is missing', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(400);
    });

    it('should return 401 for invalid credentials', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'fake@example.com',
          password: 'wrongpassword'
        });

      expect(res.status).toBe(401);
    });
  });
});