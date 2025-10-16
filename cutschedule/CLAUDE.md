# CutSchedule - Project Documentation

## ⚠️ DEVELOPMENT MODE NOTICE

**THIS PROJECT IS CURRENTLY IN DEVELOPMENT.**

Please ignore all authorization issues related to admin/Google OAuth concerns. The authentication and authorization system is being actively developed and refined. Any 401/403 errors or OAuth-related authentication failures should be considered temporary development issues and not blocking concerns.

## Overview

CutSchedule is a Next.js-based appointment scheduling application with Google Calendar integration. The application allows clients to book haircut appointments and syncs them with Google Calendar.

## Tech Stack

- **Framework**: Next.js 14+ with App Router
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with Google OAuth
- **Calendar**: Google Calendar API
- **UI**: React with TypeScript
- **Styling**: Tailwind CSS

## Authentication & Authorization Strategy

### Important: Simplified Access Control

**We do NOT use traditional admin role checks.** Access control is entirely handled by Google OAuth's allowed test users feature in development mode.

### How It Works

1. **OAuth as Firewall**: Google OAuth client configured in development mode restricts access to explicitly allowed test users only
2. **No Admin Flags**: No `isAdmin`, `role`, or admin-specific checks in the codebase
3. **Session Validation Only**: Routes verify that:
   - A valid session exists
   - User object is present in session
   - User email is available (required by OAuth)

### Implementation Details

#### Authentication Flow (`lib/auth.ts`)

```typescript
// Session callback - minimal, no admin privileges
async session({ session, user }) {
  if (user && session.user) {
    session.user.id = user.id
    // No admin privileges - OAuth allowed test users provide access control
  }
  return session
}
```

**Key Points:**
- No `session.user.isAdmin = true` hardcoding
- No admin ID linking
- User ID is set for session tracking
- Access control managed entirely by OAuth configuration

#### Route Protection Pattern

All admin routes follow this pattern:

```typescript
export async function POST(request: NextRequest) {
  // Verify authentication - rely on OAuth allowed test users
  const session = await getServerSession(authOptions)

  // Check if session exists
  if (!session) {
    console.warn('[Auth Audit] Action attempted without session')
    return NextResponse.json(
      { error: 'Unauthorized - No session' },
      { status: 401 }
    )
  }

  // Check if user exists in session
  if (!session.user) {
    console.warn('[Auth Audit] Action attempted with session but no user')
    return NextResponse.json(
      { error: 'Unauthorized - No user in session' },
      { status: 401 }
    )
  }

  // Check if user has email (required for OAuth users)
  if (!session.user.email) {
    console.warn('[Auth Audit] Action attempted by user without email')
    return NextResponse.json(
      { error: 'Unauthorized - No email in session' },
      { status: 401 }
    )
  }

  console.log(`[Auth Audit] Action authorized for user: ${session.user.email}`)

  // Continue with route logic...
}
```

**Example Routes Using This Pattern:**
- `/api/admin/sync-calendar/route.ts`
- Add other admin routes following this same pattern

### Security Considerations

#### Development vs Production

**Development Mode:**
- OAuth client configured with restricted test users list
- Only explicitly allowed Google accounts can authenticate
- No additional role checks needed

**Production Mode:**
- ⚠️ **IMPORTANT**: Before deploying to production, you must either:
  1. Keep OAuth in development mode with a restricted user list, OR
  2. Implement proper role-based access control (RBAC)
- Current implementation assumes restricted OAuth access

#### Audit Logging

All authorization checks include audit logging with `[Auth Audit]` prefix:
- Logs failed authentication attempts (missing session/user/email)
- Logs successful authorizations with user email
- Helps track access patterns and security issues

### Migration Notes

**Changes from Previous Implementation:**
- ❌ Removed: `session.user.isAdmin = true` hardcoding
- ❌ Removed: Admin table linking in session callback
- ❌ Removed: `session.user.isAdmin` checks in routes
- ✅ Added: Explicit session/user/email validation
- ✅ Added: Comprehensive audit logging
- ✅ Simplified: Session callback to minimal logic

## Database Schema

### Key Models

- **User**: NextAuth user table (managed by Prisma Adapter)
- **Appointment**: Client appointment records
- **Session**: NextAuth session table
- **WorkingHours**: Business hours configuration
- **AvailableSlot**: Custom availability slots
- **SMSLog**: SMS notification tracking

**Note**: There is no Admin table. Access control is entirely managed by Google OAuth's allowed test users configuration.

## Development Guidelines

### Code Style

- Use TypeScript strict mode
- Prefer functional components
- Use async/await over Promise chains
- Early returns to reduce nesting
- Explicit error handling with try/catch

### Authentication Rules

1. **Never** hardcode admin privileges in session callbacks
2. **Always** validate session, user, and email explicitly
3. **Always** log authorization events for audit trail
4. **Return immediately** on authorization failure
5. **Use OAuth** as the primary access control mechanism

### Adding New Admin Routes

When creating new admin API routes:

1. Copy the authentication pattern from `/api/admin/sync-calendar/route.ts`
2. Add session validation checks (session → user → email)
3. Include audit logging for all auth events
4. Return 401 for missing authentication
5. Test with both authenticated and unauthenticated requests

### Git Workflow

- Use conventional commit messages
- Feature branches merged to `dev`
- PRs target `main` branch
- Test changes locally before committing

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...

# NextAuth
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# Google Calendar API
GOOGLE_CALENDAR_ID=your-calendar-id

# Twilio (SMS notifications)
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...
```

## Common Commands

```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm run start           # Start production server

# Database
npx prisma generate     # Generate Prisma client
npx prisma db push      # Push schema changes
npx prisma studio       # Open Prisma Studio

# Code Quality
npm run lint            # Run ESLint
npm run typecheck       # TypeScript type checking
```

## Project Structure

```
cutschedule/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── admin/        # Admin-only endpoints
│   │   └── ...           # Public endpoints
│   ├── admin/            # Admin dashboard pages
│   └── ...               # Public pages
├── lib/                   # Shared utilities
│   ├── auth.ts           # NextAuth configuration
│   ├── calendar.ts       # Google Calendar integration
│   └── db.ts             # Prisma client
├── prisma/               # Database schema and migrations
├── components/           # React components
└── public/              # Static assets
```

## Troubleshooting

### Authentication Issues

**Problem**: Cannot access admin routes
**Solution**:
1. Verify you're signed in with a Google account
2. Check that your account is in OAuth allowed test users list
3. Clear cookies and sign in again
4. Check server logs for `[Auth Audit]` messages

**Problem**: Session exists but still getting 401
**Solution**:
1. Verify session contains user object: check `session.user`
2. Verify user has email: check `session.user.email`
3. Review server logs for specific auth failure reason

### Calendar Sync Issues

**Problem**: Appointments not syncing to Google Calendar
**Solution**:
1. Verify Google Calendar API credentials are set
2. Check OAuth scope includes calendar access
3. Run sync manually via `/api/admin/sync-calendar`
4. Review calendar API error logs

## Future Considerations

### Production Deployment

Before deploying to production, decide on access control strategy:

**Option 1: Keep Restricted OAuth (Recommended for small teams)**
- Keep OAuth in development/testing mode
- Maintain explicit allowed users list
- No code changes needed

**Option 2: Implement RBAC**
- Add role/permission system to database
- Check user roles in route handlers
- Implement proper admin user management UI
- Update session callback to include role information

### Scaling Considerations

- Consider adding Redis for session storage
- Implement rate limiting on API routes
- Add request caching where appropriate
- Monitor database query performance
- Add proper error tracking (e.g., Sentry)
