# RumbleRoll

A real-time web application for Royal Rumble watch parties that distributes entry numbers among participants and tracks eliminations live.

## Features

- **Party Management**: Create and join watch parties with invite codes
- **Number Distribution**: Fairly distribute all 30 entry numbers among participants
- **Live Tracking**: Track wrestler entries and eliminations in real-time
- **TV Display**: Large-screen optimized view for watching together
- **Standings**: See who's winning as wrestlers get eliminated
- **Results**: View complete match history after the event

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **UI Components**: shadcn/ui
- **Auth**: NextAuth.js (email/password)
- **Database**: PostgreSQL with Prisma ORM
- **Deployment**: Vercel + Neon/Supabase

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (local or hosted)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/rumblegame.git
cd rumblegame
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env .env.local
```

Edit `.env.local` with your values:
```
DATABASE_URL="postgresql://user:password@localhost:5432/rumblegame"
AUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"
```

4. Set up the database:
```bash
npx prisma db push
```

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Deployment

### Vercel + Neon

1. Create a [Neon](https://neon.tech) database
2. Deploy to [Vercel](https://vercel.com)
3. Add environment variables in Vercel:
   - `DATABASE_URL`: Your Neon connection string
   - `AUTH_SECRET`: Generate with `openssl rand -base64 32`

## How It Works

1. **Create a Party**: Host creates a party and gets an invite code
2. **Invite Friends**: Share the code with friends to join
3. **Distribute Numbers**: Host triggers random distribution of numbers 1-30
4. **Track the Match**: Host updates wrestler entries and eliminations
5. **TV Display**: Everyone watches the standings update live

## Number Distribution

Numbers are distributed fairly among participants:
- Each person gets `floor(30/N)` numbers
- Remainder numbers are randomly assigned
- Example: 6 people = 5 numbers each; 7 people = 4-5 each

## License

MIT
