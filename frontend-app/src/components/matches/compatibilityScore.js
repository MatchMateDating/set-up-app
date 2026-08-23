import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { HelpCircle } from "lucide-react";
import './compatibilityScore.css';

export default function CompatibilityScore({ score, variant = 'default' }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const iconRef = useRef(null);
  const isOverlay = variant === 'overlay';

  const toggleTooltip = () => setShowTooltip((prev) => !prev);

  useEffect(() => {
    if (showTooltip && iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      setPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 10,
      });
    }
  }, [showTooltip]);

  return (
    <div className={`compatibility-container${isOverlay ? ' compatibility-overlay' : ''}`}>
      <span className={`compatibility-text${isOverlay ? ' compatibility-text-overlay' : ''}`}>
        Compatibility: {score}%
      </span>

      {!isOverlay && (
        <div className="help-icon-container">
          <HelpCircle
            ref={iconRef}
            className="help-icon"
            onClick={toggleTooltip}
          />
        </div>
      )}

      {showTooltip &&
        createPortal(
          <div
            className="tooltip"
            style={{
              position: "fixed",
              top: `${position.y}px`,
              left: `${position.x}px`,
              transform: "translate(-50%, -100%)",
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
