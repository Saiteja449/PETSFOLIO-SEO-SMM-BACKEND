import mongoose from "mongoose";

const SalesActivityTemplateSchema = new mongoose.Schema(
  {
    activityName: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      default: "Sales",
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

const SalesActivityTemplate = mongoose.model("SalesActivityTemplate", SalesActivityTemplateSchema);
export default SalesActivityTemplate;
