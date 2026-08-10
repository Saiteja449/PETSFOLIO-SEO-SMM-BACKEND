import mongoose from "mongoose";

const CreativeActivityTemplateSchema = new mongoose.Schema(
  {
    activityName: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      default: "Creative",
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

const CreativeActivityTemplate = mongoose.model("CreativeActivityTemplate", CreativeActivityTemplateSchema);
export default CreativeActivityTemplate;
