import mongoose from "mongoose";

const EmployeeTargetSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    companyId: {
      type: String,
      required: false,
    },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TaskTemplate",
    },
    targetType: {
      type: String,
      enum: ["SMM", "SEO", "Content", "Sales", "Creative"],
      default: "SMM",
    },
    customName: {
      type: String,
    },
    platform: {
      type: String,
      enum: ["Meta", "YouTube", "Both"],
      required: false,
    },
    metric: {
      type: String,
      enum: ["PostCount", "TotalViews", "TotalLikes", "TotalComments"],
      required: false,
    },
    monthlyTarget: {
      type: Number,
      required: false,
    },
    weeklyTarget: {
      type: Number,
      required: false,
    },
    frequency: {
      type: String,
      enum: ["Daily", "Weekly", "Monthly"],
      required: false,
    },
    targetGoal: {
      type: String,
      required: false,
    },
    expected: {
      type: String,
      required: false,
    },
    currentValue: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["In Progress", "Completed", "Failed"],
      default: "In Progress",
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    isLegacyInternData: {
      type: Boolean,
      default: false,
    },
    delegations: [
      {
        internId: { type: String, required: true },
        targetQuantity: { type: Number, required: true },
        notes: { type: String }
      }
    ]
  },
  { timestamps: true },
);

const EmployeeTarget = mongoose.model("EmployeeTarget", EmployeeTargetSchema);
export default EmployeeTarget;
