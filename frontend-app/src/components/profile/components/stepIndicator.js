import './stepIndicator.css';

export const StepIndicator = ({ step }) => {
    const steps = [
        { number: 1, label: "Setup" },
        { number: 2, label: "Preview" },
        { number: 3, label: "Preferences" }
    ];

    return (
        <div className="step-indicator">
        {steps.map((s) => (
            <div
            key={s.number}
            className={`step-item ${step === s.number ? "active" : ""}`}
            >
            <div className="step-number">{s.number}</div>
            <div className="step-label">{s.label}</div>
            </div>
        ))}
        </div>
    );
};