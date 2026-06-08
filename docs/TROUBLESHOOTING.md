# Troubleshooting Guide

## Common Issues and Solutions

### 1. MongoDB Connection Issues

#### Error: `connect ECONNREFUSED 127.0.0.1:27017`

**Cause**: MongoDB is not running

**Solutions**:
```bash
# Start MongoDB (macOS with Homebrew)
brew services start mongodb-community

# Start MongoDB (Linux)
sudo systemctl start mongod

# Start MongoDB (Docker)
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Verify MongoDB is running
mongo --version
```

#### Error: `MongooseError: Invalid connection string`

**Cause**: Wrong MongoDB URI in `.env`

**Solution**: Check your `.env` file:
```env
# Format: mongodb://username:password@host:port/database
MONGODB_URI=mongodb://localhost:27017/smart-school-erp
```

---

### 2. Port Already in Use

#### Error: `listen EADDRINUSE: address already in use :::3000`

**Cause**: Another application is using port 3000

**Solutions**:
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or change port in .env
PORT=3001
```

---

### 3. Module Not Found Errors

#### Error: `Cannot find module '@/...'`

**Cause**: Module path alias not configured or package not installed

**Solutions**:
```bash
# Verify tsconfig.json has paths configured
# Should have:
# "paths": { "@/*": ["./src/*"] }

# Reinstall dependencies
npm install

# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

---

### 4. Environment Variables

#### Error: `Cannot find environment variable`

**Solution**: Create `.env` file from template:
```bash
cp .env.example .env

# Edit .env with your values
# Verify all required variables are set
```

**Required Variables**:
- `PORT` - Server port
- `NODE_ENV` - development/production
- `MONGODB_URI` - Database URL
- `JWT_SECRET` - JWT signing key
- `CORS_ORIGIN` - Frontend URL

---

### 5. TypeScript Compilation Errors

#### Error: `Property 'xyz' does not exist on type`

**Cause**: Type mismatch or missing type definition

**Solution**:
```typescript
// Make sure to define types properly
interface IUser {
  id: string;
  email: string;
}

// Use proper typing
const user: IUser = {
  id: '123',
  email: 'user@example.com'
};
```

#### Error: `TS2688: Cannot find type definition`

**Solution**: Install missing types:
```bash
npm install --save-dev @types/node @types/express @types/mongoose
```

---

### 6. Authentication Issues

#### Error: `Invalid token` or `No token provided`

**Cause**: Missing or invalid JWT token

**Solution**: 
```bash
# Get token first by logging in
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Use token in subsequent requests
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/students
```

#### Error: `Insufficient permissions`

**Cause**: User role doesn't have access to endpoint

**Solution**: Check user role and endpoint requirements in `CONTRIBUTING.md`

---

### 7. Test Failures

#### Tests not running

**Solution**:
```bash
# Check Jest configuration
npm run test -- --version

# Run with verbose output
npm run test -- --verbose

# Run specific test file
npm run test -- src/__tests__/helpers.test.ts
```

#### Timeout exceeded in jest

**Solution**: Increase timeout:
```typescript
jest.setTimeout(10000); // 10 seconds

it('should do something', async () => {
  // test code
}, 10000); // or set here
```

---

### 8. Linting Issues

#### ESLint errors not showing

**Solution**:
```bash
# Check ESLint configuration
npm run lint -- --debug

# Fix all fixable errors
npm run lint:fix

# Format with Prettier
npm run format
```

---

### 9. Git Issues

#### Error: `Permission denied (publickey)`

**Cause**: SSH key not configured

**Solution**:
```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "your-email@example.com"

# Add to GitHub (Settings > SSH and GPG keys)

# Test connection
ssh -T git@github.com
```

#### Error: `You are not authorized to push`

**Solution**: Set upstream and push:
```bash
git branch --set-upstream-to=origin/main main
git push
```

---

### 10. Performance Issues

#### Slow API responses

**Solutions**:
1. Check database indexes
2. Add caching (Redis)
3. Optimize queries
4. Use pagination

```typescript
// Add pagination
const page = req.query.page || 1;
const limit = req.query.limit || 10;
const students = await Student.find()
  .skip((page - 1) * limit)
  .limit(limit);
```

---

### 11. Memory Issues

#### `JavaScript heap out of memory`

**Solutions**:
```bash
# Increase Node memory limit
NODE_OPTIONS=--max-old-space-size=4096 npm run build

# Or set in .env
export NODE_OPTIONS=--max-old-space-size=4096
```

---

### 12. CORS Issues

#### Error: `Access to XMLHttpRequest blocked by CORS policy`

**Cause**: CORS_ORIGIN not set correctly

**Solution**: Update `.env`:
```env
# Allow specific origin
CORS_ORIGIN=http://localhost:3000

# Or allow all (development only)
CORS_ORIGIN=*
```

---

## Getting Help

If you can't find a solution:

1. **Check Documentation**: 
   - [API.md](./API.md)
   - [DEVELOPMENT.md](./DEVELOPMENT.md)
   - [INSTALL.md](./INSTALL.md)

2. **Search Issues**: Look for similar problems in GitHub issues

3. **Create Issue**: [Open a new issue](https://github.com/akramdesyber6-ops/smart-school-erp/issues/new)

4. **Ask Community**: Start a discussion

---

## Quick Checklist

Before reporting an issue, verify:

- [ ] Node.js 16+ installed
- [ ] MongoDB running and accessible
- [ ] `.env` file configured with all variables
- [ ] Dependencies installed (`npm install`)
- [ ] No conflicting ports
- [ ] Latest code from `main` branch
- [ ] Ran `npm run lint:fix` and `npm run test`

---

## Still Need Help?

Contact: support@smartschoolerp.com
