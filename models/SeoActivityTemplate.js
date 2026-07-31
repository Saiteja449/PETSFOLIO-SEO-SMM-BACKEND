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
  },
  { timestamps: true },
);

const SeoActivityTemplate = mongoose.model("SeoActivityTemplate", SeoActivityTemplateSchema);
export default SeoActivityTemplate;
