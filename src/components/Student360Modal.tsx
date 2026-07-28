"use client";

import React, { useState, useEffect } from "react";
import PaymentReceiptModal from "@/components/PaymentReceiptModal";

interface Student360ModalProps {
  admissionId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
  canEdit?: boolean;
}

export default function Student360Modal({
  admissionId,
  isOpen,
  onClose,
  onRefresh,
  canEdit = true,
}: Student360ModalProps) {
  const [activeTab, setActiveTab] = useState<"personal" | "academic" | "financial" | "payments" | "tasks">("personal");
  const [taskFilter, setTaskFilter] = useState<"all" | "pending" | "completed" | "emi">("all");
  const [loading, setLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [studentData, setStudentData] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [formData, setFormData] = useState<any>({});
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState<any>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteStudent = async () => {
    if (!admissionId || !studentData) return;
    const confirmDelete = window.confirm(
      `Are you sure you want to permanently delete student "${studentData.fullName}" (Reg ID: ${studentData.admissionId || "N/A"})?\n\nThis will remove their 360 profile, payment history, and tasks. This action CANNOT be undone.`
    );
    if (!confirmDelete) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admissions/${admissionId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        alert("Student record deleted successfully.");
        onClose();
        if (onRefresh) onRefresh();
      } else {
        alert(json.message || "Failed to delete student.");
      }
    } catch (err) {
      console.error("Error deleting student:", err);
      alert("Error deleting student record.");
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (isOpen && admissionId) {
      fetchStudentDetails(admissionId);
    } else {
      setStudentData(null);
      setIsEditMode(false);
    }
  }, [isOpen, admissionId]);

  const fetchStudentDetails = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admissions/${id}`);
      const json = await res.json();
      if (json.success && json.data) {
        const adm = json.data.admission;
        setStudentData(adm);
        setPayments(json.data.payments || []);
        setTasks(json.data.tasks || []);

        const emiList = (adm.customEmiPlan || []).map((e: any) => ({
          dueDate: e.dueDate ? new Date(e.dueDate).toISOString().slice(0, 10) : "",
          amount: Number(e.amount) || 0,
          isPaid: Boolean(e.isPaid),
          paidDate: e.paidDate ? new Date(e.paidDate).toISOString().slice(0, 10) : "",
        }));

        setFormData({
          fullName: adm.fullName || "",
          mobileNumber: adm.mobileNumber || "",
          email: adm.email || "",
          parentName: adm.parentName || adm.parentsFullName || "",
          parentPhone: adm.parentPhone || adm.parentsPhoneNumber || "",
          guardian2Name: adm.guardian2Name || "",
          guardian2Phone: adm.guardian2Phone || "",
          address: adm.address || "",
          city: adm.city || "",
          state: adm.state || "",
          pincode: adm.pincode || "",
          dob: adm.dob || "",
          gender: adm.gender || "",
          counsellor: adm.counsellor || "",
          brand: adm.brand || "",
          course: adm.course || "",
          batch: adm.batch || "",
          duration: adm.duration || "",
          academicYear: adm.academicYear || "",
          startDate: adm.startDate ? new Date(adm.startDate).toISOString().slice(0, 10) : "",
          admissionDate: adm.admissionDate ? new Date(adm.admissionDate).toISOString().slice(0, 10) : "",
          companyAssigned: adm.companyAssigned || "",
          courseFee: adm.courseFee || 0,
          finalFee: adm.finalFee || 0,
          amountReceivedToday: adm.amountReceivedToday || 0,
          registrationAmount: adm.registrationAmount !== undefined ? adm.registrationAmount : (adm.amountReceivedToday || 0),
          downpaymentAmount: adm.downpaymentAmount || 0,
          downpaymentDueDate: adm.downpaymentDueDate ? new Date(adm.downpaymentDueDate).toISOString().slice(0, 10) : "",
          remainingBalance: adm.remainingBalance || 0,
          paymentMode: adm.paymentMode || "Cash",
          transactionNo: adm.transactionNo || "",
          hasEmi: Boolean(adm.hasEmi),
          numInstallments: adm.numInstallments || 1,
          installmentAmount: adm.installmentAmount || 0,
          customEmiPlan: emiList,
        });
      } else {
        alert(json.message || "Failed to load student record.");
      }
    } catch (err) {
      console.error("Error fetching student 360 details:", err);
      alert("Error loading student 360 profile.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!admissionId) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/admissions/${admissionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const json = await res.json();
      if (json.success) {
        setStudentData(json.data);
        setIsEditMode(false);
        if (onRefresh) onRefresh();
        showToast("Student 360 profile & EMI plan updated successfully!");
      } else {
        alert(json.message || "Failed to update student details.");
      }
    } catch (err) {
      console.error("Error updating student details:", err);
      alert("Failed to save student details.");
    } finally {
      setIsSaving(false);
    }
  };

  const showToast = (msg: string) => {
    setCopyToast(msg);
    setTimeout(() => setCopyToast(null), 3000);
  };

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast(`Copied ${label} (${text}) to clipboard!`);
  };

  const openReceiptModal = (p: any) => {
    setSelectedReceiptPayment(p);
    setIsReceiptOpen(true);
  };

  // EMI Helper Functions
  const handleAutoGenerateEmi = () => {
    const count = Number(formData.numInstallments) || 2;
    const balance = computedBalance > 0 ? computedBalance : Number(formData.finalFee) || 0;
    const perEmi = Math.round(balance / count);

    const plan = [];
    const baseDate = new Date();
    for (let i = 0; i < count; i++) {
      const d = new Date(baseDate);
      d.setMonth(d.getMonth() + (i + 1));
      plan.push({
        dueDate: d.toISOString().slice(0, 10),
        amount: perEmi,
        isPaid: false,
        paidDate: "",
      });
    }

    setFormData({
      ...formData,
      hasEmi: true,
      numInstallments: count,
      installmentAmount: perEmi,
      customEmiPlan: plan,
    });
    showToast(`Generated ${count} monthly EMI installments of ₹${perEmi.toLocaleString("en-IN")}`);
  };

  const handleAddEmiRow = () => {
    const nextD = new Date();
    nextD.setMonth(nextD.getMonth() + 1);
    const currentPlan = formData.customEmiPlan || [];
    setFormData({
      ...formData,
      hasEmi: true,
      customEmiPlan: [
        ...currentPlan,
        {
          dueDate: nextD.toISOString().slice(0, 10),
          amount: Number(formData.installmentAmount) || 5000,
          isPaid: false,
          paidDate: "",
        },
      ],
    });
  };

  const handleRemoveEmiRow = (index: number) => {
    const currentPlan = [...(formData.customEmiPlan || [])];
    currentPlan.splice(index, 1);
    setFormData({
      ...formData,
      customEmiPlan: currentPlan,
    });
  };

  const handleEmiFieldChange = (index: number, field: string, value: any) => {
    const currentPlan = [...(formData.customEmiPlan || [])];
    const updatedItem = {
      ...currentPlan[index],
      [field]: value,
    };
    if (field === "isPaid") {
      updatedItem.paidDate = value ? (updatedItem.paidDate || new Date().toISOString().slice(0, 10)) : "";
    }
    currentPlan[index] = updatedItem;

    const unpaidSum = currentPlan
      .filter((e: any) => !e.isPaid)
      .reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);

    setFormData({
      ...formData,
      remainingBalance: unpaidSum,
      customEmiPlan: currentPlan,
    });
  };

  const handleEmiStatusChange = async (index: number, isPaid: boolean) => {
    const currentPlan = [...(formData.customEmiPlan || emiPlanToRender || [])];
    const todayStr = new Date().toISOString().slice(0, 10);

    currentPlan[index] = {
      ...currentPlan[index],
      isPaid: isPaid,
      paidDate: isPaid ? (currentPlan[index].paidDate || todayStr) : "",
    };

    const unpaidSum = currentPlan
      .filter((e: any) => !e.isPaid)
      .reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);

    setFormData((prev: any) => ({
      ...prev,
      remainingBalance: unpaidSum,
      customEmiPlan: currentPlan,
    }));

    if (admissionId) {
      try {
        const res = await fetch(`/api/admissions/${admissionId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customEmiPlan: currentPlan,
            remainingBalance: unpaidSum,
          }),
        });
        const json = await res.json();
        if (json.success) {
          setStudentData(json.data);
          if (onRefresh) onRefresh();
          showToast(`Installment #${index + 1} marked as ${isPaid ? "Paid" : "Pending (Unpaid)"}!`);
        } else {
          alert(json.message || "Failed to update EMI status");
        }
      } catch (err) {
        console.error("Failed to update EMI status:", err);
        alert("Failed to update EMI status");
      }
    }
  };

  if (!isOpen) return null;

  const totalCollected = payments.reduce((acc, p) => acc + (Number(p.amountReceived) || 0), 0);
  const regAmt = Number(studentData?.registrationAmount ?? studentData?.amountReceivedToday) || 0;
  const dpAmt = Number(studentData?.downpaymentAmount) || 0;
  const emiItems = studentData?.customEmiPlan || formData.customEmiPlan || [];
  const pendingEmisSum = emiItems.filter((e: any) => !e.isPaid).reduce((acc: number, e: any) => acc + (Number(e.amount) || 0), 0);
  const remainingBalFromData = Number(studentData?.remainingBalance || 0);
  
  const computedBalance = studentData
    ? (pendingEmisSum > 0
        ? pendingEmisSum
        : (remainingBalFromData > 0
            ? remainingBalFromData
            : Math.max(0, (studentData.finalFee || 0) - regAmt - dpAmt)))
    : 0;

  const feeProgress = studentData && studentData.finalFee > 0
    ? Math.min(100, Math.round(((totalCollected || regAmt) / studentData.finalFee) * 100))
    : 0;

  // Task filtering
  const filteredTasks = tasks.filter((t) => {
    if (taskFilter === "pending") return t.status !== "Completed";
    if (taskFilter === "completed") return t.status === "Completed";
    if (taskFilter === "emi") return (t.taskType || "").toLowerCase().includes("emi") || (t.title || "").toLowerCase().includes("emi");
    return true;
  });

  const cleanPhone = (phone?: string) => (phone || "").replace(/[^0-9]/g, "");

  const emiPlanToRender = formData.customEmiPlan || [];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 transition-all duration-300 animate-in fade-in zoom-in-95"
      onClick={onClose}
    >
      {/* Centered Popup Screen Container matching CoachFlow theme */}
      <div
        className="bg-white w-full max-w-5xl max-h-[92vh] flex flex-col rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden font-sans transform transition-all relative"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Toast Notification Banner */}
        {copyToast && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white font-extrabold text-xs px-4 py-2 rounded-xl shadow-xl border border-slate-800 flex items-center gap-2 animate-in slide-in-from-top-2">
            <span className="text-emerald-400 font-black">✓</span>
            <span>{copyToast}</span>
          </div>
        )}

        {/* Modal Header */}
        <div className="p-6 bg-white border-b border-slate-200/80 flex items-center justify-between shrink-0 relative rounded-t-3xl">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-indigo-600 text-white font-black text-xl flex items-center justify-center shadow-md shadow-indigo-600/20 uppercase shrink-0">
              {studentData?.fullName ? studentData.fullName.substring(0, 2) : "ST"}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
                  {studentData?.fullName || "Student 360 Profile"}
                </h2>
                <span className="bg-indigo-50 text-indigo-700 text-[11px] font-extrabold px-2.5 py-0.5 rounded-md border border-indigo-200/80 uppercase">
                  {studentData?.brand || "Brand Student"}
                </span>
                {computedBalance === 0 && (
                  <span className="bg-emerald-50 text-emerald-700 text-[10px] font-extrabold px-2 py-0.5 rounded-md border border-emerald-200 uppercase">
                    Fully Paid
                  </span>
                )}
                {formData.hasEmi && (
                  <span className="bg-purple-50 text-purple-700 text-[10px] font-extrabold px-2 py-0.5 rounded-md border border-purple-200 uppercase">
                    {formData.numInstallments || emiPlanToRender.length || 1} EMI Plan Active
                  </span>
                )}
              </div>
              <div className="text-xs font-semibold text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => copyToClipboard(studentData?.admissionId, "Registration ID")}
                  className="bg-slate-100/80 hover:bg-slate-200/70 px-2.5 py-0.5 rounded-md border border-slate-200/80 text-slate-700 font-bold transition-colors flex items-center gap-1 cursor-pointer"
                  title="Click to copy Reg ID"
                >
                  <span className="text-slate-400">ID:</span>
                  <span>{studentData?.admissionId || "N/A"}</span>
                  <span className="text-[10px] text-indigo-600">📋</span>
                </button>

                <button
                  type="button"
                  onClick={() => copyToClipboard(studentData?.mobileNumber, "Mobile Number")}
                  className="bg-slate-100/80 hover:bg-slate-200/70 px-2.5 py-0.5 rounded-md border border-slate-200/80 text-slate-700 font-bold transition-colors flex items-center gap-1 cursor-pointer"
                  title="Click to copy Phone"
                >
                  <span className="text-slate-400">Mobile:</span>
                  <span>{studentData?.mobileNumber || "N/A"}</span>
                  <span className="text-[10px] text-indigo-600">📋</span>
                </button>

                <span className="bg-slate-100/80 px-2.5 py-0.5 rounded-md border border-slate-200/80 text-slate-700 font-bold">
                  <span className="text-slate-400">Course:</span> {studentData?.course || "N/A"}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions & Controls */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {studentData?.mobileNumber && (
              <>
                <a
                  href={`https://wa.me/91${cleanPhone(studentData.mobileNumber)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-9 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Send WhatsApp message"
                >
                  <span>💬 WhatsApp</span>
                </a>
                <a
                  href={`tel:${cleanPhone(studentData.mobileNumber)}`}
                  className="h-9 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Call Student"
                >
                  <span>📞 Call</span>
                </a>
              </>
            )}

            {canEdit && (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditMode(!isEditMode)}
                  className={`h-9 px-4 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-md ${
                    isEditMode
                      ? "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20"
                      : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20"
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                  </svg>
                  <span>{isEditMode ? "Exit Edit Mode" : "Edit 360"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDeleteStudent}
                  disabled={isDeleting}
                  className="h-9 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Delete Student Record"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-rose-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                  <span>{isDeleting ? "Deleting..." : "Delete Student"}</span>
                </button>
              </>
            )}

            <button
              onClick={onClose}
              className="h-9 w-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center font-bold text-xl cursor-pointer transition-all border border-slate-200/80"
              title="Close Pop-up"
            >
              ×
            </button>
          </div>
        </div>

        {/* Contract Fee Progress Meter */}
        <div className="w-full bg-slate-50/80 px-6 py-2.5 border-b border-slate-200/80 flex items-center justify-between gap-4 text-[11px] font-bold text-slate-600 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-500">Contract Recovery Progress:</span>
            <span className="text-emerald-700 font-extrabold">{feeProgress}% Completed</span>
            <span className="text-slate-400 font-semibold">(₹{totalCollected.toLocaleString("en-IN")} collected of ₹{(studentData?.finalFee || 0).toLocaleString("en-IN")})</span>
          </div>
          <div className="w-48 bg-slate-200 rounded-full h-2 overflow-hidden border border-slate-200 shrink-0">
            <div
              className="bg-indigo-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${feeProgress}%` }}
            ></div>
          </div>
        </div>

        {/* Quick KPI Summary Cards */}
        <div className="bg-[#f8faff] px-6 py-4 border-b border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs shrink-0">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Agreed Fee</span>
            <div className="text-base font-black text-emerald-600 mt-1">₹{(studentData?.finalFee || 0).toLocaleString("en-IN")}</div>
          </div>
          <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Collected</span>
            <div className="text-base font-black text-blue-600 mt-1 flex items-center justify-between">
              <span>₹{totalCollected.toLocaleString("en-IN")}</span>
              <span className="text-[10px] bg-blue-50 text-blue-700 font-extrabold px-1.5 py-0.5 rounded border border-blue-100">{feeProgress}%</span>
            </div>
          </div>
          <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Remaining Balance</span>
            <div className="text-base font-black text-rose-600 mt-1">₹{computedBalance.toLocaleString("en-IN")}</div>
          </div>
          <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Company Assigned</span>
            <div className="text-xs font-extrabold text-slate-800 mt-1 truncate">{studentData?.companyAssigned || "N/A"}</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200/80 bg-white px-6 shrink-0 overflow-x-auto gap-1">
          {[
            { id: "personal", label: "Personal & Contact 360" },
            { id: "academic", label: "Academic & Course 360" },
            { id: "financial", label: "Financial & EMI 360" },
            { id: "payments", label: `Payment History (${payments.length})` },
            { id: "tasks", label: `Tasks & Activities (${tasks.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-4 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? "border-indigo-600 text-indigo-600 bg-indigo-50/40 rounded-t-xl font-extrabold"
                  : "border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#f8faff]">
          {loading ? (
            <div className="py-24 text-center text-slate-400 font-bold text-xs flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <span>Loading Student 360 Profile...</span>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              
              {/* TAB 1: PERSONAL & CONTACT */}
              {activeTab === "personal" && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
                    <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-indigo-600"></span>
                      Personal Details
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="block text-slate-500 font-bold mb-1">Student Full Name *</label>
                        {isEditMode ? (
                          <input
                            type="text"
                            value={formData.fullName}
                            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 font-bold shadow-xs"
                          />
                        ) : (
                          <div className="p-3 bg-slate-50 rounded-xl font-bold text-slate-800 border border-slate-200/70">{studentData?.fullName || "-"}</div>
                        )}
                      </div>

                      <div>
                        <label className="block text-slate-500 font-bold mb-1">Mobile Number *</label>
                        {isEditMode ? (
                          <input
                            type="text"
                            value={formData.mobileNumber}
                            onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 font-bold shadow-xs"
                          />
                        ) : (
                          <div className="p-3 bg-slate-50 rounded-xl font-bold text-slate-800 border border-slate-200/70 flex items-center justify-between">
                            <span>{studentData?.mobileNumber || "-"}</span>
                            {studentData?.mobileNumber && (
                              <button
                                type="button"
                                onClick={() => copyToClipboard(studentData.mobileNumber, "Mobile Number")}
                                className="text-xs text-indigo-600 font-bold hover:underline"
                              >
                                Copy
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-slate-500 font-bold mb-1">Email Address</label>
                        {isEditMode ? (
                          <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 font-bold shadow-xs"
                          />
                        ) : (
                          <div className="p-3 bg-slate-50 rounded-xl font-bold text-slate-800 border border-slate-200/70 flex items-center justify-between">
                            <span>{studentData?.email || "-"}</span>
                            {studentData?.email && (
                              <button
                                type="button"
                                onClick={() => copyToClipboard(studentData.email, "Email")}
                                className="text-xs text-indigo-600 font-bold hover:underline"
                              >
                                Copy
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-slate-500 font-bold mb-1">Date of Birth</label>
                        {isEditMode ? (
                          <input
                            type="date"
                            value={formData.dob}
                            onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 font-bold shadow-xs"
                          />
                        ) : (
                          <div className="p-3 bg-slate-50 rounded-xl font-bold text-slate-800 border border-slate-200/70">{studentData?.dob || "-"}</div>
                        )}
                      </div>

                      <div>
                        <label className="block text-slate-500 font-bold mb-1">Gender</label>
                        {isEditMode ? (
                          <select
                            value={formData.gender}
                            onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 font-bold shadow-xs"
                          >
                            <option value="">Select Gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                          </select>
                        ) : (
                          <div className="p-3 bg-slate-50 rounded-xl font-bold text-slate-800 border border-slate-200/70">{studentData?.gender || "-"}</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
                    <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-blue-600"></span>
                      Parent & Guardian Contacts (Optional)
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="block text-slate-500 font-bold mb-1">Guardian 1 Name (Optional)</label>
                        {isEditMode ? (
                          <input
                            type="text"
                            value={formData.parentName}
                            onChange={(e) => setFormData({ ...formData, parentName: e.target.value, parentsFullName: e.target.value })}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 font-bold shadow-xs"
                          />
                        ) : (
                          <div className="p-3 bg-slate-50 rounded-xl font-bold text-slate-800 border border-slate-200/70">{studentData?.parentName || studentData?.parentsFullName || "-"}</div>
                        )}
                      </div>

                      <div>
                        <label className="block text-slate-500 font-bold mb-1">Guardian 1 Phone Number (Optional)</label>
                        {isEditMode ? (
                          <input
                            type="text"
                            value={formData.parentPhone}
                            onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value, parentsPhoneNumber: e.target.value })}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 font-bold shadow-xs"
                          />
                        ) : (
                          <div className="p-3 bg-slate-50 rounded-xl font-bold text-slate-800 border border-slate-200/70 flex items-center justify-between">
                            <span>{studentData?.parentPhone || studentData?.parentsPhoneNumber || "-"}</span>
                            {(studentData?.parentPhone || studentData?.parentsPhoneNumber) && (
                              <button
                                type="button"
                                onClick={() => copyToClipboard(studentData.parentPhone || studentData.parentsPhoneNumber, "Guardian 1 Phone")}
                                className="text-xs text-indigo-600 font-bold hover:underline"
                              >
                                Copy
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-slate-500 font-bold mb-1">Guardian 2 Name (Optional)</label>
                        {isEditMode ? (
                          <input
                            type="text"
                            value={formData.guardian2Name}
                            onChange={(e) => setFormData({ ...formData, guardian2Name: e.target.value })}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 font-bold shadow-xs"
                          />
                        ) : (
                          <div className="p-3 bg-slate-50 rounded-xl font-bold text-slate-800 border border-slate-200/70">{studentData?.guardian2Name || "-"}</div>
                        )}
                      </div>

                      <div>
                        <label className="block text-slate-500 font-bold mb-1">Guardian 2 Phone Number (Optional)</label>
                        {isEditMode ? (
                          <input
                            type="text"
                            value={formData.guardian2Phone}
                            onChange={(e) => setFormData({ ...formData, guardian2Phone: e.target.value })}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 font-bold shadow-xs"
                          />
                        ) : (
                          <div className="p-3 bg-slate-50 rounded-xl font-bold text-slate-800 border border-slate-200/70 flex items-center justify-between">
                            <span>{studentData?.guardian2Phone || "-"}</span>
                            {studentData?.guardian2Phone && (
                              <button
                                type="button"
                                onClick={() => copyToClipboard(studentData.guardian2Phone, "Guardian 2 Phone")}
                                className="text-xs text-indigo-600 font-bold hover:underline"
                              >
                                Copy
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
                    <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-purple-600"></span>
                      Residential Address
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                      <div className="sm:col-span-3">
                        <label className="block text-slate-500 font-bold mb-1">Street Address</label>
                        {isEditMode ? (
                          <input
                            type="text"
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 font-bold shadow-xs"
                          />
                        ) : (
                          <div className="p-3 bg-slate-50 rounded-xl font-bold text-slate-800 border border-slate-200/70">{studentData?.address || "-"}</div>
                        )}
                      </div>
                      <div>
                        <label className="block text-slate-500 font-bold mb-1">City</label>
                        {isEditMode ? (
                          <input
                            type="text"
                            value={formData.city}
                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 font-bold shadow-xs"
                          />
                        ) : (
                          <div className="p-3 bg-slate-50 rounded-xl font-bold text-slate-800 border border-slate-200/70">{studentData?.city || "-"}</div>
                        )}
                      </div>
                      <div>
                        <label className="block text-slate-500 font-bold mb-1">State</label>
                        {isEditMode ? (
                          <input
                            type="text"
                            value={formData.state}
                            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 font-bold shadow-xs"
                          />
                        ) : (
                          <div className="p-3 bg-slate-50 rounded-xl font-bold text-slate-800 border border-slate-200/70">{studentData?.state || "-"}</div>
                        )}
                      </div>
                      <div>
                        <label className="block text-slate-500 font-bold mb-1">Pincode</label>
                        {isEditMode ? (
                          <input
                            type="text"
                            value={formData.pincode}
                            onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 font-bold shadow-xs"
                          />
                        ) : (
                          <div className="p-3 bg-slate-50 rounded-xl font-bold text-slate-800 border border-slate-200/70">{studentData?.pincode || "-"}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ACADEMIC & COURSE */}
              {activeTab === "academic" && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 text-xs">
                  <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-600"></span>
                    Academic & Enrollment Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-500 font-bold mb-1">Enrolled Course</label>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={formData.course}
                          onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 font-bold shadow-xs"
                        />
                      ) : (
                        <div className="p-3 bg-slate-50 rounded-xl font-bold text-slate-800 border border-slate-200/70">{studentData?.course || "-"}</div>
                      )}
                    </div>

                    <div>
                      <label className="block text-slate-500 font-bold mb-1">Assigned Batch</label>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={formData.batch}
                          onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 font-bold shadow-xs"
                        />
                      ) : (
                        <div className="p-3 bg-slate-50 rounded-xl font-bold text-slate-800 border border-slate-200/70">{studentData?.batch || "-"}</div>
                      )}
                    </div>

                    <div>
                      <label className="block text-slate-500 font-bold mb-1">Course Duration</label>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={formData.duration}
                          onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 font-bold shadow-xs"
                        />
                      ) : (
                        <div className="p-3 bg-slate-50 rounded-xl font-bold text-slate-800 border border-slate-200/70">{studentData?.duration || "-"}</div>
                      )}
                    </div>

                    <div>
                      <label className="block text-slate-500 font-bold mb-1">Academic Year</label>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={formData.academicYear}
                          onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 font-bold shadow-xs"
                        />
                      ) : (
                        <div className="p-3 bg-slate-50 rounded-xl font-bold text-slate-800 border border-slate-200/70">{studentData?.academicYear || "-"}</div>
                      )}
                    </div>

                    <div>
                      <label className="block text-slate-500 font-bold mb-1">Admission Date</label>
                      {isEditMode ? (
                        <input
                          type="date"
                          value={formData.admissionDate}
                          onChange={(e) => setFormData({ ...formData, admissionDate: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 font-bold shadow-xs"
                        />
                      ) : (
                        <div className="p-3 bg-slate-50 rounded-xl font-bold text-slate-800 border border-slate-200/70">
                          {studentData?.admissionDate ? new Date(studentData.admissionDate).toLocaleDateString("en-IN") : "-"}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-slate-500 font-bold mb-1">Batch Start Date</label>
                      {isEditMode ? (
                        <input
                          type="date"
                          value={formData.startDate}
                          onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 font-bold shadow-xs"
                        />
                      ) : (
                        <div className="p-3 bg-slate-50 rounded-xl font-bold text-slate-800 border border-slate-200/70">
                          {studentData?.startDate ? new Date(studentData.startDate).toLocaleDateString("en-IN") : "-"}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-slate-500 font-bold mb-1">Assigned Counsellor</label>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={formData.counsellor}
                          onChange={(e) => setFormData({ ...formData, counsellor: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 font-bold shadow-xs"
                        />
                      ) : (
                        <div className="p-3 bg-slate-50 rounded-xl font-bold text-slate-800 border border-slate-200/70">{studentData?.counsellor || "-"}</div>
                      )}
                    </div>

                    <div>
                      <label className="block text-slate-500 font-bold mb-1">Brand Tag</label>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={formData.brand}
                          onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 font-bold shadow-xs"
                        />
                      ) : (
                        <div className="p-3 bg-slate-50 rounded-xl font-bold text-slate-800 border border-slate-200/70">{studentData?.brand || "-"}</div>
                      )}
                    </div>

                    <div>
                      <label className="block text-slate-500 font-bold mb-1">Legal Entity / Company Assigned</label>
                      {isEditMode ? (
                        <input
                          type="text"
                          value={formData.companyAssigned}
                          onChange={(e) => setFormData({ ...formData, companyAssigned: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 font-bold shadow-xs"
                        />
                      ) : (
                        <div className="p-3 bg-slate-50 rounded-xl font-bold text-slate-800 border border-slate-200/70">{studentData?.companyAssigned || "-"}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: FINANCIAL & EMI 360 */}
              {activeTab === "financial" && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 text-xs">
                    <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-600"></span>
                      Financial & Fee Agreement Details
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-500 font-bold mb-1">Standard Course Fee (₹)</label>
                        {isEditMode ? (
                          <input
                            type="number"
                            value={formData.courseFee}
                            onChange={(e) => setFormData({ ...formData, courseFee: Number(e.target.value) })}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 font-bold shadow-xs"
                          />
                        ) : (
                          <div className="p-3 bg-slate-50 rounded-xl font-bold text-slate-800 border border-slate-200/70">₹{(studentData?.courseFee || 0).toLocaleString("en-IN")}</div>
                        )}
                      </div>

                      <div>
                        <label className="block text-slate-500 font-bold mb-1">Final Agreed Fee (₹) *</label>
                        {isEditMode ? (
                          <input
                            type="number"
                            value={formData.finalFee}
                            onChange={(e) => setFormData({ ...formData, finalFee: Number(e.target.value) })}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 font-bold shadow-xs"
                          />
                        ) : (
                          <div className="p-3 bg-emerald-50/60 rounded-xl font-black text-emerald-700 text-sm border border-emerald-200/60">₹{(studentData?.finalFee || 0).toLocaleString("en-IN")}</div>
                        )}
                      </div>

                      <div>
                        <label className="block text-slate-500 font-bold mb-1">Registration Amount (Collected at Admission) (₹) *</label>
                        {isEditMode ? (
                          <input
                            type="number"
                            value={formData.registrationAmount}
                            onChange={(e) => setFormData({ ...formData, registrationAmount: Number(e.target.value), amountReceivedToday: Number(e.target.value) })}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 font-bold shadow-xs"
                          />
                        ) : (
                          <div className="p-3 bg-slate-50 rounded-xl font-bold text-slate-800 border border-slate-200/70">₹{(studentData?.registrationAmount ?? studentData?.amountReceivedToday ?? 0).toLocaleString("en-IN")}</div>
                        )}
                      </div>

                      <div>
                        <label className="block text-slate-500 font-bold mb-1">Downpayment Amount (₹)</label>
                        {isEditMode ? (
                          <input
                            type="number"
                            value={formData.downpaymentAmount}
                            onChange={(e) => setFormData({ ...formData, downpaymentAmount: Number(e.target.value) })}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 font-bold shadow-xs"
                          />
                        ) : (
                          <div className="p-3 bg-slate-50 rounded-xl font-bold text-slate-800 border border-slate-200/70">₹{(studentData?.downpaymentAmount || 0).toLocaleString("en-IN")}</div>
                        )}
                      </div>

                      <div>
                        <label className="block text-slate-500 font-bold mb-1">Downpayment Due Date</label>
                        {isEditMode ? (
                          <input
                            type="date"
                            value={formData.downpaymentDueDate}
                            onChange={(e) => setFormData({ ...formData, downpaymentDueDate: e.target.value })}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 font-bold shadow-xs"
                          />
                        ) : (
                          <div className="p-3 bg-slate-50 rounded-xl font-bold text-slate-800 border border-slate-200/70">
                            {studentData?.downpaymentDueDate ? new Date(studentData.downpaymentDueDate).toLocaleDateString("en-IN") : "-"}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-slate-500 font-bold mb-1">Current Remaining Balance (₹)</label>
                        {isEditMode ? (
                          <input
                            type="number"
                            value={formData.remainingBalance}
                            onChange={(e) => setFormData({ ...formData, remainingBalance: Number(e.target.value) })}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 font-bold shadow-xs"
                          />
                        ) : (
                          <div className="p-3 bg-rose-50/60 rounded-xl font-black text-rose-600 text-sm border border-rose-200/60">₹{computedBalance.toLocaleString("en-IN")}</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* CUSTOM EMI PLAN & SCHEDULE EDITOR */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 text-xs">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-purple-600"></span>
                          Custom EMI Plan & Installment Schedule ({emiPlanToRender.length})
                        </h3>
                        <p className="text-[11px] font-medium text-slate-400 mt-0.5">Configure custom EMI dates, installment amounts, and payment statuses.</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleAutoGenerateEmi}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-extrabold text-[11px] rounded-xl border border-indigo-200/80 transition-all cursor-pointer shadow-xs"
                        >
                          ⚡ Auto-Generate Monthly EMIs
                        </button>
                        <button
                          type="button"
                          onClick={handleAddEmiRow}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-[11px] rounded-xl transition-all cursor-pointer shadow-xs"
                        >
                          + Add Row
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-2">
                      <div>
                        <label className="block text-slate-500 font-bold mb-1">Enable EMI Plan</label>
                        <select
                          value={formData.hasEmi ? "true" : "false"}
                          onChange={(e) => setFormData({ ...formData, hasEmi: e.target.value === "true" })}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                        >
                          <option value="true">Yes (EMI Enabled)</option>
                          <option value="false">No (Full Payment)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-500 font-bold mb-1">Number of Installments</label>
                        <input
                          type="number"
                          value={formData.numInstallments}
                          onChange={(e) => setFormData({ ...formData, numInstallments: Number(e.target.value) })}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-500 font-bold mb-1">Default Amount / Installment (₹)</label>
                        <input
                          type="number"
                          value={formData.installmentAmount}
                          onChange={(e) => setFormData({ ...formData, installmentAmount: Number(e.target.value) })}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                        />
                      </div>
                    </div>

                    {/* Installments Table */}
                    {emiPlanToRender.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 font-bold text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        No custom EMI installments configured yet. Click &quot;Auto-Generate Monthly EMIs&quot; or &quot;+ Add Row&quot; above to set up schedule.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-100 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                              <th className="pb-2 pr-3 min-w-[50px]">#</th>
                              <th className="pb-2 pr-3 min-w-[140px]">Due Date</th>
                              <th className="pb-2 pr-3 min-w-[130px]">Amount (₹)</th>
                              <th className="pb-2 pr-3 min-w-[120px]">Payment Status</th>
                              <th className="pb-2 text-right min-w-[60px]">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                            {emiPlanToRender.map((emi: any, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="py-2.5 pr-3 font-bold text-slate-500">
                                  Inst. #{idx + 1}
                                </td>
                                <td className="pr-3">
                                  <input
                                    type="date"
                                    value={emi.dueDate}
                                    onChange={(e) => handleEmiFieldChange(idx, "dueDate", e.target.value)}
                                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 text-xs"
                                  />
                                </td>
                                <td className="pr-3">
                                  <input
                                    type="number"
                                    value={emi.amount}
                                    onChange={(e) => handleEmiFieldChange(idx, "amount", Number(e.target.value))}
                                    className="w-28 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 text-xs"
                                  />
                                </td>
                                <td className="pr-3">
                                  <select
                                    value={emi.isPaid ? "true" : "false"}
                                    onChange={(e) => handleEmiStatusChange(idx, e.target.value === "true")}
                                    className={`px-2.5 py-1.5 rounded-lg font-extrabold text-[11px] border cursor-pointer ${
                                      emi.isPaid
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : "bg-amber-50 text-amber-700 border-amber-200"
                                    }`}
                                  >
                                    <option value="false">Pending (Unpaid)</option>
                                    <option value="true">Paid</option>
                                  </select>
                                </td>
                                <td className="text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveEmiRow(idx)}
                                    className="text-xs text-rose-500 hover:text-rose-700 font-bold cursor-pointer"
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: PAYMENT LEDGER */}
              {activeTab === "payments" && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                      <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-blue-600"></span>
                        Payment Transaction Ledger ({payments.length})
                      </h3>
                    </div>

                    {payments.length === 0 ? (
                      <p className="text-center py-10 text-slate-400 font-bold text-xs">No payment transactions recorded yet for this student.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-100 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                              <th className="pb-2.5 pr-3">Receipt No</th>
                              <th className="pb-2.5 pr-3">Payment Date</th>
                              <th className="pb-2.5 pr-3">Payment Mode</th>
                              <th className="pb-2.5 pr-3 text-right">Amount Received</th>
                              <th className="pb-2.5 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                            {payments.map((p: any) => (
                              <tr key={p._id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-3 pr-3 font-extrabold text-slate-900">{p.receiptNo || "REC-N/A"}</td>
                                <td className="pr-3 text-slate-500 text-[11px]">
                                  {new Date(p.paymentDate || p.createdAt).toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric"
                                  })}
                                </td>
                                <td className="pr-3">
                                  <span className="bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase border border-indigo-100">
                                    {p.paymentMode}
                                  </span>
                                </td>
                                <td className="pr-3 text-right font-black text-emerald-600 text-sm">
                                  ₹{(p.amountReceived || 0).toLocaleString("en-IN")}
                                </td>
                                <td className="text-right">
                                  <button
                                    type="button"
                                    onClick={() => openReceiptModal(p)}
                                    className="px-3 py-1 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-extrabold text-[11px] rounded-lg border border-indigo-200/80 transition-all cursor-pointer shadow-xs"
                                  >
                                    View / Print Slip
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: TASKS & ACTIVITIES */}
              {activeTab === "tasks" && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-purple-600"></span>
                      Student SOP Tasks & Follow-ups ({filteredTasks.length})
                    </h3>

                    {/* Filter Pills for Tasks */}
                    <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-[11px] font-bold">
                      {[
                        { id: "all", label: "All Tasks" },
                        { id: "pending", label: "Pending" },
                        { id: "completed", label: "Completed" },
                        { id: "emi", label: "EMI Recovery" },
                      ].map((tf) => (
                        <button
                          key={tf.id}
                          type="button"
                          onClick={() => setTaskFilter(tf.id as any)}
                          className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                            taskFilter === tf.id
                              ? "bg-white text-indigo-700 shadow-xs font-extrabold"
                              : "text-slate-500 hover:text-slate-900"
                          }`}
                        >
                          {tf.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {filteredTasks.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 font-bold text-xs bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                      No matching tasks found under this filter.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredTasks.map((t: any) => {
                        const isCompleted = t.status === "Completed";
                        const isEmiTask = (t.taskType || "").toLowerCase().includes("emi") || (t.title || "").toLowerCase().includes("emi");
                        const isDocTask = (t.taskType || "").toLowerCase().includes("document");

                        return (
                          <div
                            key={t._id}
                            className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                              isCompleted
                                ? "bg-emerald-50/30 border-emerald-200/60 hover:border-emerald-300"
                                : isEmiTask
                                ? "bg-amber-50/20 border-amber-200/80 hover:border-amber-300 shadow-xs"
                                : "bg-slate-50/80 border-slate-200/80 hover:border-indigo-300 hover:bg-white shadow-xs"
                            }`}
                          >
                            <div className="flex items-start gap-3.5">
                              <div
                                className={`h-10 w-10 rounded-xl font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-xs text-base ${
                                  isCompleted
                                    ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                    : isEmiTask
                                    ? "bg-amber-100 text-amber-700 border border-amber-200"
                                    : isDocTask
                                    ? "bg-purple-100 text-purple-700 border border-purple-200"
                                    : "bg-indigo-100 text-indigo-700 border border-indigo-200"
                                }`}
                              >
                                {isCompleted ? "✓" : isEmiTask ? "💬" : isDocTask ? "📄" : "📌"}
                              </div>
                              <div>
                                <div className="font-extrabold text-slate-900 text-xs flex items-center gap-2 flex-wrap">
                                  <span>{t.title}</span>
                                  {t.priority === "High" && (
                                    <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">
                                      High Priority
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] font-semibold text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                                  <span className="bg-slate-200/60 text-slate-700 px-2 py-0.5 rounded-md font-bold text-[10px]">
                                    Type: {t.taskType || "SOP Task"}
                                  </span>
                                  <span>•</span>
                                  <span>Assigned to: <strong className="text-slate-800">{t.assignedTo || "Counsellor"}</strong></span>
                                  {t.dueDate && (
                                    <>
                                      <span>•</span>
                                      <span>Due: <strong className="text-slate-700">{new Date(t.dueDate).toLocaleDateString("en-IN")}</strong></span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <span
                              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider shrink-0 shadow-xs border ${
                                isCompleted
                                  ? "bg-emerald-500 text-white border-emerald-600 shadow-emerald-500/20"
                                  : "bg-amber-100 text-amber-800 border-amber-300"
                              }`}
                            >
                              {t.status}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Save Footer Bar (When Edit Mode is Active) */}
              {isEditMode && (
                <div className="sticky bottom-0 bg-white p-4 rounded-2xl border-2 border-amber-400 shadow-2xl flex items-center justify-between shrink-0 animate-in slide-in-from-bottom-3 duration-200">
                  <span className="text-xs font-black text-amber-800 flex items-center gap-2">
                    <span className="animate-ping h-2.5 w-2.5 rounded-full bg-amber-500"></span>
                    Edit Mode Active — Any changes made above will update MongoDB in real-time
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsEditMode(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-600/30 disabled:opacity-50 cursor-pointer transition-all"
                    >
                      {isSaving ? "Saving 360 Changes..." : "Save All Changes"}
                    </button>
                  </div>
                </div>
              )}

            </form>
          )}
        </div>
      </div>

      {/* Payment Receipt Modal Trigger */}
      {isReceiptOpen && selectedReceiptPayment && (
        <PaymentReceiptModal
          isOpen={isReceiptOpen}
          onClose={() => setIsReceiptOpen(false)}
          receipt={selectedReceiptPayment}
          student={studentData}
          paymentsHistory={payments}
        />
      )}
    </div>
  );
}
