# Smart School ERP - Production-Ready Multi-Tenant SaaS

A comprehensive School Enterprise Resource Planning (ERP) platform designed for schools across Uganda and East Africa.

## 🎯 Project Overview

Smart School ERP is a modern, scalable multi-tenant SaaS platform that enables schools to manage:
- Student lifecycle (registration, profiles, class assignment)
- Teacher management and subject assignment
- Academic structure (classes, streams, subjects, years, terms)
- Daily attendance tracking and reporting
- Exam creation, marks entry, auto-grading, and report cards
- Fee management (structures, payments, balances, receipts)
- Super admin dashboard with analytics

## 🏗️ Tech Stack

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Forms**: React Hook Form + Zod
- **State Management**: Zustand
- **Charts**: Recharts
- **Icons**: Lucide React

### Backend
- **Database**: Supabase PostgreSQL
- **Authentication**: Supabase Auth
- **File Storage**: Supabase Storage
- **Security**: Row Level Security (RLS) on every table

## 🔐 Architecture

### Multi-Tenant Design
- Every business table includes `school_id` for data isolation
- Row Level Security (RLS) enforces data isolation at the database level
- Schools cannot access another school's data

### User Roles
1. **SUPER_ADMIN** - Platform administrators
2. **SCHOOL_ADMIN** - School administrators
3. **TEACHER** - Teaching staff
4. **BURSAR** - Finance staff
5. **STUDENT** - Student accounts

## 📁 Project Structure

```
smart-school-erp/
├── apps/
│   ├── web/                          # Next.js frontend application
│   │   ├── src/
│   │   │   ├── app/                  # Next.js app directory
│   │   │   ├── components/           # Reusable UI components
│   │   │   ├── features/             # Feature-based modules
│   │   │   ├── hooks/                # Custom React hooks
│   │   │   ├── lib/                  # Utility functions
│   │   │   ├── stores/               # Zustand stores
│   │   │   ├── types/                # TypeScript types
│   │   │   └── middleware.ts         # Next.js middleware
│   │   └── public/                   # Static assets
│   └── api/                          # Backend API layer (if needed)
├── packages/
│   ├── db/                           # Database schema & migrations
│   ├── shared-types/                 # Shared TypeScript types
│   └── ui/                           # Shared UI components
├── supabase/
│   ├── migrations/                   # SQL migrations
│   ├── policies/                     # RLS policies
│   └── seed/                         # Seed data
├── docs/
│   ├── ARCHITECTURE.md               # Architecture documentation
│   ├── DATABASE.md                   # Database schema documentation
│   ├── DEPLOYMENT.md                 # Deployment guide
│   └── API.md                        # API documentation
├── .env.example                      # Environment variables template
├── docker-compose.yml                # Local development setup
└── package.json                      # Root package.json
```

## 📋 Features

### 1. School Management
- Create schools
- School branding
- School settings
- Subscription status tracking

### 2. Student Management
- Student registration
- Profile management
- Guardian information
- Photo uploads
- Class assignment

### 3. Teacher Management
- Teacher profiles
- Subject assignment
- Class assignment

### 4. Academic Structure
- Classes management
- Streams management
- Subjects management
- Academic years
- Terms

### 5. Attendance
- Daily attendance tracking
- Attendance reports

### 6. Exams and Results
- Exam creation
- Marks entry
- Auto-grading
- Student rankings
- Report card generation

### 7. Fees Management
- Fee structures
- Payment tracking
- Balance calculations
- Receipt generation

### 8. Super Admin Dashboard
- Total schools overview
- Revenue analytics
- Active subscriptions
- Platform analytics

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm/yarn/pnpm
- PostgreSQL 14+
- Supabase account

### Installation

```bash
# Clone repository
git clone https://github.com/akramdesyber/smart-school-erp.git
cd smart-school-erp

# Install dependencies
pnpm install

# Setup environment variables
cp .env.example .env.local

# Setup database
pnpm run db:setup

# Start development server
pnpm run dev
```

## 📚 Documentation

- [Architecture Guide](./docs/ARCHITECTURE.md)
- [Database Schema](./docs/DATABASE.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)
- [API Documentation](./docs/API.md)

## 🔒 Security

- TypeScript strict mode for type safety
- Row Level Security (RLS) on all database tables
- Supabase Auth for authentication
- Environment variable management
- Input validation with Zod
- CORS and security headers configured

## 📦 Deployment

### Vercel (Frontend)
1. Connect repository to Vercel
2. Set environment variables
3. Deploy

### Supabase (Backend)
1. Create Supabase project
2. Run migrations
3. Enable RLS policies

See [Deployment Guide](./docs/DEPLOYMENT.md) for detailed instructions.

## 📄 License

MIT

## 🤝 Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## 📞 Support

For support, email support@smartscholerp.com or open an issue on GitHub.
