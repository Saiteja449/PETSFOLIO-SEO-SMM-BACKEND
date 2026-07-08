import mongoose from "mongoose";

const gaPropertySchema = new mongoose.Schema({
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "GoogleAccount",
    required: true,
  },
  companyId: {
    type: String,
    required: true,
  },
  propertyId: {
    type: String,
    required: true,
  },
  propertyName: {
    type: String,
    required: true,
  },
  connectedAt: {
    type: Date,
    default: Date.now,
  },
});

const GaProperty = mongoose.model("GaProperty", gaPropertySchema);
export default GaProperty;
