#!/usr/bin/env bash
# pnpm install 会重建 node_modules，清掉手工建的 @deepseek-ai symlink。
# 本脚本在 postinstall 阶段自动恢复它们，这样 pnpm 再怎么跑也不会断链。
# 目标：session-clear 的 3 个未声明依赖（dsh-compaction/compaction-basic/schemastery）
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)/node_modules/@deepseek-ai"
DEEPEEK_HARNESS="/home/mi/ssd/deepseek-harness"
mkdir -p "$DIR"
ln -sfn "$DEEPEEK_HARNESS/packages/compaction/compaction"      "$DIR/dsh-compaction"
ln -sfn "$DEEPEEK_HARNESS/packages/compaction/compaction-basic" "$DIR/dsh-compaction-basic"
ln -sfn "$DEEPEEK_HARNESS/vendor/schemastery"                  "$DIR/schemastery"
