"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ParticleNetwork from "@/components/ParticleNetwork";

export default function LoginPage() {
  const router = useRouter();
  const [loginMode, setLoginMode] = useState<"password" | "otp">("password");

  // Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; otp?: string; general?: string }>({});
  const [successMsg, setSuccessMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    let interval: any;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleRoleRedirect = (userRoleRaw: string) => {
    const userRole = (userRoleRaw || "").toLowerCase().trim();

    if (userRole.includes("marketing")) {
      setErrors({ general: "Access denied. Marketing accounts have been decommissioned." });
      setIsLoading(false);
      return;
    }

    if (userRole.includes("counsellor") || userRole.includes("counselor")) {
      window.location.href = "/counsellor-dashboard";
    } else if (
      userRole.includes("centre") ||
      userRole.includes("center") ||
      userRole.includes("manager") ||
      userRole.includes("branch") ||
      (userRole.includes("head") && !userRole.includes("admin"))
    ) {
      window.location.href = "/manager-dashboard";
    } else if (userRole.includes("teacher")) {
      window.location.href = "/teacher-dashboard";
    } else if (userRole.includes("cfo") || userRole.includes("finance")) {
      window.location.href = "/cfo-dashboard";
    } else if (userRole.includes("crm")) {
      window.location.href = "/crm-dashboard";
    } else if (
      userRole === "admin" ||
      userRole === "super admin" ||
      userRole === "director" ||
      userRole.includes("admin") ||
      userRole.includes("director")
    ) {
      window.location.href = "/admin-dashboard";
    } else {
      setErrors({ general: "Access denied. Unrecognized or unauthorized user role." });
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSuccessMsg("");

    if (!email) {
      setErrors({ email: "Email is required" });
      return;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setErrors({ email: "Please enter a valid email address" });
      return;
    }

    if (!password) {
      setErrors({ password: "Password is required" });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || "Login failed. Please check your credentials.";
        if (errorMsg.toLowerCase().includes("password")) {
          setErrors({ password: errorMsg });
        } else {
          setErrors({ email: errorMsg });
        }
        setIsLoading(false);
      } else {
        handleRoleRedirect(data.user?.role);
      }
    } catch (err) {
      setErrors({ general: "An unexpected error occurred. Please try again." });
      setIsLoading(false);
    }
  };

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrors({});
    setSuccessMsg("");

    if (!email) {
      setErrors({ email: "Email is required to receive OTP" });
      return;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setErrors({ email: "Please enter a valid email address" });
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrors({ email: data.error || "Failed to send OTP to email." });
      } else {
        setIsOtpSent(true);
        setResendTimer(60);
        setSuccessMsg(`OTP code has been sent to ${email}. Please check your inbox.`);
      }
    } catch (err) {
      setErrors({ general: "Failed to connect to server. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSuccessMsg("");

    if (!otp || otp.trim().length !== 6) {
      setErrors({ otp: "Please enter the 6-digit OTP code sent to your email" });
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: otp.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrors({ otp: data.error || "Verification failed" });
        setIsLoading(false);
      } else {
        handleRoleRedirect(data.user?.role);
      }
    } catch (err) {
      setErrors({ general: "Verification failed. Please try again." });
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-12 text-slate-800 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Background Particle Effect */}
      <ParticleNetwork />

      {/* Ambient Glows */}
      <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-indigo-300/30 blur-[130px] pointer-events-none animate-pulse-glow"></div>
      <div className="absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full bg-purple-300/30 blur-[130px] pointer-events-none animate-pulse-glow" style={{ animationDelay: "2.5s" }}></div>

      {/* Main Login Card */}
      <div className="relative w-full max-w-md rounded-3xl border border-slate-200/80 bg-white/95 backdrop-blur-xl p-8 sm:p-10 shadow-2xl shadow-slate-200/80 transition-all duration-500">
        
        {/* Brand Logo */}
        <div className="flex justify-center mb-6">
          <div className="group relative flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-600/30 transition-transform duration-300 hover:scale-105">
            <span className="text-white font-extrabold text-xl tracking-tight font-sans">CF</span>
          </div>
        </div>

        {/* Header */}
        <div className="mb-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-800 font-sans">
            Welcome back
          </h2>
          <p className="mt-1.5 text-xs sm:text-sm font-medium text-slate-400 font-sans">
            Sign in to access your portal
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex rounded-2xl bg-slate-100 p-1 mb-6 border border-slate-200/60">
          <button
            type="button"
            onClick={() => {
              setLoginMode("password");
              setErrors({});
              setSuccessMsg("");
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              loginMode === "password"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Password Login
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginMode("otp");
              setErrors({});
              setSuccessMsg("");
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              loginMode === "otp"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            ✉️ Email OTP Login
          </button>
        </div>

        {/* Global Error Banner */}
        {errors.general && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-xs font-semibold text-center">
            {errors.general}
          </div>
        )}

        {/* Global Success Banner */}
        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-semibold text-center">
            {successMsg}
          </div>
        )}

        {/* --- PASSWORD LOGIN FORM --- */}
        {loginMode === "password" && (
          <form onSubmit={handlePasswordSubmit} className="space-y-5">
            <div className="group">
              <label htmlFor="email" className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                EMAIL ADDRESS
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  className={`block w-full rounded-2xl border bg-slate-50/70 py-3 px-4 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none ${
                    errors.email ? "border-rose-400 focus:ring-2 focus:ring-rose-400/20" : "border-slate-200 focus:border-indigo-500 focus:bg-white"
                  }`}
                  placeholder="name@example.com"
                />
              </div>
              {errors.email && <p className="mt-1 text-xs text-rose-500 font-semibold">{errors.email}</p>}
            </div>

            <div className="group">
              <label htmlFor="password" className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                PASSWORD
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  className={`block w-full rounded-2xl border bg-slate-50/70 py-3 pl-4 pr-10 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none ${
                    errors.password ? "border-rose-400 focus:ring-2 focus:ring-rose-400/20" : "border-slate-200 focus:border-indigo-500 focus:bg-white"
                  }`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-indigo-600 cursor-pointer"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-rose-500 font-semibold">{errors.password}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center rounded-2xl bg-indigo-600 hover:bg-indigo-700 py-3.5 text-xs font-bold text-white transition-all shadow-md cursor-pointer disabled:opacity-75"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        )}

        {/* --- EMAIL OTP LOGIN FORM --- */}
        {loginMode === "otp" && (
          <form onSubmit={isOtpSent ? handleVerifyOtp : handleSendOtp} className="space-y-5">
            <div className="group">
              <label htmlFor="otp-email" className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                WORK / REGISTERED EMAIL
              </label>
              <div className="relative">
                <input
                  id="otp-email"
                  type="email"
                  disabled={isOtpSent}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  className={`block w-full rounded-2xl border bg-slate-50/70 py-3 px-4 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none ${
                    errors.email ? "border-rose-400 focus:ring-2 focus:ring-rose-400/20" : "border-slate-200 focus:border-indigo-500 focus:bg-white"
                  } ${isOtpSent ? "opacity-70 bg-slate-100" : ""}`}
                  placeholder="user@example.com"
                />
              </div>
              {errors.email && <p className="mt-1 text-xs text-rose-500 font-semibold">{errors.email}</p>}
            </div>

            {isOtpSent && (
              <div className="group animate-in fade-in slide-in-from-top-2 duration-300">
                <label htmlFor="otp-input" className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                  ENTER 6-DIGIT EMAIL OTP
                </label>
                <div className="relative">
                  <input
                    id="otp-input"
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => {
                      setOtp(e.target.value.replace(/[^0-9]/g, ""));
                      if (errors.otp) setErrors((prev) => ({ ...prev, otp: undefined }));
                    }}
                    className={`block w-full rounded-2xl border bg-slate-50/70 py-3.5 px-4 text-center text-lg font-mono font-bold tracking-[8px] text-slate-900 placeholder-slate-300 outline-none ${
                      errors.otp ? "border-rose-400 focus:ring-2 focus:ring-rose-400/20" : "border-indigo-300 focus:border-indigo-600 focus:bg-white"
                    }`}
                    placeholder="000000"
                  />
                </div>
                {errors.otp && <p className="mt-1 text-xs text-rose-500 font-semibold">{errors.otp}</p>}

                <div className="flex items-center justify-between mt-3 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOtpSent(false);
                      setOtp("");
                      setSuccessMsg("");
                    }}
                    className="font-bold text-slate-500 hover:text-slate-800"
                  >
                    ← Change Email
                  </button>
                  <button
                    type="button"
                    disabled={resendTimer > 0 || isLoading}
                    onClick={() => handleSendOtp()}
                    className="font-bold text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
                  >
                    {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : "Resend OTP"}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center rounded-2xl bg-indigo-600 hover:bg-indigo-700 py-3.5 text-xs font-bold text-white transition-all shadow-md cursor-pointer disabled:opacity-75"
            >
              {isLoading
                ? "Processing..."
                : isOtpSent
                ? "Verify OTP & Sign In"
                : "Send Email OTP Code"}
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-xs font-medium text-slate-400 font-sans">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-bold text-indigo-600 hover:text-indigo-700 hover:underline transition-colors">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
