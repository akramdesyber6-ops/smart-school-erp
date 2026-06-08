# Advanced Monitoring Guide

## Application Monitoring with PM2

### Installation

```bash
npm install -g pm2
npm install --save-dev pm2
```

### PM2 Configuration

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'smart-school-erp',
      script: './dist/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      watch: false,
      ignore_watch: ['node_modules', 'logs'],
      max_memory_restart: '500M',
      error_file: 'logs/error.log',
      out_file: 'logs/out.log',
      log_file: 'logs/combined.log',
      time_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_restarts: 10,
      min_uptime: '10s',
      autorestart: true,
    },
  ],
};
```

### PM2 Commands

```bash
# Start application
pm2 start ecosystem.config.js

# Monitor in real-time
pm2 monit

# View logs
pm2 logs smart-school-erp

# View process info
pm2 show smart-school-erp

# Restart application
pm2 restart smart-school-erp

# Stop application
pm2 stop smart-school-erp

# Delete from PM2
pm2 delete smart-school-erp

# Setup auto-restart on system boot
pm2 startup

# Save process list
pm2 save
```

---

## Logging Strategy

### Structured Logging with Pino

```bash
npm install pino pino-pretty
```

Create `src/utils/logger.ts`:

```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  },
});

export default logger;
```

### Using Logger in Controllers

```typescript
import logger from '@/utils/logger';

export const getStudents = async (req: Request, res: Response) => {
  try {
    logger.info({ route: '/api/students', method: 'GET' }, 'Fetching students');
    
    const students = await Student.find();
    
    logger.info(
      { count: students.length },
      'Successfully fetched students'
    );
    
    res.json(students);
  } catch (error) {
    logger.error({ error }, 'Failed to fetch students');
    res.status(500).json({ error: 'Failed to fetch students' });
  }
};
```

---

## Error Tracking with Sentry

### Installation

```bash
npm install @sentry/node @sentry/tracing
```

### Setup

Create `src/config/sentry.ts`:

```typescript
import * as Sentry from '@sentry/node';
import * as Tracing from '@sentry/tracing';
import { Express } from 'express';

export const initSentry = (app: Express) => {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 1.0,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Tracing.Express({ app }),
    ],
  });

  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
};

export const captureException = (error: any) => {
  Sentry.captureException(error);
};
```

### Integration in index.ts

```typescript
import { initSentry } from '@/config/sentry';

initSentry(app);

// After routes
app.use(Sentry.Handlers.errorHandler());
```

---

## Metrics with Prometheus

### Installation

```bash
npm install prom-client
```

### Setup

Create `src/config/metrics.ts`:

```typescript
import { register, Counter, Histogram, Gauge } from 'prom-client';

// HTTP request metrics
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 5, 15, 50, 100, 500],
});

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

// Database metrics
export const dbOperationDuration = new Histogram({
  name: 'db_operation_duration_ms',
  help: 'Duration of database operations',
  labelNames: ['operation', 'collection'],
  buckets: [1, 5, 10, 50, 100, 500],
});

export const dbConnectionsActive = new Gauge({
  name: 'db_connections_active',
  help: 'Active database connections',
});

// Business metrics
export const studentCount = new Gauge({
  name: 'students_total',
  help: 'Total number of students',
});

export const teacherCount = new Gauge({
  name: 'teachers_total',
  help: 'Total number of teachers',
});

// Metrics endpoint
export const metricsEndpoint = '/metrics';
export const metricsHandler = (req: any, res: any) => {
  res.set('Content-Type', register.contentType);
  res.end(register.metrics());
};
```

### Middleware for Request Metrics

```typescript
import { httpRequestDuration, httpRequestsTotal } from '@/config/metrics';

export const metricsMiddleware = (req: any, res: any, next: any) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const route = req.route?.path || req.path;
    
    httpRequestDuration
      .labels(req.method, route, res.statusCode)
      .observe(duration);
    
    httpRequestsTotal
      .labels(req.method, route, res.statusCode)
      .inc();
  });
  
  next();
};
```

### Integrate in index.ts

```typescript
import { metricsMiddleware, metricsEndpoint, metricsHandler } from '@/config/metrics';

app.use(metricsMiddleware);
app.get(metricsEndpoint, metricsHandler);
```

---

## Monitoring Dashboard

### Grafana + Prometheus

#### docker-compose.yml

```yaml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
    depends_on:
      - prometheus

volumes:
  prometheus_data:
  grafana_data:
```

#### prometheus.yml

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'smart-school-erp'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

---

## Health Checks

### Comprehensive Health Check

Create `src/routes/healthRoutes.ts`:

```typescript
import { Router } from 'express';
import mongoose from 'mongoose';

const router = Router();

router.get('/health', async (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: 'pending',
      memory: 'OK',
    },
  };

  // Check database
  try {
    await mongoose.connection.db?.admin().ping();
    health.checks.database = 'OK';
  } catch (error) {
    health.checks.database = 'FAILED';
    health.status = 'DEGRADED';
  }

  // Check memory
  const memUsage = process.memoryUsage();
  const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  
  if (heapUsedPercent > 90) {
    health.checks.memory = 'CRITICAL';
    health.status = 'UNHEALTHY';
  } else if (heapUsedPercent > 75) {
    health.checks.memory = 'WARNING';
    health.status = 'DEGRADED';
  }

  const statusCode = health.status === 'OK' ? 200 : 
                     health.status === 'DEGRADED' ? 503 : 500;

  res.status(statusCode).json(health);
});

router.get('/health/ready', (req, res) => {
  // Readiness check - quick check if service can handle requests
  res.json({ ready: true });
});

router.get('/health/live', (req, res) => {
  // Liveness check - confirms service is running
  res.json({ alive: true });
});

export default router;
```

---

## Alerting

### Email Alerts with NodeMailer

```bash
npm install nodemailer
```

Create `src/services/alertService.ts`:

```typescript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.ALERT_EMAIL,
    pass: process.env.ALERT_PASSWORD,
  },
});

export const sendAlert = async (subject: string, message: string) => {
  try {
    await transporter.sendMail({
      from: process.env.ALERT_EMAIL,
      to: process.env.ADMIN_EMAIL,
      subject: `[ALERT] ${subject}`,
      text: message,
    });
  } catch (error) {
    console.error('Failed to send alert:', error);
  }
};

// Usage
export const monitorHealth = async () => {
  const memUsage = process.memoryUsage();
  const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

  if (heapUsedPercent > 90) {
    await sendAlert('High Memory Usage', `Memory usage: ${heapUsedPercent.toFixed(2)}%`);
  }
};
```

---

## Distributed Tracing

### OpenTelemetry Setup

```bash
npm install @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/instrumentation-express @opentelemetry/instrumentation-http
```

---

## Monitoring Checklist

- [ ] PM2 process manager configured
- [ ] Structured logging implemented
- [ ] Error tracking (Sentry) setup
- [ ] Metrics collection (Prometheus)
- [ ] Monitoring dashboard (Grafana)
- [ ] Health check endpoints
- [ ] Alerting system
- [ ] Log aggregation
- [ ] Performance monitoring
- [ ] Resource monitoring

---

## Best Practices

1. **Centralize Logs** - Use log aggregation service
2. **Set Alerts** - Alert on critical metrics
3. **Monitor Trends** - Track performance over time
4. **Test Alerts** - Verify alert system works
5. **Regular Reviews** - Review metrics regularly
6. **Capacity Planning** - Plan for growth
7. **Incident Response** - Have runbooks ready
8. **Document Dashboards** - Explain what to look for

---

See also:
- [PERFORMANCE.md](./PERFORMANCE.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
