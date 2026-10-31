import mongoose from "mongoose";

const leadSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    companyId: {
      type: String,
      default: "",
    },
    source: {
      type: String,
      enum: ["seo", "instagram", "facebook", "linkedin", "whatsapp", "website", "ads", "referral", "direct", "other"],
      default: "website",
    },
    status: {
      type: String,
      enum: ["new", "contacted", "follow_up", "interested", "qualified", "converted", "lost"],
      default: "new",
      index: true,
    },
    dealValue: {
      type: Number,
      default: 0,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    convertedAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

const Lead = mongoose.model("Lead", leadSchema);

export default Lead;

