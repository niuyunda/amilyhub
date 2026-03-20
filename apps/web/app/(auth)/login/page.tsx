import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>登录教务管理系统</CardTitle>
          <CardDescription>请输入账号和密码，登录后进入工作台。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="account" className="text-sm font-medium">
              账号
            </label>
            <Input id="account" placeholder="请输入账号" />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              密码
            </label>
            <Input id="password" type="password" placeholder="请输入密码" />
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between">
          <Button variant="ghost" asChild>
            <Link href="#">忘记密码</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard">登录</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
