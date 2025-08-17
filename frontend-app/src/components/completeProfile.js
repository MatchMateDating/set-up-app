import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import './completeProfile.css'; 

const CompleteProfile = () => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    birthdate: "",
    gender: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    // Basic validation
    const today = new Date();
    if (new Date(formData.birthdate) > today) {
      setError("Birthdate cannot be in the future.");
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/profile/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error("Failed to update profile");

      setSuccess("Profile updated successfully 🎉");
      setTimeout(() => navigate("/profile"), 1200);
    } catch (err) {
      console.error(err);
      setError("Error saving profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="complete-profile-container">
      <h2 className="text-2xl font-semibold text-center mb-6">
        Complete Your Profile
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Birthdate</label>
          <input
            type="date"
            name="birthdate"
            value={formData.birthdate}
            onChange={handleChange}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring focus:ring-blue-200"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Gender</label>
          <select
            name="gender"
            value={formData.gender}
            onChange={handleChange}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring focus:ring-blue-200"
          >
            <option value="">Select gender</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="nonbinary">Non-binary</option>
            <option value="prefer_not">Prefer not to say</option>
          </select>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}
        {success && <p className="text-green-600 text-sm">{success}</p>}

        <button
          type="submit"
          disabled={loading}
          className="continue-btn"
        >
          {loading ? "Saving..." : "Continue"}
        </button>
      </form>
    </div>
  );
};

export default CompleteProfile;
