import mongoose from 'mongoose';

const companySchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true, // we'll use this for the frontend selectedCompanyId
    },
    name: {
      type: String,
      required: true,
    },
    industry: {
      type: String,
      default: 'Miscellaneous',
    },
    website: {
      type: String,
      default: '',
    },
    contacts: {
      type: String,
      default: 'N/A',
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
    }
  },
  {
    timestamps: true,
  }
);

const Company = mongoose.model('Company', companySchema);

export default Company;
