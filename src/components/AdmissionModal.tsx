"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PaymentReceiptModal from "./PaymentReceiptModal";
import CourseMultiSelect from "./CourseMultiSelect";
import { useUser } from "@/app/component/context/user-context";

interface AdmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead?: any;
  onSuccess?: () => void;
  defaultBrand?: string;
}

export default function AdmissionModal({ isOpen, onClose, lead, onSuccess, defaultBrand }: AdmissionModalProps) {
  const { user } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [batchesList, setBatchesList] = useState<any[]>([]);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [admissionData, setAdmissionData] = useState<any>(null);
  
  // 1. Student Information
  const [fullName, setFullName] = useState(lead?.studentFullName || "");
  const [mobileNumber, setMobileNumber] = useState(lead?.primaryPhoneMobile || "");
  const [email, setEmail] = useState(lead?.emailAddress || "");
  const [parentName, setParentName] = useState(lead?.parentsFullName || lead?.parentName || "");
  const [parentPhone, setParentPhone] = useState(lead?.parentsPhoneNumber || lead?.parentPhone || "");
  const [guardian2Name, setGuardian2Name] = useState(lead?.guardian2Name || "");
  const [guardian2Phone, setGuardian2Phone] = useState(lead?.guardian2Phone || "");
  const [guardian2Relation, setGuardian2Relation] = useState(lead?.guardian2Relation || "Mother / Secondary Guardian");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState(lead?.currentCity || "");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [counsellor, setCounsellor] = useState(lead?.assignedCrmAdvisor || lead?.counsellor || user?.name || "");
  // Auto-select brand: use lead brand first, then defaultBrand prop, then empty
  const resolvedDefaultBrand = lead?.targetBrand || (defaultBrand && defaultBrand !== "All Brands" && defaultBrand !== "All" ? defaultBrand : "");
  const [brand, setBrand] = useState(resolvedDefaultBrand);

  // 2. Course Details
  const [course, setCourse] = useState(lead?.targetCourse || "");
  const [batch, setBatch] = useState("");
  const [isCustomBatch, setIsCustomBatch] = useState(false);
  const [duration, setDuration] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear() + " - " + (new Date().getFullYear() + 1).toString().slice(2));
  const [courseFee, setCourseFee] = useState(Math.floor(Number(lead?.expectedCourseFee?.replace(/[^0-9.]/g, ''))) || 0);
  const [admissionDate, setAdmissionDate] = useState(new Date().toISOString().split("T")[0]);
  const [companyAssigned, setCompanyAssigned] = useState("");

  // 3. Discount & Scholarship
  const [scholarshipType, setScholarshipType] = useState("None");
  const [scholarshipAmount, setScholarshipAmount] = useState(0);
  const [discountType, setDiscountType] = useState("None");
  const [discountUnitMode, setDiscountUnitMode] = useState<"INR" | "PERCENT">("INR");
  const [discountInputValue, setDiscountInputValue] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [additionalDiscount, setAdditionalDiscount] = useState(0);
  const [discountReason, setDiscountReason] = useState("");

  const handleSwitchDiscountMode = (newMode: "INR" | "PERCENT") => {
    if (newMode === discountUnitMode) return;
    if (newMode === "PERCENT") {
      if (courseFee > 0 && discountInputValue > 0) {
        const pct = parseFloat(((discountInputValue / courseFee) * 100).toFixed(2));
        setDiscountInputValue(pct);
      }
    } else {
      if (courseFee > 0 && discountInputValue > 0) {
        const inr = Math.round((courseFee * discountInputValue) / 100);
        setDiscountInputValue(inr);
      }
    }
    setDiscountUnitMode(newMode);
  };

  // Auto recalculate discountAmount when percentage, mode, or courseFee changes
  useEffect(() => {
    if (discountUnitMode === "PERCENT") {
      const computedInr = Math.round((courseFee * discountInputValue) / 100);
      setDiscountAmount(computedInr);
    } else {
      setDiscountAmount(discountInputValue);
    }
  }, [discountUnitMode, discountInputValue, courseFee]);

  // Calculated Fees
  const totalDiscount = scholarshipAmount + discountAmount + additionalDiscount;
  const finalFee = courseFee - totalDiscount;

  // 4. Payment & EMI
  const [paymentMode, setPaymentMode] = useState("UPI");
  const [transactionNo, setTransactionNo] = useState("");
  const [registrationAmount, setRegistrationAmount] = useState(0);
  const [downpaymentAmount, setDownpaymentAmount] = useState(0);
  const [downpaymentDueDate, setDownpaymentDueDate] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  
  const amountReceivedToday = registrationAmount;
  const remainingBalance = Math.max(0, finalFee - registrationAmount - downpaymentAmount);

  const [hasEmi, setHasEmi] = useState(false);
  const [numInstallments, setNumInstallments] = useState(1);
  const [installmentAmount, setInstallmentAmount] = useState(0);
  const [firstDueDate, setFirstDueDate] = useState("");
  const [autoAllocatedCompany, setAutoAllocatedCompany] = useState("");
  const [availableCompaniesList, setAvailableCompaniesList] = useState<string[]>([]);

  interface CustomEmiItem {
    installmentName: string;
    dueDate: string;
    amount: number;
  }

  const [customEmiItems, setCustomEmiItems] = useState<CustomEmiItem[]>([]);
  const [selectedMonthlyDueDay, setSelectedMonthlyDueDay] = useState<number>(0);

  const applyMonthlyDueDay = (targetDay: number) => {
    setCustomEmiItems((prev) => {
      if (!prev || prev.length === 0) return prev;

      let baseDate = new Date();
      if (prev[0]?.dueDate) {
        const parsed = new Date(prev[0].dueDate);
        if (!isNaN(parsed.getTime())) baseDate = parsed;
      }

      return prev.map((item, idx) => {
        const nextMonthDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + idx, 1);
        const maxDaysInMonth = new Date(nextMonthDate.getFullYear(), nextMonthDate.getMonth() + 1, 0).getDate();
        const actualDay = Math.min(targetDay, maxDaysInMonth);
        nextMonthDate.setDate(actualDay);

        const year = nextMonthDate.getFullYear();
        const month = String(nextMonthDate.getMonth() + 1).padStart(2, "0");
        const day = String(nextMonthDate.getDate()).padStart(2, "0");

        return {
          ...item,
          dueDate: `${year}-${month}-${day}`,
        };
      });
    });
  };

  const addMonthsToDate = (date: Date, months: number) => {
    const d = new Date(date);
    const day = d.getDate();
    d.setMonth(d.getMonth() + months);
    if (d.getDate() !== day) {
      d.setDate(0);
    }
    return d;
  };

  const generateDefaultEmiItems = (count: number, balance: number) => {
    const cnt = count > 0 ? count : 1;
    const bal = Math.max(balance || 0, 0);
    const baseAmt = Math.floor(bal / cnt);
    const remainder = bal - baseAmt * cnt;

    const items: CustomEmiItem[] = [];
    const today = new Date();

    for (let i = 0; i < cnt; i++) {
      const d = addMonthsToDate(today, i + 1);
      const dateStr = d.toISOString().split("T")[0];
      const itemAmount = i === cnt - 1 ? baseAmt + remainder : baseAmt;

      items.push({
        installmentName: `Installment ${i + 1}`,
        dueDate: dateStr,
        amount: itemAmount,
      });
    }
    return items;
  };

  useEffect(() => {
    if (hasEmi) {
      if (customEmiItems.length !== numInstallments || customEmiItems.length === 0) {
        setCustomEmiItems(generateDefaultEmiItems(numInstallments, remainingBalance));
      }
    } else {
      setCustomEmiItems([]);
    }
  }, [hasEmi, numInstallments, remainingBalance]);

  const handleEmiDateChange = (index: number, dateVal: string) => {
    setCustomEmiItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], dueDate: dateVal };
      return copy;
    });
  };

  const handleEmiAmountChange = (index: number, amtVal: number) => {
    setCustomEmiItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], amount: Math.max(amtVal || 0, 0) };
      return copy;
    });
  };

  const addEmiRow = () => {
    setCustomEmiItems((prev) => {
      const lastDateStr = prev.length > 0 ? prev[prev.length - 1].dueDate : new Date().toISOString().split("T")[0];
      const lastDate = new Date(lastDateStr);
      if (isNaN(lastDate.getTime())) lastDate.setTime(Date.now());
      const nextDate = addMonthsToDate(lastDate, 1);

      const nextIndex = prev.length + 1;
      const newItem: CustomEmiItem = {
        installmentName: `Installment ${nextIndex}`,
        dueDate: nextDate.toISOString().split("T")[0],
        amount: 0,
      };
      const updated = [...prev, newItem];
      setNumInstallments(updated.length);
      return updated;
    });
  };

  const removeEmiRow = (index: number) => {
    setCustomEmiItems((prev) => {
      if (prev.length <= 1) return prev;
      const updated = prev.filter((_, i) => i !== index).map((item, idx) => ({
        ...item,
        installmentName: `Installment ${idx + 1}`,
      }));
      setNumInstallments(updated.length);
      return updated;
    });
  };

  const distributeEvenly = () => {
    setCustomEmiItems(generateDefaultEmiItems(customEmiItems.length || numInstallments, remainingBalance));
  };

  const scheduledEmiSum = customEmiItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const emiDifference = remainingBalance - scheduledEmiSum;

  useEffect(() => {
    if (isOpen) {
      if (paymentMode === "Cash") {
        setAutoAllocatedCompany("Cash (Unallocated)");
        setCompanyAssigned("Unallocated");
      } else {
        fetch(`/api/engine/allocate?brand=${encodeURIComponent(brand || "")}`)
          .then(res => res.json())
          .then(data => {
            if (data.success && data.company) {
              setAutoAllocatedCompany(data.company);
              setCompanyAssigned(data.company);
            }
          })
          .catch(err => console.error("Failed to fetch allocated company", err));
      }
    }
  }, [isOpen, paymentMode, brand]);

  useEffect(() => {
    if (!hasEmi && finalFee >= 0) {
      setRegistrationAmount(finalFee);
    }
  }, [hasEmi, finalFee]);

  useEffect(() => {
    if (hasEmi && numInstallments > 0) {
      setInstallmentAmount(Math.round(remainingBalance / numInstallments));
    }
  }, [remainingBalance, numInstallments, hasEmi]);

  useEffect(() => {
    if (isOpen) {
      fetch("/api/courses")
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setCourses(data.data);
          }
        })
        .catch((err) => console.error("Failed to fetch courses:", err));

      fetch("/api/batches")
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data) {
            setBatchesList(data.data);
          }
        })
        .catch((err) => console.error("Failed to fetch batches:", err));
    }
  }, [isOpen]);

  // Auto-sync Brand from selected Course
  useEffect(() => {
    if (course && courses.length > 0) {
      const selectedCourseObj = courses.find(
        (c: any) => (c.name || "").toUpperCase().trim() === course.toUpperCase().trim()
      );
      if (selectedCourseObj && selectedCourseObj.brand) {
        setBrand(selectedCourseObj.brand.toUpperCase().trim());
      }
    }
  }, [course, courses]);

  // Fetch Companies dynamically mapped to the active Brand
  useEffect(() => {
    if (isOpen) {
      const activeBrand = brand || (user?.brandScope !== "All Brands" && user?.brandScope !== "ALL BRANDS" ? user?.brandScope : "");
      fetch(`/api/companies${activeBrand ? `?brand=${encodeURIComponent(activeBrand)}` : ""}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.companies && Array.isArray(data.companies)) {
            const names = data.companies.map((c: any) => (c.name || c.legalName || "").toUpperCase().trim()).filter(Boolean);
            setAvailableCompaniesList(Array.from(new Set(names)));
          }
        })
        .catch((err) => console.error("Failed to fetch available companies:", err));
    }
  }, [isOpen, brand, user]);

  useEffect(() => {
    if (isOpen) {
      if (lead) {
        setFullName(lead.studentFullName || lead.fullName || "");
        setMobileNumber(lead.primaryPhoneMobile || lead.mobileNumber || "");
        setEmail(lead.emailAddress || lead.email || "");
        setCounsellor(lead.assignedCrmAdvisor || lead.counsellor || user?.name || "");
        setBrand(lead.targetBrand || lead.brand || "");
        
        // Multi-course array initialization
        const rawCourses = lead.courses || lead.targetCourses;
        let initialCourses: string[] = [];
        if (Array.isArray(rawCourses) && rawCourses.length > 0) {
          initialCourses = rawCourses.map((c: any) => String(c).trim()).filter(Boolean);
        } else {
          const targetCourseName = lead.targetCourse || lead.course || "";
          if (targetCourseName) {
            initialCourses = targetCourseName.split(",").map((c: string) => c.trim()).filter(Boolean);
          }
        }
        setSelectedCourses(initialCourses);
        setCourse(initialCourses.join(", "));
        
        const feeVal = lead.expectedCourseFee || lead.courseFee || "0";
        setCourseFee(
          typeof feeVal === "number"
            ? feeVal
            : Math.floor(Number(String(feeVal).replace(/[^0-9.]/g, ""))) || 0
        );

        setParentName(lead.parentName || "");
        setAddress(lead.address || "");
        setCity(lead.currentCity || lead.city || "");
        setState(lead.state || "");
        setPincode(lead.pincode || "");
        setDob(lead.dob || "");
        setGender(lead.gender || "");
        setBatch("");

        const targetCourseName = lead.targetCourse || lead.course || "";
        const foundCourseObj = courses.find(
          (c) => c.name?.trim().toLowerCase() === targetCourseName.trim().toLowerCase()
        );
        if (foundCourseObj && foundCourseObj.duration) {
          setDuration(foundCourseObj.duration);
          if (foundCourseObj.fee) {
            const numFee = Math.floor(Number(String(foundCourseObj.fee).replace(/[^0-9.]/g, ""))) || 0;
            if (numFee > 0) setCourseFee(numFee);
          }
        } else if (targetCourseName) {
          const nameUpper = targetCourseName.toUpperCase();
          if (
            nameUpper.includes("BVOC") ||
            nameUpper.includes("DEGREE") ||
            nameUpper.includes("BSC") ||
            nameUpper.includes("BACHELOR")
          ) {
            setDuration("36 Months");
          } else if (nameUpper.includes("ADVANCE") || nameUpper.includes("DIPLOMA")) {
            setDuration("12 Months");
          } else {
            setDuration("6 Months");
          }
        }

        setStartDate(new Date().toISOString().split("T")[0]);
        setCompanyAssigned("");
        setScholarshipType("None");
        setScholarshipAmount(0);
        setDiscountType("None");
        setDiscountAmount(0);
        setAdditionalDiscount(0);
        setDiscountReason("");
        setPaymentMode("UPI");
        setTransactionNo("");
        setRegistrationAmount(0);
        setDownpaymentAmount(0);
        setDownpaymentDueDate("");
        setHasEmi(false);
        setNumInstallments(1);
        setInstallmentAmount(0);
        setFirstDueDate("");
      } else {
        if (!counsellor && user?.name) {
          setCounsellor(user.name);
        }
      }
    }
  }, [lead, isOpen, user]);

  // Auto-sync course fee & duration whenever course or fetched courses list updates
  useEffect(() => {
    if (isOpen && course && courses.length > 0) {
      const foundCourseObj = courses.find(
        (c) => c.name?.trim().toLowerCase() === course.trim().toLowerCase()
      );
      if (foundCourseObj) {
        if (foundCourseObj.fee) {
          const numFee = Math.floor(Number(String(foundCourseObj.fee).replace(/[^0-9.]/g, ""))) || 0;
          if (numFee > 0) {
            setCourseFee(numFee);
          }
        }
        if (foundCourseObj.duration) {
          setDuration(foundCourseObj.duration);
        }
      }
    }
  }, [isOpen, course, courses]);

  const handleCourseSelectionChange = (newSelected: string[]) => {
    setSelectedCourses(newSelected);
    const combinedNames = newSelected.join(", ");
    setCourse(combinedNames);
    setBatch("");
    setIsCustomBatch(false);

    let totalFee = 0;
    let maxDurationMonths = 0;

    newSelected.forEach((cName) => {
      const found = courses.find((c) => c.name?.trim().toLowerCase() === cName.trim().toLowerCase());
      if (found) {
        if (found.fee) {
          const numFee = Math.floor(Number(String(found.fee).replace(/[^0-9.]/g, ""))) || 0;
          totalFee += numFee;
        }
        if (found.duration) {
          const dNum = parseInt(found.duration.replace(/\D/g, ""), 10) || 6;
          if (dNum > maxDurationMonths) maxDurationMonths = dNum;
        }
      }
    });

    if (totalFee > 0) {
      setCourseFee(totalFee);
    }
    if (maxDurationMonths > 0) {
      setDuration(`${maxDurationMonths} Months`);
    } else if (newSelected.length > 0) {
      setDuration("6 Months");
    }
  };

  const handleGenerateAdmission = async (generateReceipt = false) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const defaultPlan = generateDefaultEmiItems(numInstallments > 0 ? numInstallments : 1, remainingBalance).map((item, idx) => ({
        installmentName: item.installmentName || `Installment ${idx + 1}`,
        dueDate: item.dueDate ? new Date(item.dueDate) : new Date(Date.now() + (idx + 1) * 30 * 24 * 60 * 60 * 1000),
        amount: Number(item.amount) || 0,
        isPaid: false,
      }));

      const customEmiPlan = hasEmi
        ? (customEmiItems.length > 0
            ? customEmiItems.map((item, idx) => ({
                installmentName: item.installmentName || `Installment ${idx + 1}`,
                dueDate: item.dueDate ? new Date(item.dueDate) : new Date(Date.now() + (idx + 1) * 30 * 24 * 60 * 60 * 1000),
                amount: Number(item.amount) || 0,
                isPaid: false,
              }))
            : defaultPlan)
        : [];

      const payload = {
        enquiryId: lead?._id,
        fullName, mobileNumber, email, parentName, parentPhone, parentsFullName: parentName, parentsPhoneNumber: parentPhone,
        guardian2Name, guardian2Phone, guardian2Relation, address, city, state, pincode, dob, gender, counsellor, brand,
        course: selectedCourses.join(", "),
        courses: selectedCourses,
        targetCourses: selectedCourses,
        batch, duration, startDate, academicYear, admissionDate, companyAssigned,
        courseFee, scholarshipType, scholarshipAmount, discountType, discountAmount, additionalDiscount, totalDiscount, finalFee,
        paymentMode, transactionNo, amountReceivedToday: (Number(registrationAmount) || 0) + (Number(downpaymentAmount) || 0), registrationAmount: Number(registrationAmount), downpaymentAmount: Number(downpaymentAmount), downpaymentDueDate, paymentDate, remainingBalance, hasEmi,
        numInstallments: customEmiItems.length || numInstallments,
        installmentAmount: customEmiItems.length > 0 ? Math.round(scheduledEmiSum / customEmiItems.length) : installmentAmount,
        customEmiPlan
      };

      const res = await fetch("/api/admissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (data.success) {
        if (generateReceipt) {
          const newPayment = data.payment || {
            receiptNo: `REC-${Date.now().toString().slice(-6)}`,
            amountReceived: Number(amountReceivedToday),
            paymentMode: paymentMode || "Cash",
            referenceNo: transactionNo || "N/A",
            company: companyAssigned,
            paymentDate: paymentDate || new Date().toISOString(),
            remarks: "Initial payment upon admission",
            particulars: { courseFeeDue: 0 }
          };
          setAdmissionData(data.data);
          setReceiptData(newPayment);
          setShowReceiptModal(true);
        } else {
          onSuccess?.();
          alert("Admission generated successfully!");
          onClose();
        }
      } else {
        alert("Error: " + data.message);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to generate admission");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Removed if (!isOpen) return null; to handle AnimatePresence

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="bg-slate-50 w-full h-full max-w-[1400px] max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200"
          >
        
        {/* Header */}
        <div className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">New Student Admission</h1>
              <p className="text-xs font-semibold text-slate-500">Create a new admission and generate admission documents</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Back to Admissions
            </button>
            <button onClick={() => {}} className="px-4 py-2 bg-white border border-rose-200 text-rose-500 rounded-xl text-sm font-bold hover:bg-rose-50 transition-colors shadow-sm flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              Clear All
            </button>
          </div>
        </div>

        {/* Progress Bar (Visual Only) */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between overflow-x-auto shrink-0">
          {[
            { id: 1, title: "Student Information", desc: "Student & Contact Details", active: true },
            { id: 2, title: "Course Details", desc: "Course & Batch Information", active: true },
            { id: 3, title: "Discount & Scholarship", desc: "Discounts & Fee Adjustments", active: true },
            { id: 4, title: "Payment & EMI", desc: "Payment & Installment Details", active: true },
            { id: 5, title: "Review & Confirm", desc: "Review & Generate Admission", active: false }
          ].map((step, idx) => (
            <div key={idx} className="flex items-center gap-4 shrink-0 px-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 ${step.active ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-slate-50 text-slate-400"}`}>
                {step.active ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
                  </svg>
                ) : (
                  step.id
                )}
              </div>
              <div className="hidden lg:block">
                <p className={`text-sm font-bold ${step.active ? "text-slate-800" : "text-slate-500"}`}>{step.id}. {step.title}</p>
                <p className="text-[10px] text-slate-400 font-semibold">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Scrollable Form Area */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
            
            {/* 1. Student Information */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-indigo-50/50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">1</div>
                  Student Information
                </h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500">Full Name <span className="text-rose-500">*</span></label>
                    <input type="text" value={fullName} onChange={e=>setFullName(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-white" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500">Mobile Number <span className="text-rose-500">*</span></label>
                    <input type="text" value={mobileNumber} onChange={e=>setMobileNumber(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-white" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500">Email Address <span className="text-indigo-600 text-[10px] font-semibold">(for PDF Receipt & Email)</span></label>
                    <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="student@example.com" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-white" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500">Guardian 1 Name <span className="text-[10px] text-slate-400 font-normal">(Optional)</span></label>
                    <input type="text" value={parentName} onChange={e=>setParentName(e.target.value)} placeholder="e.g. Father Name" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-white" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500">Guardian 1 Phone <span className="text-[10px] text-slate-400 font-normal">(Optional)</span></label>
                    <input type="tel" value={parentPhone} onChange={e=>setParentPhone(e.target.value)} placeholder="e.g. +91 9876500000" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-white" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500">Guardian 2 Name <span className="text-[10px] text-slate-400 font-normal">(Optional)</span></label>
                    <input type="text" value={guardian2Name} onChange={e=>setGuardian2Name(e.target.value)} placeholder="e.g. Mother / Secondary Guardian Name" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-white" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500">Guardian 2 Phone <span className="text-[10px] text-slate-400 font-normal">(Optional)</span></label>
                    <input type="tel" value={guardian2Phone} onChange={e=>setGuardian2Phone(e.target.value)} placeholder="e.g. +91 9876511111" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-white" />
                  </div>
                  <div className="flex flex-col gap-1.5 md:col-span-3">
                    <label className="text-xs font-bold text-slate-500">Address</label>
                    <input type="text" value={address} onChange={e=>setAddress(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-white" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500">City</label>
                    <input type="text" value={city} onChange={e=>setCity(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-white" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500">State</label>
                    <input type="text" value={state} onChange={e=>setState(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-white" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500">Pincode</label>
                    <input type="text" value={pincode} onChange={e=>setPincode(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-white" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500">Date of Birth</label>
                    <input type="date" value={dob} onChange={e=>setDob(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-white" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500">Gender</label>
                    <select value={gender} onChange={e=>setGender(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-white">
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500">Sales Executive <span className="text-rose-500">*</span></label>
                    <input type="text" value={counsellor} onChange={e=>setCounsellor(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-white" />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Course Details */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-indigo-50/50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">2</div>
                  Course Details
                </h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="text-xs font-bold text-slate-500">
                      Course(s) <span className="text-rose-500">*</span>
                    </label>
                    <CourseMultiSelect
                      courses={courses}
                      selectedCourses={selectedCourses}
                      onChange={handleCourseSelectionChange}
                      placeholder="Select a course..."
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="text-xs font-bold text-slate-500">Batch</label>
                    {(() => {
                      const selectedCourseObj = courses.find((c) => c.name === course);
                      const availableBatches: string[] = Array.isArray(selectedCourseObj?.batches) && selectedCourseObj.batches.length > 0
                        ? selectedCourseObj.batches
                        : [];

                      return (
                        <>
                          <select 
                            value={isCustomBatch ? "Custom" : batch} 
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "Custom") {
                                setIsCustomBatch(true);
                                setBatch("");
                              } else {
                                setIsCustomBatch(false);
                                setBatch(val);
                              }
                            }} 
                            disabled={!course && batchesList.length === 0}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-white disabled:bg-slate-100 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <option value="">{course || batchesList.length > 0 ? "-- Select Batch --" : "-- Select a Course First --"}</option>
                            {batchesList.length > 0 && (
                              <optgroup label="Faculty Batches">
                                {batchesList.map((b) => (
                                  <option key={b._id} value={b.batchName}>
                                    {b.batchName} ({b.course} - Faculty: {b.teacherName})
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {availableBatches.length > 0 && (
                              <optgroup label="Course Batches">
                                {availableBatches.map((b, idx) => (
                                  <option key={idx} value={b}>{b}</option>
                                ))}
                              </optgroup>
                            )}
                            <option value="Custom">+ Enter Custom Batch...</option>
                          </select>
                          {isCustomBatch && (
                            <input 
                              type="text" 
                              value={batch} 
                              onChange={(e) => setBatch(e.target.value)} 
                              placeholder="Type custom batch name..." 
                              className="mt-2 w-full px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 bg-white" 
                            />
                          )}
                        </>
                      );
                    })()}
                  </div>
                  
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500">Duration <span className="text-rose-500">*</span></label>
                    <input type="text" value={duration} onChange={e=>setDuration(e.target.value)} placeholder="e.g. 6 Months" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-white" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500">Start Date <span className="text-rose-500">*</span></label>
                    <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-white" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500">Academic Year <span className="text-rose-500">*</span></label>
                    <input type="text" value={academicYear} onChange={e=>setAcademicYear(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-white" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500">Admission Date <span className="text-rose-500">*</span></label>
                    <input type="date" value={admissionDate} onChange={e=>setAdmissionDate(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-white" />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500">Course Fee (₹) <span className="text-rose-500">*</span></label>
                    <input type="number" step="any" value={courseFee} onChange={e=>setCourseFee(Number(e.target.value))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-slate-50" />
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Discount & Scholarship */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-indigo-50/50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">3</div>
                  Discount & Scholarship
                </h2>
                <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Discount Mode:</span>
                  <button
                    type="button"
                    onClick={() => handleSwitchDiscountMode("INR")}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      discountUnitMode === "INR" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-800"
                    }`}
                  >
                    ₹ INR
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchDiscountMode("PERCENT")}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      discountUnitMode === "PERCENT" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-800"
                    }`}
                  >
                    % Percent
                  </button>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500">Scholarship Type</label>
                    <select value={scholarshipType} onChange={e=>setScholarshipType(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-white">
                      <option value="None">None</option>
                      <option value="Merit Based">Merit Based</option>
                      <option value="Need Based">Need Based</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500">Scholarship Amount (₹)</label>
                    <input type="number" step="any" value={scholarshipAmount} onChange={e=>setScholarshipAmount(Number(e.target.value))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-white" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500">Discount Type</label>
                    <select value={discountType} onChange={e=>setDiscountType(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-white">
                      <option value="None">None</option>
                      <option value="Festive Offer">Festive Offer</option>
                      <option value="Launching of Course">Launching of Course</option>
                      <option value="Anniversary Offer">Anniversary Offer</option>
                      <option value="Month End Offer">Month End Offer</option>
                      <option value="Group Discount">Group Discount</option>
                      <option value="Early Bird Offer">Early Bird Offer</option>
                      <option value="Referral Discount">Referral Discount</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 flex items-center justify-between">
                      <span>Discount ({discountUnitMode === "INR" ? "₹ INR" : "% Percent"})</span>
                      {discountUnitMode === "PERCENT" && (
                        <span className="text-[10px] text-emerald-600 font-extrabold">= ₹{discountAmount.toLocaleString()}</span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        value={discountInputValue}
                        onChange={e => setDiscountInputValue(Number(e.target.value))}
                        placeholder={discountUnitMode === "INR" ? "Amount in ₹" : "% Discount"}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-white pr-12"
                      />
                      <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">
                        {discountUnitMode === "INR" ? "₹" : "%"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex flex-col items-center justify-center">
                    <p className="text-xs font-bold text-slate-500 mb-1">Course Fee (₹)</p>
                    <p className="text-2xl font-extrabold text-slate-800">{courseFee.toLocaleString()}</p>
                  </div>
                  <div className="text-slate-300 font-extrabold text-2xl">-</div>
                  <div className="flex flex-col items-center justify-center">
                    <p className="text-xs font-bold text-slate-500 mb-1">Total Discount (₹)</p>
                    <p className="text-2xl font-extrabold text-emerald-600">{totalDiscount.toLocaleString()}</p>
                  </div>
                  <div className="text-slate-300 font-extrabold text-2xl">=</div>
                  <div className="flex flex-col items-center justify-center">
                    <p className="text-xs font-bold text-slate-500 mb-1">Final Fee (₹)</p>
                    <p className="text-2xl font-extrabold text-indigo-700">{finalFee.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Payment & EMI */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-indigo-50/50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">4</div>
                  Payment & EMI Details
                </h2>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 h-5 flex items-center">
                      Payment Mode <span className="text-rose-500 ml-1">*</span>
                    </label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-white"
                    >
                      <option value="UPI">UPI</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cash">Cash</option>
                      <option value="Credit Card">Credit Card</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between h-5">
                      <label className="text-xs font-bold text-slate-500 flex items-center">
                        Company Allocation
                      </label>
                      {paymentMode !== "Cash" && autoAllocatedCompany && (
                        <span className="text-[10px] text-emerald-600 font-extrabold flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3 text-emerald-500">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Suggested (Editable)
                        </span>
                      )}
                    </div>
                    <select
                      value={paymentMode === "Cash" ? "Cash (Unallocated)" : (companyAssigned || autoAllocatedCompany || "")}
                      onChange={(e) => setCompanyAssigned(e.target.value.toUpperCase())}
                      disabled={paymentMode === "Cash"}
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-white disabled:bg-slate-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {paymentMode === "Cash" ? (
                        <option value="Cash (Unallocated)">Cash (Unallocated)</option>
                      ) : (
                        <>
                          {autoAllocatedCompany && (
                            <option value={autoAllocatedCompany}>
                              ✨ {autoAllocatedCompany} (Auto-Suggested System Choice)
                            </option>
                          )}
                          {availableCompaniesList
                            .filter((c) => c !== autoAllocatedCompany)
                            .map((cName) => (
                              <option key={cName} value={cName}>
                                {cName}
                              </option>
                            ))}
                        </>
                      )}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 h-5 flex items-center">
                      Transaction / Reference No.
                    </label>
                    <input
                      type="text"
                      value={transactionNo}
                      onChange={(e) => setTransactionNo(e.target.value)}
                      placeholder="Ref / Transaction No."
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-white"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 h-5 flex items-center truncate" title="Amount collected at this very moment">
                      Registration Amount (₹) <span className="text-rose-500 ml-1">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={registrationAmount}
                      onChange={(e) => setRegistrationAmount(Number(e.target.value))}
                      placeholder="Registration fee collected now"
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-extrabold text-indigo-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-indigo-50/70"
                    />
                  </div>
                </div>

                <div className="p-5 border border-slate-200/80 bg-slate-50/70 rounded-xl grid grid-cols-1 md:grid-cols-4 gap-5 items-center">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 h-5 flex items-center">
                      Downpayment Amount (₹)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={downpaymentAmount}
                      onChange={(e) => setDownpaymentAmount(Number(e.target.value))}
                      placeholder="0"
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-white"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 h-5 flex items-center">
                      Downpayment Due Date
                    </label>
                    <input
                      type="date"
                      value={downpaymentDueDate}
                      onChange={(e) => setDownpaymentDueDate(e.target.value)}
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-white"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 h-5 flex items-center">
                      EMI / Installment
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setHasEmi(true)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border shadow-xs ${
                          hasEmi
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setHasEmi(false);
                          setRegistrationAmount(Math.max(0, finalFee - downpaymentAmount));
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border shadow-xs ${
                          !hasEmi
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        No
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 h-5 flex items-center">
                      Remaining Balance (₹)
                    </label>
                    <div className="w-full h-11 px-4 rounded-xl border border-slate-200 text-base font-extrabold text-slate-800 bg-white flex items-center">
                      ₹{remainingBalance.toLocaleString("en-IN")}
                    </div>
                  </div>

                  {hasEmi && (
                    <>
                      <div className="flex flex-col gap-1.5 md:col-span-2">
                        <label className="text-xs font-bold text-slate-500 h-5 flex items-center">
                          Number of Installments
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="24"
                            value={numInstallments}
                            onChange={(e) => {
                              const val = Math.max(Number(e.target.value) || 1, 1);
                              setNumInstallments(val);
                            }}
                            className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-white"
                          />
                          <button
                            type="button"
                            onClick={distributeEvenly}
                            className="shrink-0 h-11 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 transition-colors"
                          >
                            Distribute Evenly
                          </button>
                        </div>
                      </div>

                      {/* Customizable EMI Schedule Breakdown */}
                      <div className="md:col-span-4 mt-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <div>
                            <h4 className="text-xs font-extrabold text-indigo-900 uppercase tracking-wider flex items-center gap-2">
                              📅 Customizable EMI Schedule & Due Dates
                            </h4>
                            <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                              Customize individual installment amounts and specific due dates for each payment.
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={addEmiRow}
                              className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors flex items-center gap-1"
                            >
                              + Add Installment
                            </button>
                            <button
                              type="button"
                              onClick={distributeEvenly}
                              className="px-3 py-1.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors"
                            >
                              Reset Equal Amounts
                            </button>
                          </div>
                        </div>

                        {/* Quick Day of Month Selector Bar */}
                        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                              🗓️ Set Monthly Due Day for All Installments:
                            </span>
                            <select
                              value={selectedMonthlyDueDay}
                              onChange={(e) => {
                                const dayNum = Number(e.target.value);
                                setSelectedMonthlyDueDay(dayNum);
                                if (dayNum > 0) applyMonthlyDueDay(dayNum);
                              }}
                              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-extrabold text-indigo-950 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer shadow-xs"
                            >
                              <option value={0}>Select Day (e.g. 10th)</option>
                              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                                <option key={d} value={d}>
                                  {d}{d === 1 || d === 21 || d === 31 ? "st" : d === 2 || d === 22 ? "nd" : d === 3 || d === 23 ? "rd" : "th"} Day of Month
                                </option>
                              ))}
                            </select>
                          </div>
                          <span className="text-[11px] font-semibold text-slate-400">
                            (Sets dates to this day of every month — individual dates remain fully editable below)
                          </span>
                        </div>

                        {/* Installments Table */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-50/70 text-[10px] uppercase font-bold text-slate-500">
                                <th className="py-2.5 px-3">Installment</th>
                                <th className="py-2.5 px-3">Due Date (Editable)</th>
                                <th className="py-2.5 px-3">Amount ₹ (Editable)</th>
                                <th className="py-2.5 px-3 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                              {customEmiItems.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="py-2.5 px-3 font-bold text-slate-700">
                                    {item.installmentName}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <input
                                      type="date"
                                      value={item.dueDate}
                                      onChange={(e) => handleEmiDateChange(idx, e.target.value)}
                                      className="px-3 py-1.5 rounded-lg border border-slate-200 font-semibold text-slate-800 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 bg-white"
                                    />
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <div className="flex items-center gap-1">
                                      <span className="text-slate-400 font-bold">₹</span>
                                      <input
                                        type="number"
                                        min="0"
                                        value={item.amount}
                                        onChange={(e) => handleEmiAmountChange(idx, Number(e.target.value))}
                                        className="w-32 px-3 py-1.5 rounded-lg border border-slate-200 font-extrabold text-indigo-700 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 bg-white"
                                      />
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 text-right">
                                    {customEmiItems.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => removeEmiRow(idx)}
                                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                        title="Delete Installment"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                        </svg>
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Sum Validation Banner */}
                        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2 font-bold text-slate-700">
                            <span>Total Scheduled EMI:</span>
                            <span className="text-sm font-extrabold text-indigo-700">₹{scheduledEmiSum.toLocaleString("en-IN")}</span>
                          </div>
                          {scheduledEmiSum === remainingBalance ? (
                            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px] flex items-center gap-1">
                              ✔ EMI sum perfectly matches remaining balance (₹{remainingBalance.toLocaleString("en-IN")})
                            </span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold text-[11px]">
                                ⚠ Diff: ₹{Math.abs(emiDifference).toLocaleString("en-IN")} {emiDifference > 0 ? "remaining to schedule" : "exceeds remaining balance"}
                              </span>
                              <button
                                type="button"
                                onClick={distributeEvenly}
                                className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-[11px] font-bold hover:bg-indigo-700 transition-colors shadow-xs"
                              >
                                Auto-Fix Balance
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Warning / Validation Message */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
              <div className="text-emerald-500">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
              </div>
              <p className="text-xs font-semibold text-emerald-700">Please review all details carefully before generating admission. After submission, admission documents and receipts will be generated.</p>
            </div>

          </div>

          {/* Right Sidebar - Admission Summary */}
          <div className="w-[380px] bg-indigo-50/30 border-l border-slate-200 flex flex-col shrink-0 overflow-y-auto">
            <div className="px-6 py-5 border-b border-slate-200 bg-white sticky top-0 z-10 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-indigo-900 tracking-tight flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                </svg>
                Admission Summary
              </h3>
              <button className="text-slate-400 hover:text-indigo-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Profile Card Summary */}
              <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-extrabold text-lg">
                  {fullName ? fullName.split(' ').map((n: string) => n[0]).join('').substring(0,2).toUpperCase() : "?"}
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">{fullName || "Student Name"}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100">Ready to Admit</span>
                  </div>
                </div>
              </div>

              {/* Student Details */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Student Details</h4>
                </div>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Mobile</span>
                    <span className="font-semibold text-slate-800">{mobileNumber || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Email</span>
                    <span className="font-semibold text-slate-800">{email || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">City</span>
                    <span className="font-semibold text-slate-800">{city || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Sales Executive</span>
                    <span className="font-semibold text-slate-800">{counsellor || "-"}</span>
                  </div>
                </div>
              </div>

              {/* Course Details */}
              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Course Details</h4>
                </div>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Course</span>
                    <span className="font-semibold text-slate-800">{course || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Batch</span>
                    <span className="font-semibold text-slate-800">{batch || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Duration</span>
                    <span className="font-semibold text-slate-800">{duration || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Start Date</span>
                    <span className="font-semibold text-slate-800">{startDate || "-"}</span>
                  </div>
                </div>
              </div>

              {/* Fee Summary */}
              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Fee Summary</h4>
                </div>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Course Fee</span>
                    <span className="font-semibold text-slate-800">₹{courseFee.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Total Discount</span>
                    <span className="font-semibold text-emerald-600">- ₹{totalDiscount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between bg-indigo-50 p-2 rounded-lg -mx-2">
                    <span className="text-indigo-900 font-bold">Final Fee</span>
                    <span className="font-extrabold text-indigo-700">₹{finalFee.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-500 font-medium">Received Today</span>
                    <span className="font-semibold text-slate-800">₹{amountReceivedToday.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-rose-600">
                    <span className="font-bold">Outstanding Balance</span>
                    <span className="font-extrabold">₹{remainingBalance.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Payment Summary */}
              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Payment Summary</h4>
                </div>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Payment Mode</span>
                    <span className="font-semibold text-slate-800">{paymentMode}</span>
                  </div>
                  {hasEmi && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">EMI / Installments</span>
                        <span className="font-semibold text-slate-800">{numInstallments} Installments</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-medium">Installment Amount</span>
                        <span className="font-semibold text-slate-800">₹{installmentAmount.toLocaleString()}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-white px-6 py-4 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex gap-3">
            <button onClick={onClose} className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm">
              Cancel
            </button>
            <button className="px-6 py-2.5 bg-white border border-slate-200 text-indigo-600 rounded-xl text-sm font-bold hover:bg-indigo-50 transition-colors shadow-sm flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
              </svg>
              Save Draft
            </button>
          </div>
          <div className="flex gap-3">
            <button disabled={isSubmitting} onClick={() => handleGenerateAdmission(false)} className="px-6 py-2.5 bg-white border border-indigo-200 text-indigo-600 rounded-xl text-sm font-bold hover:bg-indigo-50 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              {isSubmitting ? "Processing..." : "Generate Admission"}
            </button>
            <button disabled={isSubmitting} onClick={() => handleGenerateAdmission(true)} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-600/20 flex items-center gap-2 disabled:opacity-50">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
              {isSubmitting ? "Processing..." : "Generate Admission + First Receipt"}
            </button>
          </div>
        </div>

          </motion.div>
        </motion.div>
      )}

      {showReceiptModal && receiptData && admissionData && (
        <PaymentReceiptModal
          isOpen={showReceiptModal}
          onClose={() => {
            setShowReceiptModal(false);
            onSuccess?.();
            onClose();
          }}
          receipt={receiptData}
          student={admissionData}
          paymentsHistory={[receiptData]}
        />
      )}
    </AnimatePresence>
  );
}
