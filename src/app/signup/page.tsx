"use client";

import React, { useState } from "react";
import Link from "next/link";
import ParticleNetwork from "@/components/ParticleNetwork";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const validate = () => {
    const newErrors: typeof errors = {};

    if (!name.trim()) {
      newErrors.name = "Full name is required";
    }

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

    if (!confirmPassword) {
      newErrors.confirmPassword = "Confirm password is required";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
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
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, password, confirmPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrors({ email: data.error || "Registration failed. Please try again." });
      } else {
        setIsSuccess(true);
      }
    } catch (err) {
      setErrors({ email: "An unexpected network error occurred. Please try again." });
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-12 text-slate-900 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Particle Network Canvas */}
      <ParticleNetwork />

      {/* Ambient Glows */}
      <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-indigo-300/30 blur-[130px] pointer-events-none animate-pulse-glow" />
      <div className="absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full bg-purple-300/30 blur-[130px] pointer-events-none animate-pulse-glow" style={{ animationDelay: "2.5s" }} />

      {/* Main Card */}
      <div className="relative w-full max-w-md rounded-3xl border border-slate-200/90 bg-white/95 backdrop-blur-2xl p-8 sm:p-10 shadow-2xl shadow-slate-200/80 transition-all duration-300">
        {/* Top Brand Logo */}
        <div className="flex justify-center mb-6">
          <Link href="/" className="group relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 shadow-lg shadow-indigo-600/30 transition-transform duration-300 hover:scale-105">
            <span className="text-white font-extrabold text-xl tracking-tight font-heading">L2L</span>
            <div className="absolute -inset-1 rounded-2xl bg-indigo-400/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        </div>

        {/* Header */}
        <div className="mb-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-heading">
            Create account
          </h2>
          <p className="mt-1 text-xs sm:text-sm font-medium text-slate-500">
            Get started with Lead2Ledger Enterprise
          </p>
        </div>

        {isSuccess ? (
          <div className="flex flex-col items-center justify-center py-6 text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 mb-4 shadow-md shadow-emerald-500/10">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-8 w-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 font-heading">Account Created!</h3>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Your account has been registered successfully.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex items-center gap-1.5 justify-center rounded-2xl bg-indigo-600 px-6 py-3 text-xs font-extrabold text-white hover:bg-indigo-700 shadow-md shadow-indigo-600/25 transition-all cursor-pointer active:scale-95"
            >
              Proceed to Sign In &rarr;
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div className="group">
              <label htmlFor="name" className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 font-heading">
                FULL NAME
              </label>
              <div className="relative">
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  className={`block w-full rounded-2xl border bg-slate-50/80 py-3 px-4 text-xs font-semibold text-slate-900 placeholder-slate-400 transition-all outline-none ${
                    errors.name ? "border-rose-400 focus:ring-4 focus:ring-rose-400/15" : "border-slate-200 focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-600/10"
                  }`}
                  placeholder="John Doe"
                />
              </div>
              {errors.name && <p className="mt-1 text-xs text-rose-600 font-semibold">{errors.name}</p>}
            </div>

            {/* Email Input */}
            <div className="group">
              <label htmlFor="email" className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 font-heading">
                WORK EMAIL ADDRESS
              </label>
              <div className="relative">
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
                  className={`block w-full rounded-2xl border bg-slate-50/80 py-3 px-4 text-xs font-semibold text-slate-900 placeholder-slate-400 transition-all outline-none ${
                    errors.email ? "border-rose-400 focus:ring-4 focus:ring-rose-400/15" : "border-slate-200 focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-600/10"
                  }`}
                  placeholder="name@company.com"
                />
              </div>
              {errors.email && <p className="mt-1 text-xs text-rose-600 font-semibold">{errors.email}</p>}
            </div>

            {/* Password Input */}
            <div className="group">
              <label htmlFor="password" className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 font-heading">
                PASSWORD
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  className={`block w-full rounded-2xl border bg-slate-50/80 py-3 pl-4 pr-11 text-xs font-semibold text-slate-900 placeholder-slate-400 transition-all outline-none ${
                    errors.password ? "border-rose-400 focus:ring-4 focus:ring-rose-400/15" : "border-slate-200 focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-600/10"
                  }`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-xs font-bold text-slate-400 hover:text-indigo-600 cursor-pointer"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-rose-600 font-semibold">{errors.password}</p>}
            </div>

            {/* Confirm Password Input */}
            <div className="group">
              <label htmlFor="confirmPassword" className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 font-heading">
                CONFIRM PASSWORD
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                  }}
                  className={`block w-full rounded-2xl border bg-slate-50/80 py-3 pl-4 pr-11 text-xs font-semibold text-slate-900 placeholder-slate-400 transition-all outline-none ${
                    errors.confirmPassword ? "border-rose-400 focus:ring-4 focus:ring-rose-400/15" : "border-slate-200 focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-600/10"
                  }`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-xs font-bold text-slate-400 hover:text-indigo-600 cursor-pointer"
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
              {errors.confirmPassword && <p className="mt-1 text-xs text-rose-600 font-semibold">{errors.confirmPassword}</p>}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center rounded-2xl bg-indigo-600 hover:bg-indigo-700 py-3.5 text-xs font-extrabold text-white transition-all shadow-md shadow-indigo-600/25 hover:shadow-indigo-600/40 cursor-pointer disabled:opacity-70 mt-2 active:scale-[0.99]"
            >
              {isLoading ? "Creating account..." : "Create Account"}
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-xs font-medium text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="font-bold text-indigo-600 hover:text-indigo-700 hover:underline transition-colors">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
