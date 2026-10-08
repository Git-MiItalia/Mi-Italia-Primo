/* The portal's on/off switch.
 *
 * This markup was written out eight separate times — VariantsStock, AddProduct,
 * Engagement, Markdowns, PriceTags, Notifications, Integrations (twice),
 * PolicyEditorModal (twice), ProductAIModelStudio and AIModelStudio. Identical
 * every time apart from the disabled variant. Eight copies means a change to
 * the markup or the class names has to be made eight times, and the eighth is
 * the one that gets missed.
 *
 * `onToggle` is optional on purpose: several call sites put the click handler on
 * the surrounding row instead, so the switch itself must not take one — adding
 * one there would fire the row's handler twice.
 *
 * `disabled` greys it out and removes its own handler. It does NOT stop a
 * parent row's handler, so a caller that disables the switch must also guard
 * whatever sits around it.
 *
 * Styling lives in app-additions.css under .toggle / .toggle-knob /
 * .toggle-disabled, so the rendered result is unchanged from every copy it
 * replaces.
 */
export default function Toggle({ on, onToggle, disabled }) {
  return (
    <div
      className={`toggle${on ? ' on' : ''}${disabled ? ' toggle-disabled' : ''}`}
      onClick={disabled ? undefined : onToggle}
    >
      <div className="toggle-knob" />
    </div>
  )
}
