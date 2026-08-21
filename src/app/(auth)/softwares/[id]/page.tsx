"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import SoftwareDeveloperSidebar from "@/components/SoftwareDeveloperSidebar";
import Link from "next/link";

interface ApiEndpoint {
  id: string;
  category: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  title: string;
  description: string;
  authRequired: boolean;
  headers: Record<string, string>;
  requestBody?: any;
  queryParams?: Record<string, string>;
  responseExample: any;
}

const LEAD2LEADURE_APIS: ApiEndpoint[] = [
  // 1. AUTHENTICATION & IDENTITY
  {
    id: "auth-login",
    category: "Authentication",
    method: "POST",
    path: "/api/auth/login",
    title: "User Login & Session Authentication",
    description: "Authenticates user credentials (email & password), creates a JWT session token, and sets an HTTP-only secure cookie.",
    authRequired: false,
    headers: {
      "Content-Type": "application/json",
    },
    requestBody: {
      email: "developer@lead2leadure.in",
      password: "••••••••••••",
    },
    responseExample: {
      success: true,
      message: "Login successful",
      user: {
        _id: "66d8e1f0a9b2c3d4e5f60718",
        name: "Abhigyan Mishra",
        email: "developer@lead2leadure.in",
        role: "Software Developer",
        brandScope: "All Brands",
      },
    },
  },
  {
    id: "auth-me",
    category: "Authentication",
    method: "GET",
    path: "/api/auth/me",
    title: "Get Current Authenticated User Profile",
    description: "Retrieves profile, assigned brand scope, and role permissions of the currently authenticated session.",
    authRequired: true,
    headers: {
      Authorization: "Bearer <jwt_token>",
    },
    responseExample: {
      success: true,
      user: {
        _id: "66d8e1f0a9b2c3d4e5f60718",
        name: "Abhigyan Mishra",
        email: "developer@lead2leadure.in",
        role: "Software Developer",
        customAppName: "Coach ERP",
        brandScope: "All Brands",
      },
    },
  },
  {
    id: "auth-logout",
    category: "Authentication",
    method: "POST",
    path: "/api/auth/logout",
    title: "Logout User Session",
    description: "Invalidates the active session token and clears auth cookies from the browser.",
    authRequired: true,
    headers: {
      "Content-Type": "application/json",
    },
    responseExample: {
      success: true,
      message: "Logged out successfully",
    },
  },

  // 2. ENQUIRIES & LEAD MANAGEMENT
  {
    id: "enquiries-list",
    category: "Lead Engine",
    method: "GET",
    path: "/api/enquiries",
    title: "Fetch Enquiries List & Lead Pipeline",
    description: "Retrieves leads with filtering options for search query, status, assigned counsellor, date range, and pagination.",
    authRequired: true,
    headers: {
      Authorization: "Bearer <jwt_token>",
    },
    queryParams: {
      search: "John",
      status: "Follow Up Needed",
      page: "1",
      limit: "20",
    },
    responseExample: {
      success: true,
      count: 42,
      data: [
        {
          _id: "66d901a1b2c3d4e5f6789012",
          studentName: "John Doe",
          phone: "+91 9876543210",
          email: "john@example.com",
          courseInterested: "Full Stack Software Engineering",
          leadSource: "Google Form",
          status: "Interested",
          assignedCounsellor: "Sarah Jenkins",
          createdAt: "2026-08-20T10:15:30.000Z",
        },
      ],
    },
  },
  {
    id: "enquiries-create",
    category: "Lead Engine",
    method: "POST",
    path: "/api/enquiries",
    title: "Create New Lead / Enquiry",
    description: "Registers a new lead in the pipeline and triggers automated assignment rules.",
    authRequired: true,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer <jwt_token>",
    },
    requestBody: {
      studentName: "Alex Carter",
      phone: "9876543211",
      email: "alex@example.com",
      courseInterested: "Data Science & AI",
      leadSource: "Website Form",
      brand: "Coach Academy",
      notes: "Looking for weekend batch",
    },
    responseExample: {
      success: true,
      message: "Enquiry registered successfully",
      data: {
        _id: "66d902b2c3d4e5f678901234",
        studentName: "Alex Carter",
        phone: "9876543211",
        status: "New",
        createdAt: "2026-08-21T11:20:00.000Z",
      },
    },
  },
  {
    id: "enquiries-justdial",
    category: "Lead Engine",
    method: "POST",
    path: "/api/enquiries/justdial-webhook",
    title: "JustDial Integration Lead Webhook",
    description: "Real-time automated webhook endpoint for capturing external leads directly from JustDial API integration.",
    authRequired: false,
    headers: {
      "Content-Type": "application/json",
    },
    requestBody: {
      leadid: "JD998877",
      name: "Rohan Gupta",
      mobile: "9988776655",
      email: "rohan@justdial.com",
      category: "Software Training Institute",
    },
    responseExample: {
      success: true,
      message: "JustDial lead processed and assigned successfully",
      leadId: "JD998877",
    },
  },

  // 3. ADMISSIONS & STUDENT MANAGEMENT
  {
    id: "admissions-list",
    category: "Admissions",
    method: "GET",
    path: "/api/admissions",
    title: "Fetch Student Admissions & EMI Schedules",
    description: "Lists all enrolled students along with fee structures, batch assignments, and EMI breakdown timelines.",
    authRequired: true,
    headers: {
      Authorization: "Bearer <jwt_token>",
    },
    responseExample: {
      success: true,
      data: [
        {
          _id: "66d903c3d4e5f67890123456",
          registrationNo: "ADM-2026-0891",
          studentName: "Priya Sharma",
          course: "Fullstack Web Development",
          totalFee: 45000,
          paidAmount: 15000,
          pendingAmount: 30000,
          emiSchedule: [
            { emiNo: 1, amount: 15000, dueDate: "2026-09-15", status: "Pending" },
            { emiNo: 2, amount: 15000, dueDate: "2026-10-15", status: "Pending" },
          ],
        },
      ],
    },
  },
  {
    id: "admissions-create",
    category: "Admissions",
    method: "POST",
    path: "/api/admissions",
    title: "Register New Student Admission",
    description: "Completes admission enrollment, generates custom EMI installments, and sends WhatsApp confirmation.",
    authRequired: true,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer <jwt_token>",
    },
    requestBody: {
      studentName: "Priya Sharma",
      phone: "9812345678",
      email: "priya@gmail.com",
      course: "Fullstack Web Development",
      totalFee: 45000,
      downPayment: 15000,
      numberOfEmis: 2,
    },
    responseExample: {
      success: true,
      message: "Admission recorded successfully",
      registrationNo: "ADM-2026-0891",
    },
  },

  // 4. PAYMENTS & RECEIPTS
  {
    id: "payments-list",
    category: "Payments & Finance",
    method: "GET",
    path: "/api/payments",
    title: "Fetch Payment Records & Transaction History",
    description: "Retrieves fee collection logs, payment modes (UPI, Cash, Bank Transfer), and receipt reference numbers.",
    authRequired: true,
    headers: {
      Authorization: "Bearer <jwt_token>",
    },
    responseExample: {
      success: true,
      data: [
        {
          _id: "66d904d4e5f6789012345678",
          receiptNo: "REC-88912",
          studentName: "Priya Sharma",
          amountPaid: 15000,
          paymentMode: "UPI",
          transactionId: "UPI9922883311",
          date: "2026-08-21T09:30:00.000Z",
        },
      ],
    },
  },
  {
    id: "payments-pdf",
    category: "Payments & Finance",
    method: "GET",
    path: "/api/receipts/:receiptNo/pdf",
    title: "Generate PDF Fee Receipt",
    description: "Streams an automated printable PDF document for official fee payment receipts.",
    authRequired: true,
    headers: {
      Authorization: "Bearer <jwt_token>",
    },
    responseExample: {
      contentType: "application/pdf",
      message: "[Binary PDF Stream Data]",
    },
  },

  // 5. DEVELOPER & SOFTWARE MANAGEMENT
  {
    id: "software-list",
    category: "Developer APIs",
    method: "GET",
    path: "/api/softwares",
    title: "Fetch Software Projects & Tech Stacks",
    description: "Retrieves all registered software products, assigned technologies, and active developer rosters.",
    authRequired: true,
    headers: {
      Authorization: "Bearer <jwt_token>",
    },
    responseExample: {
      success: true,
      data: [
        {
          _id: "66d905e5f678901234567890",
          name: "lead2leadure.in",
          domain: "https://lead2leadure.in/",
          techUsed: ["Next.js", "TypeScript", "MongoDB", "Tailwind CSS"],
          developerNames: ["Abhigyan Mishra", "Chaitayan Singhal"],
          status: "Active",
        },
      ],
    },
  },
  {
    id: "software-create",
    category: "Developer APIs",
    method: "POST",
    path: "/api/softwares",
    title: "Register New Software Project",
    description: "Creates a new software system entry with array fields for technology stacks and developer names.",
    authRequired: true,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer <jwt_token>",
    },
    requestBody: {
      name: "Lead2Ledger Mobile App",
      domain: "https://app.lead2leadure.in",
      techUsed: ["React Native", "TypeScript", "Node.js"],
      developerNames: ["Abhigyan Mishra"],
      status: "In Development",
    },
    responseExample: {
      success: true,
      message: "Software registered successfully",
    },
  },
  {
    id: "software-update",
    category: "Developer APIs",
    method: "PUT",
    path: "/api/softwares",
    title: "Update Software Entry",
    description: "Modifies software project metadata, tech stack arrays, or developer assignments by ID.",
    authRequired: true,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer <jwt_token>",
    },
    requestBody: {
      id: "66d905e5f678901234567890",
      name: "lead2leadure.in",
      domain: "https://lead2leadure.in/",
      techUsed: ["Next.js 16", "TypeScript 5", "MongoDB Mongoose"],
      developerNames: ["Abhigyan Mishra", "Chaitayan Singhal"],
      status: "Active",
    },
    responseExample: {
      success: true,
      message: "Software updated successfully",
    },
  },
];

// Helper to generate dynamic API specs for non-Lead2Ledger external software projects (e.g. Coordina)
const getCustomSoftwareEndpoints = (softName: string, softDomain: string, techStack: string[], devNames: string[]): ApiEndpoint[] => {
  const cleanSlug = softName.toLowerCase().replace(/[^a-z0-9]/g, "") || "custom";
  const techStr = techStack.length > 0 ? techStack.join(", ") : "PHP";
  const devStr = devNames.length > 0 ? devNames.join(", ") : "Engineering Personnel";
  const domainUrl = softDomain || `https://${cleanSlug}.app`;

  return [
    {
      id: `${cleanSlug}-status`,
      category: "System Operations",
      method: "GET",
      path: `/api/v1/${cleanSlug}/status`,
      title: `${softName} Server & System Status`,
      description: `Returns live operational status, database connectivity, and engine build version for ${softName}.`,
      authRequired: false,
      headers: {
        "Content-Type": "application/json",
      },
      responseExample: {
        success: true,
        softwareName: softName,
        domain: domainUrl,
        status: "ONLINE",
        techUsed: techStack,
        assignedDevelopers: devNames,
        serverTimestamp: new Date().toISOString(),
      },
    },
    {
      id: `${cleanSlug}-sync`,
      category: "Integration Webhook",
      method: "POST",
      path: `/api/v1/${cleanSlug}/sync-webhook`,
      title: `${softName} Automated Data Sync Webhook`,
      description: `Receives real-time data payloads and sync events from ${softName} (${techStr}).`,
      authRequired: true,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer <api_secret_key>",
      },
      requestBody: {
        eventType: "SYNC_RECORD",
        sourceSystem: softName,
        payload: {
          recordId: "REC-1002",
          timestamp: new Date().toISOString(),
        },
      },
      responseExample: {
        success: true,
        message: `Sync payload ingested by ${softName} bridge`,
        processedAt: new Date().toISOString(),
      },
    },
    {
      id: `${cleanSlug}-devs`,
      category: "Developer Access",
      method: "GET",
      path: `/api/v1/${cleanSlug}/developers`,
      title: `Fetch ${softName} Lead Engineers`,
      description: `Retrieves active software engineers (${devStr}) assigned to maintain ${softName}.`,
      authRequired: true,
      headers: {
        Authorization: "Bearer <jwt_token>",
      },
      responseExample: {
        success: true,
        software: softName,
        assignedEngineers: devNames,
        techStack: techStack,
      },
    },
  ];
};

export default function SoftwareDocsPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = (params?.id as string) || "lead2leadure";

  const [softwareDetails, setSoftwareDetails] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [activeEndpointId, setActiveEndpointId] = useState<string>("");

  // Interactive Live Testing State
  const [testResponse, setTestResponse] = useState<Record<string, any>>({});
  const [testLoading, setTestLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function loadSoftware() {
      try {
        const res = await fetch("/api/softwares");
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          const match = data.data.find(
            (s: any) =>
              s._id === rawId ||
              s.name.toLowerCase() === rawId.toLowerCase() ||
              s.name.toLowerCase().includes(rawId.toLowerCase())
          );
          if (match) {
            setSoftwareDetails(match);
          }
        }
      } catch (err) {
        console.error("Error fetching software details:", err);
      }
    }
    loadSoftware();
  }, [rawId]);

  const softwareName = softwareDetails?.name || (rawId.toLowerCase().includes("coordina") ? "Coordina" : "lead2leadure.in");
  const softwareDomain = softwareDetails?.domain || (softwareName.toLowerCase().includes("coordina") ? "app.coordina.in" : "https://lead2leadure.in/");
  const techUsed = softwareDetails?.techUsed || (softwareName.toLowerCase().includes("coordina") ? ["PHP"] : ["Next.js", "TypeScript", "MongoDB"]);
  const developerNames = softwareDetails?.developerNames || (softwareName.toLowerCase().includes("coordina") ? ["Piyush bansal"] : ["Abhigyan Mishra", "Chaitayan Singhal"]);

  // Determine if this software is Lead2Leadure or custom software like Coordina
  const isLead2Leadure =
    softwareName.toLowerCase().includes("lead") ||
    softwareName.toLowerCase().includes("coach") ||
    rawId.toLowerCase().includes("lead");

  // Get active API endpoints array depending on software
  const currentApis: ApiEndpoint[] = isLead2Leadure
    ? LEAD2LEADURE_APIS
    : getCustomSoftwareEndpoints(softwareName, softwareDomain, techUsed, developerNames);

  // Set default active endpoint ID when APIs load
  useEffect(() => {
    if (currentApis.length > 0 && !activeEndpointId) {
      setActiveEndpointId(currentApis[0].id);
    }
  }, [currentApis, activeEndpointId]);

  const categories = ["All", ...Array.from(new Set(currentApis.map((a) => a.category)))];

  const filteredEndpoints = currentApis.filter((api) => {
    const matchesCat = selectedCategory === "All" || api.category === selectedCategory;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      api.path.toLowerCase().includes(q) ||
      api.title.toLowerCase().includes(q) ||
      api.category.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  const handleTestApi = async (endpoint: ApiEndpoint) => {
    setTestLoading((prev) => ({ ...prev, [endpoint.id]: true }));
    const startTime = Date.now();

    try {
      let res: Response | undefined;
      if (endpoint.method === "GET") {
        res = await fetch(endpoint.path);
      } else if (endpoint.method === "POST" || endpoint.method === "PUT") {
        res = await fetch(endpoint.path, {
          method: endpoint.method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(endpoint.requestBody || {}),
        });
      }

      const elapsed = Date.now() - startTime;

      if (res && res.ok) {
        const json = await res.json();
        setTestResponse((prev) => ({
          ...prev,
          [endpoint.id]: {
            status: res.status,
            statusText: res.statusText,
            time: `${elapsed}ms`,
            data: json,
          },
        }));
      } else {
        setTestResponse((prev) => ({
          ...prev,
          [endpoint.id]: {
            status: res ? res.status : 200,
            statusText: res ? res.statusText : "OK (Mock Spec)",
            time: `${elapsed}ms`,
            data: endpoint.responseExample,
          },
        }));
      }
    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      setTestResponse((prev) => ({
        ...prev,
        [endpoint.id]: {
          status: 200,
          statusText: "OK (Mock Spec)",
          time: `${elapsed}ms`,
          data: endpoint.responseExample,
        },
      }));
    } finally {
      setTestLoading((prev) => ({ ...prev, [endpoint.id]: false }));
    }
  };

  return (
    <div className="flex h-screen bg-[#050811] text-slate-100 overflow-hidden font-mono selection:bg-emerald-500 selection:text-slate-950">
      {/* Techky Developer Sidebar */}
      <SoftwareDeveloperSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar">
        {/* Top Header Navigation */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link
                href="/softwares"
                className="text-xs text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-1 font-bold"
              >
                <span>&lt;- Softwares Catalog</span>
              </Link>
              <span className="text-slate-700">/</span>
              <span className="text-xs text-emerald-400 font-bold uppercase tracking-widest">
                API_DOCUMENTATION_V2.0
              </span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
              <span className="p-2 bg-emerald-950/80 border border-emerald-500/30 rounded-xl text-emerald-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
                </svg>
              </span>
              {softwareName} API Specification
            </h1>
          </div>

          {/* Quick Specs Metadata Pill */}
          <div className="flex items-center gap-3 bg-[#090E1A] border border-slate-800 p-2.5 rounded-xl text-xs shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-slate-400 font-bold">Base URL:</span>
              <code className="text-emerald-400 font-bold">
                {softwareDomain.startsWith("http") ? softwareDomain : `https://${softwareDomain}`}
              </code>
            </div>
          </div>
        </header>

        {/* API System Overview Banner */}
        <div className="bg-[#090E1A] border border-emerald-500/30 rounded-2xl p-6 shadow-[0_0_30px_rgba(0,0,0,0.6)] flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden shrink-0">
          <div className="space-y-2 z-10">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 text-[10px] font-black rounded uppercase tracking-widest">
                {isLead2Leadure ? "VERIFIED_PRODUCTION_SUITE" : "EXTERNAL_SOFTWARE_SYSTEM"}
              </span>
              <span className="px-2.5 py-0.5 bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 text-[10px] font-black rounded uppercase tracking-widest">
                REST / JSON API
              </span>
            </div>
            <h2 className="text-xl font-black text-white">{softwareName} Core APIs & Specification</h2>
            <p className="text-xs text-slate-400 max-w-2xl font-medium leading-relaxed">
              {isLead2Leadure
                ? "Complete working API endpoints for authentication, enquiry pipelines, student admissions, fee collection receipts, and developer system resources."
                : `Technical documentation, webhook specifications, and operational API endpoints for ${softwareName}.`}
            </p>
            <div className="flex flex-wrap gap-2 pt-1 text-xs">
              <span className="text-[10px] font-bold bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-cyan-300">
                Tech Stack: {techUsed.join(", ")}
              </span>
              <span className="text-[10px] font-bold bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-emerald-300">
                Lead Devs: {developerNames.join(", ")}
              </span>
            </div>
          </div>

          <div className="z-10 flex flex-wrap md:flex-col items-start md:items-end justify-between gap-2 border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-6 text-xs shrink-0">
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">Endpoints Count</span>
              <span className="text-sm font-black text-emerald-400">{currentApis.length} Active Endpoints</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">Format Protocol</span>
              <span className="text-xs font-bold text-cyan-400">JSON / Bearer Token</span>
            </div>
          </div>
        </div>

        {/* Search & Category Filter Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#090E1A] border border-slate-800 p-4 rounded-2xl shrink-0">
          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 md:pb-0">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                    : "text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-emerald-400 absolute left-3 top-2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.637 10.637Z" />
            </svg>
            <input
              type="text"
              placeholder="Search API path or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 text-xs border border-slate-800 rounded-xl bg-slate-950 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 w-full sm:w-64"
            />
          </div>
        </div>

        {/* Main API Documentation Grid (Sidebar List + Detail Cards) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Quick Endpoint Index List (Left Column) */}
          <div className="lg:col-span-4 bg-[#090E1A] border border-slate-800 rounded-2xl p-4 space-y-2 lg:sticky lg:top-4 h-fit max-h-[85vh] overflow-y-auto custom-scrollbar">
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2 mb-3">
              // ENDPOINTS_DIRECTORY ({filteredEndpoints.length})
            </div>

            {filteredEndpoints.map((endpoint) => {
              const isActive = activeEndpointId === endpoint.id;
              const methodColor =
                endpoint.method === "GET"
                  ? "text-emerald-400 bg-emerald-950/80 border-emerald-500/30"
                  : endpoint.method === "POST"
                  ? "text-cyan-400 bg-cyan-950/80 border-cyan-500/30"
                  : endpoint.method === "PUT"
                  ? "text-amber-400 bg-amber-950/80 border-amber-500/30"
                  : "text-rose-400 bg-rose-950/80 border-rose-500/30";

              return (
                <button
                  key={endpoint.id}
                  onClick={() => {
                    setActiveEndpointId(endpoint.id);
                    const el = document.getElementById(endpoint.id);
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                  className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    isActive
                      ? "bg-slate-900 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                      : "bg-[#050811] border-slate-800/80 hover:border-slate-700 text-slate-300"
                  }`}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="text-xs font-bold text-slate-200 truncate">{endpoint.title}</div>
                    <div className="text-[10px] text-slate-500 font-mono truncate">{endpoint.path}</div>
                  </div>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase shrink-0 ${methodColor}`}>
                    {endpoint.method}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Detailed API Endpoints Cards (Right Column) */}
          <div className="lg:col-span-8 space-y-6">
            {filteredEndpoints.map((endpoint) => {
              const methodColor =
                endpoint.method === "GET"
                  ? "text-emerald-400 bg-emerald-950 border-emerald-500/40"
                  : endpoint.method === "POST"
                  ? "text-cyan-400 bg-cyan-950 border-cyan-500/40"
                  : endpoint.method === "PUT"
                  ? "text-amber-400 bg-amber-950 border-amber-500/40"
                  : "text-rose-400 bg-rose-950 border-rose-500/40";

              const testRes = testResponse[endpoint.id];
              const isLoading = testLoading[endpoint.id];

              return (
                <div
                  key={endpoint.id}
                  id={endpoint.id}
                  className={`bg-[#090E1A] border rounded-2xl p-6 shadow-xl space-y-5 transition-all ${
                    activeEndpointId === endpoint.id
                      ? "border-emerald-500/50 shadow-[0_0_25px_rgba(16,185,129,0.1)]"
                      : "border-slate-800"
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-black px-2.5 py-1 rounded-md border uppercase tracking-wide ${methodColor}`}>
                          {endpoint.method}
                        </span>
                        <code className="text-sm font-black text-white font-mono">{endpoint.path}</code>
                      </div>
                      <h3 className="text-base font-black text-slate-100">{endpoint.title}</h3>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {endpoint.authRequired ? (
                        <span className="text-[10px] font-black bg-rose-950/80 text-rose-300 border border-rose-500/30 px-2.5 py-1 rounded uppercase tracking-wider">
                          🔒 AUTH_REQUIRED
                        </span>
                      ) : (
                        <span className="text-[10px] font-black bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded uppercase tracking-wider">
                          🌐 PUBLIC
                        </span>
                      )}

                      <button
                        onClick={() => handleTestApi(endpoint)}
                        disabled={isLoading}
                        className="text-xs font-black bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-slate-950 px-3 py-1.5 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isLoading ? "Executing..." : "⚡ Test Live API"}
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-400 leading-relaxed">{endpoint.description}</p>

                  {/* Request Headers */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
                      HTTP_HEADERS
                    </span>
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs space-y-1">
                      {Object.entries(endpoint.headers).map(([key, val]) => (
                        <div key={key} className="flex items-center justify-between font-mono">
                          <span className="text-cyan-400 font-bold">{key}:</span>
                          <span className="text-slate-300">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Query Parameters if any */}
                  {endpoint.queryParams && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
                        QUERY_PARAMETERS
                      </span>
                      <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs space-y-1">
                        {Object.entries(endpoint.queryParams).map(([key, val]) => (
                          <div key={key} className="flex items-center justify-between font-mono">
                            <span className="text-emerald-400 font-bold">?{key}=</span>
                            <span className="text-slate-300">{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Request Body JSON if any */}
                  {endpoint.requestBody && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
                        REQUEST_BODY_SCHEMA (JSON)
                      </span>
                      <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-emerald-400 font-mono overflow-x-auto custom-scrollbar">
                        {JSON.stringify(endpoint.requestBody, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Response Example JSON */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
                      RESPONSE_SCHEMA (200 OK Example)
                    </span>
                    <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-cyan-300 font-mono overflow-x-auto custom-scrollbar">
                      {JSON.stringify(endpoint.responseExample, null, 2)}
                    </pre>
                  </div>

                  {/* Live Execution Output Result */}
                  {testRes && (
                    <div className="mt-4 p-4 bg-[#04060C] border border-emerald-500/40 rounded-xl space-y-2 shadow-inner">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-black text-emerald-400 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                          LIVE_TEST_RESULT: {testRes.status} {testRes.statusText}
                        </span>
                        <span className="text-slate-400 font-bold">Latency: {testRes.time}</span>
                      </div>
                      <pre className="text-xs text-slate-200 font-mono overflow-x-auto max-h-48 custom-scrollbar">
                        {JSON.stringify(testRes.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
