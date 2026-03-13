# Mode Comparison Frontend - Task 8: Library 批量操作

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 Library 页面添加批量选择功能和模式对比按钮，实现模式选择弹窗

**Architecture:** 扩展现有 Library 页面，添加批量选择状态管理，使用 shadcn/ui Dialog 组件实现模式选择弹窗

**Tech Stack:** Next.js 16, React 19, shadcn/ui, Tailwind CSS v4, TypeScript

---

## Task 8: 前端组件 - Library 批量操作

### Step 1: 添加批量选择状态

**Files:**
- Modify: `src/app/library/page.tsx`

首先读取现有的 Library 页面代码，了解当前结构。

然后在页面组件中添加批量选择状态：

```typescript
'use client';

import { useState } from 'react';
// ... existing imports

export default function LibraryPage() {
  // ... existing state

  // Batch selection state
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Toggle selection mode
  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    if (isSelectionMode) {
      setSelectedEntryIds([]); // Clear selection when exiting
    }
  };

  // Toggle single entry selection
  const toggleEntrySelection = (entryId: string) => {
    setSelectedEntryIds(prev =>
      prev.includes(entryId)
        ? prev.filter(id => id !== entryId)
        : [...prev, entryId]
    );
  };

  // Select all visible entries
  const selectAllEntries = () => {
    if (!entries) return;
    const allIds = entries.map(e => e.id);
    setSelectedEntryIds(allIds);
  };

  // Clear all selections
  const clearSelection = () => {
    setSelectedEntryIds([]);
  };

  // ... rest of component
}
```

### Step 2: 添加批量操作工具栏

在 Library 页面顶部添加批量操作工具栏：

```typescript
{/* Batch operation toolbar */}
{isSelectionMode && (
  <div className="mb-4 flex items-center justify-between rounded-lg border bg-muted p-4">
    <div className="flex items-center gap-4">
      <span className="text-sm text-muted-foreground">
        已选择 {selectedEntryIds.length} 个条目
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={selectAllEntries}
      >
        全选
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={clearSelection}
        disabled={selectedEntryIds.length === 0}
      >
        清空
      </Button>
    </div>
    <div className="flex items-center gap-2">
      <Button
        variant="default"
        size="sm"
        onClick={() => setIsCompareDialogOpen(true)}
        disabled={selectedEntryIds.length === 0}
      >
        模式对比 ({selectedEntryIds.length})
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleSelectionMode}
      >
        取消
      </Button>
    </div>
  </div>
)}
```

### Step 3: 修改 Entry 卡片支持选择

修改 Entry 卡片组件，添加选择框：

```typescript
{/* Entry card with selection */}
<div
  className={cn(
    "relative rounded-lg border p-4 transition-colors",
    isSelectionMode && "cursor-pointer hover:bg-accent",
    selectedEntryIds.includes(entry.id) && "border-primary bg-accent"
  )}
  onClick={() => isSelectionMode && toggleEntrySelection(entry.id)}
>
  {isSelectionMode && (
    <div className="absolute right-2 top-2">
      <Checkbox
        checked={selectedEntryIds.includes(entry.id)}
        onCheckedChange={() => toggleEntrySelection(entry.id)}
      />
    </div>
  )}
  {/* ... existing entry card content */}
</div>
```

### Step 4: 创建模式选择弹窗组件

**Files:**
- Create: `src/components/library/CompareModesDialog.tsx`

创建模式选择弹窗组件：

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useComparisonBatch } from '@/hooks/useComparisonBatch';
import { Loader2 } from 'lucide-react';

interface CompareModesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedEntryIds: string[];
  onSuccess?: () => void;
}

export function CompareModesDialog({
  open,
  onOpenChange,
  selectedEntryIds,
  onSuccess,
}: CompareModesDialogProps) {
  const router = useRouter();
  const [targetMode, setTargetMode] = useState<'two-step' | 'tool-calling'>('tool-calling');
  const { createBatch, createMutation } = useComparisonBatch();

  const handleSubmit = () => {
    createBatch(
      {
        entryIds: selectedEntryIds,
        targetMode,
      },
      {
        onSuccess: (data) => {
          onOpenChange(false);
          onSuccess?.();
          // Navigate to comparison result page
          router.push(`/comparison/${data.batchId}`);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>模式对比</DialogTitle>
          <DialogDescription>
            选择要对比的目标模式，系统将使用该模式重新处理选中的 {selectedEntryIds.length} 个条目，并与原始结果进行对比。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-3">
            <Label>目标模式</Label>
            <RadioGroup value={targetMode} onValueChange={(value) => setTargetMode(value as any)}>
              <div className="flex items-start space-x-3 space-y-0">
                <RadioGroupItem value="two-step" id="two-step" />
                <div className="space-y-1">
                  <Label htmlFor="two-step" className="font-normal cursor-pointer">
                    两步模式 (Two-Step)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    先快速分类，再深度分析。适合结构化内容。
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3 space-y-0">
                <RadioGroupItem value="tool-calling" id="tool-calling" />
                <div className="space-y-1">
                  <Label htmlFor="tool-calling" className="font-normal cursor-pointer">
                    工具调用模式 (Tool-Calling)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    使用内置工具增强分析能力。适合复杂内容。
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {createMutation.isError && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {createMutation.error?.message || '创建对比任务失败'}
            </div>
          )}

          {createMutation.data && (
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-medium">预计处理时间</p>
              <p className="text-muted-foreground">{createMutation.data.estimatedTime}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createMutation.isPending}
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending || selectedEntryIds.length === 0}
          >
            {createMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            开始对比
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Step 5: 集成弹窗到 Library 页面

在 Library 页面中集成弹窗：

```typescript
import { CompareModesDialog } from '@/components/library/CompareModesDialog';

export default function LibraryPage() {
  // ... existing state
  const [isCompareDialogOpen, setIsCompareDialogOpen] = useState(false);

  const handleCompareSuccess = () => {
    // Clear selection after successful comparison
    setSelectedEntryIds([]);
    setIsSelectionMode(false);
  };

  return (
    <div>
      {/* ... existing content */}

      {/* Compare modes dialog */}
      <CompareModesDialog
        open={isCompareDialogOpen}
        onOpenChange={setIsCompareDialogOpen}
        selectedEntryIds={selectedEntryIds}
        onSuccess={handleCompareSuccess}
      />
    </div>
  );
}
```

### Step 6: 添加选择模式切换按钮

在 Library 页面工具栏添加切换按钮：

```typescript
{/* Toolbar */}
<div className="flex items-center justify-between mb-4">
  <div className="flex items-center gap-2">
    {/* ... existing filters */}
  </div>
  <div className="flex items-center gap-2">
    <Button
      variant={isSelectionMode ? "default" : "outline"}
      size="sm"
      onClick={toggleSelectionMode}
    >
      {isSelectionMode ? "退出选择" : "批量选择"}
    </Button>
  </div>
</div>
```

### Step 7: 手动测试

测试场景：
1. 点击"批量选择"按钮进入选择模式
2. 选择多个 Entry
3. 点击"模式对比"按钮
4. 在弹窗中选择目标模式
5. 点击"开始对比"
6. 验证跳转到对比结果页面

### Step 8: TypeScript 类型检查

Run: `npx tsc --noEmit`
Expected: No errors

### Step 9: Commit

```bash
git add src/app/library/page.tsx src/components/library/CompareModesDialog.tsx
git commit -m "feat(library): add batch selection and mode comparison dialog

- Add batch selection mode with checkbox UI
- Add batch operation toolbar (select all, clear, compare)
- Create CompareModesDialog component with mode selection
- Integrate useComparisonBatch hook for batch creation
- Auto-navigate to comparison result page on success
- Support two-step and tool-calling mode selection

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## 验收清单

- [ ] 批量选择模式正确实现
- [ ] Entry 卡片支持选择（带 Checkbox）
- [ ] 批量操作工具栏正确显示
- [ ] CompareModesDialog 组件正确实现
- [ ] 模式选择 UI 清晰易用
- [ ] 创建批次后正确跳转
- [ ] 手动测试通过
- [ ] TypeScript 类型检查通过
- [ ] 代码已提交到 Git

---

**任务创建日期**: 2026-03-08
**预计工时**: 1.5-2 小时
**前置任务**: Task 7（useComparisonBatch Hook）
