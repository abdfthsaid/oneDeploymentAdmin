"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBolt, faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import { useAuthStore } from "@/stores/useAuthStore";
import { useUsersStore } from "@/stores/useUsersStore";

export default function LoginPage() {
  const router = useRouter();
  const { user, login } = useAuthStore();
  const {
    loginUser,
    resendLoginOtp,
    verifyLoginOtp,
    loading,
    error,
    success,
    clearMessages,
  } = useUsersStore();

  const [form, setForm] = useState({ username: "", password: "" });
  const [otpForm, setOtpForm] = useState({ otp: "" });
  const [otpStep, setOtpStep] = useState<{
    challengeId: string;
    email: string;
    otpExpiresAt: number;
    resendAvailableAt: number;
  } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    return () => {
      clearMessages();
    };
  }, [clearMessages]);

  useEffect(() => {
    if (user) {
      const userRole = user.role;
      if (userRole === "user") {
        router.replace("/slots");
      } else if (userRole === "moderator" || userRole === "admin") {
        router.replace("/dashboard");
      } else {
        router.replace("/slots");
      }
    }
  }, [user, router]);

  useEffect(() => {
    if (!otpStep) return;

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [otpStep]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 6);
    setOtpForm({ otp: digitsOnly });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    clearMessages();
    try {
      const challenge = await loginUser(form);
      setOtpStep(challenge);
      setOtpForm({ otp: "" });
    } catch (err) {
      // Error is handled by the store
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpStep || loading) return;
    clearMessages();
    try {
      const result = await verifyLoginOtp({
        challengeId: otpStep.challengeId,
        otp: otpForm.otp,
      });
      login(result.user as any, result.token, result.expiresAt);
    } catch (err) {
      // Error is handled by the store
    }
  };

  const resetLoginFlow = () => {
    setOtpStep(null);
    setOtpForm({ otp: "" });
    clearMessages();
  };

  const handleResendOtp = async () => {
    if (!otpStep || loading || resendSecondsRemaining > 0) return;
    clearMessages();
    try {
      const nextChallenge = await resendLoginOtp({
        challengeId: otpStep.challengeId,
      });
      setOtpStep(nextChallenge);
      setOtpForm({ otp: "" });
      setNow(Date.now());
    } catch (err) {
      // Error is handled by the store
    }
  };

  const resendSecondsRemaining = otpStep
    ? Math.max(0, Math.ceil((otpStep.resendAvailableAt - now) / 1000))
    : 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-blue-300 dark:from-gray-900 dark:to-gray-800 relative overflow-hidden">
      {/* Decorative background pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <svg width="100%" height="100%" className="h-full w-full">
          <defs>
            <pattern
              id="grid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="0.5"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>
      <div className="relative z-10 flex w-full max-w-4xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* Left branding panel for large screens */}
        <div className="hidden md:flex flex-col justify-center items-center bg-gradient-to-br from-blue-600 to-blue-400 dark:from-blue-800 dark:to-blue-600 w-1/2 p-10 text-white">
          <div className="flex items-center mb-6">
            <FontAwesomeIcon icon={faBolt} className="text-4xl mr-3" />
            <span className="text-3xl font-extrabold tracking-wide">
              Danab Power
            </span>
          </div>
          <h2 className="text-2xl font-bold mb-2">Welcome Back!</h2>
          <p className="text-blue-100 text-lg mb-8 text-center">
            Log in to access your dashboard and manage your power bank stations
            efficiently.
          </p>
          <div className="mt-auto text-xs text-blue-100 opacity-80">
            &copy; {new Date().getFullYear()} Danab Power. All rights reserved.
          </div>
        </div>
        {/* Login form panel */}
        <div className="flex-1 flex flex-col justify-center p-8 sm:p-12">
          <div className="mb-8 flex items-center justify-center md:hidden">
            <FontAwesomeIcon
              icon={faBolt}
              className="text-3xl text-blue-600 mr-2"
            />
            <span className="text-2xl font-extrabold text-blue-600 dark:text-white tracking-wide">
              Danab Power
            </span>
          </div>
          <h2 className="text-3xl font-bold mb-6 text-center text-blue-600 dark:text-white">
            Admin Login
          </h2>
          {success && (
            <div className="mb-4 text-green-700 bg-green-100 dark:bg-green-900 dark:text-green-300 rounded px-4 py-2 text-center font-medium">
              {success}
            </div>
          )}
          {error && (
            <div className="mb-4 text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300 rounded px-4 py-2 text-center font-medium">
              {error}
            </div>
          )}
          {!otpStep ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-gray-700 dark:text-gray-200 mb-1 font-medium">
                  Username
                </label>
                <input
                  type="text"
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-800 dark:text-white transition-all"
                  placeholder="Enter your username"
                />
              </div>
              <div>
                <label className="block text-gray-700 dark:text-gray-200 mb-1 font-medium">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 pr-12 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-800 dark:text-white transition-all"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-400 hover:from-blue-700 hover:to-blue-500 text-white py-3 px-4 rounded-lg font-semibold shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Checking..." : "Continue"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                OTP sent to <strong>{otpStep.email}</strong>
              </div>
              <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                If you asked more than once, use the newest email code only.
              </div>
              <div>
                <label className="block text-gray-700 dark:text-gray-200 mb-1 font-medium">
                  6-digit OTP
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  name="otp"
                  value={otpForm.otp}
                  onChange={handleOtpChange}
                  required
                  maxLength={6}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-800 dark:text-white transition-all tracking-[0.35em] text-center text-lg"
                  placeholder="000000"
                />
              </div>
              <button
                type="submit"
                disabled={loading || otpForm.otp.length !== 6}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-400 hover:from-blue-700 hover:to-blue-500 text-white py-3 px-4 rounded-lg font-semibold shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Verifying..." : "Verify OTP"}
              </button>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={loading || resendSecondsRemaining > 0}
                className="w-full border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 py-3 px-4 rounded-lg font-semibold transition-colors hover:bg-blue-50 dark:hover:bg-blue-950 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {resendSecondsRemaining > 0
                  ? `Resend OTP in ${resendSecondsRemaining}s`
                  : "Resend OTP"}
              </button>
              <button
                type="button"
                onClick={resetLoginFlow}
                className="w-full border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 py-3 px-4 rounded-lg font-semibold transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Back to password
              </button>
            </form>
          )}
          <div className="mt-8 text-center text-gray-400 text-xs">
            Powered by{" "}
            <span className="font-bold text-blue-600 dark:text-blue-400">
              Danab Power
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
