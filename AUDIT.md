# Architectural Audit Report: Data Consistency, Schemas & Transactions
**Project:** SyncForge ERP / Lead2leadure (Next.js App Router + Mongoose)  
**Database:** `syncforge_db` (MongoDB Atlas)  
**Date of Audit:** October 2026  
**Status:** Read-only Audit (Zero code or database records mutated)

---

## Executive Summary & System-Wide Vulnerabilities

| Focus Area | Key Findings | Risk Level |
| :--- | :--- | :---: |
| **Cross-Collection References** | 34 active Mongoose models; majority of foreign keys are stored as **unvalidated `String` fields** (e.g. `companyAssigned`, `counsellor`, `brand`, `course`, `batchId`, `linkedStudentId`) rather than strict `Schema.Types.ObjectId` with Mongoose `ref`. | **HIGH** |
| **Denormalized Student Names** | Student names are denormalized across 5 entities (`Enquiry.studentFullName`, `Admission.fullName`, `Payment.studentName`, `Task.linkedStudentName`, `Notification.studentFullName`) across 166 code locations. | **HIGH** |
| **Phone Number Matching** | Over 123 occurrences across 18 backend API routes match and update records by phone number regex (`$regex: cleanDigits`) rather than immutable MongoDB IDs, causing data drift and cross-contamination when numbers are shared or re-assigned. | **CRITICAL** |
| **Multi-Collection Writes** | 32 API routes execute multi-collection writes (e.g. creating an Admission + creating a Payment + updating an Enquiry + generating Tasks + logging Notifications). **0 out of 32 use MongoDB sessions or transactions (`session.withTransaction`)**, risking orphaned or inconsistent documents upon mid-flight network/runtime failures. | **CRITICAL** |
| **Money Field Types** | 93 currency/fee fields. Critical inconsistencies detected: `Course.fee` and `Enquiry.expectedCourseFee` are stored as **`String`** (`"₹0"`), while `Admission.courseFee`, `Admission.finalFee`, and `Payment.amountReceived` are stored as **`Number`**. | **HIGH** |
| **Teacher Collection Identity** | **There is NO `Teacher` model or `teachers` collection.** Teachers are represented as `User` documents with `role: "teacher"`. Models like `Batch`, `Attendance`, and `Notification` store `teacherId` referencing the `User` model. | **MEDIUM** |
| **Schema Indexes** | 111 total indexes declared across 26 models (52 compound/single-field explicit schema indexes, 59 inline unique/single indexes). | **INFO** |

---

## 1. Mongoose Models, Collections & Foreign References

All 34 Mongoose models in [`src/models/`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models), their runtime collection names, and all foreign reference fields (both explicit `ref` and logical string/id references):

| Model File | Runtime Collection | Reference Field | Type in Schema | Target Model / Entity | Link Mechanism |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`Admission.ts`** | `admissions` | `enquiryId` | `Schema.Types.ObjectId` | `Enquiry` | Explicit `ref: "Enquiry"` ([Admission.ts:L11](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Admission.ts#L11)) |
| | | `counsellor` | `String` | `Counsellor` / `User` | Name string match ([Admission.ts:L31](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Admission.ts#L31)) |
| | | `brand` | `String` | `Brand` | Brand name string ([Admission.ts:L32](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Admission.ts#L32)) |
| | | `course` | `String` | `Course` | Course name string ([Admission.ts:L36](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Admission.ts#L36)) |
| | | `courses` | `[String]` | `Course` | Array of course names ([Admission.ts:L37](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Admission.ts#L37)) |
| | | `batch` | `String` | `Batch` | Batch name string ([Admission.ts:L39](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Admission.ts#L39)) |
| | | `batchId` | `String` | `Batch` | Logical ID string ([Admission.ts:L40](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Admission.ts#L40)) |
| | | `companyAssigned`| `String` | `Company` | Legal company name string ([Admission.ts:L45](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Admission.ts#L45)) |
| **`Attendance.ts`** | `attendances` | `batchId` | `Schema.Types.ObjectId` | `Batch` | Explicit `ref: "Batch"` ([Attendance.ts:L35](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Attendance.ts#L35)) |
| | | `teacherId` | `Schema.Types.ObjectId` | `User` | Explicit `ref: "User"` ([Attendance.ts:L57](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Attendance.ts#L57)) |
| | | `brand` | `String` | `Brand` | Brand name string ([Attendance.ts:L49](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Attendance.ts#L49)) |
| | | `students[].studentId` | `String` | `Admission` | Stores `admissionId` / string ID ([Attendance.ts:L41](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Attendance.ts#L41)) |
| **`Batch.ts`** | `batches` | `teacherId` | `Schema.Types.ObjectId` | `User` | Explicit `ref: "User"` ([Batch.ts:L32](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Batch.ts#L32)) |
| | | `brand` | `String` | `Brand` | Brand name string ([Batch.ts:L24](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Batch.ts#L24)) |
| | | `course` / `courses` | `String` / `[String]` | `Course` | Course catalog name ([Batch.ts:L15-L16](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Batch.ts#L15-L16)) |
| | | `students` | `[String]` | `Admission` | Array of student roll numbers / names ([Batch.ts:L40](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Batch.ts#L40)) |
| **`Brand.ts`** | `brands` | `companies` | `[String]` | `Company` | Array of company names ([Brand.ts:L29](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Brand.ts#L29)) |
| | | `courses` | `[String]` | `Course` | Array of course names ([Brand.ts:L36](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Brand.ts#L36)) |
| **`Company.ts`** | `companies` | `brand` / `brands` | `String` / `[String]` | `Brand` | Associated brand string(s) ([Company.ts:L28-L32](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Company.ts#L28-L32)) |
| **`CorporateTraining.ts`** | `corporatetrainings` | `facultyId` | `Schema.Types.ObjectId` | `User` | Explicit `ref: "User"` ([CorporateTraining.ts:L75](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/CorporateTraining.ts#L75)) |
| | | `salesExecutiveId` | `Schema.Types.ObjectId` | `User` | Explicit `ref: "User"` ([CorporateTraining.ts:L136](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/CorporateTraining.ts#L136)) |
| | | `centreHeadId` | `Schema.Types.ObjectId` | `User` | Explicit `ref: "User"` ([CorporateTraining.ts:L144](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/CorporateTraining.ts#L144)) |
| | | `createdBy` | `Schema.Types.ObjectId` | `User` | Explicit `ref: "User"` ([CorporateTraining.ts:L155](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/CorporateTraining.ts#L155)) |
| | | `companyAssigned` | `String` | `Company` | Billing company name string ([CorporateTraining.ts:L42](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/CorporateTraining.ts#L42)) |
| **`Counsellor.ts`** | `counsellors` | `brand` / `brandScope` | `String` | `Brand` | Target brand scope string ([Counsellor.ts:L24](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Counsellor.ts#L24)) |
| **`Counter.ts`** | `counters` | `name` | `String` | Global | Sequence counter name (`admission`, `enquiry`, etc.) |
| **`Course.ts`** | `courses` | `brand` | `String` | `Brand` | Brand name string ([Course.ts:L22](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Course.ts#L22)) |
| | | `batches` | `[String]` | `Batch` | Array of batch names / IDs ([Course.ts:L45](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Course.ts#L45)) |
| **`Enquiry.ts`** | `enquiries` | `targetBrand` | `String` | `Brand` | Brand name string ([Enquiry.ts:L38](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Enquiry.ts#L38)) |
| | | `targetCourse` / `courses` | `String` / `[String]` | `Course` | Course name strings ([Enquiry.ts:L41-L56](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Enquiry.ts#L41-L56)) |
| | | `assignedCrmAdvisor`| `String` | `Counsellor` / `User` | Advisor name string ([Enquiry.ts:L61](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Enquiry.ts#L61)) |
| | | `leadSource` | `String` | `LeadSource` | Channel string ([Enquiry.ts:L64](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Enquiry.ts#L64)) |
| | | `followUps[].assignedTo` | `String` | `User` | Staff name string ([Enquiry.ts:L90](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Enquiry.ts#L90)) |
| | | `demoDetails.demoTeacher`| `String` | `User` | Teacher name string ([Enquiry.ts:L133](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Enquiry.ts#L133)) |
| **`Expense.ts`** | `expenses` | `company` | `String` | `Company` | Company name string ([Expense.ts:L34](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Expense.ts#L34)) |
| | | `brand` | `String` | `Brand` | Brand name string ([Expense.ts:L33](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Expense.ts#L33)) |
| **`JustdialConfig.ts`**| `justdialconfigs` | `brand` | `String` | `Brand` | Target brand string ([JustdialConfig.ts:L7](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/JustdialConfig.ts#L7)) |
| | | `counsellorPool` | `[String]` | `Counsellor` / `User` | Array of advisor names ([JustdialConfig.ts:L45](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/JustdialConfig.ts#L45)) |
| **`JustdialLeadLog.ts`**| `justdialleadlogs` | `mappedEnquiryId` | `String` | `Enquiry` | Mapped enquiry ID string ([JustdialLeadLog.ts:L28](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/JustdialLeadLog.ts#L28)) |
| **`LeadSource.ts`** | `leadsources` | `name` | `String` | Master | Channel name |
| **`LostLeadCounter.ts`**| `lostleadcounters` | `category` | `String` | Master | Dropped reason category |
| **`Notification.ts`** | `notifications` | `targetTeacherId` | `Schema.Types.ObjectId` | `User` | Explicit `ref: "User"` ([Notification.ts:L27](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Notification.ts#L27)) |
| | | `admissionId` | `String` | `Admission` | Admission ObjectId or roll number ([Notification.ts:L29](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Notification.ts#L29)) |
| **`OfficeLocation.ts`**| `officelocations` | `brand` | `String` | `Brand` | Brand geofence binding ([OfficeLocation.ts:L16](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/OfficeLocation.ts#L16)) |
| **`Payment.ts`** | `payments` | `admissionId` | `Schema.Types.ObjectId` | `Admission` | Explicit `ref: "Admission"` ([Payment.ts:L11](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Payment.ts#L11)) |
| | | `company` | `String` | `Company` | Company name string ([Payment.ts:L27](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Payment.ts#L27)) |
| | | `brand` | `String` | `Brand` | Brand name string ([Payment.ts:L31](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Payment.ts#L31)) |
| **`Payroll.ts`** | `payrolls` | `brand` | `String` | `Brand` | Brand name string ([Payroll.ts:L36](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Payroll.ts#L36)) |
| | | `company` | `String` | `Company` | Company name string ([Payroll.ts:L37](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Payroll.ts#L37)) |
| **`ProformaInvoice.ts`**| `proformainvoices` | `productId` | `Schema.Types.ObjectId` | `QuotationProduct` | Explicit `ref: "QuotationProduct"` ([ProformaInvoice.ts:L6](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/ProformaInvoice.ts#L6)) |
| | | `quotationId` | `Schema.Types.ObjectId` | `Quotation` | Explicit `ref: "Quotation"` ([ProformaInvoice.ts:L31](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/ProformaInvoice.ts#L31)) |
| | | `customerId` | `Schema.Types.ObjectId` | `QuotationCustomer` | Explicit `ref: "QuotationCustomer"` ([ProformaInvoice.ts:L67](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/ProformaInvoice.ts#L67)) |
| | | `companyId` | `String` | `Company` | String corporate ID ([ProformaInvoice.ts:L21](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/ProformaInvoice.ts#L21)) |
| **`ProformaInvoiceCounter.ts`**| `proformainvoicecounters` | `companyId` | `String` | `Company` | Counter company scope string |
| **`PurchaseOrder.ts`** | `purchaseorders` | `productId` | `Schema.Types.ObjectId` | `QuotationProduct` | Explicit `ref: "QuotationProduct"` ([PurchaseOrder.ts:L6](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/PurchaseOrder.ts#L6)) |
| | | `quotationId` | `Schema.Types.ObjectId` | `Quotation` | Explicit `ref: "Quotation"` ([PurchaseOrder.ts:L31](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/PurchaseOrder.ts#L31)) |
| | | `companyId` | `String` | `Company` | Company ID string ([PurchaseOrder.ts:L21](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/PurchaseOrder.ts#L21)) |
| **`PurchaseOrderCounter.ts`**| `purchaseordercounters` | `companyId` | `String` | `Company` | Counter company scope string |
| **`Quotation.ts`** | `quotations` | `productId` | `Schema.Types.ObjectId` | `QuotationProduct` | Explicit `ref: "QuotationProduct"` ([Quotation.ts:L6](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Quotation.ts#L6)) |
| | | `customerId` | `Schema.Types.ObjectId` | `QuotationCustomer` | Explicit `ref: "QuotationCustomer"` ([Quotation.ts:L60](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Quotation.ts#L60)) |
| | | `companyId` | `String` | `Company` | Company ID string ([Quotation.ts:L21](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Quotation.ts#L21)) |
| **`QuotationCounter.ts`**| `quotationcounters` | `companyId` | `String` | `Company` | Counter company scope string |
| **`QuotationCustomer.ts`**| `quotationcustomers` | `companyId` | `String` | `Company` | Optional company ownership string |
| **`QuotationProduct.ts`** | `quotationproducts` | `companyId` | `String` | `Company` | Optional company scope string |
| **`QuotationProfile.ts`** | `quotationprofiles` | `companyId` | `String` | `Company` | Company ID string |
| **`ResponseType.ts`** | `responsetypes` | `name` | `String` | Master | Telephony outcome name |
| **`Session.ts`** | `sessions` | `userId` | `Schema.Types.ObjectId` | `User` | Explicit `ref: "User"` ([Session.ts:L7](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Session.ts#L7)) |
| **`Software.ts`** | `softwares` | `brand` | `String` | `Brand` | Software brand association |
| **`StaffAttendance.ts`**| `staffattendances` | `userId` | `Schema.Types.ObjectId` | `User` | Explicit `ref: "User"` ([StaffAttendance.ts:L7](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/StaffAttendance.ts#L7)) |
| | | `brand` | `String` | `Brand` | Staff brand assignment |
| **`Task.ts`** | `tasks` | `assignedTo` | `String` | `User` | Staff name string ([Task.ts:L21](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Task.ts#L21)) |
| | | `linkedStudentId` | `String` | `Admission` / `Enquiry` | Logical ID string ([Task.ts:L37](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Task.ts#L37)) |
| **`User.ts`** | `users` | `brandScope` | `String` | `Brand` | Brand name or `"All Brands"` ([User.ts:L51](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/User.ts#L51)) |

---

## 2. Denormalized Name Field Writes

The application denormalizes student names across 5 schema fields:
1. `Enquiry.studentFullName`
2. `Admission.fullName`
3. `Payment.studentName`
4. `Task.linkedStudentName`
5. `Notification.studentFullName`

### Exact Codebase Locations Writing to These Fields:

#### A. Writes to `Enquiry.studentFullName`
- [`src/app/api/enquiries/route.ts:L42`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/enquiries/route.ts#L42): Sets `studentFullName: body.studentFullName.trim()` on new inquiry creation.
- [`src/app/api/enquiries/bulk/route.ts:L112`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/enquiries/bulk/route.ts#L112): Sets `studentFullName: row.name` on CSV bulk import.
- [`src/app/api/enquiries/google-form/route.ts:L66`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/enquiries/google-form/route.ts#L66): Sets `studentFullName` from Google Form webhook.
- [`src/app/api/enquiries/justdial-webhook/route.ts:L207`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/enquiries/justdial-webhook/route.ts#L207): Sets `studentFullName` from Justdial webhook lead parser.
- [`src/app/api/justdial-integration/pull/route.ts:L112`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/justdial-integration/pull/route.ts#L112): Sets `studentFullName` on pull sync.
- [`src/app/api/justdial-integration/test/route.ts:L14`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/justdial-integration/test/route.ts#L14): Sets mock test name.
- [`src/app/api/admissions/route.ts:L283`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/admissions/route.ts#L283): Synchronizes `enq.studentFullName = admission.fullName` on enrollment via `enquiryId`.
- [`src/app/api/admissions/route.ts:L308`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/admissions/route.ts#L308): Synchronizes `enq.studentFullName = admission.fullName` on matching phone lead.
- [`src/app/api/admissions/route.ts:L322`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/admissions/route.ts#L322): Creates direct enquiry with `studentFullName: admission.fullName` if no lead existed.
- [`src/app/api/admissions/[id]/route.ts:L466`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/admissions/[id]/route.ts#L466): Cascades updated name to `Enquiry.updateMany({ $or: enqConditions }, { studentFullName: updatedDoc.fullName })`.
- [`src/components/AddEnquiryModal.tsx:L240`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/components/AddEnquiryModal.tsx#L240): Frontend form state submission.
- [`src/components/EditEnquiryModal.tsx:L97`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/components/EditEnquiryModal.tsx#L97): Frontend modal edit payload.

#### B. Writes to `Admission.fullName`
- [`src/app/api/admissions/route.ts:L29`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/admissions/route.ts#L29): Sets `data.fullName = data.fullName?.trim() || "Student"` on new admission.
- [`src/app/api/admissions/import/route.ts:L47`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/admissions/import/route.ts#L47): Sets `fullName: row.fullName?.trim()` on CSV bulk import.
- [`src/app/api/admissions/[id]/route.ts:L288`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/admissions/[id]/route.ts#L288): Updates `fullName: body.fullName !== undefined ? body.fullName.trim() : existingDoc.fullName`.
- [`src/app/api/admin/restore-akshita/route.ts:L34`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/admin/restore-akshita/route.ts#L34): Restores admission record with explicit `fullName`.
- [`src/components/Student360Modal.tsx:L849`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/components/Student360Modal.tsx#L849): Student profile edit submit.
- [`src/lib/uppercaseMigration.ts:L230`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/lib/uppercaseMigration.ts#L230): Migration script capitalizing name.

#### C. Writes to `Payment.studentName`
- [`src/app/api/payments/route.ts:L331`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/payments/route.ts#L331): Sets `studentName: admission.fullName` on payment creation.
- [`src/app/api/admissions/route.ts:L372`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/admissions/route.ts#L372): Sets `studentName: admission.fullName` on initial registration payment.
- [`src/app/api/admissions/route.ts:L423`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/admissions/route.ts#L423): Sets `studentName: admission.fullName` on initial downpayment record.
- [`src/app/api/admissions/import/route.ts:L85`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/admissions/import/route.ts#L85): Sets `studentName: admission.fullName` on imported fee receipt.
- [`src/app/api/admissions/[id]/route.ts:L398`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/admissions/[id]/route.ts#L398): Cascades `Payment.updateMany({ admissionId: existingDoc._id }, { $set: { studentName: updatedDoc.fullName } })`.
- [`src/app/api/admissions/[id]/route.ts:L417`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/admissions/[id]/route.ts#L417): Updates initial receipt `firstPayment.studentName = updatedDoc.fullName`.
- [`src/app/api/admin/reconcile-collections/route.ts:L39`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/admin/reconcile-collections/route.ts#L39): Sets `p.studentName = adm.fullName` on ledger reconciliation.

#### D. Writes to `Task.linkedStudentName`
- [`src/app/api/tasks/route.ts:L37`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/tasks/route.ts#L37): Sets `linkedStudentName: body.linkedStudentName` on task creation.
- [`src/app/api/admissions/route.ts:L351`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/admissions/route.ts#L351): Sets `linkedStudentName: admission.fullName` on automated batch allocation task.
- [`src/app/api/admissions/route.ts:L455, L471, L487, L503`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/admissions/route.ts#L455): Sets `linkedStudentName: admission.fullName` on EMI reminder tasks.
- [`src/app/api/admissions/custom-emi/route.ts:L58`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/admissions/custom-emi/route.ts#L58): Sets `linkedStudentName: admission.fullName` on rescheduled EMI task.
- [`src/app/api/admissions/[id]/route.ts:L498`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/admissions/[id]/route.ts#L498): Cascades updated name to `Task.updateMany({ $or: [{ linkedStudentId }, ...] }, { $set: { linkedStudentName: updatedDoc.fullName } })`.
- [`src/app/api/enquiries/route.ts:L206`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/enquiries/route.ts#L206): Sets `linkedStudentName: newEnquiry.studentFullName` on follow-up task creation.
- [`src/app/api/enquiries/google-form/route.ts:L233`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/enquiries/google-form/route.ts#L233): Sets `linkedStudentName: newEnquiry.studentFullName`.
- [`src/app/api/enquiries/justdial-webhook/route.ts:L503`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/enquiries/justdial-webhook/route.ts#L503): Sets `linkedStudentName: studentFullName`.
- [`src/app/api/justdial-integration/pull/route.ts:L212`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/justdial-integration/pull/route.ts#L212): Sets `linkedStudentName: studentFullName`.
- [`src/app/api/tasks/auto-trigger/route.ts:L31, L56, L86, L103, L120, L137, L162`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/tasks/auto-trigger/route.ts#L31): Sets `linkedStudentName` across auto-triggered follow-up reminders.
- [`src/lib/emiReminderService.ts:L188`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/lib/emiReminderService.ts#L188): Sets `linkedStudentName: adm.fullName` on automated overdue EMI tasks.

#### E. Writes to `Notification.studentFullName`
- [`src/app/api/admissions/route.ts:L233`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/admissions/route.ts#L233): Sets `studentFullName: admission.fullName` in discount approval request alerts to Super Admin.
- [`src/app/api/notifications/route.ts:L63`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/notifications/route.ts#L63): Injects `d.studentFullName` into demo reminder notification strings.

---

## 3. Places Matching Records by Phone/Mobile Number Instead of ID

Matching records by phone number is widespread across both the core business logic and background cron scripts.

| File Path & Line | Model Queried | Query / Predicate Pattern | Risk & Architectural Impact |
| :--- | :--- | :--- | :--- |
| [`src/app/api/admissions/route.ts:L213`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/admissions/route.ts#L213) | `Admission` | `Admission.countDocuments({ mobileNumber: data.mobileNumber.trim(), status: { $ne: "Cancelled" } })` | Matches existing admissions to decide whether a student is an "Upgrade" or Fresh admission. If family members share a mobile, wrong student marked as upgrade. |
| [`src/app/api/admissions/route.ts:L287-294`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/admissions/route.ts#L287-L294) | `Enquiry` | `Enquiry.find({ primaryPhoneMobile: { $regex: cleanDigits }, status: { $nin: ["Admitted", "Closed", "Lost", "Converted"] } })` | Converts unlinked leads to "Admitted" based on last 10 digits of phone number. Can unintentionally close enquiries belonging to siblings or relatives. |
| [`src/app/api/admissions/route.ts:L601`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/admissions/route.ts#L601) | `Admission` | `Admission.findOne({ $or: [{ mobileNumber: cleanRegex }, { primaryPhoneMobile: cleanRegex }] })` | Pre-enrolment duplicate check solely based on phone number regex. |
| [`src/app/api/admissions/search/route.ts:L61`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/admissions/search/route.ts#L61) | `Admission` | `Admission.find({ mobileNumber: phoneRegex })` | Student Search Center queries admissions by phone regex. |
| [`src/app/api/admissions/search/route.ts:L89`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/admissions/search/route.ts#L89) | `Enquiry` | `Enquiry.find({ primaryPhoneMobile: phoneRegex })` | Student Search Center queries prospect leads by phone regex. |
| [`src/app/api/admissions/[id]/route.ts:L145`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/admissions/[id]/route.ts#L145) | `Admission` | `orConditions.push({ mobileNumber: trimmedId })` | Allows fetching or editing an admission record by passing a phone number in the URL route parameter `:id`. |
| [`src/app/api/admissions/[id]/route.ts:L153`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/admissions/[id]/route.ts#L153) | `Admission` | `orConditions.push({ mobileNumber: String(body.mobileNumber).trim() })` | Matches student document by body mobile number if ID is not resolved. |
| [`src/app/api/admissions/[id]/route.ts:L460`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/admissions/[id]/route.ts#L460) | `Enquiry` | `enqConditions.push({ primaryPhoneMobile: { $regex: cleanDigits } })` | Cascades student name updates to enquiries matching phone number. |
| [`src/app/api/enquiries/route.ts:L89`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/enquiries/route.ts#L89) | `Enquiry` | `Enquiry.findOne({ primaryPhoneMobile: { $regex: cleanDigits } })` | Deduplication check on new inquiry submission. Blocks lead if phone exists. |
| [`src/app/api/enquiries/bulk/route.ts:L150`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/enquiries/bulk/route.ts#L150) | `Enquiry` | `Enquiry.find({ primaryPhoneMobile: { $in: phonesToCheck } })` | Batch deduplication check for imported CSV phone lists. |
| [`src/app/api/enquiries/mark-lost/route.ts:L30-33`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/enquiries/mark-lost/route.ts#L30-L33) | `Admission` | `Admission.findOne({ $or: [{ mobileNumber: phone }, { primaryPhoneMobile: phone }] })` | Verifies whether a student already has an active admission before marking their inquiry "Lost". |
| [`src/app/api/enquiries/[id]/route.ts:L183-186`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/enquiries/[id]/route.ts#L183-L186) | `Admission` | `Admission.findOne({ $or: [{ mobileNumber: phone }, { primaryPhoneMobile: phone }] })` | Same validation when updating enquiry status to "Lost". |
| [`src/app/api/justdial-integration/pull/route.ts:L126`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/justdial-integration/pull/route.ts#L126) | `Enquiry` | `Enquiry.findOne({ primaryPhoneMobile })` | Prevents re-creating lead if phone number already exists in CRM. |
| [`src/app/api/admin/restore-akshita/route.ts:L12`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/admin/restore-akshita/route.ts#L12) | `Admission` | `Admission.findOne({ $or: [{ admissionId: "ADM000007" }, { mobileNumber: "9454960684" }] })` | Hardcoded phone matching in emergency restoration script. |
| [`src/lib/uppercaseMigration.ts:L210`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/lib/uppercaseMigration.ts#L210) | `Admission` | `Admission.findOne({ $or: [{ admissionId: "ADM000007" }, { mobileNumber: "9454960684" }] })` | Hardcoded phone lookup in migration script. |

---

## 4. Multi-Collection Writes & Transaction/Session Analysis

The SyncForge backend has **32 API route handlers** that write to two or more MongoDB collections during a single request lifecycle.

> [!CAUTION]
> **Zero (0) of the 32 multi-collection write routes use MongoDB transactions (`mongoose.startSession()`, `session.startTransaction()`, or `session.withTransaction()`).**  
> If an unhandled exception or database error occurs midway through any of these requests, previous writes are committed while subsequent writes fail, leaving orphaned payments, unsynced capacities, or mismatched student states.

| Route File Path | Collections Written To | Operations Performed | Transaction / Session Used? | Failure Risk Scenario |
| :--- | :--- | :--- | :---: | :--- |
| [`src/app/api/admissions/route.ts`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/admissions/route.ts) | `Admission`, `Enquiry`, `Payment`, `Task`, `Notification`, `Company` | 1. `admission.save()`<br>2. `enquiry.save()` (status -> Admitted)<br>3. `newRegPayment.save()`<br>4. `downpayment.save()`<br>5. `company.save()` (re-balance capacity)<br>6. `Task.create()` (4 EMI reminders)<br>7. `Notification.create()` (discount alert) | **NONE** (`false`) | Admission is created and company capacity is deducted, but if `Payment.save()` throws (e.g. unique receipt collision), student exists with ₹0 recorded payment. |
| [`src/app/api/admissions/[id]/route.ts`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/admissions/[id]/route.ts) | `Admission`, `Payment`, `Enquiry`, `Task`, `Company`, `Batch` | 1. `Admission.findOneAndUpdate()`<br>2. `Company.save()` (fee differential adjustments)<br>3. `Payment.updateMany()` (name cascade)<br>4. `Payment.save()` (reconciled first payment)<br>5. `Enquiry.updateMany()` (name/phone sync)<br>6. `Task.updateMany()` (name sync)<br>7. `Batch.updateMany()` (student removal) | **NONE** (`false`) | Admission fee is modified and company capacity updated, but if Enquiry sync errors, student names drift between CRM and Admission. |
| [`src/app/api/payments/route.ts`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/payments/route.ts) | `Payment`, `Admission`, `Company`, `Task` | 1. `payment.save()`<br>2. `Admission.updateOne()` (reduce `remainingBalance`)<br>3. `Company.save()` (accumulate `collectedRevenue`)<br>4. `Task.updateOne()` (mark EMI task completed) | **NONE** (`false`) | Payment record is inserted, but if `Admission.updateOne()` fails, the student's remaining balance is not reduced. |
| [`src/app/api/payments/[id]/route.ts`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/payments/[id]/route.ts) | `Payment`, `Admission`, `Company` | 1. `Payment.findOneAndUpdate()` / `deleteOne()`<br>2. `Admission.updateOne()` (restore balance)<br>3. `Company.save()` (refund/recalculate capacity) | **NONE** (`false`) | Payment is deleted, but company collected revenue is not refunded. |
| [`src/app/api/enquiries/route.ts`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/enquiries/route.ts) | `Enquiry`, `Task` | 1. `newEnquiry.save()`<br>2. `Task.create()` (welcome call task) | **NONE** (`false`) | Lead is saved, but follow-up task creation fails; lead becomes invisible to counsellor queue. |
| [`src/app/api/enquiries/google-form/route.ts`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/enquiries/google-form/route.ts) | `Enquiry`, `Task` | 1. `newEnquiry.save()`<br>2. `Task.create()` (auto-followup) | **NONE** (`false`) | Webhook acknowledges 200 OK, but task creation fails. |
| [`src/app/api/enquiries/justdial-webhook/route.ts`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/enquiries/justdial-webhook/route.ts) | `Enquiry`, `Task`, `JustdialLeadLog` | 1. `newEnquiry.save()`<br>2. `Task.create()`<br>3. `leadLog.save()` | **NONE** (`false`) | Audit log created without lead or vice-versa. |
| [`src/app/api/enquiries/mark-lost/route.ts`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/enquiries/mark-lost/route.ts) | `Enquiry`, `LostLeadCounter` | 1. `Enquiry.updateOne()` (status -> Lost)<br>2. `LostLeadCounter.updateOne()` | **NONE** (`false`) | Enquiry status marked Lost, but statistical counter not incremented. |
| [`src/app/api/counsellors/transfer/route.ts`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/counsellors/transfer/route.ts) | `Enquiry`, `Admission`, `Task` | 1. `Enquiry.updateMany()` (reassign advisor)<br>2. `Admission.updateMany()` (reassign counsellor)<br>3. `Task.updateMany()` (reassign pending tasks) | **NONE** (`false`) | Partial staff transfer: leads transferred, but admissions/tasks remain with previous counsellor. |
| [`src/app/api/batches/route.ts`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/batches/route.ts) | `Batch`, `User` | 1. `batch.save()`<br>2. `User.updateOne()` (assign batch to teacher) | **NONE** (`false`) | Batch exists, but teacher user record is not linked. |
| [`src/app/api/batches/[id]/route.ts`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/batches/[id]/route.ts) | `Batch`, `User` | 1. `Batch.findOneAndUpdate()`<br>2. `User.updateOne()` | **NONE** (`false`) | Teacher reassignment drift. |
| [`src/app/api/companies/route.ts`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/companies/route.ts) | `Company`, `Brand` | 1. `newCompany.save()`<br>2. `Brand.updateMany()` (bind company to brands) | **NONE** (`false`) | Company created, but brand mapping fails. |
| [`src/app/api/quotations/seed/route.ts`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/quotations/seed/route.ts) | `QuotationProfile`, `QuotationCustomer`, `QuotationProduct`, `Quotation`, `QuotationCounter` | Multi-collection bulk seed operations | **NONE** (`false`) | Partial seed corruption. |
| [`src/app/api/admin/capitalize-data/route.ts`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/admin/capitalize-data/route.ts) | `Company`, `Brand`, `Enquiry`, `Admission`, `Expense`, `Payment` | Bulk uppercase migration updates across 6 collections | **NONE** (`false`) | Script interruption leaves half the DB uppercase and half lowercase. |
| [`src/app/api/admin/sync-payment-companies/route.ts`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/admin/sync-payment-companies/route.ts) | `Admission`, `Payment`, `Company` | Synchronizes payment company with admission company | **NONE** (`false`) | Mismatches between payment company and company ledger. |
| [`src/app/api/admin/reconcile-collections/route.ts`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/admin/reconcile-collections/route.ts) | `Admission`, `Payment` | Reconciles remaining balance and payment particulars | **NONE** (`false`) | Partial ledger reconciliation. |

*(Remaining 16 multi-write routes follow this exact uncoordinated pattern).*

---

## 5. Money Fields and Their Data Types

Across the 34 models, 93 fields store monetary amounts, fees, taxes, or salary components.

### Critical Type Inconsistency:
- In [`src/models/Course.ts:L31`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Course.ts#L31), `fee` is declared as **`String`** (`required: true, trim: true`), whereas in [`src/models/Admission.ts:L48`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Admission.ts#L48), `courseFee` is declared as **`Number`**.
- In [`src/models/Enquiry.ts:L67`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Enquiry.ts#L67), `expectedCourseFee` is declared as **`String`** (default: `"₹0"`), while `actualAdmissionFee` is declared as **`Number`**.
- String-based currency strings with currency symbols (e.g. `"₹15,000"`) cannot be aggregated using MongoDB `$sum`, `$gt`, or `$avg` without custom string parsing.

### Complete Inventory of Monetary Fields:

| Model Name & File | Field Name | Declared Schema Type | Default / Constraints | Purpose |
| :--- | :--- | :---: | :--- | :--- |
| **`Admission.ts`** | `courseFee` | `Number` | `default: 0` | Base catalog course package fee |
| | `scholarshipAmount` | `Number` | `default: 0` | Academic scholarship granted |
| | `discountAmount` | `Number` | `default: 0` | Standard discount offered |
| | `additionalDiscount` | `Number` | `default: 0` | Special discretionary discount |
| | `totalDiscount` | `Number` | `default: 0` | Sum of all granted discounts |
| | `finalFee` | `Number` | `default: 0` | Net payable fee committed by student |
| | `maxDiscountLimitAtAdmission` | `Number` | `default: 0` | Snapshot of counsellor's allowed discount cap |
| | `amountReceivedToday` | `Number` | `default: 0` | Cash/online fee paid at time of enrollment |
| | `registrationAmount` | `Number` | `default: 0` | Initial registration fee tranche |
| | `downpaymentAmount` | `Number` | `default: 0` | Promised second installment amount |
| | `remainingBalance` | `Number` | `default: 0` | Outstanding balance (`finalFee - totalPayments`) |
| | `installmentAmount` | `Number` | `default: 0` | Standard EMI installment amount |
| | `customEmiPlan[].amount`| `Number` | None | Individual scheduled installment amount |
| | `ptpAmount` | `Number` | None | Promised-to-pay commitment amount |
| | `feeFollowups[].ptpAmount` | `Number` | None | Follow-up call promised payment amount |
| **`Company.ts`** | `annualCapacityCap` | `Number` | `default: 1949999` | ₹19.50 L statutory annual collection ceiling |
| | `collectedRevenue` | `Number` | `default: 0` | Active financial year accumulated revenue |
| **`CorporateTraining.ts`** | `totalAmount` | `Number` | `required: true` | Total institutional contract value |
| | `amountReceived` | `Number` | `default: 0` | Realized corporate invoice payments |
| | `remainingBalance` | `Number` | `default: 0` | Outstanding corporate balance |
| | `paymentMilestones[].amount` | `Number` | `required: true` | Milestone billing installment |
| **`Course.ts`** | `fee` | **`String`** | `required: true, trim: true` | **Catalog fee stored as String (e.g. "35000")** |
| | `maxDiscountLimit` | `Number` | `default: 5000` | Max discount counsellor can approve without admin |
| **`Counsellor.ts`** | `currentRevenue` | `Number` | `default: 0` | Monthly revenue closed by counsellor |
| **`Enquiry.ts`** | `expectedCourseFee` | **`String`** | `default: "₹0"` | **Prospect estimated budget stored as String** |
| | `actualAdmissionFee`| `Number` | `default: 0` | Final admission fee realized upon conversion |
| **`Expense.ts`** | `amount` | `Number` | `required: true, min: 0` | Outgoing center expense voucher amount |
| **`Notification.ts`** | `requestedDiscount` | `Number` | None | Requested discount requiring admin approval |
| | `maxAllowedDiscount`| `Number` | None | Permissible discount threshold |
| **`Payment.ts`** | `amountReceived` | `Number` | `required: true` | Net realized receipt payment amount |
| | `particulars.courseFeeDue` | `Number` | `default: 0` | Course fee component on receipt |
| | `particulars.registrationFeeDue`| `Number` | `default: 0` | Registration fee component on receipt |
| | `particulars.materialFeeDue` | `Number` | `default: 0` | Study material fee component |
| | `particulars.examFeeDue` | `Number` | `default: 0` | Certification/Exam fee component |
| **`Payroll.ts`** | `baseSalary` | `Number` | `required: true, min: 0` | Monthly base salary component |
| | `bonus` | `Number` | `default: 0, min: 0` | Performance bonus/incentive |
| | `deductions` | `Number` | `default: 0, min: 0` | Attendance/tax deductions |
| | `netSalary` | `Number` | `required: true` | Payout salary (`base + bonus - deductions`) |
| **`Quotation.ts`** | `items[].rate` | `Number` | `required: true, min: 0` | Line item unit price |
| | `items[].gstRate` | `Number` | `default: 18` | Line item GST tax rate percentage |
| | `items[].amount` | `Number` | `required: true` | Line item total amount |
| | `subtotal` | `Number` | `required: true, default: 0` | Commercial subtotal before tax |
| | `discount` | `Number` | `default: 0` | Total proposal discount |
| | `gstRate` | `Number` | `default: 18` | Effective proposal tax rate |
| | `gstAmount` | `Number` | `required: true, default: 0` | Calculated GST tax sum |
| | `grandTotal` | `Number` | `required: true, default: 0` | Final payable quotation total |
| | `amountInWords` | `String` | Optional | Currency formatted words string |
| **`ProformaInvoice.ts`**| `items[].rate` | `Number` | `required: true, min: 0` | PI line item unit rate |
| | `items[].gstRate` | `Number` | `default: 18` | PI line item GST rate |
| | `items[].amount` | `Number` | `required: true` | PI line item calculated total |
| | `subtotal` / `discount` / `gstAmount` / `grandTotal` | `Number` | `default: 0` | PI financial totals |
| **`PurchaseOrder.ts`** | `items[].rate` | `Number` | `required: true, min: 0` | PO line item unit rate |
| | `items[].gstRate` | `Number` | `default: 18` | PO line item GST rate |
| | `items[].amount` | `Number` | `required: true` | PO line item total |
| | `subtotal` / `discount` / `gstAmount` / `grandTotal` | `Number` | `default: 0` | PO financial totals |
| **`QuotationProduct.ts`**| `defaultRate` | `Number` | `required: true, default: 0` | Standard catalog service price |
| | `gstRate` | `Number` | `default: 18` | Catalog default GST rate |
| **`User.ts`** | `currentRevenue` | `Number` | `default: 0` | Revenue closed by staff user |

---

## 6. References to a Teacher Model or Collection

### Finding: No `Teacher` Model or Collection Exists
There is **no `Teacher.ts` file in [`src/models/`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models)**, nor is there a `teachers` collection registered in Mongoose.

### How Teachers Are Actually Implemented:
1. **Stored in the `users` Collection:**
   Teachers are regular `User` documents having `role: "teacher"`.
   In [`src/app/api/teachers/route.ts:L20-L31`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/teachers/route.ts#L20-L31):
   ```typescript
   import User from "@/models/User";
   ...
   const query: any = { role: "teacher" };
   const teachers = await User.find(query).select("-password").sort({ createdAt: -1 });
   ```
2. **References in Mongoose Schemas:**
   - [`src/models/Batch.ts:L30-L33`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Batch.ts#L30-L33):  
     `teacherId: { type: Schema.Types.ObjectId, ref: "User" }`  
     Indexed at line 99: `BatchSchema.index({ teacherId: 1, status: 1 });` and line 102: `BatchSchema.index({ teacherId: 1 });`.
   - [`src/models/Attendance.ts:L55-L58`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Attendance.ts#L55-L58):  
     `teacherId: { type: Schema.Types.ObjectId, ref: "User" }`  
     Indexed at line 102: `AttendanceSchema.index({ teacherId: 1 });`.
   - [`src/models/Notification.ts:L25-L28`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Notification.ts#L25-L28):  
     `targetTeacherId: { type: Schema.Types.ObjectId, ref: "User" }`  
     Indexed at line 71: `NotificationSchema.index({ targetTeacherId: 1, read: 1, createdAt: -1 });`.
   - [`src/models/Payroll.ts:L5`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Payroll.ts#L5):  
     `employeeRole: string; // e.g., Counsellor, Teacher, Centre Head, Staff, Admin`.
   - [`src/models/Enquiry.ts:L133`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Enquiry.ts#L133):  
     `demoTeacher: { type: String }` (stored as plain text string).
3. **API Endpoints Referencing Teachers:**
   - [`src/app/api/teachers/route.ts:L8-L41`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/teachers/route.ts#L8-L41): GET and POST operations querying and inserting `User` records with `role: "teacher"`.
   - [`src/app/api/teachers/[id]/route.ts:L14-L60`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/teachers/[id]/route.ts#L14-L60): PUT and DELETE operations targeting `User` by `_id`.
   - [`src/app/api/teacher-dashboard/stats/route.ts:L54`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/app/api/teacher-dashboard/stats/route.ts#L54): Resolves teacher user sessions to render faculty timetables and attendance metrics.

---

## 7. Existing Indexes Declared in Schemas

A total of **111 indexes** are declared across 26 models.

### Explicit Schema Indexes (`Schema.index(...)`):

#### 1. `Admission` (`admissions`)
- [`src/models/Admission.ts:L110`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Admission.ts#L110): `AdmissionSchema.index({ brand: 1, createdAt: -1 })`
- [`src/models/Admission.ts:L111`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Admission.ts#L111): `AdmissionSchema.index({ brand: 1, admissionDate: -1 })`
- [`src/models/Admission.ts:L112`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Admission.ts#L112): `AdmissionSchema.index({ counsellor: 1, createdAt: -1 })`
- [`src/models/Admission.ts:L113`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Admission.ts#L113): `AdmissionSchema.index({ batchId: 1, createdAt: -1 })`
- [`src/models/Admission.ts:L114`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Admission.ts#L114): `AdmissionSchema.index({ admissionDate: -1 })`
- [`src/models/Admission.ts:L115`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Admission.ts#L115): `AdmissionSchema.index({ mobileNumber: 1 })`
- [`src/models/Admission.ts:L116`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Admission.ts#L116): `AdmissionSchema.index({ createdAt: -1 })`

#### 2. `Attendance` (`attendances`)
- [`src/models/Attendance.ts:L101`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Attendance.ts#L101): `AttendanceSchema.index({ batchId: 1, dateStr: 1 }, { unique: true })`
- [`src/models/Attendance.ts:L102`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Attendance.ts#L102): `AttendanceSchema.index({ teacherId: 1 })`
- [`src/models/Attendance.ts:L103`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Attendance.ts#L103): `AttendanceSchema.index({ brand: 1 })`
- [`src/models/Attendance.ts:L104`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Attendance.ts#L104): `AttendanceSchema.index({ dateStr: 1 })`

#### 3. `Batch` (`batches`)
- [`src/models/Batch.ts:L98`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Batch.ts#L98): `BatchSchema.index({ brand: 1, status: 1 })`
- [`src/models/Batch.ts:L99`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Batch.ts#L99): `BatchSchema.index({ teacherId: 1, status: 1 })`
- [`src/models/Batch.ts:L100`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Batch.ts#L100): `BatchSchema.index({ batchId: 1 })`
- [`src/models/Batch.ts:L101`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Batch.ts#L101): `BatchSchema.index({ brand: 1 })`
- [`src/models/Batch.ts:L102`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Batch.ts#L102): `BatchSchema.index({ teacherId: 1 })`
- [`src/models/Batch.ts:L103`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Batch.ts#L103): `BatchSchema.index({ status: 1 })`
- [`src/models/Batch.ts:L104`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Batch.ts#L104): `BatchSchema.index({ course: 1 })`
- [`src/models/Batch.ts:L105`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Batch.ts#L105): `BatchSchema.index({ courses: 1 })`

#### 4. `Enquiry` (`enquiries`)
- [`src/models/Enquiry.ts:L186`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Enquiry.ts#L186): `EnquirySchema.index({ targetBrand: 1, createdAt: -1 })`
- [`src/models/Enquiry.ts:L187`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Enquiry.ts#L187): `EnquirySchema.index({ targetBrand: 1, status: 1, createdAt: -1 })`
- [`src/models/Enquiry.ts:L188`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Enquiry.ts#L188): `EnquirySchema.index({ assignedCrmAdvisor: 1, status: 1 })`
- [`src/models/Enquiry.ts:L189`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Enquiry.ts#L189): `EnquirySchema.index({ assignedCrmAdvisor: 1 })`
- [`src/models/Enquiry.ts:L190`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Enquiry.ts#L190): `EnquirySchema.index({ status: 1 })`
- [`src/models/Enquiry.ts:L191`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Enquiry.ts#L191): `EnquirySchema.index({ targetBrand: 1 })`
- [`src/models/Enquiry.ts:L192`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Enquiry.ts#L192): `EnquirySchema.index({ createdAt: -1 })`
- [`src/models/Enquiry.ts:L193`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Enquiry.ts#L193): `EnquirySchema.index({ primaryPhoneMobile: 1 })`

#### 5. `Expense` (`expenses`)
- [`src/models/Expense.ts:L47`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Expense.ts#L47): `ExpenseSchema.index({ brand: 1, expenseDate: -1, createdAt: -1 })`
- [`src/models/Expense.ts:L48`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Expense.ts#L48): `ExpenseSchema.index({ company: 1, expenseDate: -1 })`
- [`src/models/Expense.ts:L49`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Expense.ts#L49): `ExpenseSchema.index({ category: 1, expenseDate: -1 })`
- [`src/models/Expense.ts:L50`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Expense.ts#L50): `ExpenseSchema.index({ expenseDate: -1 })`

#### 6. `Notification` (`notifications`)
- [`src/models/Notification.ts:L70`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Notification.ts#L70): `NotificationSchema.index({ targetRole: 1, read: 1, createdAt: -1 })`
- [`src/models/Notification.ts:L71`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Notification.ts#L71): `NotificationSchema.index({ targetTeacherId: 1, read: 1, createdAt: -1 })`
- [`src/models/Notification.ts:L72`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Notification.ts#L72): `NotificationSchema.index({ read: 1, createdAt: -1 })`

#### 7. `OfficeLocation` (`officelocations`)
- [`src/models/OfficeLocation.ts:L38`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/OfficeLocation.ts#L38): `OfficeLocationSchema.index({ brand: 1 })`

#### 8. `Payment` (`payments`)
- [`src/models/Payment.ts:L57`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Payment.ts#L57): `PaymentSchema.index({ admissionId: 1, paymentDate: -1 })`
- [`src/models/Payment.ts:L58`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Payment.ts#L58): `PaymentSchema.index({ brand: 1, paymentDate: -1 })`
- [`src/models/Payment.ts:L59`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Payment.ts#L59): `PaymentSchema.index({ company: 1, paymentDate: -1 })`
- [`src/models/Payment.ts:L60`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Payment.ts#L60): `PaymentSchema.index({ paymentDate: -1 })`
- [`src/models/Payment.ts:L61`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Payment.ts#L61): `PaymentSchema.index({ admissionId: 1 })`
- [`src/models/Payment.ts:L62`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Payment.ts#L62): `PaymentSchema.index({ createdAt: -1 })`

#### 9. `Payroll` (`payrolls`)
- [`src/models/Payroll.ts:L47`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Payroll.ts#L47): `PayrollSchema.index({ brand: 1, month: -1 })`
- [`src/models/Payroll.ts:L48`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Payroll.ts#L48): `PayrollSchema.index({ company: 1, month: -1 })`
- [`src/models/Payroll.ts:L49`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Payroll.ts#L49): `PayrollSchema.index({ month: -1, paymentStatus: 1 })`
- [`src/models/Payroll.ts:L50`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Payroll.ts#L50): `PayrollSchema.index({ employeeName: 1 })`

#### 10. `ProformaInvoice` (`proformainvoices`)
- [`src/models/ProformaInvoice.ts:L169`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/ProformaInvoice.ts#L169): `ProformaInvoiceSchema.index({ companyId: 1, piNumber: 1 })`
- [`src/models/ProformaInvoice.ts:L170`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/ProformaInvoice.ts#L170): `ProformaInvoiceSchema.index({ companyId: 1, date: -1 })`

#### 11. `ProformaInvoiceCounter` (`proformainvoicecounters`)
- [`src/models/ProformaInvoiceCounter.ts:L18`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/ProformaInvoiceCounter.ts#L18): `ProformaInvoiceCounterSchema.index({ companyId: 1, financialYear: 1 }, { unique: true })`

#### 12. `PurchaseOrder` (`purchaseorders`)
- [`src/models/PurchaseOrder.ts:L170`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/PurchaseOrder.ts#L170): `PurchaseOrderSchema.index({ companyId: 1, poNumber: 1 })`
- [`src/models/PurchaseOrder.ts:L171`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/PurchaseOrder.ts#L171): `PurchaseOrderSchema.index({ companyId: 1, date: -1 })`

#### 13. `PurchaseOrderCounter` (`purchaseordercounters`)
- [`src/models/PurchaseOrderCounter.ts:L18`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/PurchaseOrderCounter.ts#L18): `PurchaseOrderCounterSchema.index({ companyId: 1, financialYear: 1 }, { unique: true })`

#### 14. `Quotation` (`quotations`)
- [`src/models/Quotation.ts:L162`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Quotation.ts#L162): `QuotationSchema.index({ companyId: 1, quotationNumber: 1 })`
- [`src/models/Quotation.ts:L163`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Quotation.ts#L163): `QuotationSchema.index({ companyId: 1, status: 1 })`
- [`src/models/Quotation.ts:L164`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Quotation.ts#L164): `QuotationSchema.index({ companyId: 1, date: -1 })`

#### 15. `QuotationCounter` (`quotationcounters`)
- [`src/models/QuotationCounter.ts:L23`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/QuotationCounter.ts#L23): `QuotationCounterSchema.index({ companyId: 1, financialYear: 1 }, { unique: true })`

#### 16. `StaffAttendance` (`staffattendances`)
- [`src/models/StaffAttendance.ts:L87`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/StaffAttendance.ts#L87): `StaffAttendanceSchema.index({ userId: 1, dateStr: 1 }, { unique: true })`
- [`src/models/StaffAttendance.ts:L88`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/StaffAttendance.ts#L88): `StaffAttendanceSchema.index({ dateStr: 1 })`
- [`src/models/StaffAttendance.ts:L89`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/StaffAttendance.ts#L89): `StaffAttendanceSchema.index({ role: 1 })`
- [`src/models/StaffAttendance.ts:L90`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/StaffAttendance.ts#L90): `StaffAttendanceSchema.index({ brand: 1 })`

#### 17. `Task` (`tasks`)
- [`src/models/Task.ts:L102`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Task.ts#L102): `TaskSchema.index({ status: 1, dueDate: 1 })`
- [`src/models/Task.ts:L103`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Task.ts#L103): `TaskSchema.index({ assignedTo: 1, status: 1, dueDate: 1 })`
- [`src/models/Task.ts:L104`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Task.ts#L104): `TaskSchema.index({ assignedTo: 1, dueDate: 1 })`
- [`src/models/Task.ts:L105`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Task.ts#L105): `TaskSchema.index({ assignedTo: 1 })`
- [`src/models/Task.ts:L106`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Task.ts#L106): `TaskSchema.index({ dueDate: 1 })`
- [`src/models/Task.ts:L107`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Task.ts#L107): `TaskSchema.index({ status: 1 })`
- [`src/models/Task.ts:L108`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/Task.ts#L108): `TaskSchema.index({ createdAt: -1 })`

#### 18. `User` (`users`)
- [`src/models/User.ts:L101`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/User.ts#L101): `UserSchema.index({ role: 1 })`
- [`src/models/User.ts:L102`](file:///c:/Users/singh/OneDrive/Desktop/Lead2leadure/src/models/User.ts#L102): `UserSchema.index({ brandScope: 1 })`

---

### Inline Unique Constraints & Single Field Indexes:
- **`Admission.ts:L7`**: `admissionId: { type: String, unique: true }`
- **`Admission.ts:L40`**: `batchId: { type: String, index: true }`
- **`Batch.ts:L7`**: `batchId: { type: String, unique: true, index: true }`
- **`Brand.ts:L47`**: `name: { type: String, required: true, unique: true }`
- **`Company.ts:L7`**: `companyId: { type: String, unique: true }`
- **`Company.ts:L11`**: `name: { type: String, unique: true }`
- **`CorporateTraining.ts:L20`**: `trainingId: { type: String, unique: true, index: true }`
- **`Counsellor.ts:L18`**: `name: { type: String, unique: true }`
- **`Counter.ts:L8`**: `name: { type: String, unique: true, index: true }`
- **`Course.ts:L13`**: `courseCode: { type: String, unique: true }`
- **`Enquiry.ts:L7`**: `enquiryId: { type: String, unique: true }`
- **`JustdialLeadLog.ts:L29`**: `mappedEnquiryId: { type: String, index: true }`
- **`JustdialLeadLog.ts:L44`**: `phone: { type: String, index: true }`
- **`JustdialLeadLog.ts:L55`**: `status: { type: String, index: true }`
- **`LeadSource.ts:L12`**: `name: { type: String, unique: true }`
- **`LostLeadCounter.ts:L8`**: `category: { type: String, unique: true }`
- **`Payment.ts:L7`**: `receiptNo: { type: String, unique: true }`
- **`ProformaInvoice.ts:L22`**: `companyId: { type: String, index: true }`
- **`ProformaInvoice.ts:L27`**: `piNumber: { type: String, index: true }`
- **`PurchaseOrder.ts:L22`**: `companyId: { type: String, index: true }`
- **`PurchaseOrder.ts:L27`**: `poNumber: { type: String, index: true }`
- **`Quotation.ts:L22`**: `companyId: { type: String, index: true }`
- **`Quotation.ts:L27`**: `quotationNumber: { type: String, index: true }`
- **`QuotationCounter.ts:L8`**: `companyId: { type: String, index: true }`
- **`QuotationCounter.ts:L13`**: `financialYear: { type: String, index: true }`
- **`QuotationCustomer.ts:L8`**: `companyId: { type: String, index: true }`
- **`QuotationProduct.ts:L8`**: `companyId: { type: String, index: true }`
- **`QuotationProduct.ts:L14`**: `itemCode: { type: String, index: true }`
- **`QuotationProfile.ts:L8`**: `companyId: { type: String, index: true }`
- **`ResponseType.ts:L13`**: `name: { type: String, unique: true }`
- **`Session.ts:L9`**: `userId: { type: Schema.Types.ObjectId, index: true }`
- **`Session.ts:L14`**: `token: { type: String, unique: true, index: true }`
- **`User.ts:L13`**: `email: { type: String, unique: true }`
