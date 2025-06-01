# 🚀 ROCKETv1 - Clean Deployment Guide

## 📦 Essential Files Only

This guide lists **exactly what you need** to deploy ROCKETv1 to a new machine.

### **Core Application Files**
```
package.json                 # Dependencies
package-lock.json           # Locked dependencies  
tsconfig.json               # TypeScript config
next.config.js              # Next.js config
tailwind.config.js          # Tailwind CSS
postcss.config.js           # PostCSS config
.eslintrc.json              # ESLint rules
Dockerfile                  # Web app container
docker-compose.yml          # Multi-service setup
.gitignore                  # Git ignore rules
```

### **Source Code Directories**
```
app/                        # Next.js 14 app directory
├── api/                    # API routes
├── auth/                   # Authentication pages
├── globals.css             # Global styles
└── layout.tsx              # Root layout

components/                 # React components
├── ui/                     # Reusable UI components
├── rocket/                 # 3D rocket components
├── chat/                   # Chat interface
└── auth/                   # Auth components

lib/                        # Core utilities
├── database/               # Supabase client
├── services/               # Business logic
├── auth/                   # Authentication
├── store.ts                # Zustand state
└── utils.ts                # Utilities

types/                      # TypeScript definitions
├── rocket.d.ts             # Rocket types
└── index.ts                # Type exports

public/                     # Static assets
└── (images, icons, etc.)

services/                   # Microservices
├── agentpy/                # Python AI agent
└── rocketpy/               # Physics simulation
```

### **Database** 
```
supabase/
└── migrations/             # ALL migration files
    ├── 20250601152335_initial_rocket_schema.sql
    ├── 20241201000000_add_vector_columns.sql
    └── 20250601191409_fix_missing_columns.sql
```

### **Documentation** (Minimal)
```
README.md                   # Main project overview
ENVIRONMENT_SETUP.md        # Setup instructions
```

---

## 🛠️ **New Machine Setup Steps**

### 1. **Clone Repository**
```bash
git clone <your-repo-url>
cd ROCKETv1
```

### 2. **Create Environment File**
```bash
cp .env.example .env
# Add your actual API keys:
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
# - OPENAI_API_KEY
# - NEXT_PUBLIC_OPENWEATHER_API_KEY
```

### 3. **Run Database Migrations**
```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref <your-project-ref>

# Apply all migrations
supabase db push --linked
```

### 4. **Start Application**
```bash
# Using Docker (Recommended)
docker-compose up --build

# Or locally
npm install
npm run dev
```

### 5. **Verify Setup**
- Web App: http://localhost:3000
- AI Agent: http://localhost:8002  
- Physics API: http://localhost:8000

---

## 📋 **Files NOT Needed** (Safe to Delete)

❌ Remove these development/planning files:
- `database_implementation_plan.md`
- `progress.md` 
- `setup-instructions.md`
- `DOCKER_SETUP.md`
- `SYSTEM_COMPLETION_SUMMARY.md`
- All `TECHNICAL_DOCUMENTATION*.md`
- All `*_ANALYSIS.md` files
- `USER_RESEARCH_INSIGHTS.md`
- `TO-ADD-FEATURES.md`
- `PROJECT_SUMMARY.md`
- Any `test_*.json` files

---

## 🎯 **Total File Count for Clean Deployment**
- **~50 essential files** (vs ~80+ with clutter)
- **5 directories** of source code
- **3 migration files** for database
- **2 documentation files**

This gives you a **production-ready codebase** without development artifacts! 🚀 