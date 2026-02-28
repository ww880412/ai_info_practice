# 对象存储选型文档

> Phase 0 前置决策 - 2026-02-28

## 选型结论

**选择 Cloudflare R2**

## 选型对比

| 维度 | Cloudflare R2 | AWS S3 | 阿里云 OSS |
|------|---------------|--------|------------|
| **S3 兼容** | ✅ 完全兼容 | ✅ 原生 | ✅ 兼容 |
| **免费额度** | 10GB 存储 + 无出站费 | 有限 | 有限 |
| **SDK** | @aws-sdk/client-s3 | @aws-sdk/client-s3 | ali-oss |
| **配置复杂度** | 低 | 中 | 中 |
| **与 Next.js 集成** | 优秀（Vercel 原生支持） | 良好 | 良好 |

## 选择 R2 的理由

1. **零出站费用** - 文件下载不计费，适合频繁读取场景
2. **S3 兼容** - 使用标准 AWS SDK，未来可无缝切换
3. **Vercel 生态** - 与 Next.js 部署平台天然集成
4. **免费额度充足** - 10GB 存储 + 1M 写入/月 + 10M 读取/月

## 所需环境变量

```env
# Cloudflare R2
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=ai-practice-uploads
R2_PUBLIC_URL=https://your-bucket.r2.dev  # 可选，用于公开访问
```

## 实施步骤

### 1. Cloudflare 控制台配置

1. 登录 Cloudflare Dashboard
2. 进入 R2 Object Storage
3. 创建 Bucket: `ai-practice-uploads`
4. 创建 API Token (R2 读写权限)
5. 记录 Account ID 和 Token

### 2. 本地配置

将上述环境变量添加到 `.env.local`

### 3. 安装依赖

```bash
npm install @aws-sdk/client-s3
```

## 文件组织

```
src/lib/storage/
├── client.ts      # R2 客户端配置
├── upload.ts      # 上传工具函数
├── download.ts    # 下载工具函数
└── index.ts       # 统一导出
```

## 验收标准

- [ ] 文件上传到 R2 成功
- [ ] 通过 signed URL 或 public URL 下载成功
- [ ] Parser 能从 URL 读取文件并处理
- [ ] 本地开发环境正常工作
