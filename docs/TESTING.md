# Testing Guide

## Unit Testing

### Run Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test -- --coverage

# Run specific test file
npm run test -- src/__tests__/helpers.test.ts
```

### Write Tests

Create test file in `src/__tests__/` directory:

```typescript
// src/__tests__/example.test.ts
import { functionName } from '@/path/to/function';

describe('Function Name', () => {
  it('should do something', () => {
    const result = functionName();
    expect(result).toBe(expectedValue);
  });

  it('should handle errors', () => {
    expect(() => functionName()).toThrow();
  });
});
```

### Test Examples

```typescript
// String matching
expect(text).toBe('expected');
expect(text).toContain('substring');

// Number comparison
expect(count).toBeGreaterThan(5);
expect(value).toBeLessThan(100);
expect(result).toBe(42);

// Array/Object testing
expect(array).toHaveLength(5);
expect(object).toHaveProperty('key');
expect(array).toContain(item);

// Async tests
it('should fetch data', async () => {
  const data = await fetchData();
  expect(data).toBeDefined();
});

// Error handling
expect(() => func()).toThrow(Error);
expect(() => func()).toThrow('error message');

// Mocking
jest.mock('@/utils/auth');
import { generateToken } from '@/utils/auth';

(generateToken as jest.Mock).mockReturnValue('token');
const result = generateToken('userId', 'role');
expect(result).toBe('token');
```

---

## Integration Testing

### Testing Endpoints with Jest

```typescript
import request from 'supertest';
import app from '@/index';

describe('Auth Endpoints', () => {
  it('POST /api/auth/register should create user', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('userId');
  });

  it('POST /api/auth/login should return token', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123',
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
  });
});
```

### Setup Test Database

Create `src/__tests__/setup.ts`:

```typescript
import mongoose from 'mongoose';

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/test-db');
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});
```

---

## Manual API Testing

### Using cURL

```bash
# Register user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "John",
    "lastName": "Doe"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'

# Get Students (with token)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/students

# Create Grade
curl -X POST http://localhost:3000/api/grades \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "student": "STUDENT_ID",
    "course": "COURSE_ID",
    "marks": 85
  }'
```

### Using Postman

1. **Import Collection**
   - Create new collection for Smart School ERP
   - Add requests for each endpoint

2. **Set Environment Variables**
   ```json
   {
     "baseUrl": "http://localhost:3000/api",
     "token": ""
   }
   ```

3. **Pre-request Scripts**
   ```javascript
   // Set token after login
   pm.environment.set("token", pm.response.json().token);
   ```

4. **Tests**
   ```javascript
   pm.test("Status code is 200", function () {
     pm.response.to.have.status(200);
   });

   pm.test("Response has token", function () {
     pm.response.json().should.have.property("token");
   });
   ```

### Using Insomnia

1. Create new workspace
2. Add base URL: `http://localhost:3000/api`
3. Create request folders for each module
4. Setup authentication headers
5. Test endpoints

---

## Load Testing

### Using Apache Bench

```bash
# Install Apache Bench (ab)
# macOS: brew install httpd
# Linux: sudo apt-get install apache2-utils

# Test GET request
ab -n 1000 -c 10 http://localhost:3000/health

# Test POST request
ab -n 100 -c 5 -p data.json -T application/json \
  http://localhost:3000/api/auth/login
```

### Using Artillery

```bash
# Install
npm install -g artillery

# Create load-test.yml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 10

scenarios:
  - name: "Health Check"
    flow:
      - get:
          url: "/health"

# Run test
artillery run load-test.yml
```

### Using k6

```bash
# Install: https://k6.io/docs/getting-started/installation/

# Create test script (load-test.js)
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  vus: 10,
  duration: '30s',
};

export default function () {
  let response = http.get('http://localhost:3000/health');
  check(response, {
    'status is 200': (r) => r.status === 200,
  });
}

# Run test
k6 run load-test.js
```

---

## Performance Testing

### Measure Response Time

```typescript
import request from 'supertest';
import app from '@/index';

it('GET /students should respond in < 100ms', async () => {
  const startTime = Date.now();
  
  await request(app)
    .get('/api/students')
    .set('Authorization', `Bearer ${token}`);
  
  const endTime = Date.now();
  const responseTime = endTime - startTime;
  
  expect(responseTime).toBeLessThan(100);
});
```

---

## Security Testing

### OWASP Top 10 Tests

```typescript
// SQL Injection test (not applicable for MongoDB)
// Test: Input validation should prevent injection

// XSS test
it('should sanitize HTML in input', async () => {
  const response = await request(app)
    .post('/api/grades')
    .send({
      remarks: '<script>alert("xss")</script>',
    });
  // Should sanitize or reject
});

// CSRF test
// Verify CSRF tokens are required

// Broken Authentication test
it('should reject requests without token', async () => {
  const response = await request(app)
    .get('/api/students');
  
  expect(response.status).toBe(401);
});

// Sensitive Data Exposure test
it('should not expose passwords in response', async () => {
  const response = await request(app)
    .get('/api/students')
    .set('Authorization', `Bearer ${token}`);
  
  response.body.forEach(student => {
    expect(student).not.toHaveProperty('password');
  });
});
```

---

## Test Coverage

### View Coverage Report

```bash
npm run test -- --coverage

# Open coverage report
open coverage/lcov-report/index.html
```

### Coverage Targets

- Statements: 80%+
- Branches: 75%+
- Functions: 80%+
- Lines: 80%+

---

## Continuous Integration Testing

### GitHub Actions

Already configured in `.github/workflows/ci.yml`

Tests run automatically on:
- Push to main/develop
- Pull requests
- Schedule (optional)

### Local Pre-commit Hooks

```bash
# Install husky
npm install husky --save-dev

# Setup
npx husky install

# Add pre-commit hook
npx husky add .husky/pre-commit "npm run test && npm run lint"
```

---

## Troubleshooting Tests

### Tests Not Found

```bash
# Ensure test files follow naming convention
# Should be: *.test.ts or *.spec.ts

# Check jest configuration
npm run test -- --showConfig
```

### Timeout Issues

```typescript
// Increase timeout
jest.setTimeout(10000);

it('should handle async operation', async () => {
  // test code
}, 10000);
```

### Database Connection Issues

```bash
# Ensure MongoDB is running
mongod

# Check connection string in test setup
```

### Mock Not Working

```typescript
// Ensure mock is defined before import
jest.mock('@/utils/auth');

// Verify mock path is correct
// Verify mock is called
expect(generateToken).toHaveBeenCalled();
```

---

## Best Practices

1. **Test One Thing**: Each test should verify single behavior
2. **Descriptive Names**: Use clear test descriptions
3. **Arrange-Act-Assert**: Follow AAA pattern
4. **Mock External Calls**: Don't call real APIs/databases
5. **Setup & Teardown**: Clean up after each test
6. **Avoid Sleep**: Don't use sleep in tests
7. **Deterministic**: Tests should be predictable
8. **Independent**: Tests shouldn't depend on each other

---

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Supertest](https://github.com/visionmedia/supertest)
- [Testing Best Practices](https://testingjavascript.com/)

---

## Quick Reference

```bash
npm run test              # Run all tests
npm run test:watch       # Watch mode
npm run test -- --coverage  # With coverage
npm run test -- path/to/test.ts  # Specific file
npm run lint             # Check code quality
npm run format           # Format code
```
