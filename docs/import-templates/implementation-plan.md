# Batch Import Implementation Plan

## Goals

Add an import surface that lets users maintain Obsidian Gallery from a desktop spreadsheet:

- Fill or update paint ownership in the vault.
- Create custom paints.
- Create projects and units in bulk.
- Create reusable recipes with ordered recipe steps and paint ratios.
- Attach recipes and paints to unit progress stages.

The import should feel forgiving: users can upload a workbook, preview what will happen, fix row-level errors, and then commit only valid rows.

## Workbook Model

Use a multi-sheet `.xlsx` workbook with stable sheet names. Each data row should support a user-friendly external key so sheets can refer to each other before database IDs exist.

Full importer sheets:

- `Paint Collection`: catalog paint ownership by brand, line, sku, barcode, or paint name.
- `Custom Paints`: user-owned custom paints not found in the catalog.
- `Projects`: project shells.
- `Units`: unit shells linked to one or more projects.
- `Recipes`: recipe headers.
- `Recipe Steps`: ordered recipe steps.
- `Recipe Step Paints`: paints used in each step, including ratio text.
- `Unit Stage Links`: recipes or loose paints attached to unit stages.

Helper-only sheets:

- `Reference`: allowed statuses, stage keys, paint sources, and import actions.
- `Instructions`: short import guidance and matching rules.

Recipe importer first slice:

- Use `recipes-import-template.xlsx`.
- Keep exactly three sheets: `Guide`, `Example Recipe`, and `Fill In`.
- The user-editable `Fill In` sheet is one flattened table where each row represents one recipe step.
- Recipe-level fields repeat on each step row.
- Each step row has three paint slots, matching the current recipe UI.
- Inline custom paint fields are allowed in paint slots so users do not need a separate custom-paint sheet for recipe import.

## Import Flow

1. User downloads a template from a new import page, likely `/settings/import` or `/vault/import`.
2. User fills the workbook in Excel, Numbers, LibreOffice, or Google Sheets.
3. User uploads the workbook.
4. Server parses workbook into normalized rows and returns a preview:
   - rows to create
   - rows to update
   - rows skipped
   - row-level warnings and blocking errors
5. User confirms the import.
6. Server executes a single import job in dependency order:
   - resolve catalog paints
   - create custom paints
   - upsert paint ownership
   - upsert projects
   - upsert units and `unit_projects`
   - ensure default `unit_progress_steps`
   - upsert recipes
   - recreate or append recipe steps and `recipe_step_paints`
   - upsert `unit_stage_recipes` and insert `unit_stage_paints`
7. Import result is saved for audit and shown as a downloadable report.

## Matching Rules

Paint catalog resolution should accept, in priority order:

1. `catalog_paint_id`
2. exact `barcode`
3. exact `sku` plus optional brand/line
4. normalized brand + line + paint name
5. normalized brand + paint name

Custom paint resolution should accept:

1. `custom_paint_key`
2. exact existing custom paint name plus manufacturer/series

Project, unit, and recipe references should prefer the spreadsheet keys:

- `project_key`
- `unit_key`
- `recipe_key`
- `custom_paint_key`

These keys do not need to be stored permanently at first. During one import job they can be kept in memory and mapped to created row IDs.

## Data Rules

Paint collection:

- `ownership_status` accepts `owned`, `wishlist`, `unowned`.
- `quantity` is required when owned and defaults to `1`.
- Wishlist can coexist with owned if the existing product model continues to allow it.

Projects:

- `project_key` and `name` are required.
- Import should create if the project name does not exist for the user.

Units:

- `unit_key`, `name`, and one project reference are required.
- `project_keys` may be comma-separated to populate `unit_projects`.
- `status` accepts `active`, `bench`, `pile`, `complete`, `other`.
- `stage_*` columns can pre-mark progress steps.

Recipes:

- `recipe_key` and `name` are required.
- `is_public` defaults to `false`.
- Recipe steps are ordered by `step_number`.
- Step paints can reference catalog or custom paints and use freeform `ratio_text`.

Unit stage links:

- `stage_key` accepts `assembled`, `primed`, `initial_paints`, `fine_details`, `base_rim`, `done`.
- A row may attach a recipe or a paint to a unit stage.
- When attaching a recipe, use `unit_stage_recipes` with `onConflict: progress_step_id`.
- When attaching a paint, insert into `unit_stage_paints` if it is not already present for that stage.

## Backend Shape

Add a parser module:

- `utils/import-workbooks/types.ts`
- `utils/import-workbooks/parse-workbook.ts`
- `utils/import-workbooks/validate-import.ts`
- `utils/import-workbooks/resolve-paints.ts`
- `utils/import-workbooks/execute-import.ts`

Use `jszip` plus a small XLSX reader, or add a maintained parser dependency such as `xlsx` or `exceljs`. Prefer a server-only parser so workbook contents never need to be processed in the browser.

Add API routes or server actions:

- `POST /api/import/preview`
- `POST /api/import/commit`

Persist import jobs:

- `import_jobs`: user_id, filename, status, counts, started_at, completed_at
- `import_job_rows`: job_id, sheet_name, row_number, severity, message, raw_row JSONB

## UI Shape

Add an import page with:

- template download buttons
- upload dropzone
- preview table grouped by sheet
- filters for errors/warnings/creates/updates
- confirm import button
- final result summary and report download

Keep this utilitarian. The main user need is confidence before committing a large data change.

## First Implementation Slice

1. Add template downloads.
2. Add preview-only parsing and row validation.
3. Support paint ownership import.
4. Add custom paints.
5. Add projects and units.
6. Add recipes and recipe steps.
7. Add unit stage recipe/paint links.
8. Add import job persistence and reports.

This sequence creates usable value early while keeping the higher-risk relational imports behind the preview system.
