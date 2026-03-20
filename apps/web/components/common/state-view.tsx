import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingState({ text = "加载中..." }: { text?: string }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <p className="text-sm text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  );
}

export function EmptyState({ title = "暂无数据", hint = "请调整筛选条件后重试。" }: { title?: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="space-y-2 p-8 text-center">
        <p className="text-base font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Alert>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>请求失败，请稍后重试</AlertTitle>
      <AlertDescription className="mt-1 flex items-center justify-between gap-2">
        <span>{message}</span>
        {onRetry ? (
          <Button size="sm" variant="outline" onClick={onRetry}>
            重试
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

export function ForbiddenState({ message = "暂无权限访问该模块" }: { message?: string }) {
  return (
    <Card>
      <CardContent className="space-y-2 p-8 text-center">
        <p className="text-base font-medium">无权限</p>
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}
