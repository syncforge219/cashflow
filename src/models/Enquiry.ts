import mongoose, { Schema } from "mongoose";
import { softDeletePlugin } from "@/lib/softDeletePlugin";

const EnquirySchema = new Schema(
  {
    enquiryId: {
      type: String,
      unique: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      index: true,
      default: null,
    },
    date: {
      type: String,
      trim: true,
    },
    studentFullName: {
      type: String,
      trim: true,
    },
    primaryPhoneMobile: {
      type: String,
      trim: true,
    },
    parentsFullName: {
      type: String,
      trim: true,
    },
    parentsPhoneNumber: {
      type: String,
      trim: true,
    },
    emailAddress: {
      type: String,
      trim: true,
      lowercase: true,
    },
    currentCity: {
      type: String,
      trim: true,
    },
    targetBrand: {
      type: String,
    },
    targetBrandId: {
      type: Schema.Types.ObjectId,
      ref: "Brand",
    },
    targetCourse: {
      type: String,
      trim: true,
    },
    targetCourses: [
      {
        type: String,
        trim: true,
      },
    ],
    courses: [
      {
        type: String,
        trim: true,
      },
    ],
    isLookingForJob: {
      type: Boolean,
      default: false,
    },
    assignedCrmAdvisor: {
      type: String,
    },
    assignedCrmAdvisorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    leadSource: {
      type: String,
    },
    expectedCourseFee: {
      type: String,
      default: "₹0",
    },
    actualAdmissionFee: {
      type: Number,
      default: 0,
    },
    priorityLevel: {
      type: String,
      default: "Medium",
    },
    remarks: {
      type: String,
    },
    followUps: [
      {
        date: String,
        time: String,
        priority: { type: String, default: "Medium" }, // Urgent, High, Medium, Low
        typeOfContact: String, // Telephonic, WhatsApp, Email, Walkin, Campus Visit
        remarks: String,
        nextAction: String,
        assignedTo: String,
        status: { type: String, default: "Pending" }, // Pending, Completed, Rescheduled, Missed, Cancelled, In Progress
        plannedBy: String,
        isCompleted: { type: Boolean, default: false },
        isRecurring: { type: Boolean, default: false },
        recurringRule: String, // e.g. "3_days", "7_days", "14_days", "30_days"
        escalatedToManager: { type: Boolean, default: false },
        escalatedAt: Date,
        completedAt: Date,
        callStart: String,
        callEnd: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    followUpNotes: {
      type: String,
    },
    followUpDate: {
      type: String,
    },
    demos: [
      {
        date: String,
        time: String,
        mode: String,
        notes: String,
        status: { type: String, default: "Scheduled" },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    isDemoScheduled: {
      type: Boolean,
      default: false,
    },
    demoDate: {
      type: String,
    },
    demoTime: {
      type: String,
    },
    demoNotes: {
      type: String,
    },
    demoTeacher: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      default: "New",
    },
    // Who brought this lead in: the user who added it, or the marketing user who set up the
    // connector it arrived through. Marketing Executives see only their own leads.
    addedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },
    addedByName: {
      type: String,
      trim: true,
      default: "",
    },
    // Marketing Suite & Lead Management Enhancements
    leadScore: {
      type: Number,
      default: 50,
    },
    leadTags: [
      {
        type: String,
        trim: true,
      },
    ],
    utmSource: {
      type: String,
      trim: true,
    },
    utmMedium: {
      type: String,
      trim: true,
    },
    utmCampaign: {
      type: String,
      trim: true,
    },
    campaignId: {
      type: String,
      trim: true,
    },
    lostReason: {
      type: String,
      trim: true,
    },
    reEngagementStatus: {
      type: String,
      default: "None",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

import { getNextSequence } from "@/lib/sequenceHelper";

// Performance & Compound Indexes
EnquirySchema.index({ targetBrandId: 1, createdAt: -1 });
EnquirySchema.index({ targetBrandId: 1, status: 1, createdAt: -1 });
EnquirySchema.index({ assignedCrmAdvisorId: 1, status: 1 });
EnquirySchema.index({ targetBrandId: 1 });
EnquirySchema.index({ assignedCrmAdvisorId: 1 });
EnquirySchema.index({ targetBrand: 1, createdAt: -1 });
EnquirySchema.index({ targetBrand: 1, status: 1, createdAt: -1 });
EnquirySchema.index({ assignedCrmAdvisor: 1, status: 1 });
EnquirySchema.index({ assignedCrmAdvisor: 1 });
EnquirySchema.index({ status: 1 });
EnquirySchema.index({ targetBrand: 1 });
EnquirySchema.index({ createdAt: -1 });
EnquirySchema.index({ primaryPhoneMobile: 1 });

import { syncEnquiryRefs } from "@/lib/referenceHelper";
import { findOrCreateStudentForEnquiry } from "@/lib/studentHelper";

// Atomic Auto-generate enquiryId before saving if not present using document's transaction session
EnquirySchema.pre("save", async function () {
  const session = this.$session();

  // Dual-write synchronization between strings and ObjectIds
  await syncEnquiryRefs(this, session);

  if (this.isNew && !this.studentId) {
    this.studentId = await findOrCreateStudentForEnquiry(this, session);
  }

  if (!this.enquiryId) {
    this.enquiryId = await getNextSequence(
      "enquiryId",
      "ENQ",
      6,
      async () => {
        const query = mongoose.models.Enquiry.findOne({
          enquiryId: /^ENQ\d+$/
        }).sort({ enquiryId: -1 });
        if (session) query.session(session);
        const lastEnquiry = await query;

        if (lastEnquiry && lastEnquiry.enquiryId) {
          const match = lastEnquiry.enquiryId.match(/^ENQ(\d+)$/);
          if (match) {
            return parseInt(match[1], 10);
          }
        }
        return 0;
      },
      session
    );
  }
});

EnquirySchema.pre(["findOneAndUpdate", "updateOne"], async function () {
  const update = this.getUpdate() as any;
  if (update) {
    const session = this.getOptions()?.session;
    const target = update.$set || update;
    await syncEnquiryRefs(target, session);
  }
});

EnquirySchema.plugin(softDeletePlugin);

// Clear the mongoose model if it already exists to fix Next.js HMR caching old hooks
if (mongoose.models.Enquiry) {
  delete mongoose.models.Enquiry;
}
const Enquiry = mongoose.model("Enquiry", EnquirySchema);

export default Enquiry;

