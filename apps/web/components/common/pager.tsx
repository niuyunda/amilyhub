import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function Pager({
  page,
  pageSize,
  total,
  onPrev,
  onNext,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const totalPage = Math.max(1, Math.ceil(total / pageSize));
  const disablePrev = page <= 1;
  const disableNext = page >= totalPage;

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
        <p className="text-sm text-muted-foreground">
          第 {page} / {totalPage} 页，共 {total} 条
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" disabled={disablePrev} onClick={onPrev}>
            上一页
          </Button>
          <Button variant="outline" disabled={disableNext} onClick={onNext}>
            下一页
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
