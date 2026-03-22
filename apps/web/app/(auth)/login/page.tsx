"use client";

import { Eye, EyeOff, Lock, LogIn, User } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import styles from "./login.module.css";

// ─── 读取 URL 参数的独立组件 ─────────────────────────────────────────────────
// useSearchParams 必须在 Suspense 边界内，把它单独隔离，
// 避免它导致整个 LoginForm 进入 Suspense 挂起 → 重建 → 事件丢失
function SearchParamsReader({ onRead }: { onRead: (from: string) => void }) {
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/dashboard";
  // 通过回调把值传给父组件（仅在值变化时调用一次）
  onRead(from);
  return null;
}

// ─── 核心登录表单（不使用任何 Suspense 相关的 hook）──────────────────────────
function LoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function doLogin() {
    if (isLoading) return;
    setError("");
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
          redirectTo,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; redirectTo?: string }
        | null;

      if (!response.ok) {
        setError(payload?.error ?? "登录失败，请稍后重试");
        return;
      }

      router.replace(payload?.redirectTo ?? redirectTo);
      router.refresh();
    } finally {
      setIsLoading(false);
    }
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    void doLogin();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      void doLogin();
    }
  }

  return (
    <form onSubmit={handleFormSubmit} className={styles.loginForm}>
      {/* 账号 */}
      <div className={styles.fieldGroup}>
        <label htmlFor="login-username" className={styles.fieldLabel}>
          账号
        </label>
        <div className={styles.inputWrapper}>
          <span className={styles.inputIcon}>
            <User size={16} />
          </span>
          <Input
            id="login-username"
            type="text"
            className={styles.fieldInput}
            placeholder="请输入账号"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="username"
            disabled={isLoading}
            autoFocus
          />
        </div>
      </div>

      {/* 密码 */}
      <div className={styles.fieldGroup}>
        <label htmlFor="login-password" className={styles.fieldLabel}>
          密码
        </label>
        <div className={styles.inputWrapper}>
          <span className={styles.inputIcon}>
            <Lock size={16} />
          </span>
          <Input
            id="login-password"
            type={showPassword ? "text" : "password"}
            className={styles.fieldInput}
            placeholder="请输入密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="current-password"
            disabled={isLoading}
          />
          <button
            type="button"
            className={styles.togglePassword}
            onClick={() => setShowPassword((v) => !v)}
            tabIndex={-1}
            aria-label={showPassword ? "隐藏密码" : "显示密码"}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className={styles.errorBanner} role="alert">
          <span className={styles.errorDot} />
          {error}
        </div>
      )}

      {/* 登录按钮 */}
      <Button
        type="submit"
        className={styles.loginBtn}
        disabled={isLoading}
      >
        {isLoading ? (
          <span className={styles.btnLoading}>
            <span className={styles.spinner} />
            登录中…
          </span>
        ) : (
          <span className={styles.btnContent}>
            <LogIn size={18} />
            登录
          </span>
        )}
      </Button>
    </form>
  );
}

// ─── 登录页壳（装饰 + 布局）─────────────────────────────────────────────────
function LoginShell() {
  const [redirectTo, setRedirectTo] = useState("/dashboard");
  const handleRead = useCallback((from: string) => setRedirectTo(from), []);

  return (
    <div className={styles.loginPage}>
      {/* Suspense 仅作用于 SearchParamsReader，不影响 LoginForm 的事件绑定 */}
      <Suspense fallback={null}>
        <SearchParamsReader onRead={handleRead} />
      </Suspense>

      {/* 背景装饰 */}
      <div className={styles.bgDecoration}>
        <div className={styles.blob1} />
        <div className={styles.blob2} />
        <div className={styles.blob3} />
        <div className={styles.gridOverlay} />
      </div>

      {/* 登录卡片 */}
      <div className={styles.loginCardWrapper}>
        {/* Logo + 标题 */}
        <div className={styles.loginHeader}>
          <div className={styles.logoRing}>
            <div className={styles.logoIcon}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M16 4L28 10V22L16 28L4 22V10L16 4Z" fill="url(#loginGrad)" fillOpacity="0.9" />
                <path d="M16 8L24 12V20L16 24L8 20V12L16 8Z" fill="white" fillOpacity="0.25" />
                <text x="16" y="20" textAnchor="middle" fill="white" fontSize="11" fontWeight="700" fontFamily="Inter, sans-serif">A</text>
                <defs>
                  <linearGradient id="loginGrad" x1="4" y1="4" x2="28" y2="28">
                    <stop offset="0%" stopColor="#8b9cf4" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
          <h1 className={styles.loginTitle}>Amily Hub</h1>
          <p className={styles.loginSubtitle}>教务管理系统</p>
        </div>

        {/* 表单卡片 */}
        <div className={styles.loginCard}>
          <div className={styles.cardInner}>
            <div className={styles.cardTop}>
              <h2 className={styles.cardHeading}>欢迎回来</h2>
              <p className={styles.cardDesc}>请输入您的账号和密码登录</p>
            </div>
            <LoginForm redirectTo={redirectTo} />
          </div>
        </div>

        <p className={styles.loginFooter}>© {new Date().getFullYear()} Amily Hub · 教务管理平台</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <LoginShell />;
}
