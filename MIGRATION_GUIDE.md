# Migration Guide: Multiple Scripts per Request

This guide explains the migration from single script per request to multiple scripts per request (v2.0).

## What Changed?

### Old Format (v1.0)
Each request could have at most ONE pre-request script and ONE post-request script:

```json
{
  "id": "req-123",
  "title": "Get User Token",
  "preScriptId": "script-456",
  "postScriptId": "script-789"
}
```

### New Format (v2.0)
Each request can now have MULTIPLE scripts that run in order:

```json
{
  "id": "req-123",
  "title": "Get User Token",
  "preScriptIds": ["script-setup", "script-auth"],
  "postScriptIds": ["script-extract", "script-validate", "script-notify"]
}
```

## Migration Strategy

Your data will be automatically migrated in three ways:

### 1. Automatic Migration on App Load

When you load the app after updating:
- The app automatically detects old format in localStorage
- Converts `preScriptId` → `preScriptIds: [...]`
- Converts `postScriptId` → `postScriptIds: [...]`
- Your data is preserved and upgraded transparently

**No action needed** - this happens automatically!

### 2. Import-Time Migration

When you import an old export file:
- The import function detects old format
- Automatically migrates before saving
- Your imported data works immediately

**No action needed** - just import as normal!

### 3. Offline Migration (Optional)

If you have exported JSON files you want to migrate offline:

```bash
# Migrate a single file
python migrate_export.py old-export.json new-export.json

# The script:
# - Reads your old export file
# - Converts all requests to new format
# - Writes a new file you can re-import
```

## Recommended Workflow

### Before Updating (IMPORTANT)

1. **Export your current data**:
   - Click "Export All" button
   - Save the JSON file as `backup-v1.json`
   - Keep this as a backup!

### After Updating

1. **Load the app** - Migration happens automatically
2. **Verify your requests** - Check that scripts are still attached
3. **Test execution** - Send a request to verify scripts run correctly

### If Something Goes Wrong

1. **You have your backup** from step 1
2. **Revert to old version** if needed
3. **Re-import your backup** - It will be migrated on import

## New Features

### Multiple Scripts per Request

- Add multiple pre-request scripts that run in sequence
- Add multiple post-request scripts that run in sequence
- Scripts run from top to bottom

### Script Reordering

- Drag and drop scripts to change execution order
- Click ⋮⋮ icon and drag to reorder
- Remove scripts with ✕ button

### Script Search

- Search scripts by name in the Scripts tab
- Type in the search box to filter
- Makes finding scripts in large collections easy

## Testing Your Migration

After migration, test that:

1. ✅ Old requests still load correctly
2. ✅ Scripts are attached (check script lists in request builder)
3. ✅ Scripts execute in the right order
4. ✅ Variables are set/read correctly
5. ✅ Import/export still works

## Backward Compatibility

The new code is fully backward compatible:
- Old format data migrates automatically
- You can still use single scripts (just a 1-element array)
- No data loss during migration
- Old export files can be imported directly

## Troubleshooting

### Issue: Scripts not showing in request

**Solution**: The script might have been deleted. Check the Scripts tab to verify it still exists.

### Issue: Script runs in wrong order

**Solution**: Use drag-and-drop to reorder scripts in the request builder.

### Issue: Old export file won't import

**Solution**: Use the Python migration script first:
```bash
python migrate_export.py old-file.json migrated-file.json
```
Then import `migrated-file.json`.

### Issue: Want to roll back

**Solution**: 
1. Import your v1.0 backup
2. The app will migrate it automatically
3. Or revert your git commit if you haven't pushed

## Python Migration Script Details

### Requirements
- Python 3.6 or higher
- No additional packages needed (uses standard library)

### Usage

```bash
python migrate_export.py <input.json> <output.json>
```

### Example

```bash
# Migrate a backup file
python migrate_export.py rest-client-export-1234567890.json rest-client-export-migrated.json

# Output:
# ✓ Migration complete!
#   - Total requests: 25
#   - Migrated requests: 18
#   - Output written to: rest-client-export-migrated.json
```

### What It Does

1. Reads your export JSON file
2. For each request:
   - Converts `preScriptId` to `preScriptIds: [...]`
   - Converts `postScriptId` to `postScriptIds: [...]`
   - Removes old fields
3. Updates metadata (version → 2.0)
4. Writes new file with migrated data

### Safety

- Original file is never modified
- Creates new output file
- Prompts before overwriting existing files
- Validates JSON before processing

## Version History

- **v1.0**: Single script per request (`preScriptId`, `postScriptId`)
- **v2.0**: Multiple scripts per request (`preScriptIds: []`, `postScriptIds: []`)

## Need Help?

1. Check your browser console for migration messages
2. Look for `[Migration] Migrated old requests...` message
3. Open an issue on GitHub with your export file (remove sensitive data first)
