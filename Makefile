.PHONY: setup dev build lint

setup:            ## Install backend (uv) and frontend (pnpm) dependencies
	uv sync --project backend
	pnpm install

dev:              ## Run backend + frontend concurrently
	pnpm run dev

build:            ## Build the frontend for production
	pnpm run build

lint:             ## Lint backend (ruff) and frontend (biome)
	pnpm run lint
