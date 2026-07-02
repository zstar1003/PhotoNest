# PhotoNest

一个为高像素摄影作品设计的静态“摄影书架”，可直接部署至 GitHub Pages。

## 功能

- 单视窗相册书架：选择相册后，以摄影书方式逐页阅读，支持左右方向键翻页
- 无长页面、无网页内置上传功能；图片按相册整理并由 `gallery.json` 驱动
- Anime.js 负责相册出场、进入阅读器和翻页过渡动画
- 每张作品可下载原图；若第三方图片源禁止跨域下载，会在新标签页打开原图
- GitHub Actions 自动部署至 GitHub Pages

## 发布自己的作品

1. 在仓库中新建 `assets/gallery/`，把原图放入其中。例如 `assets/gallery/morning-lake.jpg`。
2. 修改 `gallery.json`。根数组中的每一项是一册相册；`cover` 为封面，`photos` 是相册内页。仓库内图片可这样填写：

   ```json
   {
     "title": "Water Studies",
     "tint": "#536147",
     "cover": "assets/gallery/morning-lake.jpg",
     "coverAlt": "Sunlight across a quiet lake",
     "description": "晨光在湖面留下的短暂形状。",
     "photos": [{
       "title": "Morning Lake",
       "location": "Hangzhou, China",
       "year": "2026",
       "dimensions": "9504 × 6336 px",
       "src": "assets/gallery/morning-lake.jpg",
       "download": "assets/gallery/morning-lake.jpg",
       "alt": "Sunlight across a quiet lake"
     }]
   }
   ```

3. 提交并推送到 `main`，GitHub Actions 会自动发布。

## 大图片说明

- 网站本身没有 10 MB 的客户端限制，原图按需加载并使用浏览器原生解码；为首屏体验，可另设压缩的 `thumbnail` 字段。
- GitHub 普通 Git 单文件上限是 **100 MB**。图片超过时请先压缩、拆分，或改用专业图片存储/CDN；**Git LFS 不适合 GitHub Pages 图片直出**，Pages 只会得到 LFS 指针文件。
- GitHub Pages 仓库和站点大小也受 GitHub 服务限制。大量超大原图建议将 `src` / `download` 指向 Cloudflare R2、S3 或摄影 CDN。

## GitHub Pages 设置

工作流推送后，在仓库 **Settings → Pages → Build and deployment** 中将 Source 设为 **GitHub Actions**。首次工作流完成后，网站地址通常为：

`https://<github-user>.github.io/<repository-name>/`

此仓库用相对路径，项目页与自定义域名都能正常工作。
