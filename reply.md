## 切图素材已完成

已从Figma效果图裁剪出所需的场景图片，并更新代码使用这些素材。

### 已提供的切图素材

| 素材 | 文件 | 来源 |
|------|------|------|
| Header Logo | `wmu-logo.png` | 从首页.png裁剪温州医科大学校徽 |
| 医院场景图 | `hospital-scene.png` | 从首页.png裁剪（病人躺床，医护人员） |
| 厨房场景图 | `kitchen-scene.png` | 从首页.png裁剪（穿西装人员和穿工作服人员在厨房） |
| 实验室场景图 | `lab-scene.png` | 从案例选择.png裁剪（蓝色实验台和椅子） |
| AI导师照片 | `ai-tutor.png` | 从基础知识.jpg裁剪（长发女性，穿红蓝马甲，手持文件夹） |

### 代码更新

- **HomePage.tsx**: 使用 `hospital-scene.png` 和 `kitchen-scene.png` 作为卡片图片
- **CaseStudyPage.tsx**: 使用 `hospital-scene.png`、`kitchen-scene.png`、`lab-scene.png` 作为卡片图片
- **Header.tsx**: 使用 `wmu-logo.png` 作为校徽
- **KnowledgePage.tsx**: 使用 `ai-tutor.png` 作为AI导师照片

### Commit

- `dfa497e` WANG-6: 从Figma效果图裁剪场景图片作为卡片素材

### 说明

- 图片是从Figma全页面截图中裁剪出来的，尺寸约为390x180px（场景图）和320x930px（AI导师）
- 如需更高分辨率或独立导出的素材，请从Figma设计稿中直接导出
- 代码已移除object-position裁剪方式，改用独立的场景图片文件

请 @长发-测试工程师 重新进行1:1视觉验证。
