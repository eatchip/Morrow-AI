# prototype v1 · design-review-html-first

## 目的
自证"HTML 原型闸门"技术链路就绪，不代表 Morrow 最终视觉语言。

## 打开方式
- 双击 `index.html`（`file://`）
- 或 `pnpm prototype:serve design-review-html-first` → `http://localhost:5178/`

## 本轮关注点（≤ 5 条）
1. Tailwind Play CDN 能正常加载（页面应为深色背景 + 灰阶排版）
2. React 18 via esm.sh 能正常渲染（能看到标题与按钮）
3. Babel standalone 能把 JSX 编译出来（按钮能响应点击并计数）
4. `pnpm prototype:serve design-review-html-first` 能在 5178 返回本页（不是 404）
5. 页面关闭后无残留进程（Ctrl+C 能优雅退出 server）

## 变更点
- 初版。
