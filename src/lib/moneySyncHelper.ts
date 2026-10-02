import { toPaise, fromPaise } from "@/lib/money";

/**
 * Synchronizes money fields on Admission documents between rupees and integer paise.
 * Supports both Mongoose Document instances and plain update objects ($set / target).
 */
export function syncAdmissionMoney(doc: any): void {
  if (!doc) return;

  const moneyFields = [
    { rupee: "courseFee", paise: "courseFeePaise" },
    { rupee: "scholarshipAmount", paise: "scholarshipAmountPaise" },
    { rupee: "discountAmount", paise: "discountAmountPaise" },
    { rupee: "additionalDiscount", paise: "additionalDiscountPaise" },
    { rupee: "totalDiscount", paise: "totalDiscountPaise" },
    { rupee: "finalFee", paise: "finalFeePaise" },
    { rupee: "maxDiscountLimitAtAdmission", paise: "maxDiscountLimitAtAdmissionPaise" },
    { rupee: "amountReceivedToday", paise: "amountReceivedTodayPaise" },
    { rupee: "registrationAmount", paise: "registrationAmountPaise" },
    { rupee: "downpaymentAmount", paise: "downpaymentAmountPaise" },
    { rupee: "remainingBalance", paise: "remainingBalancePaise" },
    { rupee: "installmentAmount", paise: "installmentAmountPaise" },
    { rupee: "ptpAmount", paise: "ptpAmountPaise" },
  ];

  const isDoc = typeof doc.isModified === "function";

  for (const { rupee, paise } of moneyFields) {
    if (isDoc) {
      if (doc.isModified(paise) && doc[paise] !== undefined && doc[paise] !== null) {
        doc[rupee] = fromPaise(doc[paise]);
      } else if (doc.isModified(rupee) && doc[rupee] !== undefined && doc[rupee] !== null) {
        doc[paise] = toPaise(doc[rupee]);
      } else if (doc[paise] === undefined && doc[rupee] !== undefined && doc[rupee] !== null) {
        doc[paise] = toPaise(doc[rupee]);
      } else if (doc[rupee] === undefined && doc[paise] !== undefined && doc[paise] !== null) {
        doc[rupee] = fromPaise(doc[paise]);
      }
    } else {
      // Plain update object
      if (doc[paise] !== undefined && doc[paise] !== null) {
        doc[rupee] = fromPaise(doc[paise]);
      } else if (doc[rupee] !== undefined && doc[rupee] !== null) {
        doc[paise] = toPaise(doc[rupee]);
      }
    }
  }

  // Handle customEmiPlan array
  if (Array.isArray(doc.customEmiPlan)) {
    for (const emi of doc.customEmiPlan) {
      if (emi.amountPaise !== undefined && emi.amountPaise !== null) {
        emi.amount = fromPaise(emi.amountPaise);
      } else if (emi.amount !== undefined && emi.amount !== null) {
        emi.amountPaise = toPaise(emi.amount);
      }
    }
  }

  // Handle feeFollowups array
  if (Array.isArray(doc.feeFollowups)) {
    for (const f of doc.feeFollowups) {
      if (f.ptpAmountPaise !== undefined && f.ptpAmountPaise !== null) {
        f.ptpAmount = fromPaise(f.ptpAmountPaise);
      } else if (f.ptpAmount !== undefined && f.ptpAmount !== null) {
        f.ptpAmountPaise = toPaise(f.ptpAmount);
      }
    }
  }
}

/**
 * Synchronizes money fields on Payment documents between rupees and integer paise.
 * Supports both Mongoose Document instances and plain update objects ($set / target).
 */
export function syncPaymentMoney(doc: any): void {
  if (!doc) return;

  const isDoc = typeof doc.isModified === "function";

  // amountReceived <-> amountReceivedPaise
  if (isDoc) {
    if (doc.isModified("amountReceivedPaise") && doc.amountReceivedPaise !== undefined && doc.amountReceivedPaise !== null) {
      doc.amountReceived = fromPaise(doc.amountReceivedPaise);
    } else if (doc.isModified("amountReceived") && doc.amountReceived !== undefined && doc.amountReceived !== null) {
      doc.amountReceivedPaise = toPaise(doc.amountReceived);
    } else if (doc.amountReceivedPaise === undefined && doc.amountReceived !== undefined && doc.amountReceived !== null) {
      doc.amountReceivedPaise = toPaise(doc.amountReceived);
    } else if (doc.amountReceived === undefined && doc.amountReceivedPaise !== undefined && doc.amountReceivedPaise !== null) {
      doc.amountReceived = fromPaise(doc.amountReceivedPaise);
    }
  } else {
    if (doc.amountReceivedPaise !== undefined && doc.amountReceivedPaise !== null) {
      doc.amountReceived = fromPaise(doc.amountReceivedPaise);
    } else if (doc.amountReceived !== undefined && doc.amountReceived !== null) {
      doc.amountReceivedPaise = toPaise(doc.amountReceived);
    }
  }

  // Handle particulars sub-document
  if (doc.particulars) {
    const p = doc.particulars;
    const particularFields = [
      { rupee: "courseFeeDue", paise: "courseFeeDuePaise" },
      { rupee: "registrationFeeDue", paise: "registrationFeeDuePaise" },
      { rupee: "materialFeeDue", paise: "materialFeeDuePaise" },
      { rupee: "examFeeDue", paise: "examFeeDuePaise" },
    ];

    for (const { rupee, paise } of particularFields) {
      if (p[paise] !== undefined && p[paise] !== null) {
        p[rupee] = fromPaise(p[paise]);
      } else if (p[rupee] !== undefined && p[rupee] !== null) {
        p[paise] = toPaise(p[rupee]);
      }
    }
  }
}
