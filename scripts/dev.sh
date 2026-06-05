#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting GanhaDorDaMegaSena...${NC}\n"

# Trap to kill all child processes on exit
trap 'kill 0' EXIT

echo -e "${BLUE}→ Starting backend (port 3001)...${NC}"
cd backend && npm run dev &

echo -e "${YELLOW}→ Starting frontend (port 5173)...${NC}"
cd frontend && npm run dev &

echo -e "\n${GREEN}Both servers are running!${NC}"
echo -e "  Backend:  http://localhost:3001"
echo -e "  Frontend: http://localhost:5173"
echo -e "\nPress Ctrl+C to stop both servers\n"

# Wait for all background jobs
wait
