import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { HelpCircle } from "lucide-react";
import './compatibilityScore.css';

export default function CompatibilityScore({ score }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const iconRef = useRef(null);

  const toggleTooltip = () => setShowTooltip((prev) => !prev);

  useEffect(() => {
    if (showTooltip && iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      setPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 10, // 10px above the icon
      });
    }
  }, [showTooltip]);

  return (
    <div className="compatibility-container">
      <span className="compatibility-text">Compatibility: {score}%</span>

      <div className="help-icon-container">
        <HelpCircle
          ref={iconRef}
          className="help-icon"
          onClick={toggleTooltip}
        />
      </div>

      {/* Portal for tooltip (so it floats above everything) */}
      {showTooltip &&
        createPortal(
          <div
            className="tooltip"
            style={{
              position: "fixed",
              top: `${position.y}px`,
              left: `${position.x}px`,
              transform: "translate(-50%, -100%)", // center horizontally, pop above icon
            }}
          >
            <p>
              This compatibility score is based on conversation analysis.
            </p>
            <div className="tooltip-arrow" />
          </div>,
          document.body
        )}
    </div>
  );
}
