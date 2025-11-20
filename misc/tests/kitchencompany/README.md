Kitchen Company — Equipment test data and manuals

This folder contains test equipment data and links to manufacturer manuals.

Files:
- `equipment.json` — array of equipment objects matching `CreateEquipmentRequest` fields from `src/types/equipment.ts`.
- `manual_links.json` — suggested search queries and example support URLs for each device.

How to download manuals (PowerShell examples):

1. Find the correct manual URL for the device (use the `search_query` from `manual_links.json`).
2. Download the manual (PDF or HTML) into this folder. Example PowerShell commands:

```powershell
# Replace <manual_url> and <output_file.pdf> with the real URL and target filename
Invoke-WebRequest -Uri "<manual_url>" -OutFile "misc\\tests\\kitchencompany\\<output_file.pdf>"
```

If you want me to fetch manuals automatically, provide the direct manual URLs (PDF or HTML). I can then download them and save them into this folder and update `manual_links.json` with the final saved filenames.

Notes:
- The `equipment.json` entries are safe sample data; update `serial_number` and `model` fields to match actual units for accurate record-keeping.
- The project expects create requests shaped like `CreateEquipmentRequest` (see `src/types/equipment.ts`). You can use `equipment.json` to seed the DB or call the API endpoints.
