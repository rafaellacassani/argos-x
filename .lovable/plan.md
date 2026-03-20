

## Plan: Upgrade Bot Settings from Side Sheet to Dialog + Add Delay Option

### What changes

1. **Replace `Sheet` with `Dialog` (centered popup)**
   - In `SalesBotBuilder.tsx`, swap the `Sheet`/`SheetContent`/`SheetTrigger` for `Dialog`/`DialogContent`/`DialogTrigger`
   - The settings will appear as a centered modal popup instead of a right-side panel
   - More responsive across desktop and mobile

2. **Add a "Save" button inside the dialog**
   - Place a footer with "Cancelar" and "Salvar configurações" buttons
   - On save: persist trigger settings, close dialog, mark `hasChanges = true`

3. **Add execution delay option for `stage_change` trigger**
   - New field in `triggerConfig`: `delay_minutes` (number, default `0`)
   - UI: Radio/toggle for "Imediatamente" vs "Após um tempo"
   - When "Após um tempo" is selected, show number input + unit selector (minutos / horas / dias)
   - The value is stored as minutes in `triggerConfig.delay_minutes`
   - This delay will be respected by the execution engine (already supports `trigger_delay_minutes` pattern from stage automations)

### Files to modify

- **`src/pages/SalesBotBuilder.tsx`**: Replace Sheet with Dialog, add save button, add delay UI for stage_change trigger

### Technical details

- Reuse existing `Dialog`/`DialogContent` components already in the project
- Delay unit conversion: hours × 60, days × 1440 → stored as minutes
- The `triggerConfig.delay_minutes` field follows the same pattern as `trigger_delay_minutes` in funnel automations, so the execution engine can read it directly

