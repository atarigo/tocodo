.DEFAULT_GOAL := help
.PHONY: help install game sim test typecheck check reset

help: ## 顯示所有可用指令
	@echo ""
	@echo "血腥都市（第一紀元）常用指令："
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'
	@echo ""

install: ## 安裝依賴套件
	pnpm install

game: ## 開始遊戲（終端機互動模式）
	pnpm game

sim: ## 平衡模擬：典型成長曲線打 1〜15 層的勝率表
	pnpm sim

test: ## 執行測試（戰鬥公式與規則）
	pnpm test

typecheck: ## TypeScript 型別檢查
	pnpm typecheck

check: typecheck test ## 型別檢查 + 測試一次跑完

reset: ## 刪除存檔（save.json），整個世界重新開始
	rm -f save.json
	@echo "存檔已刪除。"
