import { useState } from "react";
import { passwordStrength } from "../../services/authErrors";
import "../../styles/auth-extra.css";

// Campo de senha com botão "mostrar/ocultar" e (opcional) indicador de força.
export default function PasswordField({ label, value, onChange, autoComplete, showStrength = false, required = true, disabled = false, id }) {
  const [visible, setVisible] = useState(false);
  const strength = showStrength ? passwordStrength(value) : null;
  const fieldId = id || `pw-${label.toLowerCase().replace(/\W+/g, "-")}`;

  return (
    <div className="auth-field">
      <label htmlFor={fieldId}>{label}</label>
      <div className="auth-password">
        <input
          id={fieldId}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete}
        />
        <button type="button" className="auth-eye" onClick={() => setVisible((current) => !current)} aria-label={visible ? "Ocultar senha" : "Mostrar senha"} aria-pressed={visible}>
          {visible ? "Ocultar" : "Mostrar"}
        </button>
      </div>
      {strength && strength.level >= 0 && (
        <div className={`auth-strength is-${strength.level}`} aria-live="polite">
          <span><i /><i /><i /></span>
          <small>Força da senha: {strength.label}</small>
        </div>
      )}
    </div>
  );
}
