# Git 规则（本项目）

## 1. 管理范围
- 所有“代码/文本类”文件必须纳入 Git：`.js .json .md .txt .rpgproject .html .css` 等。
- 任何影响玩法/剧情/配置的数据都必须提交（尤其是 `game/data/*.json`、`game/js/**`）。

## 2. 二进制资源策略
- 图片/音频/字体等二进制文件（如 `.png .ogg .m4a .ttf`）允许纳入 Git，但会导致仓库体积快速膨胀。
- 如果后续要推送到远程（GitHub/Gitee 等）且资源较多，建议：
  - 使用 Git LFS 管理大文件，或
  - 将“生成类资源”（例如 ComfyUI 输出）单独放到不进 Git 的目录/仓库。

## 3. 提交习惯
- 频繁提交“可运行的最小改动”：每次提交都保证能启动游戏并进入标题界面。
- 提交信息建议以模块开头：`title: ...`、`ui: ...`、`data: ...`、`fix: ...`。

## 4. 常见忽略项
- 系统/编辑器/缓存/构建产物不入库：见 `.gitignore`。

## 5. 远程推送（你现在卡住的点）
你的 `.git/config` 当前没有配置远程仓库（remote），所以无法 push。常用处理：

### HTTPS（最简单）
1. 在远程平台创建空仓库（不要自动加 README/License，避免第一次 push 冲突）
2. 本地执行：
   - `git remote add origin <你的远程仓库URL>`
   - `git branch -M main`
   - `git push -u origin main`
3. 平台若不再支持密码登录，需要用 Personal Access Token（PAT）替代密码。

### SSH（更稳定）
1. 生成 SSH Key（`ed25519`），把公钥添加到远程平台
2. 远程 URL 用 `git@...:` 形式
3. `git push -u origin main`
