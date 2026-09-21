# AGENTS.md — 项目协作约定（Project_GWA10343033）

## Git 推送约定（最重要，必须遵守）

**每次推送到远程都是「直接推送」，禁止合并后再推。**

具体含义：

1. **推上去的提交必须只有一个父提交**，历史保持线性，**绝不允许出现 merge commit**。
   用 `git commit-tree <tree> -p <base> -m <msg>` 构造，不要用 `git merge` 后再推。
2. **推送过程绝不改动工作区**。禁止使用 `merge` / `pull` / `checkout` / `reset --hard` 等会改写
   工作区的命令。只能用只读工作区的 plumbing：
   `git add` → `git write-tree` → `git read-tree`（独立索引）→ `git commit-tree` → `git push`。
3. **本地媒体文件（`Audio/`、`Video/`）以本地文件为准，不参与 git**（详见下一节）。
   推送时绝不能把磁盘上的它们带进提交，也**绝不能因为推送而把它们从磁盘删掉**。
   （历史上曾因用 `git merge` 导致工作区媒体被删，属真实事故。）
   ⚠️ 注意：本分支实际**已跟踪 103 个媒体文件**（`.gitignore` 对已跟踪文件无效），
   已通过 `skip-worktree` 让它们不进 `git status`；构造目标树时仍须确保不含 `Audio/`、`Video/`。
4. **推送前必须回读远端**（`git ls-remote origin refs/heads/<branch>`），确认与预期父提交一致，
   不一致则中止，防止覆盖他人提交。推送用 `--force-with-lease=refs/heads/<branch>:<期望值>`。
5. **推送前必须核对目标树**：
   - 相对目标分支的差异 == 本次要推的文件，不多不少；
   - 目标树中不含 `Audio/`、`Video/`；
   - 目标分支独有的已跟踪资源（如 `frontend/public/images/*.jpg` 各模块封面）仍在。
     ⚠️ 这些封面图在功能分支工作区里往往是**未跟踪的同名文件**，若用功能分支的树当基准会被直接删掉。
     **目标树必须以「目标分支的树」为基准再叠加本次改动。**
6. **未经明确指示，不要自动推送。** 需要推送时等指示；收到指示后按上述方式直接推。

> 本约定已封装为 skill `direct-push-no-merge`，含一键脚本 `scripts/direct-push.cjs`
> （自带三道护栏：无实际改动拦截 / 目标树资源缺失拦截 / 远端被他人更新拦截，支持 `--dry-run`）。

## 媒体素材：一律以本地文件为准，git 里的版本不参与（用户 2026-09-18 明确要求）

**运行时读取路径是 `E:\XWJ\GWA10343033_New\Video\` 与 `Audio\` 这两个本地文件夹，不是 git 里的版本。**
代码里只写 `/Video/...`、`/Audio/...` 相对 URL，由 `frontend/vite.config.ts` 的 `mediaAssets` 插件
把请求映射到仓库根的这两个真实目录（dev 用中间件直读 + 支持 Range；build 在 `closeBundle` 时拷进 `dist`）。
所以**换素材只需替换本地文件**，不必改代码、不必提交。

### 不要提交媒体到 git

- `.gitignore` 里已有 `/Audio/`、`/Video/`，但**对历史上已被跟踪的文件无效** ——
  本分支（`feature/epidemiology-figma-player`）实际跟踪了 **103 个**媒体文件。
- 结果：本地一换素材，`git status` 就一直显示 `M`，且 `checkout` / `restore` / 切分支
  都可能把 git 里的旧版**覆盖回工作区**。

### 解决方式：给已跟踪媒体打 `skip-worktree`

```bash
node <workbuddy>/2026-09-10-11-06-42/.git-media-local-ignore.cjs apply    # 打标记（103 个文件）
node <workbuddy>/2026-09-10-11-06-42/.git-media-local-ignore.cjs status   # 查看
node <workbuddy>/2026-09-10-11-06-42/.git-media-local-ignore.cjs undo     # 撤销
```

效果（已用对照组实验验证，见 `.verify-skipworktree-control.cjs`）：

| 状态 | `git checkout -- <媒体>` 的结果 |
|---|---|
| 无标记（默认） | ❌ 被 git 覆盖回旧版 |
| **有 skip-worktree** | ✅ 本地内容保留 |

副作用：`git status` 不再显示媒体的改动，因此**判断「素材有没有被换过」不能再看 `M`**，
要改用内容哈希（对比 `git rev-parse HEAD:<path>` 的 blob）或时长指纹。
若某次确实想把某个媒体提交上去，先对该文件单独 `undo` 再操作。

## 环境注意事项

- 本机 `git commit`、`git reset --hard` 会被安全软件拦截 `reg.exe` 导致进程被杀。
  **改引用一律用 Node 直接写 `.git/refs/...`**；提交用 `commit-tree`。
- `git push` 后常漏写 `refs/remotes/origin/*`，需要手动补（该目录可能不存在，因 ref 原在 `packed-refs`）。
- `github.com` 直连通常可用；`git -c http.proxy= -c https.proxy=` 可清掉漂移的代理环境变量。
- `frontend/public/Video` 是一个**损坏的 MSYS 软链接**（lstat 报 EACCES），会让 `npm run build`
  的静态拷贝阶段失败。属历史遗留，**不影响 `npm run dev`**（媒体走 vite 插件中间件按真实路径读取）。

## 项目速览

- 仓库根：`E:\XWJ\GWA10343033_New`，前端在 `frontend/`；`origin` = GitHub `gitbestpre/Project_GWA10343033_New`。
- 技术栈：React 19 + TypeScript 6 (strict) + Vite 8 + React Router 7；1920×1080 固定舞台（`StageLayout`）。
- 媒体（`Audio/`、`Video/`）放在仓库根，通过 `vite.config.ts` 的 `mediaAssets` 插件以 `/Audio/*`、`/Video/*` 访问。
- `npm run dev` 端口 5174；`npx tsc -b` 类型检查；`npx vitest run` 单测。
- 已知陈旧测试：`src/__tests__/KnowledgePage.test.tsx` 有 7 项预存失败（组件已重构但测试未同步），
  与业务改动无关，勿误判为回归。
