# Installation Guide

## Prerequisites

- Node.js 16+ (https://nodejs.org/)
- npm 7+ or yarn
- MongoDB 4.4+ (https://www.mongodb.com/)

## Step 1: Clone the Repository

```bash
git clone https://github.com/akramdesyber6-ops/smart-school-erp.git
cd smart-school-erp
```

## Step 2: Install Dependencies

```bash
npm install
```

## Step 3: Setup Environment Variables

Copy the example environment file and update it with your configuration:

```bash
cp .env.example .env
```

Edit `.env` and set the following variables:

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/smart-school-erp
JWT_SECRET=your-secret-key-change-this
JWT_EXPIRATION=24h
CORS_ORIGIN=http://localhost:3000
```

## Step 4: Start MongoDB

### Using Docker (Recommended)

```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### Or install MongoDB locally

Visit: https://docs.mongodb.com/manual/installation/

## Step 5: Run Development Server

```bash
npm run dev
```

The server should start on `http://localhost:3000`

You should see:
```
✅ Server running on port 3000
📝 Environment: development
```

## Step 6: Verify Installation

Visit: http://localhost:3000/health

You should get:
```json
{
  "status": "OK",
  "timestamp": "2026-06-08T12:00:00.000Z"
}
```

## Development Commands

```bash
# Start development server with auto-reload
npm run dev

# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run type-check

# Build for production
npm run build

# Start production server
npm start
```

## Troubleshooting

### MongoDB Connection Error

If you get `MongoDB connection error`, make sure:
1. MongoDB is running (`mongod` command)
2. Connection string in `.env` is correct
3. MongoDB is listening on port 27017

### Port Already in Use

If port 3000 is already in use:
1. Change `PORT` in `.env`
2. Or kill the process using port 3000

### Module Not Found Errors

Run `npm install` again to ensure all dependencies are installed.

## Next Steps

- Read the [API Documentation](./API.md)
- Check out the [Contributing Guide](./CONTRIBUTING.md)
- Explore the project structure in the [README](./README.md)
