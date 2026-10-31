import mongoose from "mongoose";

const linkClickSchema = new mongoose.Schema(
  {
    linkId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TrackedLink",
      required: true,
      index: true,
    },
    shortCode: {
      type: String,
      required: true,
    },
    platform: {
      type: String,
      default: "other",
    },
    ipHash: {
      type: String,
      required: true,
    },
    deviceType: {
      type: String,
      enum: ["mobile", "desktop", "tablet", "other"],
      default: "desktop",
    },
    browser: {
      type: String,
      default: "Other",
    },
    referrer: {
      type: String,
      default: "",
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const LinkClick = mongoose.model("LinkClick", linkClickSchema);

export default LinkClick;

