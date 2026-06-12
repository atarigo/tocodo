.DEFAULT_GOAL := help
.PHONY: help install dev game build sim test typecheck check

help: ## 顯示所有可用指令
	@echo ""
	@echo "血腥都市（第一紀元）常用指令："
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'
	@echo ""

install: ## 安裝依賴套件
	pnpm install

dev: ## 啟動網頁開發伺服器（http://localhost:5173）
	pnpm dev

game: dev ## 同 dev：啟動網頁版

build: ## 正式建置（輸出到 dist/）
	pnpm build

sim: ## 平衡模擬：四種流派打 1〜15 層的勝率表
	pnpm sim

test: ## 執行測試（戰鬥公式與規則）
	pnpm test

typecheck: ## TypeScript ＋ Svelte 型別檢查
	pnpm typecheck

check: typecheck test ## 型別檢查 + 測試一次跑完
