import { B } from './bushido';
import { MAX_HABIT_NAME, REQUIRED_HABITS } from './habits';

export function HabitNameFields(props: {
  count: number;
  names: string[];
  onChange: (names: string[]) => void;
}) {
  return (
    <div className="bsh-stack">
      <p className="body-md">چهار عادت اجباری: {REQUIRED_HABITS.join('، ')}</p>
      <B.TextField
        label="عادت پنجم (انتخاب از بانک عادات)"
        placeholder="نام عادت انتخابی فرد را بنویس"
        maxLength={MAX_HABIT_NAME}
        value={props.names[4] || ''}
        onChange={(e) => props.onChange([...REQUIRED_HABITS, e.target.value])}
      />
    </div>
  );
}
