# CutSchedule

##[cut-schedule-ck4d12342.vercel.app](url)

A modern appointment booking system for barbers and salons with automated SMS reminders, Google Calendar integration, and a powerful admin dashboard.

## Features

### Client Booking
- Simple, user-friendly booking interface
- Real-time availability checking
- Instant SMS confirmations
- Appointment management via SMS link

### Admin Dashboard
- Manage appointments and availability
- Set working hours and blocked dates
- View appointment history
- Google Calendar sync

### Automated Reminders
- 24-hour appointment reminders
- 1-hour pre-appointment notifications
- Re-engagement messages (2-week and 3-week follow-ups)
- Customizable SMS templates

### Integrations
- **Google Calendar**: Two-way sync for appointments
- **Twilio**: SMS notifications and reminders
- **NextAuth**: Secure Google OAuth admin authentication

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **Styling**: Tailwind CSS + shadcn/ui components
- **SMS**: Twilio
- **Calendar**: Google Calendar API
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js (LTS version)
- PostgreSQL database
- Twilio account (for SMS)
- Google Cloud project (for Calendar API and OAuth)

### Installation

1. Clone the repository:
```bash
cd cutschedule
npm install
```

2. Set up environment variables (create `.env` file in `/cutschedule` directory):
```bash
# Database
DATABASE_URL="postgresql://..."

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# Google OAuth & Calendar
GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_CALENDAR_ID="your-calendar-id"
GOOGLE_SERVICE_ACCOUNT_EMAIL="your-service-account-email"
GOOGLE_PRIVATE_KEY="your-private-key"

# Twilio
TWILIO_ACCOUNT_SID="your-account-sid"
TWILIO_AUTH_TOKEN="your-auth-token"
BARBER_PHONE="+1234567890"

# Cron Job
CRON_SECRET="your-cron-secret"

# Admin
ADMIN_EMAIL="admin@example.com"
ADMIN_GOOGLE_ID="your-google-id"
```

3. Set up the database:
```bash
cd cutschedule
npx prisma generate
npx prisma db push
npx prisma db seed  # Optional: seed initial data
```

4. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Project Structure

```
cutschedule/
├── app/                    # Next.js app directory
│   ├── admin/             # Admin dashboard pages
│   ├── api/               # API routes
│   ├── book/              # Client booking flow
│   └── manage-appointment/ # Appointment management
├── components/            # React components
├── lib/                   # Utility functions & configurations
├── prisma/               # Database schema & migrations
│   └── schema.prisma     # Prisma schema
├── scripts/              # Utility scripts
└── types/                # TypeScript type definitions
```

## Available Scripts

```bash
npm run dev        # Start development server
npm run build      # Build for production
npm start          # Start production server
npm run lint       # Run ESLint
npm run typecheck  # Run TypeScript type checking
```

## Automated Reminders Setup

The system supports automated SMS reminders through cron jobs. See [CRON_SETUP.md](./cutschedule/CRON_SETUP.md) for detailed setup instructions.

### Quick Setup (Vercel)

Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/reminders",
      "schedule": "0 9,12,15,18 * * *"
    }
  ]
}
```

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project to Vercel
3. Add environment variables
4. Deploy

The build command and output directory are automatically detected.

### Environment Variables on Vercel

Add all environment variables from `.env` to your Vercel project settings.

## API Endpoints

### Public Endpoints
- `GET /api/availability?date=YYYY-MM-DD` - Check availability for a date
- `POST /api/appointments` - Create a new appointment
- `GET /api/appointments/[id]` - Get appointment details
- `POST /api/appointments/[id]/cancel` - Cancel an appointment

### Protected Endpoints (Admin)
- `GET /api/admin/appointments` - List all appointments
- `POST /api/admin/working-hours` - Update working hours
- `POST /api/admin/blocked-dates` - Block dates/times

### Cron Endpoints
- `GET /api/cron/reminders` - Send automated reminders (requires `CRON_SECRET`)

## Database Models

- **Admin**: Admin user accounts
- **User/Account/Session**: NextAuth authentication
- **Appointment**: Customer appointments
- **WorkingHours**: Business operating hours
- **BlockedDate**: Blocked dates and times
- **SMSLog**: SMS delivery tracking

## Configuration

### Working Hours
Configure business hours in the admin dashboard or directly in the database.

### SMS Templates
Customize message templates in `lib/sms.ts`:
- Confirmation messages
- 1-day reminders
- 1-hour reminders
- Re-engagement messages (2-week, 3-week)
- Cancellation notices

## Testing

```bash
# Run Playwright tests
npx playwright test

# Run tests in UI mode
npx playwright test --ui
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

Private - All rights reserved

## Support

For issues or questions, please open an issue on GitHub.
