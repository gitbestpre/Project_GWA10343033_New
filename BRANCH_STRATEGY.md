# 分支策略

## 分支结构

| 分支 | 用途 | 谁往里提交 |
|------|------|-----------|
| `main` | 生产环境代码，始终保持可发布状态 | 仅通过 `develop` 合并 |
| `develop` | 日常开发集成分支 | 所有功能分支合并进来 |
| `feature/*` | 单个功能或修复 | 开发者从 `develop` 拉出，完成后合并回去 |

## 日常工作流

### 1. 开始新功能

```bash
git checkout develop
git pull origin develop
git checkout -b feature/功能名
```

### 2. 日常提交

在 feature 分支上正常开发和提交：

```bash
git add .
git commit -m "简要描述本次改动"
```

### 3. 完成后合并回 develop

```bash
git checkout develop
git pull origin develop
git merge feature/功能名 --no-ff
git push origin develop
```

`--no-ff` 保留合并记录，方便追溯。

### 4. 发布到 main

当 develop 上的功能足够发布时：

```bash
git checkout main
git pull origin main
git merge develop --no-ff
git push origin main
git tag -a v1.0.0 -m "版本说明"
git push origin v1.0.0
```

## 规则

- **不要直接往 main 提交**，所有改动先走 develop
- **feature 分支及时清理**，合并后删除
- **合并前确保无冲突**，先 pull 再 merge
- **提交信息写清楚**，方便回溯
