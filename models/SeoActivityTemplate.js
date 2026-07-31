import mongoose from "mongoose";

const SeoActivityTemplateSchema = new mongoose.Schema(
  {
    activityName: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      default: "SEO",
      required: true,
    },
    description: {
      type: String,
    },
    isFixed: {
      type: Boolean,
      default: false,
    },
    defaultFrequency: {
      type: String,
      enum: ["Daily", "Weekly", "Monthly"],
      required: false,
    },
    defaultTargetGoal: {
      type: String,
      required: false,
    },
    companyOverrides: [
      {
        companyId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Company",
        },
        frequency: {
          type: String,
          enum: ["Daily", "Weekly", "Monthly"],
        },
        targetGoal: {
          type: String,
        },
      }
    ],
  },
  { timestamps: true },
);

const SeoActivityTemplate = mongoose.model("SeoActivityTemplate", SeoActivityTemplateSchema);
export default SeoActivityTemplate;
