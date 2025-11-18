BASE_FILE = -f docker-compose.yml
COLAB_FILE = -f docker-compose.colab.yml
CPU_FILE = -f docker-compose.cpu.yml

.PHONY: colab cpu logs stop down restart-backend

colab:
	docker compose $(BASE_FILE) $(COLAB_FILE) up -d --build

cpu:
	docker compose $(BASE_FILE) $(CPU_FILE) up -d --build

logs:
	docker compose $(BASE_FILE) $(COLAB_FILE) logs -f

restart-backend:
	docker compose $(BASE_FILE) $(COLAB_FILE) restart backend
	docker compose $(BASE_FILE) $(COLAB_FILE) logs -f backend

down:
	docker compose down