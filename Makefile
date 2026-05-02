.PHONY: setup up down logs restart build clean help

help:
	@echo "Available commands:"
	@echo "  make setup    - Run initial setup script"
	@echo "  make up       - Start containers in background"
	@echo "  make down     - Stop containers"
	@echo "  make logs     - View container logs"
	@echo "  make restart  - Restart containers"
	@echo "  make build    - Rebuild containers"
	@echo "  make clean    - Remove containers and volumes"

setup:
	@./Scripts/setup.sh

up:
	@docker-compose -f Docker/docker-compose.yml up -d
	@echo "Service running at http://localhost:8080"

down:
	@docker-compose -f Docker/docker-compose.yml down

logs:
	@docker-compose -f Docker/docker-compose.yml logs -f

restart:
	@docker-compose -f Docker/docker-compose.yml restart

build:
	@docker-compose -f Docker/docker-compose.yml build

clean:
	@docker-compose -f Docker/docker-compose.yml down -v
