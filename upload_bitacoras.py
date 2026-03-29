import os
import subprocess
import json

FOLDER_ID = "11np-13y-dzmjLSp8m-xwoNykcfulGSax"
BITACORAS_DIR = r"c:\6. Viaje a san andres\3.Sistema-pae-barroblanco v-vercel-Converting to Progressive Web App (PWA)\1. Documentos practica\bitacoras_generadas"

# Get all .xlsx files in the directory
files = [f for f in os.listdir(BITACORAS_DIR) if f.endswith('.xlsx')]

for filename in files:
    file_path = os.path.join(BITACORAS_DIR, filename)
    
    # Construct the JSON metadata
    metadata = {
        "name": filename,
        "parents": [FOLDER_ID]
    }
    metadata_json = json.dumps(metadata)
    
    # Build the command
    # gws drive files create --json '<metadata>' --upload '<file_path>'
    cmd = [
        "gws", "drive", "files", "create",
        "--json", metadata_json,
        "--upload", file_path
    ]
    
    print(f"Uploading {filename}...")
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True, shell=True)
        print(f"Successfully uploaded {filename}")
    except subprocess.CalledProcessError as e:
        print(f"Error uploading {filename}: {e.stderr}")
