import type { TriState } from '../../types/safetyChecklist'
import { TRI_STATE_LABELS } from '../../types/safetyChecklist'

type Props = {
  label: string
  name: string
  value: TriState | null
  disabled?: boolean
  onChange: (value: TriState) => void
  error?: string | null
}

const OPTIONS: TriState[] = ['yes', 'no', 'na']

export function TriStateField({
  label,
  name,
  value,
  disabled,
  onChange,
  error,
}: Props) {
  return (
    <fieldset
      className={`tri-field${error ? ' is-invalid' : ''}`}
      disabled={disabled}
      aria-invalid={error ? true : undefined}
    >
      <legend className="tri-field__legend">{label}</legend>
      <div className="tri-field__options" role="radiogroup" aria-label={label}>
        {OPTIONS.map((opt) => {
          const id = `${name}-${opt}`
          return (
            <label key={opt} htmlFor={id} className="tri-field__option touch-target">
              <input
                id={id}
                type="radio"
                name={name}
                value={opt}
                checked={value === opt}
                disabled={disabled}
                onChange={() => onChange(opt)}
              />
              <span>{TRI_STATE_LABELS[opt]}</span>
            </label>
          )
        })}
      </div>
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </fieldset>
  )
}
