#!/bin/bash
set -e

echo "📊 Utilization Planner - Starting up..."
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not available. Please install Docker Compose."
    exit 1
fi

# Create .env if not exists
if [ ! -f .env ]; then
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env
fi

echo "🐳 Starting Docker containers..."
docker compose up --build -d

echo ""
echo "⏳ Waiting for database to be ready..."
sleep 5

echo "🗃️  Running database migrations..."
docker compose exec -T backend npx prisma migrate dev --name init 2>/dev/null || \
docker compose exec -T backend npx prisma db push

echo "🌱 Seeding database..."
docker compose exec -T backend npx prisma db seed

echo ""
echo "✅ Utilization Planner is running!"
echo ""
echo "  🌐 Frontend: http://localhost:5173"
echo "  🔌 Backend:  http://localhost:3001"
echo "  🗄️  Database: localhost:5432"
echo ""
echo "  📧 Default login: admin@mrnow.at / admin123"
echo ""
echo "  To stop: docker compose down"
echo "  To view logs: docker compose logs -f"
