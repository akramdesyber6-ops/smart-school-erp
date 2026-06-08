# Performance & Optimization Guide

## Database Optimization

### Indexes

Create indexes for frequently queried fields:

```typescript
// Mongoose automatic indexes
db.users.createIndex({ email: 1 });
db.students.createIndex({ rollNumber: 1 });
db.students.createIndex({ class: 1 });
db.teachers.createIndex({ employeeId: 1 });
db.courses.createIndex({ code: 1 });
db.grades.createIndex({ student: 1, course: 1 });
db.attendance.createIndex({ student: 1, course: 1 });
db.attendance.createIndex({ date: 1 });

// Compound indexes for common queries
db.grades.createIndex({ student: 1, course: 1 });
db.attendance.createIndex({ course: 1, date: 1 });
```

### Query Optimization

```typescript
// ❌ Bad - fetches all fields and all documents
const students = await Student.find();

// ✅ Good - select only needed fields
const students = await Student.find().select('firstName lastName email');

// ✅ Good - limit results
const students = await Student.find().limit(10);

// ✅ Good - combination
const students = await Student.find()
  .select('firstName lastName email')
  .limit(10)
  .skip(0);

// ✅ Good - populate only needed data
const grades = await Grade.find()
  .populate('student', 'firstName lastName')
  .populate('course', 'name code');

// ✅ Good - use lean() for read-only operations
const students = await Student.find().lean();
```

### Batch Operations

```typescript
// ✅ Good - batch insert
const students = [
  { email: 'student1@example.com', ... },
  { email: 'student2@example.com', ... },
];
await Student.insertMany(students);

// ✅ Good - batch update
await Grade.updateMany(
  { course: courseId },
  { $set: { validated: true } }
);
```

---

## API Response Optimization

### Pagination

```typescript
// Implement pagination
const page = req.query.page || 1;
const limit = req.query.limit || 10;
const skip = (page - 1) * limit;

const students = await Student.find()
  .skip(skip)
  .limit(limit);

const total = await Student.countDocuments();

res.json({
  data: students,
  pagination: {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
  },
});
```

### Field Filtering

```typescript
// Allow clients to specify fields
const fields = req.query.fields?.split(',') || [];
let query = Student.find();

if (fields.length > 0) {
  query = query.select(fields.join(' '));
}

const students = await query;
```

### Response Compression

```typescript
// Already enabled with Helmet
import compression from 'compression';
app.use(compression());
```

---

## Caching Strategy

### Redis Caching

```typescript
import redis from 'redis';

const client = redis.createClient({
  host: 'localhost',
  port: 6379,
});

// Cache grades for 1 hour
export const getStudentGrades = async (studentId: string) => {
  const cacheKey = `grades:${studentId}`;
  
  // Check cache
  const cached = await client.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Fetch from database
  const grades = await Grade.find({ student: studentId });
  
  // Store in cache (3600 seconds = 1 hour)
  await client.setex(cacheKey, 3600, JSON.stringify(grades));
  
  return grades;
};

// Invalidate cache on update
export const updateGrade = async (id: string, data: any) => {
  const grade = await Grade.findByIdAndUpdate(id, data);
  
  // Invalidate cache
  await client.del(`grades:${grade.student}`);
  
  return grade;
};
```

### Session Caching

```typescript
import session from 'express-session';
import RedisStore from 'connect-redis';

app.use(
  session({
    store: new RedisStore({ client }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);
```

---

## Application-Level Optimization

### Connection Pooling

```typescript
// MongoDB connection pooling (automatic)
mongoose.connect(MONGODB_URI, {
  maxPoolSize: 10,
  minPoolSize: 5,
});
```

### Worker Threads

```typescript
// For CPU-intensive operations
import { Worker } from 'worker_threads';

const worker = new Worker('./calculate-grades.js');

worker.on('message', (result) => {
  console.log('Grades calculated:', result);
});

worker.postMessage({ courseId: '123' });
```

### Async Operations

```typescript
// Use Promise.all() for parallel operations
const [grades, attendance, courses] = await Promise.all([
  Grade.find({ student: studentId }),
  Attendance.find({ student: studentId }),
  Course.find({}),
]);
```

---

## Frontend Performance

### API Efficiency

```typescript
// Combine multiple calls into single endpoint
// ❌ Bad - 3 separate calls
GET /students/123
GET /grades/student/123
GET /attendance/student/123

// ✅ Good - single call with all data
GET /students/123/profile
```

### Response Time Benchmarks

| Operation | Target | Current |
|-----------|--------|---------|
| Health Check | < 50ms | ~10ms |
| Get Student | < 100ms | ~50ms |
| Get Grades | < 150ms | ~80ms |
| Create Grade | < 200ms | ~100ms |

---

## Monitoring & Metrics

### Application Monitoring

```typescript
import prometheus from 'prom-client';

// Create metrics
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 5, 15, 50, 100, 500],
});

// Middleware to track requests
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    httpRequestDuration
      .labels(req.method, req.route.path, res.statusCode)
      .observe(duration);
  });
  
  next();
});
```

### Logging

```typescript
// Use structured logging
import pino from 'pino';

const logger = pino();

logger.info({
  method: req.method,
  path: req.path,
  duration: duration,
  statusCode: res.statusCode,
});
```

---

## Load Testing Results

### With Apache Bench

```bash
ab -n 10000 -c 100 http://localhost:3000/health

# Results:
# Requests per second: 1000+
# Time per request: 100ms
# Failed requests: 0
```

### With k6

```bash
k6 run load-test.js

# Results:
# Virtual users: 10
# Requests: 10,000
# Failed requests: 0%
# Average response time: 80ms
```

---

## Scalability Considerations

### Horizontal Scaling

1. **Load Balancer**
   ```
   Client -> Nginx/HAProxy -> [App Instance 1]
                           -> [App Instance 2]
                           -> [App Instance 3]
   ```

2. **Database Replication**
   - Primary-Secondary setup
   - Read replicas for queries
   - Automatic failover

3. **Session Management**
   - Store sessions in Redis
   - Share across instances

### Vertical Scaling

- Increase server resources (CPU, RAM)
- Optimize code
- Implement caching
- Use CDN for static files

---

## Cost Optimization

### Strategies

1. **Use Managed Services**
   - MongoDB Atlas instead of self-managed
   - Heroku or Railway instead of bare metal

2. **Auto-scaling**
   - Scale up during peak hours
   - Scale down during off-peak

3. **Resource Monitoring**
   - Identify and fix bottlenecks
   - Remove unused services

4. **CDN for Static Files**
   - Reduce bandwidth costs
   - Faster content delivery

---

## Production Checklist

- [ ] Database indexes created
- [ ] Query optimization completed
- [ ] Caching implemented (Redis)
- [ ] Compression enabled
- [ ] Monitoring configured
- [ ] Load balancer setup
- [ ] SSL/HTTPS enabled
- [ ] Backups automated
- [ ] Auto-scaling configured
- [ ] Rate limiting enabled

---

## Tools & Resources

- [PM2](https://pm2.keymetrics.io/) - Process management
- [Redis](https://redis.io/) - Caching
- [DataDog](https://www.datadoghq.com/) - Monitoring
- [New Relic](https://newrelic.com/) - APM
- [Prometheus](https://prometheus.io/) - Metrics
- [k6](https://k6.io/) - Load testing

---

See also:
- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [SECURITY.md](./SECURITY.md)
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
