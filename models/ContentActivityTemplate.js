import mongoose from "mongoose";

const ContentActivityTemplateSchema = new mongoose.Schema(
  {
    activityName: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      default: "Content",
      required: true,
    },
    description: {
      type: String,
    },
    isFixed: {
      type: Boolean,
      default: false,
    },
    dailyExpiry: {
      type: Boolean,
      default: false,
    },
},
  { timestamps: true },
);

const ContentActivityTemplate = mongoose.model("ContentActivityTemplate", ContentActivityTemplateSchema);
export default ContentActivityTemplate;
