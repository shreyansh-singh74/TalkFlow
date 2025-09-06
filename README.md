# MeetAi - AI-Powered Meeting Management Platform

MeetAi is a comprehensive web application that revolutionizes meeting management through AI automation. Create custom AI agents, schedule intelligent meetings, and get automatic transcriptions, recordings, and summaries.

## 🚀 Key Features

- **Custom AI Agents**: Create personalized AI assistants with specific instructions
- **Intelligent Meetings**: AI-powered meeting participation and documentation
- **Automatic Transcription**: Real-time speech-to-text conversion
- **Smart Summaries**: AI-generated meeting summaries and insights
- **Meeting Lifecycle**: Complete status tracking from scheduling to completion
- **Search & Filter**: Advanced search capabilities across all meetings and agents
- **Secure Authentication**: Multiple login options including GitHub and Google OAuth

## 📖 What You Can Do

For a comprehensive overview of all features and capabilities, see [FEATURES.md](./FEATURES.md).

### Quick Overview:
- 🤖 **Create AI Agents** with custom personalities and instructions
- 📅 **Schedule Meetings** with AI participation
- 🎥 **Record & Transcribe** meetings automatically  
- 📊 **Get AI Summaries** of meeting content and decisions
- 🔍 **Search & Organize** your meeting history
- 👥 **Manage Multiple Agents** for different use cases

## 🛠️ Getting Started

### Prerequisites
- Node.js 18+ installed
- PostgreSQL database
- Environment variables configured

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/shreyansh-singh74/MeetAi.git
   cd MeetAi
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file with:
   ```bash
   DATABASE_URL="your_postgresql_connection_string"
   GITHUB_CLIENT_ID="your_github_oauth_client_id"
   GITHUB_CLIENT_SECRET="your_github_oauth_client_secret"
   GOOGLE_CLIENT_ID="your_google_oauth_client_id"
   GOOGLE_CLIENT_SECRET="your_google_oauth_client_secret"
   ```

4. **Set up the database**
   ```bash
   npm run db:push
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🏗️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Backend**: tRPC, Better Auth
- **Database**: PostgreSQL with Drizzle ORM
- **UI**: Tailwind CSS, Radix UI Components
- **State Management**: TanStack Query
- **Authentication**: OAuth (GitHub, Google) + Email/Password

## 📁 Project Structure

```
src/
├── app/                    # Next.js app router pages
├── components/             # Reusable UI components  
├── db/                     # Database schema and connection
├── lib/                    # Utility libraries and auth
├── modules/                # Feature-specific modules
│   ├── agents/            # AI agent management
│   ├── auth/              # Authentication flows
│   ├── dashboard/         # Dashboard components
│   ├── meetings/          # Meeting management
│   └── home/              # Home page components
└── trpc/                  # API layer and routing
```

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run db:push` - Push database schema changes
- `npm run db:studio` - Open Drizzle Studio

## 🚀 Deployment

The application can be deployed on platforms like Vercel, Netlify, or any Node.js hosting service.

1. Set up your database and environment variables
2. Build the application: `npm run build`  
3. Deploy the built application

## 📄 Documentation

- [Features Overview](./FEATURES.md) - Comprehensive list of all features
- [API Documentation](./src/trpc/routers/) - tRPC API endpoints
- [Database Schema](./src/db/schema.ts) - Database structure

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit your changes: `git commit -m 'Add new feature'`
4. Push to the branch: `git push origin feature/new-feature`
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙋‍♂️ Support

If you have any questions or need help getting started, please open an issue or reach out to the maintainers.
