import mongoose, { Schema } from "mongoose";

const EnquirySchema = new Schema(
  {
    enquiryId: {
      type: String,
      unique: true,
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
    assignedCrmAdvisor: {
      type: String,
    },
    leadSource: {
      type: String,
    },
    expectedCourseFee: {
      type: String,
      default: "₹0",
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

// Performance Indexes
EnquirySchema.index({ assignedCrmAdvisor: 1 });
EnquirySchema.index({ status: 1 });
EnquirySchema.index({ targetBrand: 1 });
EnquirySchema.index({ createdAt: -1 });
EnquirySchema.index({ primaryPhoneMobile: 1 });

// Auto-generate enquiryId before saving if not present
EnquirySchema.pre("save", async function () {
  if (!this.enquiryId) {
    const lastEnquiry = await mongoose.models.Enquiry.findOne({
      enquiryId: /^ENQ\d+$/
    }).sort({ enquiryId: -1 });

    let nextNumber = 1;
    if (lastEnquiry && lastEnquiry.enquiryId) {
      const match = lastEnquiry.enquiryId.match(/^ENQ(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    
    this.enquiryId = `ENQ${String(nextNumber).padStart(6, "0")}`;
  }
});

// Clear the mongoose model if it already exists to fix Next.js HMR caching old hooks
if (mongoose.models.Enquiry) {
  delete mongoose.models.Enquiry;
}
const Enquiry = mongoose.model("Enquiry", EnquirySchema);

export default Enquiry;
