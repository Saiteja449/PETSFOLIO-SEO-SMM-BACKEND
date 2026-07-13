import mongoose from "mongoose";

const companySchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    industry: {
      type: String,
      default: "Miscellaneous",
    },
    website: {
      type: String,
      default: "",
    },
    ga4PropertyId: {
      type: String,
      default: "",
    },
    gscSiteUrl: {
      type: String,
      default: "",
    },
    employeesCount: {
      type: Number,
      default: 0,
    },
    addedDate: {
      type: Date,
      default: Date.now,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

const Company = mongoose.model("Company", companySchema);

export default Company;
