const request = require('supertest');
const path = require('path');
const fs = require('fs');

// Set env vars before requiring server
process.env.LOG_FILE = path.join(__dirname, 'test-access.log');
process.env.PIHOLE_COUNT = 2;
process.env.PIHOLE_1_NAME = 'Test1';
process.env.PIHOLE_1_URL = 'http://test1.com';
process.env.PIHOLE_1_PASSWORD = 'pwd1';
process.env.PIHOLE_2_NAME = 'Test2';
process.env.PIHOLE_2_URL = 'http://test2.com';
process.env.PIHOLE_2_PASSWORD = 'pwd2';

const app = require('../server');

describe('Backend API', () => {
  afterAll(() => {
    // Cleanup log file
    if (fs.existsSync(process.env.LOG_FILE)) {
      fs.unlinkSync(process.env.LOG_FILE);
    }
  });

  test('GET /health returns status healthy', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.piholes).toBe(2);
  });

  test('GET /api/piholes returns configured piholes', async () => {
    const res = await request(app).get('/api/piholes');
    expect(res.statusCode).toBe(200);
    expect(res.body.piholes).toHaveLength(2);
    expect(res.body.piholes[0].name).toBe('Test1');
    expect(res.body.piholes[0].url).toBe('http://test1.com');
  });

  test('POST /api/log writes to log file', async () => {
    const logData = {
      action: 'enable',
      piholeName: 'Test1',
      piholeUrl: 'http://test1.com'
    };

    const res = await request(app).post('/api/log').send(logData);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify file content
    const content = fs.readFileSync(process.env.LOG_FILE, 'utf8');
    expect(content).toContain('"action":"enable"');
    expect(content).toContain('"pihole":"Test1"');
  });
});
