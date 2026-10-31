import mongoose from "mongoose";

const trackedLinkSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    destinationUrl: {
      type: String,
      required: true,
      trim: true,
    },
    shortCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    platform: {
      type: String,
      enum: ["whatsapp", "instagram", "facebook", "linkedin", "email", "ads", "website", "other"],
      default: "other",
    },
    campaign: {
      type: String,
      default: "general",
      trim: true,
    },
    companyId: {
      type: String,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    clicksCount: {
      type: Number,
      default: 0,
    },
    uniqueClicksCount: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const TrackedLink = mongoose.model("TrackedLink", trackedLinkSchema);

export default TrackedLink;
