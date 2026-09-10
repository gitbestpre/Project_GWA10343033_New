# 项目启动指南

## 快速启动

### 1. 启动开发服务器

在项目根目录打开命令行，执行：

```bash
cd frontend
npm run dev
```

或者在 Windows PowerShell/CMD 中：

```cmd
cd frontend
npm run dev
```

### 2. 访问页面

开发服务器启动后，在浏览器中访问：

```
http://localhost:5173
```

Vite 默认端口是 5173，如果被占用会自动使用其他端口。

### 3. 页面路由

- **首页**: http://localhost:5173/
- **知识宣教**: http://localhost:5173/knowledge
- **案例学习**: http://localhost:5173/case-study

## 如果遇到问题

### 首次运行需要安装依赖

```bash
cd frontend
npm install
```

### 端口被占用

如果 5173 端口被占用，可以在 `vite.config.ts` 中指定其他端口：

```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000, // 修改为你想要的端口
  },
})
```

### 查看其他可用命令

```bash
npm run build    # 构建生产版本
npm run preview  # 预览生产构建
npm run lint     # 代码检查
npm test         # 运行测试
```

## 注意事项

### 图片资源

目前代码中引用的图片路径如下，需要准备对应的图片文件：

```
public/images/
├── wmu-logo.png              # 温州医科大学 Logo
├── hospital-scene.png         # 医院场景
├── kitchen-scene.png          # 厨房场景
├── lab-scene.png             # 实验室场景
├── ai-tutor.png              # AI 导师照片
├── 星星.png                   # 欢迎页装饰
└── Ellipse 33.png            # 讲解头像
```

在图片资源未准备好之前，页面会显示灰色占位背景。

### 热更新

Vite 支持热模块替换（HMR），修改代码后浏览器会自动刷新显示最新内容。

## 浏览器要求

推荐使用以下浏览器以获得最佳体验：

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 开发工具推荐

- **VS Code** 配合以下插件：
  - ES7+ React/Redux/React-Native snippets
  - TypeScript Vue Plugin (Volar)
  - Tailwind CSS IntelliSense（如果后续使用）
  - Prettier - Code formatter

## 项目结构

```
frontend/
├── src/
│   ├── components/        # 公共组件
│   │   ├── Header.tsx
│   │   └── Header.css
│   ├── pages/            # 页面组件
│   │   ├── HomePage.tsx
│   │   ├── HomePage.css
│   │   ├── KnowledgePage.tsx
│   │   ├── KnowledgePage.css
│   │   ├── CaseStudyPage.tsx
│   │   └── CaseStudyPage.css
│   ├── __tests__/        # 测试文件
│   ├── App.tsx           # 路由配置
│   ├── main.tsx          # 应用入口
│   └── index.css         # 全局样式
├── public/               # 静态资源
│   └── images/          # 图片资源（需要添加）
├── index.html           # HTML 模板
├── package.json         # 依赖配置
├── tsconfig.json        # TypeScript 配置
└── vite.config.ts       # Vite 配置
```

## 下一步

1. 启动开发服务器
2. 在浏览器中查看优化后的页面效果
3. 根据 Figma 设计稿准备图片资源
4. 开始开发子模块页面
