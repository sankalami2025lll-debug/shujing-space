"use client";

/**
 * 页面名称：注册登录 AuthPage
 * 页面用途：用户在使用模型发布、收藏、个人中心等功能前完成身份认证
 * 主要功能：登录/注册 Tab、密码切换、验证码登录、60s 倒计时、协议勾选、找回密码、成功后跳转模型库
 * 对应文档：页面功能注释文档/12_注册登录_AuthPage.md
 * 说明：独立顶栏（不使用全站 NavBar）；接入 AuthProvider 与 /api/auth/*；成功后 router.push('/models')。
 */
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Check, ArrowLeft, ChevronDown, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/auth-provider";
import { ApiError } from "@/lib/http";
import {
  sendCode,
  login,
  register,
  resetPassword,
  type VerificationScene,
} from "@/lib/api/auth";

export default function AuthPage() {
  const router = useRouter();
  const { setAuth } = useAuth();

  const [tab, setTab] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loginMethod, setLoginMethod] = useState<"password" | "code">("password");

  const [loginAccount, setLoginAccount] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginCode, setLoginCode] = useState("");

  const [regAccount, setRegAccount] = useState("");
  const [regCode, setRegCode] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regCompany, setRegCompany] = useState("");
  const [regPurpose, setRegPurpose] = useState("");

  const [sendingCode, setSendingCode] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [showForgot, setShowForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotAccount, setForgotAccount] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotCountdown, setForgotCountdown] = useState(0);
  const [forgotSendingCode, setForgotSendingCode] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    if (forgotCountdown <= 0) return;
    const timer = setTimeout(() => setForgotCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [forgotCountdown]);

  const resolveErrorMessage = (e: unknown, fallback: string) =>
    e instanceof ApiError ? e.message : fallback;

  const handleSendCode = async (
    scene: Extract<VerificationScene, "register" | "login">,
    target: string,
  ) => {
    if (sendingCode || countdown > 0) return;
    if (!target.trim()) {
      toast.error("请先输入手机号或邮箱");
      return;
    }
    setSendingCode(true);
    try {
      const res = await sendCode({ target: target.trim(), scene });
      setCountdown(60);
      if (res.devCode) {
        toast.success(`验证码已发送（开发环境验证码：${res.devCode}）`);
      } else {
        toast.success("验证码已发送，请注意查收");
      }
    } catch (e) {
      toast.error(resolveErrorMessage(e, "验证码发送失败，请稍后重试"));
    } finally {
      setSendingCode(false);
    }
  };

  const handleLogin = async () => {
    if (loggingIn) return;
    if (!loginAccount.trim()) {
      toast.error("请输入手机号或邮箱");
      return;
    }
    if (loginMethod === "password" && !loginPassword) {
      toast.error("请输入密码");
      return;
    }
    if (loginMethod === "code" && !loginCode.trim()) {
      toast.error("请输入验证码");
      return;
    }
    setLoggingIn(true);
    try {
      const result = await login({
        account: loginAccount.trim(),
        loginType: loginMethod,
        password: loginMethod === "password" ? loginPassword : undefined,
        code: loginMethod === "code" ? loginCode.trim() : undefined,
      });
      setAuth(result.accessToken, result.user);
      toast.success("登录成功，正在进入模型库");
      router.push("/models");
    } catch (e) {
      toast.error(resolveErrorMessage(e, "登录失败，请稍后重试"));
    } finally {
      setLoggingIn(false);
    }
  };

  const handleRegister = async () => {
    if (registering) return;
    if (!agreed) {
      toast.error("请先同意用户协议与隐私政策");
      return;
    }
    if (!regAccount.trim()) {
      toast.error("请输入手机号或邮箱");
      return;
    }
    if (!regCode.trim()) {
      toast.error("请输入验证码");
      return;
    }
    if (regPassword.length < 6) {
      toast.error("密码至少 6 位");
      return;
    }
    setRegistering(true);
    try {
      const result = await register({
        account: regAccount.trim(),
        code: regCode.trim(),
        password: regPassword,
        company: regCompany.trim() || undefined,
        roleType: regPurpose || undefined,
        agreed: true,
      });
      setAuth(result.accessToken, result.user);
      toast.success("注册成功，正在进入模型库");
      router.push("/models");
    } catch (e) {
      toast.error(resolveErrorMessage(e, "注册失败，请稍后重试"));
    } finally {
      setRegistering(false);
    }
  };

  const handleForgotSendCode = async () => {
    if (forgotSendingCode || forgotCountdown > 0) return;
    if (!forgotAccount.trim()) {
      toast.error("请先输入手机号或邮箱");
      return;
    }
    setForgotSendingCode(true);
    try {
      const res = await sendCode({ target: forgotAccount.trim(), scene: "reset" });
      setForgotCountdown(60);
      if (res.devCode) {
        toast.success(`重置验证码已发送（开发环境验证码：${res.devCode}）`);
      } else {
        toast.success("重置验证码已发送，请注意查收");
      }
    } catch (e) {
      toast.error(resolveErrorMessage(e, "验证码发送失败，请稍后重试"));
    } finally {
      setForgotSendingCode(false);
    }
  };

  const handleResetPassword = async () => {
    if (resetting) return;
    if (!forgotAccount.trim()) {
      toast.error("请输入手机号或邮箱");
      return;
    }
    if (!forgotCode.trim()) {
      toast.error("请输入重置验证码");
      return;
    }
    if (forgotNewPassword.length < 6) {
      toast.error("新密码至少 6 位");
      return;
    }
    setResetting(true);
    try {
      await resetPassword({
        account: forgotAccount.trim(),
        code: forgotCode.trim(),
        newPassword: forgotNewPassword,
      });
      setForgotSent(true);
      toast.success("密码重置成功，请使用新密码登录");
    } catch (e) {
      toast.error(resolveErrorMessage(e, "密码重置失败，请稍后重试"));
    } finally {
      setResetting(false);
    }
  };

  const openForgot = () => {
    setForgotSent(false);
    setForgotAccount("");
    setForgotCode("");
    setForgotNewPassword("");
    setForgotCountdown(0);
    setShowForgot(true);
  };

  const inputClass =
    "w-full bg-black/40 border border-white/10 rounded-[12px] px-4 text-[14px] text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-400/40 transition-colors h-[46px]";

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col overflow-x-hidden">
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-black/60 border-b border-white/10 h-14 md:h-16 px-5 md:px-10 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <img
            src="/brand/company-logo-transparent.png"
            alt="数境空间"
            className="h-7 w-auto object-contain"
            style={{ mixBlendMode: "screen" }}
          />
          <span className="text-[17px] md:text-[19px] font-medium tracking-wide">数境空间</span>
        </Link>
        <Link
          href="/"
          className="flex items-center gap-1.5 text-[13px] md:text-[14px] text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回官网
        </Link>
      </nav>

      <div className="flex-1 flex pt-14 md:pt-16 flex-col lg:flex-row">
        <div className="hidden lg:flex flex-col justify-center px-16 xl:px-24 bg-[#080808] lg:w-[45%] relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-cyan-500/[0.06] blur-3xl" />
          <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-400/[0.04] blur-3xl" />

          <svg
            className="absolute bottom-12 right-8 w-[200px] h-[160px] opacity-[0.12]"
            viewBox="0 0 200 160"
            fill="none"
          >
            <g stroke="rgba(255,255,255,0.6)" strokeWidth="0.5">
              <rect x="30" y="50" width="60" height="90" />
              <rect x="110" y="30" width="60" height="110" />
              <line x1="30" y1="50" x2="15" y2="35" />
              <line x1="90" y1="50" x2="75" y2="35" />
              <line x1="90" y1="140" x2="75" y2="125" />
              <line x1="30" y1="140" x2="15" y2="125" />
              <rect x="15" y="35" width="60" height="90" />
              <line x1="110" y1="30" x2="95" y2="15" />
              <line x1="170" y1="30" x2="155" y2="15" />
              <rect x="95" y="15" width="60" height="110" />
            </g>
            <g stroke="rgba(96,165,250,0.5)" strokeWidth="0.7">
              <line x1="15" y1="35" x2="95" y2="15" />
              <line x1="75" y1="35" x2="155" y2="15" />
            </g>
          </svg>

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/[0.05] mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span className="text-[12px] text-cyan-400 tracking-wider">模型库平台</span>
            </div>

            <h1 className="text-[36px] xl:text-[44px] font-bold leading-tight mb-6 whitespace-pre-line">
              {"连接真实空间\n与数字应用"}
            </h1>

            <p className="text-[15px] text-gray-400 mb-10 leading-relaxed max-w-[380px]">
              登录数境空间，浏览真实三维空间数据资产，提交数据服务需求，进入云端模型展示平台。
            </p>

            <div className="flex flex-col gap-4">
              {["真实空间数据资产", "云端模型展示", "具身智能空间训练数据"].map((item) => (
                <div key={item} className="flex items-center gap-3 text-[14px] text-gray-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-5 py-12 md:py-16">
          <div className="w-full max-w-[440px] bg-white/[0.03] border border-white/10 rounded-[24px] p-7 md:p-9 backdrop-blur-sm">
            <p className="text-[20px] md:text-[22px] font-semibold mb-6">欢迎使用数境空间</p>

            <div className="flex bg-white/[0.04] rounded-[12px] p-1 mb-7">
              {(["login", "register"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`flex-1 py-2 rounded-[10px] text-[14px] font-medium transition-all ${
                    tab === t ? "bg-white/[0.08] text-white" : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {t === "login" ? "登录" : "注册"}
                </button>
              ))}
            </div>

            {tab === "login" && (
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] text-gray-400">手机号 / 邮箱</label>
                  <input
                    className={inputClass}
                    placeholder="请输入手机号或邮箱"
                    type="text"
                    value={loginAccount}
                    onChange={(e) => setLoginAccount(e.target.value)}
                  />
                </div>

                {loginMethod === "password" ? (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] text-gray-400">密码</label>
                    <div className="relative">
                      <input
                        className={inputClass}
                        placeholder="请输入密码"
                        type={showPassword ? "text" : "password"}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] text-gray-400">验证码</label>
                    <div className="flex gap-2">
                      <input
                        className={inputClass}
                        placeholder="请输入验证码"
                        type="text"
                        value={loginCode}
                        onChange={(e) => setLoginCode(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => handleSendCode("login", loginAccount)}
                        disabled={countdown > 0 || sendingCode}
                        className="flex-shrink-0 px-3 py-1 text-[12px] border border-white/15 rounded-lg text-gray-400 hover:text-white hover:border-white/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        {countdown > 0
                          ? `${countdown}s 后重试`
                          : sendingCode
                            ? "发送中…"
                            : "获取验证码"}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      setLoginMethod(loginMethod === "password" ? "code" : "password")
                    }
                    className="text-[13px] text-cyan-400/80 hover:text-cyan-400 cursor-pointer transition-colors"
                  >
                    {loginMethod === "password" ? "使用验证码登录" : "使用密码登录"}
                  </button>
                  <button
                    type="button"
                    onClick={openForgot}
                    className="text-[13px] text-gray-500 hover:text-gray-300 cursor-pointer transition-colors"
                  >
                    忘记密码？
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleLogin}
                  disabled={loggingIn}
                  className="w-full h-[46px] rounded-full bg-white text-black text-[15px] font-semibold hover:bg-gray-100 transition-all mt-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
                >
                  {loggingIn ? "登录中…" : "登录"}
                </button>

                <p className="text-[13px] text-gray-500 text-center">
                  还没有账号？{" "}
                  <span
                    onClick={() => setTab("register")}
                    className="text-cyan-400/80 hover:text-cyan-400 cursor-pointer transition-colors"
                  >
                    立即注册
                  </span>
                </p>
              </div>
            )}

            {tab === "register" && (
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] text-gray-400">手机号 / 邮箱</label>
                  <input
                    className={inputClass}
                    placeholder="请输入手机号或邮箱"
                    type="text"
                    value={regAccount}
                    onChange={(e) => setRegAccount(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] text-gray-400">验证码</label>
                  <div className="flex gap-2">
                    <input
                      className={inputClass}
                      placeholder="请输入验证码"
                      type="text"
                      value={regCode}
                      onChange={(e) => setRegCode(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => handleSendCode("register", regAccount)}
                      disabled={countdown > 0 || sendingCode}
                      className="flex-shrink-0 px-3 py-1 text-[12px] border border-white/15 rounded-lg text-gray-400 hover:text-white hover:border-white/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {countdown > 0
                        ? `${countdown}s 后重试`
                        : sendingCode
                          ? "发送中…"
                          : "获取验证码"}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] text-gray-400">设置密码</label>
                  <div className="relative">
                    <input
                      className={inputClass}
                      placeholder="请设置密码（至少 6 位）"
                      type={showPassword ? "text" : "password"}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] text-gray-400">公司名称</label>
                  <input
                    className={inputClass}
                    placeholder="请输入公司名称"
                    type="text"
                    value={regCompany}
                    onChange={(e) => setRegCompany(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] text-gray-400">使用目的</label>
                  <div className="relative">
                    <select
                      className="w-full bg-black/40 border border-white/10 rounded-[12px] px-4 h-[46px] text-[14px] text-white focus:outline-none focus:border-cyan-400/40 appearance-none transition-colors"
                      value={regPurpose}
                      onChange={(e) => setRegPurpose(e.target.value)}
                    >
                      <option value="" className="bg-[#0a0a0a]">
                        请选择使用目的
                      </option>
                      <option value="browse" className="bg-[#0a0a0a]">
                        浏览模型
                      </option>
                      <option value="service" className="bg-[#0a0a0a]">
                        提交数据服务需求
                      </option>
                      <option value="twin" className="bg-[#0a0a0a]">
                        数字孪生项目
                      </option>
                      <option value="engineering" className="bg-[#0a0a0a]">
                        工程改造项目
                      </option>
                      <option value="tourism" className="bg-[#0a0a0a]">
                        数字文旅项目
                      </option>
                      <option value="embodied" className="bg-[#0a0a0a]">
                        具身智能空间训练
                      </option>
                      <option value="other" className="bg-[#0a0a0a]">
                        其他
                      </option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => setAgreed(!agreed)}
                    className={`flex-shrink-0 w-5 h-5 rounded-[5px] border flex items-center justify-center mt-0.5 transition-all ${
                      agreed
                        ? "bg-cyan-400/20 border-cyan-400/60"
                        : "border-white/20 bg-white/[0.03]"
                    }`}
                  >
                    {agreed && <Check className="w-3 h-3 text-cyan-400" />}
                  </button>
                  <span className="text-[13px] text-gray-400 leading-relaxed">
                    我已阅读并同意
                    <span className="text-white/80 hover:text-white cursor-pointer transition-colors">
                      《用户协议》
                    </span>
                    和
                    <span className="text-white/80 hover:text-white cursor-pointer transition-colors">
                      《隐私政策》
                    </span>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleRegister}
                  disabled={!agreed || registering}
                  className="w-full h-[46px] rounded-full bg-white text-black text-[15px] font-semibold hover:bg-gray-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
                >
                  {registering ? "注册中…" : "注册账号"}
                </button>

                <p className="text-[13px] text-gray-500 text-center">
                  已有账号？{" "}
                  <span
                    onClick={() => setTab("login")}
                    className="text-cyan-400/80 hover:text-cyan-400 cursor-pointer transition-colors"
                  >
                    立即登录
                  </span>
                </p>
              </div>
            )}

            <div className="border-t border-white/[0.06] mt-6 pt-4">
              <p className="text-[12px] text-gray-600 text-center">
                登录即表示你同意数境空间的服务条款
              </p>
            </div>
          </div>
        </div>
      </div>

      {showForgot && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          onClick={() => setShowForgot(false)}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-[400px] bg-[#0f0f0f] border border-white/10 rounded-[20px] p-6 md:p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[17px] font-semibold">找回密码</h3>
              <button
                type="button"
                onClick={() => setShowForgot(false)}
                className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {forgotSent ? (
              <div className="flex flex-col items-center text-center py-4 gap-3">
                <Check className="w-10 h-10 text-cyan-400" />
                <p className="text-[14px] text-gray-300">密码重置成功，请使用新密码登录。</p>
                <button
                  type="button"
                  onClick={() => setShowForgot(false)}
                  className="mt-2 px-6 py-2.5 rounded-full bg-white text-black text-[14px] font-medium hover:bg-gray-100 transition-all"
                >
                  我知道了
                </button>
              </div>
            ) : (
              <>
                <p className="text-[13px] text-gray-400 leading-relaxed mb-5">
                  输入注册手机号或邮箱，获取重置验证码并设置新密码。
                </p>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] text-gray-400">手机号 / 邮箱</label>
                    <input
                      className={inputClass}
                      placeholder="请输入注册手机号或邮箱"
                      type="text"
                      value={forgotAccount}
                      onChange={(e) => setForgotAccount(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] text-gray-400">重置验证码</label>
                    <div className="flex gap-2">
                      <input
                        className={inputClass}
                        placeholder="请输入重置验证码"
                        type="text"
                        value={forgotCode}
                        onChange={(e) => setForgotCode(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={handleForgotSendCode}
                        disabled={forgotCountdown > 0 || forgotSendingCode}
                        className="flex-shrink-0 px-3 py-1 text-[12px] border border-white/15 rounded-lg text-gray-400 hover:text-white hover:border-white/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                      >
                        {forgotCountdown > 0
                          ? `${forgotCountdown}s 后重试`
                          : forgotSendingCode
                            ? "发送中…"
                            : "获取验证码"}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] text-gray-400">新密码</label>
                    <input
                      className={inputClass}
                      placeholder="请设置新密码（至少 6 位）"
                      type={showPassword ? "text" : "password"}
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleResetPassword}
                    disabled={resetting}
                    className="w-full h-[46px] rounded-full bg-white text-black text-[15px] font-semibold hover:bg-gray-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
                  >
                    {resetting ? "提交中…" : "重置密码"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

