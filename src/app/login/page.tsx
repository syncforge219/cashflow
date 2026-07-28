"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ParticleNetwork from "@/components/ParticleNetwork";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters long";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    setErrors({});

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      let data: any = {};
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        setErrors({ email: text.includes("Internal") ? "Server error occurred. Please try again." : text });
        return;
      }

      if (!response.ok) {
        const errorMsg = data.error || "Login failed. Please check your credentials.";
        if (errorMsg.toLowerCase().includes("password")) {
          setErrors({ password: errorMsg });
        } else {
          setErrors({ email: errorMsg });
        }
      } else {
        setIsSuccess(true);
        // Redirect to role-based dashboard
        if (data.user?.role === "counsellor") {
          window.location.href = "/counsellor-dashboard";
        } else if (data.user?.role === "brand manager" || data.user?.role === "centre head") {
          window.location.href = "/manager-dashboard";
        } else if (data.user?.role === "teacher") {
          window.location.href = "/teacher-dashboard";
        } else if (data.user?.role === "cfo" || data.user?.role === "finance manager" || data.user?.role === "finance executive") {
          window.location.href = "/cfo-dashboard";
        } else if (data.user?.role === "crm" || data.user?.role === "crm executive" || data.user?.role === "crm advisor") {
          window.location.href = "/crm-dashboard";
        } else {
          window.location.href = "/admin-dashboard";
        }
      }
    } catch (err) {
      setErrors({ email: "An unexpected error occurred. Please try again." });
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-12 text-slate-800 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Interactive Constellation Particle Network Canvas Background */}
      <ParticleNetwork />

      {/* Soft Animated Dashboard Ambient Glow Blobs */}
      <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-indigo-300/30 blur-[130px] pointer-events-none animate-pulse-glow"></div>
      <div className="absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full bg-purple-300/30 blur-[130px] pointer-events-none animate-pulse-glow" style={{ animationDelay: "2.5s" }}></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-blue-200/20 blur-[150px] pointer-events-none"></div>

      {/* Main Card with Entrance Animation */}
      <div className="relative w-full max-w-md rounded-3xl border border-slate-200/80 bg-white/95 backdrop-blur-xl p-8 sm:p-10 shadow-2xl shadow-slate-200/80 transition-all duration-500 animate-in fade-in slide-in-from-bottom-6 duration-700 ease-out hover:shadow-indigo-500/10">
        
        {/* Top Brand Logo with Soft Glow */}
        <div className="flex justify-center mb-6">
          <div className="group relative flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-600/30 transition-transform duration-300 hover:scale-105 hover:rotate-3 cursor-pointer">
            <span className="text-white font-extrabold text-xl tracking-tight font-sans">CF</span>
            <div className="absolute -inset-1 rounded-2xl bg-indigo-400/30 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </div>
        </div>

        {/* Header */}
        <div className="mb-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-800 font-sans">
            Welcome back
          </h2>
          <p className="mt-1.5 text-xs sm:text-sm font-medium text-slate-400 font-sans">
            Sign in to your account to continue
          </p>
        </div>

        {isSuccess ? (
          <div className="flex flex-col items-center justify-center py-6 text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 mb-4 shadow-md shadow-emerald-500/10 animate-bounce">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-8 w-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-800">Login Successful!</h3>
            <p className="mt-1 text-xs font-medium text-slate-400">
              Redirecting to your workspace...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Input */}
            <div className="group">
              <label htmlFor="email" className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 font-sans transition-colors group-focus-within:text-indigo-600">
                EMAIL ADDRESS
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 transition-colors group-focus-within:text-indigo-600">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4.5 w-4.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  className={`block w-full rounded-2xl border bg-slate-50/70 py-3 pl-10 pr-4 text-xs font-semibold text-slate-800 placeholder-slate-400 transition-all duration-300 outline-none
                    ${errors.email ? "border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/15" : "border-slate-200/90 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 focus:bg-white"}`}
                  placeholder="name@example.com"
                />
              </div>
              {errors.email && (
                <p className="mt-1.5 text-xs text-rose-500 font-semibold animate-in fade-in slide-in-from-top-1 duration-200">{errors.email}</p>
              )}
            </div>

            {/* Password Input */}
            <div className="group">
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 font-sans transition-colors group-focus-within:text-indigo-600">
                  PASSWORD
                </label>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 transition-colors group-focus-within:text-indigo-600">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4.5 w-4.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  className={`block w-full rounded-2xl border bg-slate-50/70 py-3 pl-10 pr-10 text-xs font-semibold text-slate-800 placeholder-slate-400 transition-all duration-300 outline-none
                    ${errors.password ? "border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/15" : "border-slate-200/90 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 focus:bg-white"}`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4.5 w-4.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.815 7.815L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4.5 w-4.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs text-rose-500 font-semibold animate-in fade-in slide-in-from-top-1 duration-200">{errors.password}</p>
              )}
            </div>

            {/* Remember Me */}
            <div className="flex items-center pt-1">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 rounded-md border-slate-300 bg-white text-indigo-600 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none cursor-pointer transition-all"
              />
              <label htmlFor="remember-me" className="ml-2.5 block text-xs font-semibold text-slate-600 select-none cursor-pointer font-sans hover:text-slate-900 transition-colors">
                Keep me signed in
              </label>
            </div>

            {/* Animated Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="relative group overflow-hidden flex w-full items-center justify-center rounded-2xl bg-indigo-600 hover:bg-indigo-700 py-3.5 text-xs font-bold text-white transition-all duration-300 shadow-md shadow-indigo-600/20 hover:shadow-xl hover:shadow-indigo-600/35 focus:outline-none focus:ring-4 focus:ring-indigo-500/30 active:scale-[0.98] disabled:opacity-75 cursor-pointer mt-2"
            >
              {/* Button Shimmer Effect */}
              <div className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-20deg] group-hover:animate-shimmer pointer-events-none"></div>

              {isLoading ? (
                <svg className="h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <span className="flex items-center gap-1.5">
                  Sign In
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </span>
              )}
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
