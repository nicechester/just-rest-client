#!/usr/bin/env python3
"""
Just REST Client - Export File Migration Script

Migrates exported JSON files from old format (single script IDs) to new format (script ID arrays).

Old format:
  {
    "preScriptId": "script-123",
    "postScriptId": "script-456"
  }

New format:
  {
    "preScriptIds": ["script-123"],
    "postScriptIds": ["script-456", "script-789"]
  }

Usage:
    python migrate_export.py input.json output.json
    
Example:
    python migrate_export.py old-export.json migrated-export.json
"""

import json
import sys
from datetime import datetime
from pathlib import Path


def migrate_request(request):
    """
    Migrate a single request object from old format to new format.
    
    Args:
        request (dict): Request object to migrate
        
    Returns:
        dict: Migrated request object
    """
    migrated = request.copy()
    
    # Migrate preScriptId to preScriptIds
    if 'preScriptId' in request:
        # Convert single ID to array (empty string becomes empty array)
        migrated['preScriptIds'] = [request['preScriptId']] if request['preScriptId'] else []
        del migrated['preScriptId']
    elif 'preScriptIds' not in migrated:
        # Ensure preScriptIds exists even if not in old format
        migrated['preScriptIds'] = []
    
    # Migrate postScriptId to postScriptIds  
    if 'postScriptId' in request:
        # Convert single ID to array (empty string becomes empty array)
        migrated['postScriptIds'] = [request['postScriptId']] if request['postScriptId'] else []
        del migrated['postScriptId']
    elif 'postScriptIds' not in migrated:
        # Ensure postScriptIds exists even if not in old format
        migrated['postScriptIds'] = []
    
    return migrated


def migrate_export(data):
    """
    Migrate entire export file.
    
    Args:
        data (dict): Export data structure
        
    Returns:
        tuple: (migrated_data, migrated_count)
    """
    migrated_count = 0
    
    if 'requests' in data and isinstance(data['requests'], list):
        original_requests = data['requests'][:]
        data['requests'] = []
        
        for req in original_requests:
            migrated_req = migrate_request(req)
            data['requests'].append(migrated_req)
            
            # Count if migration actually happened
            if 'preScriptId' in req or 'postScriptId' in req:
                migrated_count += 1
    
    # Update metadata
    if 'metadata' not in data:
        data['metadata'] = {}
    
    data['metadata']['migrated'] = True
    data['metadata']['migratedAt'] = datetime.utcnow().isoformat() + 'Z'
    data['metadata']['originalVersion'] = data['metadata'].get('version', '1.0')
    data['metadata']['version'] = '2.0'
    
    return data, migrated_count


def main():
    """Main execution function"""
    if len(sys.argv) != 3:
        print("Just REST Client - Export Migration Tool")
        print()
        print("Usage: python migrate_export.py <input.json> <output.json>")
        print()
        print("Example:")
        print("  python migrate_export.py rest-client-export-old.json rest-client-export-new.json")
        print()
        sys.exit(1)
    
    input_file = Path(sys.argv[1])
    output_file = Path(sys.argv[2])
    
    try:
        # Check if input file exists
        if not input_file.exists():
            print(f"✗ Error: Input file not found: {input_file}")
            sys.exit(1)
        
        # Check if output file already exists
        if output_file.exists():
            response = input(f"⚠ Warning: {output_file} already exists. Overwrite? (y/N): ")
            if response.lower() != 'y':
                print("Migration cancelled.")
                sys.exit(0)
        
        print(f"Reading {input_file}...")
        
        # Read input file
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Validate structure
        if not isinstance(data, dict):
            print("✗ Error: Invalid export file format (root must be an object)")
            sys.exit(1)
        
        # Migrate
        print("Migrating requests...")
        migrated_data, count = migrate_export(data)
        
        # Write output file
        print(f"Writing {output_file}...")
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(migrated_data, f, indent=2, ensure_ascii=False)
        
        # Success summary
        print()
        print("✓ Migration complete!")
        print(f"  - Total requests: {len(data.get('requests', []))}")
        print(f"  - Migrated requests: {count}")
        print(f"  - Output written to: {output_file}")
        
        if count == 0:
            print()
            print("ℹ Note: No requests needed migration (already in new format)")
        
    except FileNotFoundError:
        print(f"✗ Error: File not found: {input_file}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"✗ Error: Invalid JSON in {input_file}")
        print(f"  {e}")
        sys.exit(1)
    except PermissionError:
        print(f"✗ Error: Permission denied accessing files")
        sys.exit(1)
    except Exception as e:
        print(f"✗ Error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
