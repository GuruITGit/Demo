.PHONY: help dev prod down logs shell-backend shell-db migrate seed clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Development
dev: ## Start development environment
	docker compose -f infrastructure/docker-compose.dev.yml up -d
	@echo "Services started:"
	@echo "  PostgreSQL : localhost:5432"
	@echo "  Redis      : localhost:6379"
	@echo "  MinIO      : localhost:9000 (console: localhost:9001)"
	@echo "  MailHog    : localhost:1025 (UI: localhost:8025)"
	@echo "  pgAdmin    : localhost:5050"

dev-down: ## Stop development environment
	docker compose -f infrastructure/docker-compose.dev.yml down

# Production
prod: ## Start production environment
	docker compose -f infrastructure/docker-compose.yml up -d

down: ## Stop production environment
	docker compose -f infrastructure/docker-compose.yml down

# Logs
logs: ## View all logs
	docker compose -f infrastructure/docker-compose.yml logs -f

logs-backend: ## View backend logs
	docker compose -f infrastructure/docker-compose.yml logs -f backend

# Backend
install: ## Install backend dependencies
	cd backend && npm install

build: ## Build backend
	cd backend && npm run build

start: ## Start backend in dev mode
	cd backend && npm run start:dev

migrate: ## Run database migrations
	cd backend && npm run migration:run

seed: ## Run database seeds
	cd backend && npm run seed:run

migrate-seed: migrate seed ## Run migrations then seeds

# Shell access
shell-backend: ## Open shell in backend container
	docker compose -f infrastructure/docker-compose.yml exec backend sh

shell-db: ## Open psql in postgres container
	docker compose -f infrastructure/docker-compose.yml exec postgres psql -U postgres -d smartgov

# Cleanup
clean: ## Remove all containers and volumes
	docker compose -f infrastructure/docker-compose.yml down -v
	docker compose -f infrastructure/docker-compose.dev.yml down -v

# SSL certificate (self-signed for dev)
ssl-gen: ## Generate self-signed SSL certificate
	mkdir -p infrastructure/nginx/ssl
	openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
		-keyout infrastructure/nginx/ssl/key.pem \
		-out infrastructure/nginx/ssl/cert.pem \
		-subj "/C=TH/ST=Bangkok/L=Bangkok/O=SmartGov/CN=localhost"
	@echo "Self-signed certificate generated at infrastructure/nginx/ssl/"
