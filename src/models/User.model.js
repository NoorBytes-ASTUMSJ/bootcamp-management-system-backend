const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const validator = require("validator");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      validate: [validator.isEmail, "Please enter a valid email address"],
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },

    phone: {
      type: String,
      required: [true, "Phone is required"],
      trim: true,
    },

    role: {
      type: String,
      required: true,
      enum: ["admin", "mentor", "student", "user"],
      default: "user",
    },

    applicationType: {
      type: String,
      required: [true, "Application type is required"],
      enum: {
        values: ["student", "mentor"],
        message: "Application type must be student or mentor",
      },
    },

    gender: {
      type: String,
      required: [true, "Gender is required"],
      enum: {
        values: ["male", "female"],
        message: "Gender must be male or female",
      },
      lowercase: true,
      trim: true,
    },

    university: {
      type: String,
      required: [true, "University is required"],
      trim: true,
    },

    universityId: {
      type: String,
      required: [true, "University ID is required"],
      trim: true,
    },

    telegramUsername: {
      type: String,
      required: [true, "Telegram username is required"],
      trim: true,
    },

    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
    },

    year: {
      type: String,
      enum: ["1st", "2nd", "3rd", "4th", "5th"],
      required: [true, "Year is required"],
    },

    department: {
      type: String,
      trim: true,
      required: [
        function () {
          return this.year && this.year !== "1st";
        },
        "Department is required for non-1st year users",
      ],
    },

    github: {
      type: String,
      trim: true,
      required: [
        function () {
          return ["student", "mentor"].includes(this.applicationType);
        },
        "GitHub profile is required",
      ],
      validate: {
        validator: (v) => !v || validator.isURL(v),
        message: "Enter a valid GitHub URL",
      },
    },

    // --- STUDENT APPLICATION FIELDS ---

    codeforces: {
      type: String,
      trim: true,
      required: [
        function () {
          return this.applicationType === "student";
        },
        "Codeforces profile is required",
      ],
      validate: {
        validator: (v) => !v || validator.isURL(v),
        message: "Enter a valid Codeforces URL",
      },
    },

    leetcode: {
      type: String,
      trim: true,
      required: [
        function () {
          return this.applicationType === "student";
        },
        "LeetCode profile is required",
      ],
      validate: {
        validator: (v) => !v || validator.isURL(v),
        message: "Enter a valid LeetCode URL",
      },
    },

    dailyAvailableHours: {
      type: Number,
      min: [0, "Hours cannot be negative"],
      max: [16, "Hours cannot exceed 16"],
      required: [
        function () {
          return this.applicationType === "student";
        },
        "Daily available hours is required",
      ],
    },

    availabilityDescription: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
      required: [
        function () {
          return this.applicationType === "student";
        },
        "Availability description is required",
      ],
    },

    // --- COMMON APPLICATION FIELD ---

    motivation: {
      type: String,
      trim: true,
      maxlength: [1000, "Motivation cannot exceed 1000 characters"],
      required: [
        function () {
          return ["student", "mentor"].includes(this.applicationType);
        },
        "Motivation is required",
      ],
    },

    // --- MENTOR APPLICATION FIELDS ---

    experience: {
      type: String,
      trim: true,
      required: [
        function () {
          return this.applicationType === "mentor";
        },
        "Experience is required",
      ],
    },

    expertise: {
      type: String,
      enum: {
        values: ["DSA", "Development"],
        message: "Expertise must be DSA or Development",
      },
      required: [
        function () {
          return this.applicationType === "mentor";
        },
        "Expertise is required",
      ],
    },

    // --- PASSWORD RESET OTP FIELDS ---

    resetPasswordOTP: {
      type: String,
      default: null,
    },

    resetPasswordExpires: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// Password Hashing Middleware
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
