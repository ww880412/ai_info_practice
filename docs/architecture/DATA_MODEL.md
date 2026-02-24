# 数据模型

> Prisma Schema 核心模型定义

## 核心模型

### Entry (条目)

```prisma
model Entry {
  id              String   @id @default(cuid())
  title           String?
  originalContent String?  @db.Text
  sourceUrl       String?
  sourceType      SourceType

  // AI 分析结果
  contentType     ContentType?
  techDomain      TechDomain?
  aiTags          String[]
  coreSummary     String?  @db.Text
  keyPoints       String[]
  practiceValue   PracticeValue?
  practiceReason  String?

  // 质量评估
  qualityScores   Json?

  // 元数据
  confidence      Float?
  difficulty      Difficulty?
  processStatus   ProcessStatus @default(PENDING)
  userTags        String[]

  // 关联
  practiceTask    PracticeTask?
  reasoningTraces ReasoningTrace[]
  qualityRevisions QualityRevision[]
  groups          Group[]      @relation("EntryGroups")

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([processStatus])
  @@index([contentType])
}
```

### Group (分组)

```prisma
model Group {
  id        String   @id @default(cuid())
  name      String
  parentId  String?
  parent    Group?   @relation("GroupHierarchy", fields: [parentId], references: [id])
  children  Group[]  @relation("GroupHierarchy")
  entries   Entry[]  @relation("EntryGroups")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([name, parentId])
}
```

### PracticeTask (练习任务)

```prisma
model PracticeTask {
  id          String   @id @default(cuid())
  entryId     String   @unique
  entry       Entry    @relation(fields: [entryId], references: [id])
  steps       Step[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### Step (练习步骤)

```prisma
model Step {
  id            String     @id @default(cuid())
  taskId        String
  task          PracticeTask @relation(fields: [taskId], references: [id])
  content       String     @db.Text
  order         Int
  status        StepStatus @default(PENDING)
  notes         String?    @db.Text
  completedAt   DateTime?

  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  @@index([taskId])
}
```

### ReasoningTrace (推理轨迹)

```prisma
model ReasoningTrace {
  id        String   @id @default(cuid())
  entryId   String
  entry     Entry    @relation(fields: [entryId], references: [id])
  steps     Json     // Array of reasoning steps
  rawSteps  Json?    // Raw AI response steps
  createdAt DateTime @default(now())

  @@index([entryId])
}
```

### QualityRevision (质量评估历史)

```prisma
model QualityRevision {
  id        String   @id @default(cuid())
  entryId   String
  entry     Entry    @relation(fields: [entryId], references: [id])
  scores    Json     // Quality scores
  overrides Json?    // Manual overrides
  createdAt DateTime @default(now())

  @@index([entryId])
}
```

## 枚举类型

```prisma
enum SourceType {
  URL
  PDF
  TEXT
}

enum ContentType {
  TUTORIAL
  TOOL
  PRINCIPLE
  CASE_STUDY
  OPINION
}

enum PracticeValue {
  ACTIONABLE
  KNOWLEDGE
  NOT_RELEVANT
}

enum ProcessStatus {
  PENDING
  PARSING
  AI_PROCESSING
  COMPLETED
  FAILED
}

enum Difficulty {
  EASY
  MEDIUM
  HARD
}

enum StepStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  SKIPPED
}
```

---

*最后更新: 2026-02-24*
