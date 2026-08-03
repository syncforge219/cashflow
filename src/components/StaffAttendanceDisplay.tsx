"use client";

import React, { useState, useEffect, useRef } from "react";
import { useUser } from "@/app/component/context/user-context";
import { extractFaceDescriptorFromCanvas } from "@/lib/faceVerification";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  brand: string;
  isFaceRegistered: boolean;
  faceRegisteredAt?: string;
  statusToday: "Present" | "Absent" | "Late";
  checkInTime?: string;
  checkOutTime?: string;
  workingHours?: string;
  distanceMeters?: number;
  confidence?: number;
  locationVerified?: boolean;
  faceVerified?: boolean;
}

interface OfficeLocationData {
  _id?: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  address?: string;
  brand?: string;
  updatedBy?: string;
  updatedAt?: string;
}

export default function StaffAttendanceDisplay() {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<"roster" | "history" | "location">("roster");

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [officeLocation, setOfficeLocation] = useState<OfficeLocationData | null>(null);
  const [allOfficeLocations, setAllOfficeLocations] = useState<OfficeLocationData[]>([]);
  const [staffRoster, setStaffRoster] = useState<StaffMember[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalStaff: 0,
    totalPresent: 0,
    totalAbsent: 0,
    totalFaceRegistered: 0,
  });

  const [currentUserStatus, setCurrentUserStatus] = useState({
    isFaceRegistered: false,
    isMarkedToday: false,
    todayLog: null as any,
  });

  const [targetStaffForFaceReg, setTargetStaffForFaceReg] = useState<StaffMember | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");

  // Brand categorization states
  const [selectedBrand, setSelectedBrand] = useState("All");
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);

  // Modals state
  const [isFaceRegModalOpen, setIsFaceRegModalOpen] = useState(false);
  const [isMarkAttendanceModalOpen, setIsMarkAttendanceModalOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  // Video & Canvas Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [camError, setCamError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Admin Location Form
  const [locForm, setLocForm] = useState({
    latitude: "",
    longitude: "",
    radiusMeters: "500",
    address: "",
    brand: "All",
  });
  const [detectingGps, setDetectingGps] = useState(false);

  // Verification step details
  const [gpsStatus, setGpsStatus] = useState<{
    lat?: number;
    lng?: number;
    distance?: number;
    isWithin?: boolean;
    error?: string;
  }>({});

  const roleLower = (user?.role || "").toLowerCase().trim();
  const isAdmin =
    roleLower === "super admin" ||
    roleLower === "admin" ||
    roleLower === "superadmin" ||
    (roleLower.includes("admin") && !roleLower.includes("manager") && !roleLower.includes("cfo"));

  const todayDateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  useEffect(() => {
    if (!isAdmin) {
      setActiveTab("history");
    }
    fetchBrands();
    fetchData("All");
  }, [isAdmin]);

  const fetchBrands = async () => {
    try {
      const res = await fetch("/api/brands");
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.brands)) {
        const brandNames = data.brands.map((b: any) => b.name).filter(Boolean);
        setAvailableBrands(brandNames);
      }
    } catch (err) {
      console.error("Failed to fetch brands list:", err);
    }
  };

  const fetchData = async (targetBrand?: string) => {
    setLoading(true);
    setErrorMsg("");
    const brandToFetch = targetBrand !== undefined ? targetBrand : selectedBrand;
    try {
      const params = new URLSearchParams();
      if (brandToFetch && brandToFetch !== "All") {
        params.set("brand", brandToFetch);
      }

      const res = await fetch(`/api/staff-attendance?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setOfficeLocation(data.officeLocation);
        setAllOfficeLocations(data.allLocations || []);
        setStaffRoster(data.staffRoster || []);
        setAttendanceLogs(data.attendanceLogs || []);
        setStats(data.stats || { totalStaff: 0, totalPresent: 0, totalAbsent: 0, totalFaceRegistered: 0 });
        setCurrentUserStatus(
          data.currentUserStatus || { isFaceRegistered: false, isMarkedToday: false, todayLog: null }
        );

        if (data.officeLocation) {
          setLocForm({
            latitude: String(data.officeLocation.latitude),
            longitude: String(data.officeLocation.longitude),
            radiusMeters: String(data.officeLocation.radiusMeters || 200),
            address: data.officeLocation.address || "",
            brand: data.officeLocation.brand || brandToFetch || "All",
          });
        }
      } else {
        setErrorMsg(data.error || "Failed to load staff attendance records.");
      }
    } catch (err: any) {
      setErrorMsg("Network error loading staff attendance data.");
    } finally {
      setLoading(false);
    }
  };

  // Start Camera Stream
  const startCamera = async () => {
    setCamError("");
    setCameraActive(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      setCamError("Could not access camera. Please allow camera permissions in your browser.");
    }
  };

  // Stop Camera Stream
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // Close modals safely
  const closeModals = () => {
    stopCamera();
    setIsFaceRegModalOpen(false);
    setIsMarkAttendanceModalOpen(false);
    setIsLocationModalOpen(false);
    setTargetStaffForFaceReg(null);
    setCamError("");
    setErrorMsg("");
    setGpsStatus({});
  };

  // Open Face Registration Modal
  const handleOpenFaceRegModal = (targetMember?: StaffMember) => {
    setErrorMsg("");
    setSuccessMsg("");
    setTargetStaffForFaceReg(targetMember || null);
    setIsFaceRegModalOpen(true);
    setTimeout(() => {
      startCamera();
    }, 300);
  };

  // Process & Submit Face Registration
  const handleRegisterFace = async () => {
    if (!videoRef.current || !canvasRef.current || !cameraActive) {
      setCamError("Camera feed is not active. Please wait or retry.");
      return;
    }

    setIsProcessing(true);
    setCamError("");

    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      const descriptor = extractFaceDescriptorFromCanvas(canvas, video);

      if (!descriptor || descriptor.length === 0) {
        setCamError("Could not extract face features. Please ensure your face is clearly visible.");
        setIsProcessing(false);
        return;
      }

      const res = await fetch("/api/staff-attendance/register-face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faceDescriptor: descriptor,
          targetUserId: targetStaffForFaceReg ? targetStaffForFaceReg.id : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(
          targetStaffForFaceReg
            ? `Face ID registered/updated successfully for ${targetStaffForFaceReg.name}!`
            : "Face ID registered/updated successfully! You can now mark your attendance."
        );
        closeModals();
        fetchData();
      } else {
        setCamError(data.error || "Failed to register Face ID.");
      }
    } catch (err: any) {
      setCamError("An error occurred during Face ID registration.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Open Mark Attendance Modal
  const handleOpenMarkAttendanceModal = () => {
    setErrorMsg("");
    setSuccessMsg("");
    setGpsStatus({});
    setIsMarkAttendanceModalOpen(true);

    // Get current GPS position automatically
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsStatus({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        (err) => {
          setGpsStatus({
            error: "Unable to retrieve GPS location. Please allow browser location access.",
          });
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setGpsStatus({ error: "Geolocation is not supported by your browser." });
    }

    setTimeout(() => {
      startCamera();
    }, 300);
  };

  // Perform Dual Verification (GPS + Face ID) and Mark Attendance
  const handleVerifyAndMarkAttendance = async () => {
    if (!videoRef.current || !canvasRef.current || !cameraActive) {
      setCamError("Webcam is not active. Please wait or retry.");
      return;
    }

    setIsProcessing(true);
    setCamError("");

    // Ensure GPS position is present
    if (!gpsStatus.lat || !gpsStatus.lng) {
      // Re-request GPS position
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          setGpsStatus({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          await executeVerification(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => {
          setCamError("GPS location access is required to verify attendance. Please enable location.");
          setIsProcessing(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      await executeVerification(gpsStatus.lat, gpsStatus.lng);
    }
  };

  const executeVerification = async (lat: number, lng: number) => {
    try {
      const canvas = canvasRef.current!;
      const video = videoRef.current!;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      const liveDescriptor = extractFaceDescriptorFromCanvas(canvas, video);

      if (!liveDescriptor || liveDescriptor.length === 0) {
        setCamError("Could not scan face. Please position your face clearly in front of the camera.");
        setIsProcessing(false);
        return;
      }

      const res = await fetch("/api/staff-attendance/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: lat,
          longitude: lng,
          liveFaceDescriptor: liveDescriptor,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(data.message || "Attendance marked PRESENT successfully!");
        closeModals();
        fetchData();
      } else {
        setCamError(data.error || "Attendance verification failed.");
      }
    } catch (err: any) {
      setCamError("Network error during attendance verification.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Detect Current Location for Admin Form
  const handleDetectCurrentLocation = () => {
    setDetectingGps(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocForm((prev) => ({
            ...prev,
            latitude: pos.coords.latitude.toFixed(6),
            longitude: pos.coords.longitude.toFixed(6),
          }));
          setDetectingGps(false);
        },
        (err) => {
          alert("Could not detect GPS location: " + err.message);
          setDetectingGps(false);
        },
        { enableHighAccuracy: true }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
      setDetectingGps(false);
    }
  };

  // Save Office Location (Admin)
  const handleSaveOfficeLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locForm.latitude || !locForm.longitude) {
      alert("Latitude and Longitude are required.");
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch("/api/staff-attendance/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(locForm),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg("Office location updated successfully!");
        setIsLocationModalOpen(false);
        fetchData();
      } else {
        alert(data.error || "Failed to update office location.");
      }
    } catch (err: any) {
      alert("Error saving office location.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset Staff Face ID (Admin)
  const handleResetFaceId = async (staffId: string, staffName: string) => {
    if (!confirm(`Are you sure you want to reset Face ID registration for ${staffName}? They will need to re-register their Face ID.`)) {
      return;
    }

    try {
      const res = await fetch("/api/staff-attendance/reset-face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: staffId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(`Face ID reset for ${staffName}.`);
        fetchData();
      } else {
        alert(data.error || "Failed to reset Face ID.");
      }
    } catch (err) {
      alert("Error resetting Face ID.");
    }
  };

  const filteredStaffRoster = staffRoster.filter((member) => {
    const matchesSearch =
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.role.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "All" || member.role.toLowerCase() === roleFilter.toLowerCase();
    return matchesSearch && matchesRole;
  });

  const loggedInUserId = (user?._id || user?.id || "").toString();
  const myAttendanceHistory = attendanceLogs.filter(
    (log) => (log.userId?.toString() || log.userId) === loggedInUserId
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Hidden Canvas for Frame Processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Banner & Title */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-indigo-500/30 text-indigo-200 rounded-full border border-indigo-400/30 backdrop-blur-md">
                Smart Staff Portal
              </span>
              <span className="text-xs text-indigo-200/80 font-medium">{todayDateStr}</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white mt-2">
              Staff Attendance Register
            </h1>
            <p className="text-indigo-200/80 text-sm mt-1 max-w-xl">
              Dual-verification system: Admin configures office GPS location and staff register Face ID for 100% verified present marking.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {isAdmin && (
              <button
                onClick={() => setIsLocationModalOpen(true)}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 backdrop-blur-md cursor-pointer"
              >
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {officeLocation ? "Update Office Location" : "Upload Office Location"}
              </button>
            )}

            {!isAdmin && (
              <>
                {!currentUserStatus.isFaceRegistered ? (
                  <button
                    onClick={() => handleOpenFaceRegModal()}
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Register Face ID
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenFaceRegModal()}
                      className="px-4 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/30 font-bold rounded-xl text-sm transition-all flex items-center gap-2 backdrop-blur-md cursor-pointer"
                      title="Update or re-register your Face ID anytime"
                    >
                      <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Re-Register Face ID
                    </button>

                    {!currentUserStatus.isMarkedToday ? (
                      <button
                        onClick={handleOpenMarkAttendanceModal}
                        className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/30 flex items-center gap-2 cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Mark Check-In
                      </button>
                    ) : !currentUserStatus.todayLog?.checkOutTime ? (
                      <div className="flex items-center gap-2">
                        <div className="px-4 py-2.5 bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 font-bold rounded-xl text-sm flex items-center gap-2 backdrop-blur-md">
                          <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          Present Today ({currentUserStatus.todayLog?.checkInTime || "Marked"})
                        </div>
                        <button
                          onClick={handleOpenMarkAttendanceModal}
                          className="px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-rose-500/30 flex items-center gap-2 cursor-pointer"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Check-Out Today
                        </button>
                      </div>
                    ) : (
                      <div className="px-5 py-2.5 bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 font-bold rounded-xl text-sm flex items-center gap-2 backdrop-blur-md">
                        <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        Present Today (In: {currentUserStatus.todayLog?.checkInTime} | Out: {currentUserStatus.todayLog?.checkOutTime})
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Global Alerts */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium">{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg("")} className="text-rose-400 hover:text-rose-600 text-sm font-bold">
            Dismiss
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg("")} className="text-emerald-400 hover:text-emerald-600 text-sm font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isAdmin ? (
          <>
            {/* Total Staff */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Staff</p>
                <h3 className="text-2xl font-black text-slate-800 mt-1">{stats.totalStaff}</h3>
                <p className="text-xs text-slate-500 mt-0.5">Active team members</p>
              </div>
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>

            {/* Present Today */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Present Today</p>
                <h3 className="text-2xl font-black text-emerald-600 mt-1">{stats.totalPresent}</h3>
                <p className="text-xs text-emerald-600 font-medium mt-0.5">
                  {stats.totalStaff > 0 ? `${Math.round((stats.totalPresent / stats.totalStaff) * 100)}% turnout` : "0% turnout"}
                </p>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>

            {/* Face Registered */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Face ID Registered</p>
                <h3 className="text-2xl font-black text-amber-600 mt-1">{stats.totalFaceRegistered}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{stats.totalStaff - stats.totalFaceRegistered} pending registration</p>
              </div>
              <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>

            {/* Office Location Status */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Office Location</p>
                {officeLocation ? (
                  <>
                    <h3 className="text-base font-bold text-slate-800 mt-1 truncate max-w-[170px]">
                      {officeLocation.address || `${officeLocation.latitude.toFixed(4)}, ${officeLocation.longitude.toFixed(4)}`}
                    </h3>
                    <p className="text-xs text-emerald-600 font-medium mt-0.5">
                      Radius: {officeLocation.radiusMeters || 200}m
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="text-sm font-bold text-rose-500 mt-1">Not Uploaded</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Admin setup required</p>
                  </>
                )}
              </div>
              <div className={`p-3 rounded-2xl ${officeLocation ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"}`}>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* My Today's Attendance Status */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between col-span-1 sm:col-span-2">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">My Status Today</p>
                {currentUserStatus.isMarkedToday ? (
                  <>
                    <h3 className="text-2xl font-black text-emerald-600 mt-1">PRESENT</h3>
                    <div className="text-xs text-emerald-600 font-semibold mt-0.5 space-y-0.5">
                      <p>Check-In Time: {currentUserStatus.todayLog?.checkInTime || "Marked"}</p>
                      {currentUserStatus.todayLog?.checkOutTime ? (
                        <>
                          <p className="text-indigo-700 font-bold">Check-Out Time: {currentUserStatus.todayLog.checkOutTime}</p>
                          <p className="text-indigo-900 font-extrabold">Working Hours: {currentUserStatus.todayLog.workingHours || "--"}</p>
                        </>
                      ) : (
                        <p className="text-amber-600 font-medium font-sans">Check-Out Pending (Click Check-Out Above)</p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="text-2xl font-black text-amber-500 mt-1">NOT MARKED</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Click &quot;Mark Today&apos;s Attendance&quot; above</p>
                  </>
                )}
              </div>
              <div className={`p-3 rounded-2xl ${currentUserStatus.isMarkedToday ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-500"}`}>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>

            {/* My Face ID Status */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between col-span-1 sm:col-span-2">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">My Face ID</p>
                {currentUserStatus.isFaceRegistered ? (
                  <>
                    <h3 className="text-xl font-black text-emerald-600 mt-1">REGISTERED ✓</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Face ID active for daily check-in</p>
                  </>
                ) : (
                  <>
                    <h3 className="text-xl font-black text-amber-500 mt-1">NOT REGISTERED</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Click &quot;Register Face ID&quot; above</p>
                  </>
                )}
              </div>
              <div className={`p-3 rounded-2xl ${currentUserStatus.isFaceRegistered ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-500"}`}>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Main Content Tabs Container */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Navigation Tabs */}
        <div className="border-b border-slate-200 px-6 pt-4 flex items-center justify-between gap-4 overflow-x-auto">
          <div className="flex gap-2">
            {isAdmin && (
              <button
                onClick={() => setActiveTab("roster")}
                className={`pb-4 px-3 font-semibold text-sm transition-all border-b-2 cursor-pointer ${
                  activeTab === "roster"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                Staff Daily Roster ({filteredStaffRoster.length})
              </button>
            )}
            <button
              onClick={() => setActiveTab("history")}
              className={`pb-4 px-3 font-semibold text-sm transition-all border-b-2 cursor-pointer ${
                activeTab === "history"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              My Attendance History ({myAttendanceHistory.length})
            </button>
            {isAdmin && officeLocation && (
              <button
                onClick={() => setActiveTab("location")}
                className={`pb-4 px-3 font-semibold text-sm transition-all border-b-2 cursor-pointer ${
                  activeTab === "location"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                Office Location Details
              </button>
            )}
          </div>
        </div>

        {/* Tab 1: Staff Roster Table */}
        {activeTab === "roster" && isAdmin && (
          <div className="p-6 space-y-4">
            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:w-80">
                <input
                  type="text"
                  placeholder="Search staff by name, email, or role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
                <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-400">Brand Scope:</label>
                  <select
                    value={selectedBrand}
                    onChange={(e) => {
                      const newBrand = e.target.value;
                      setSelectedBrand(newBrand);
                      fetchData(newBrand);
                    }}
                    className="px-3 py-2 bg-indigo-50/80 border border-indigo-200 text-indigo-700 font-bold rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="All">All Brands / Locations</option>
                    {availableBrands.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-400">Role:</label>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="All">All Roles</option>
                    <option value="counsellor">Counsellor</option>
                    <option value="teacher">Teacher</option>
                    <option value="cfo">CFO / Finance</option>
                    <option value="crm">CRM</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Table */}
            {loading ? (
              <div className="py-16 text-center text-slate-400 font-medium">Loading staff roster...</div>
            ) : filteredStaffRoster.length === 0 ? (
              <div className="py-16 text-center text-slate-400 font-medium">No staff members found matching criteria.</div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                      <th className="py-3.5 px-4">Staff Member</th>
                      <th className="py-3.5 px-4">Role</th>
                      <th className="py-3.5 px-4">Face ID Status</th>
                      <th className="py-3.5 px-4">Today&apos;s Status</th>
                      <th className="py-3.5 px-4">Check-In</th>
                      <th className="py-3.5 px-4">Check-Out</th>
                      <th className="py-3.5 px-4">Working Hours</th>
                      <th className="py-3.5 px-4">Verification Details</th>
                      {isAdmin && <th className="py-3.5 px-4 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStaffRoster.map((member) => (
                      <tr key={member.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-700 text-white font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
                              {member.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800">{member.name}</p>
                              <p className="text-xs text-slate-400">{member.email}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="capitalize text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
                            {member.role}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          {member.isFaceRegistered ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200/60">
                              <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                              Registered
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-semibold rounded-lg border border-amber-200/60">
                              <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Not Registered
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {member.statusToday === "Present" ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-500 text-white font-bold text-xs rounded-full shadow-xs">
                              PRESENT
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-200 text-slate-600 font-semibold text-xs rounded-full">
                              ABSENT
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-medium text-slate-700">
                          {member.checkInTime || "--"}
                        </td>

                        <td className="py-3.5 px-4 font-medium text-slate-700">
                          {member.checkOutTime ? (
                            <span className="text-emerald-700 font-bold">{member.checkOutTime}</span>
                          ) : (
                            <span className="text-slate-400">--</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-extrabold text-indigo-600">
                          {member.workingHours || "--"}
                        </td>

                        <td className="py-3.5 px-4 text-xs">
                          {member.statusToday === "Present" ? (
                            <div className="space-y-0.5">
                              <p className="text-emerald-700 font-medium">
                                GPS Distance: {member.distanceMeters ?? 0}m away
                              </p>
                              <p className="text-indigo-600 font-medium">
                                Face Match: {member.confidence ?? 100}% confidence
                              </p>
                            </div>
                          ) : (
                            <span className="text-slate-400">Not verified</span>
                          )}
                        </td>

                        {isAdmin && (
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleOpenFaceRegModal(member)}
                                className="px-2.5 py-1 text-xs font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                                title={`Register or update Face ID for ${member.name}`}
                              >
                                {member.isFaceRegistered ? "Re-Register Face" : "Register Face"}
                              </button>
                              {member.isFaceRegistered && (
                                <button
                                  onClick={() => handleResetFaceId(member.id, member.name)}
                                  className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Reset Face ID so staff can re-register"
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: My Attendance History */}
        {activeTab === "history" && (
          <div className="p-6">
            {myAttendanceHistory.length === 0 ? (
              <div className="py-16 text-center text-slate-400 font-medium">
                No past attendance records found for your account.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                      <th className="py-3.5 px-4">Date</th>
                      <th className="py-3.5 px-4">Check-In</th>
                      <th className="py-3.5 px-4">Check-Out</th>
                      <th className="py-3.5 px-4">Working Hours</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">GPS Verification</th>
                      <th className="py-3.5 px-4">Face Verification</th>
                      <th className="py-3.5 px-4">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {myAttendanceHistory.map((log) => (
                      <tr key={log._id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-800">{log.dateStr}</td>
                        <td className="py-3.5 px-4 font-medium text-slate-700">{log.checkInTime || "--"}</td>
                        <td className="py-3.5 px-4 font-medium text-slate-700">
                          {log.checkOutTime ? (
                            <span className="text-emerald-700 font-bold">{log.checkOutTime}</span>
                          ) : (
                            <span className="text-slate-400">--</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-extrabold text-indigo-600 font-mono">
                          {log.workingHours || "--"}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 bg-emerald-500 text-white font-bold text-xs rounded-full">
                            {log.status || "Present"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs font-medium text-emerald-700">
                          {log.distanceMeters ? `${log.distanceMeters}m from office` : "Verified"}
                        </td>
                        <td className="py-3.5 px-4 text-xs font-medium text-indigo-600">
                          {log.confidence ? `${log.confidence}% match score` : "Verified"}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-500">{log.notes || "--"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Office Location Configuration */}
        {activeTab === "location" && isAdmin && (
          <div className="p-6 space-y-6 max-w-4xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Brand-wise Office Locations</h3>
                <p className="text-xs text-slate-500">Each brand/branch can be configured with its own distinct GPS office coordinates</p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => {
                    setLocForm({
                      latitude: "",
                      longitude: "",
                      radiusMeters: "200",
                      address: "",
                      brand: selectedBrand || "All",
                    });
                    setIsLocationModalOpen(true);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  + Add / Update Brand Location
                </button>
              )}
            </div>

            {allOfficeLocations.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm bg-slate-50 rounded-2xl border border-slate-200">
                No office locations configured yet. Click &quot;+ Add / Update Brand Location&quot; to upload GPS coordinates.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {allOfficeLocations.map((loc) => (
                  <div key={loc._id || loc.brand} className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-3 relative group">
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-extrabold rounded-lg uppercase tracking-wider">
                        {loc.brand || "All Brands"}
                      </span>
                      <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        {loc.radiusMeters || 200}m Radius
                      </span>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Coordinates</p>
                      <p className="text-sm font-bold text-slate-800 font-mono mt-0.5">
                        {loc.latitude}, {loc.longitude}
                      </p>
                    </div>

                    {loc.address && (
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Address / Landmark</p>
                        <p className="text-xs font-medium text-slate-700 mt-0.5">{loc.address}</p>
                      </div>
                    )}

                    <div className="pt-2 flex items-center justify-between border-t border-slate-200/60">
                      <a
                        href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 hover:text-indigo-800 text-xs font-bold flex items-center gap-1"
                      >
                        Google Maps ↗
                      </a>

                      {isAdmin && (
                        <button
                          onClick={() => {
                            setLocForm({
                              latitude: String(loc.latitude),
                              longitude: String(loc.longitude),
                              radiusMeters: String(loc.radiusMeters || 200),
                              address: loc.address || "",
                              brand: loc.brand || "All",
                            });
                            setIsLocationModalOpen(true);
                          }}
                          className="px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer"
                        >
                          Edit Location
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================= MODAL 1: REGISTER FACE ID ================= */}
      {isFaceRegModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {targetStaffForFaceReg ? `Register/Update Face ID for ${targetStaffForFaceReg.name}` : "Register / Re-Register Face ID"}
                </h3>
                <p className="text-xs text-slate-500">
                  {targetStaffForFaceReg ? `Capturing camera face scan for ${targetStaffForFaceReg.email}` : "Position your face in front of the webcam"}
                </p>
              </div>
              <button onClick={closeModals} className="text-slate-400 hover:text-slate-600 p-2">
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-center">
              {camError && (
                <div className="p-3 bg-rose-50 text-rose-700 text-xs font-medium rounded-xl border border-rose-200">
                  {camError}
                </div>
              )}

              {/* Camera Frame Box */}
              <div className="relative w-full aspect-video bg-slate-950 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100"
                />

                {/* Animated Face Frame Overlay */}
                <div className="absolute inset-0 pointer-events-none border-4 border-dashed border-indigo-400/60 rounded-3xl m-8 flex items-center justify-center">
                  <div className="w-32 h-44 border-2 border-indigo-400 rounded-full animate-pulse opacity-80" />
                </div>
              </div>

              <p className="text-xs text-slate-500">
                Ensure good lighting and look directly into the camera.
              </p>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModals}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRegisterFace}
                  disabled={isProcessing || !cameraActive}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/30 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {isProcessing ? "Processing Scan..." : "Scan & Save Face ID"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: MARK ATTENDANCE ================= */}
      {isMarkAttendanceModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {currentUserStatus.isMarkedToday && !currentUserStatus.todayLog?.checkOutTime
                    ? "Mark Today's Check-Out"
                    : "Mark Today's Check-In"}
                </h3>
                <p className="text-xs text-slate-500">Verifying GPS Location & Face ID</p>
              </div>
              <button onClick={closeModals} className="text-slate-400 hover:text-slate-600 p-2">
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              {camError && (
                <div className="p-3 bg-rose-50 text-rose-700 text-xs font-medium rounded-xl border border-rose-200">
                  {camError}
                </div>
              )}

              {/* Status Checks */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                {/* GPS Status */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="font-semibold text-slate-500">1. GPS Location</p>
                  {gpsStatus.lat ? (
                    <p className="font-bold text-emerald-600 mt-1">Detected ✓</p>
                  ) : (
                    <p className="font-bold text-amber-600 mt-1 animate-pulse">Requesting location...</p>
                  )}
                </div>

                {/* Camera Status */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="font-semibold text-slate-500">2. Face Scanner</p>
                  {cameraActive ? (
                    <p className="font-bold text-emerald-600 mt-1">Camera Active ✓</p>
                  ) : (
                    <p className="font-bold text-amber-600 mt-1 animate-pulse">Starting camera...</p>
                  )}
                </div>
              </div>

              {/* Video Scanner */}
              <div className="relative w-full aspect-video bg-slate-950 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100"
                />

                <div className="absolute inset-0 pointer-events-none border-4 border-indigo-500/50 rounded-3xl m-8 flex items-center justify-center">
                  <div className="w-32 h-44 border-2 border-emerald-400 rounded-full animate-ping opacity-60" />
                </div>
              </div>

              <p className="text-xs text-center text-slate-500">
                Align your face in the box. Both your GPS coordinates and Face ID must match.
              </p>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModals}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleVerifyAndMarkAttendance}
                  disabled={isProcessing || !cameraActive}
                  className={`px-6 py-2.5 text-white font-bold text-sm rounded-xl shadow-lg disabled:opacity-50 flex items-center gap-2 cursor-pointer ${
                    currentUserStatus.isMarkedToday && !currentUserStatus.todayLog?.checkOutTime
                      ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/30"
                      : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30"
                  }`}
                >
                  {isProcessing
                    ? "Verifying..."
                    : currentUserStatus.isMarkedToday && !currentUserStatus.todayLog?.checkOutTime
                    ? "Verify & Check-Out"
                    : "Verify & Mark Present"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 3: UPLOAD OFFICE LOCATION (ADMIN) ================= */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Upload Office Location</h3>
                <p className="text-xs text-slate-500">Set office GPS coordinates for staff verification</p>
              </div>
              <button onClick={closeModals} className="text-slate-400 hover:text-slate-600 p-2">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveOfficeLocation} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600">Assign to Brand / Location Scope *</label>
                <select
                  value={locForm.brand}
                  onChange={(e) => setLocForm({ ...locForm, brand: e.target.value })}
                  className="w-full px-3 py-2 mt-1 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="All">All Brands (Global Default)</option>
                  {availableBrands.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleDetectCurrentLocation}
                disabled={detectingGps}
                className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold rounded-xl text-sm transition-colors border border-indigo-200 flex items-center justify-center gap-2 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                {detectingGps ? "Detecting GPS Position..." : "Detect My Current GPS Location"}
              </button>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Latitude *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={locForm.latitude}
                    onChange={(e) => setLocForm({ ...locForm, latitude: e.target.value })}
                    placeholder="e.g. 28.6139"
                    className="w-full px-3 py-2 mt-1 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600">Longitude *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={locForm.longitude}
                    onChange={(e) => setLocForm({ ...locForm, longitude: e.target.value })}
                    placeholder="e.g. 77.2090"
                    className="w-full px-3 py-2 mt-1 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">Allowed Distance Radius (Meters) *</label>
                <input
                  type="number"
                  required
                  value={locForm.radiusMeters}
                  onChange={(e) => setLocForm({ ...locForm, radiusMeters: e.target.value })}
                  placeholder="200"
                  className="w-full px-3 py-2 mt-1 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Staff must mark attendance within this distance from office coordinates.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">Office Name / Address (Optional)</label>
                <input
                  type="text"
                  value={locForm.address}
                  onChange={(e) => setLocForm({ ...locForm, address: e.target.value })}
                  placeholder="Main Office Campus, Delhi"
                  className="w-full px-3 py-2 mt-1 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModals}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/30 disabled:opacity-50 cursor-pointer"
                >
                  {isProcessing ? "Saving..." : "Save Office Location"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
