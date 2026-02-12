// src/components/editToolbar.js
import './editToolbar.css';
import { FaThLarge, FaThList } from "react-icons/fa";

export const editToolbar = ({ formData, handleInputChange }) => {
  // Fixed permanent list — keeps same order always
  const fontOptions = [
    'Arial',
    'Times New Roman',
    'Courier New',
    'Georgia',
    'Verdana',
    'Tahoma',
    'Trebuchet MS',
    'Press Start 2P',
    'Pinyon Script'
  ];

  return (
    <div className="edit-toolbar">
      <div className="toolbar-item">
        <select
          name="fontFamily"
          value={formData.fontFamily}
          onChange={handleInputChange}
          className="toolbar-select"
        >
          {fontOptions.map(f => (
            <option key={f} value={f} style={{ fontFamily: f }}>
              {f}
            </option>
          ))}
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
          <option value="pixelClouds">Pixel Clouds</option>
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
};

