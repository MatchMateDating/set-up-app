// src/components/editToolbar.js
import './editToolbar.css';
import { FaThLarge, FaThList } from "react-icons/fa";

export const editToolbar = ({ formData, handleInputChange, editing }) => (
  <div className="edit-toolbar">
    <div className="toolbar-item">
      <select
        name="fontFamily"
        value={formData.fontFamily}
        onChange={handleInputChange}
        className="toolbar-select"
      >
        <option value="Arial" style={{ fontFamily: "Arial" }}>Arial</option>
        <option value="Times New Roman" style={{ fontFamily: "Times New Roman" }}>Times New Roman</option>
        <option value="Courier New" style={{ fontFamily: "Courier New" }}>Courier New</option>
        <option value="Georgia" style={{ fontFamily: "Georgia" }}>Georgia</option>
        <option value="Verdana" style={{ fontFamily: "Verdana" }}>Verdana</option>
        <option value="Tahoma" style={{ fontFamily: "Tahoma" }}>Tahoma</option>
        <option value="Trebuchet MS" style={{ fontFamily: "Trebuchet MS" }}>Trebuchet MS</option>
      </select>
    </div>

    <div className="toolbar-item">
      <select
        name="profileStyle"
        value={formData.profileStyle}
        onChange={handleInputChange}
        className="toolbar-select"
      >
        <option value="classic">Classic Card</option>
        <option value="minimal">Minimalist</option>
        <option value="bold">Bold Header</option>
        <option value="framed">Framed</option>
        <option value="pixel">Pixel Theme</option>
        <option value="constitution">Constitution Theme</option>
      </select>
    </div>

    <div className="toolbar-item layout-toggle">
      <button
        type="button"
        className={`layout-btn ${formData.imageLayout === "grid" ? "active" : ""}`}
        onClick={() =>
          handleInputChange({ target: { name: "imageLayout", value: "grid" } })
        }
      >
        <FaThLarge />
      </button>
      <button
        type="button"
        className={`layout-btn ${formData.imageLayout === "vertical" ? "active" : ""}`}
        onClick={() =>
          handleInputChange({ target: { name: "imageLayout", value: "vertical" } })
        }
      >
        <FaThList />
      </button>
    </div>
  </div>
);
