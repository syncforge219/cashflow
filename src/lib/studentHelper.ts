import mongoose from "mongoose";
import Student from "@/models/Student";
import Enquiry from "@/models/Enquiry";

/**
 * Normalizes phone numbers to a clean 10-digit Indian mobile format.
 */
export function normalizePhone(rawPhone: any): string {
  if (!rawPhone) return "";
  const cleaned = String(rawPhone).replace(/\D/g, "");
  if (cleaned.length === 10) {
    return cleaned;
  }
  if (cleaned.length > 10 && cleaned.startsWith("91")) {
    return cleaned.slice(-10);
  }
  if (cleaned.length > 10 && cleaned.startsWith("0")) {
    return cleaned.slice(-10);
  }
  return cleaned.slice(-10);
}

/**
 * Ensures every new Enquiry has a valid studentId.
 * Creates a Student master record if studentId is not supplied.
 */
export async function findOrCreateStudentForEnquiry(
  enquiryDocOrData: any,
  session?: mongoose.ClientSession | null
): Promise<mongoose.Types.ObjectId> {
  if (enquiryDocOrData.studentId && mongoose.Types.ObjectId.isValid(String(enquiryDocOrData.studentId))) {
    return new mongoose.Types.ObjectId(String(enquiryDocOrData.studentId));
  }

  const phone = normalizePhone(
    enquiryDocOrData.primaryPhoneMobile ||
    enquiryDocOrData.phone ||
    enquiryDocOrData.mobileNumber
  );

  const fullName = (
    enquiryDocOrData.studentFullName ||
    enquiryDocOrData.fullName ||
    "New Lead"
  ).trim();

  // Create new Student document
  const studentPayload: any = {
    fullName,
    primaryPhone: phone || "0000000000",
    alternatePhone: enquiryDocOrData.alternatePhoneMobile || "",
    email: (enquiryDocOrData.emailAddress || enquiryDocOrData.email || "").toLowerCase().trim(),
    parentName: (enquiryDocOrData.parentsFullName || enquiryDocOrData.parentName || "").trim(),
    parentPhone: normalizePhone(enquiryDocOrData.parentsPhoneNumber || enquiryDocOrData.parentPhone || ""),
    guardian2Name: enquiryDocOrData.guardian2Name || "",
    guardian2Phone: normalizePhone(enquiryDocOrData.guardian2Phone || ""),
    city: enquiryDocOrData.currentCity || enquiryDocOrData.city || "",
    address: enquiryDocOrData.locationArea || enquiryDocOrData.address || "",
    status: "ACTIVE",
  };

  const student = new Student(studentPayload);
  if (session) {
    await student.save({ session });
  } else {
    await student.save();
  }

  return student._id as mongoose.Types.ObjectId;
}

/**
 * Ensures every new Admission has a valid studentId.
 * - Reuses the linked Enquiry's studentId if enquiryId is provided.
 * - Creates a new Student master record if direct admission without enquiry.
 */
export async function resolveStudentForAdmission(
  admissionDocOrData: any,
  session?: mongoose.ClientSession | null
): Promise<mongoose.Types.ObjectId> {
  // If studentId is already explicitly provided, use it
  if (admissionDocOrData.studentId && mongoose.Types.ObjectId.isValid(String(admissionDocOrData.studentId))) {
    return new mongoose.Types.ObjectId(String(admissionDocOrData.studentId));
  }

  // 1. If linked to an Enquiry, reuse Enquiry's studentId (or create one for the Enquiry and reuse)
  if (admissionDocOrData.enquiryId && mongoose.Types.ObjectId.isValid(String(admissionDocOrData.enquiryId))) {
    const q = Enquiry.findById(admissionDocOrData.enquiryId);
    if (session) q.session(session);
    const linkedEnq = await q;

    if (linkedEnq) {
      if (linkedEnq.studentId && mongoose.Types.ObjectId.isValid(String(linkedEnq.studentId))) {
        return new mongoose.Types.ObjectId(String(linkedEnq.studentId));
      }

      // Enquiry lacks studentId; create Student from Enquiry and link both
      const newStudentId = await findOrCreateStudentForEnquiry(linkedEnq, session);
      linkedEnq.studentId = newStudentId;
      if (session) {
        await linkedEnq.save({ session });
      } else {
        await linkedEnq.save();
      }
      return newStudentId;
    }
  }

  // 2. Direct Admission without Enquiry: create a new Student record
  const phone = normalizePhone(
    admissionDocOrData.mobileNumber ||
    admissionDocOrData.primaryPhoneMobile ||
    admissionDocOrData.phone
  );

  const fullName = (
    admissionDocOrData.fullName ||
    admissionDocOrData.studentFullName ||
    "Enrolled Student"
  ).trim();

  const studentPayload: any = {
    fullName,
    primaryPhone: phone || "0000000000",
    alternatePhone: admissionDocOrData.alternatePhoneMobile || "",
    email: (admissionDocOrData.email || "").toLowerCase().trim(),
    parentName: (admissionDocOrData.parentName || admissionDocOrData.parentsFullName || "").trim(),
    parentPhone: normalizePhone(admissionDocOrData.parentPhone || admissionDocOrData.parentsPhoneNumber || ""),
    guardian2Name: admissionDocOrData.guardian2Name || "",
    guardian2Phone: normalizePhone(admissionDocOrData.guardian2Phone || ""),
    city: admissionDocOrData.city || "",
    address: admissionDocOrData.address || "",
    dob: admissionDocOrData.dob || "",
    gender: admissionDocOrData.gender || "",
    status: "ACTIVE",
  };

  const student = new Student(studentPayload);
  if (session) {
    await student.save({ session });
  } else {
    await student.save();
  }

  return student._id as mongoose.Types.ObjectId;
}

/**
 * Interim Cascade Bridge:
 * Until Phase 4 is complete, updates made to an Admission also update the linked Student record.
 */
export async function syncPrompt1CascadeToStudent(
  studentId: any,
  updatedFields: {
    fullName?: string;
    mobileNumber?: string;
    email?: string;
    city?: string;
    parentName?: string;
    parentsFullName?: string;
    parentPhone?: string;
    parentsPhoneNumber?: string;
  },
  session?: mongoose.ClientSession | null
): Promise<void> {
  if (!studentId || !mongoose.Types.ObjectId.isValid(String(studentId))) return;

  const update: any = {};
  if (updatedFields.fullName) update.fullName = updatedFields.fullName.trim();
  if (updatedFields.mobileNumber) update.primaryPhone = normalizePhone(updatedFields.mobileNumber);
  if (updatedFields.email) update.email = updatedFields.email.toLowerCase().trim();
  if (updatedFields.city) update.city = updatedFields.city.trim();
  if (updatedFields.parentName || updatedFields.parentsFullName) {
    update.parentName = (updatedFields.parentName || updatedFields.parentsFullName || "").trim();
  }
  if (updatedFields.parentPhone || updatedFields.parentsPhoneNumber) {
    update.parentPhone = normalizePhone(updatedFields.parentPhone || updatedFields.parentsPhoneNumber || "");
  }

  if (Object.keys(update).length === 0) return;

  const q = Student.updateOne({ _id: new mongoose.Types.ObjectId(String(studentId)) }, { $set: update });
  if (session) q.session(session);
  await q;
}
